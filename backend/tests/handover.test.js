const h = require("./helpers");
const { test, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
const { app } = require("../app");
const { setStripeForTests } = require("../utils/stripe");
const { codeFor } = require("../utils/handover");
const { payoutReadyWhere, splitAmount } = require("../utils/payouts");
const { request, prisma, createUser, loginToken } = h;

after(h.cleanup);

const HOUR = 3600 * 1000;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const person = async (role = "user") => {
  const u = await createUser({ role });
  await prisma.user.update({ where: { id: u.id }, data: { isVerified: true } });
  return { ...u, token: await loginToken(app, u) };
};
let seq = 0;
const rnd = () => `${process.pid}_${Date.now()}_${seq++}`;

/** A paid delivery already taken by `traveler`, with a salt (so a code exists). Extra fields override. */
async function job(sender, traveler, extra = {}) {
  const d = await prisma.delivery.create({
    data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, paymentStatus: "paid", status: "accepted", travelerId: traveler.id, handoverSalt: `salt${rnd()}`, ...extra },
  });
  await prisma.payment.create({ data: { deliveryId: d.id, userId: sender.id, amountCents: 1000, currency: "usd", status: "paid", stripeSessionId: `cs_${rnd()}`, stripePaymentIntentId: `pi_${rnd()}`, paidAt: new Date() } });
  return d;
}
const row = (id) => prisma.delivery.findUnique({ where: { id } });
const complete = (id, token, code) => request(app).patch(`/api/deliveries/${id}/complete`).set(auth(token)).send(code === undefined ? {} : { code });
const wrongCode = (d) => (codeFor(d.id, d.handoverSalt) === "000000" ? "111111" : "000000");

let refunds;
beforeEach(() => {
  refunds = [];
  setStripeForTests({ refunds: { create: async (params, opts) => { refunds.push({ params, opts }); return { id: `re_${refunds.length}` }; } } });
});

// ------------------------------------------------------------------------------------------------ the code
test("only the sender can see the handover code, and only while the package is being carried", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const d = await job(sender, traveler);

  const ok = await request(app).get(`/api/deliveries/${d.id}/handover-code`).set(auth(sender.token));
  assert.equal(ok.status, 200);
  assert.match(ok.body.code, /^\d{6}$/);
  assert.equal(ok.body.code, codeFor(d.id, d.handoverSalt));
  assert.equal((await request(app).get(`/api/deliveries/${d.id}/handover-code`).set(auth(sender.token))).body.code, ok.body.code, "stable between calls");

  for (const who of [traveler, stranger]) {
    assert.equal((await request(app).get(`/api/deliveries/${d.id}/handover-code`).set(auth(who.token))).status, 404, "the traveler must get the code from the recipient, not the app");
  }
  assert.equal((await request(app).get(`/api/deliveries/${d.id}/handover-code`)).status, 401);

  const pending = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1, paymentStatus: "paid" } });
  assert.equal((await request(app).get(`/api/deliveries/${pending.id}/handover-code`).set(auth(sender.token))).status, 404, "not before a traveler accepts");
  await prisma.delivery.update({ where: { id: d.id }, data: { status: "delivered" } });
  assert.equal((await request(app).get(`/api/deliveries/${d.id}/handover-code`).set(auth(sender.token))).status, 404, "not after delivery");
});

test("accepting issues a salt; the code differs per delivery; the salt never appears in any response", async () => {
  const sender = await person();
  const traveler = await person();
  const open = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1, paymentStatus: "paid" } });
  const accept = await request(app).patch(`/api/deliveries/${open.id}/accept`).set(auth(traveler.token));
  assert.equal(accept.status, 200);
  assert.ok((await row(open.id)).handoverSalt, "a salt must be issued when a traveler accepts");
  assert.ok(!("handoverSalt" in accept.body.delivery) && !("handoverAttempts" in accept.body.delivery));

  const mine = await request(app).get("/api/deliveries/mine").set(auth(sender.token));
  assert.ok(!JSON.stringify(mine.body).includes("handoverSalt"));
  const asTraveler = await request(app).get("/api/request/mine").set(auth(traveler.token));
  assert.ok(!JSON.stringify(asTraveler.body).includes("handoverSalt"));

  const a = await job(sender, traveler);
  const b = await job(sender, traveler);
  assert.notEqual(codeFor(a.id, a.handoverSalt), codeFor(b.id, b.handoverSalt));
});

test("a delivery accepted before codes existed gets its salt when the sender opens the code", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler, { handoverSalt: null });
  const blocked = await complete(d.id, traveler.token, "123456");
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.msg, /ask the sender/i);
  const code = (await request(app).get(`/api/deliveries/${d.id}/handover-code`).set(auth(sender.token))).body.code;
  assert.match(code, /^\d{6}$/);
  assert.equal((await complete(d.id, traveler.token, code)).status, 200);
});

// ------------------------------------------------------------------------------------------------ completing with the code
test("delivered only with the right code; wrong or missing codes change nothing", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);

  assert.equal((await complete(d.id, traveler.token)).status, 400, "no code");
  assert.equal((await complete(d.id, traveler.token, "12ab56")).status, 400, "not six digits");
  const wrong = await complete(d.id, traveler.token, wrongCode(d));
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.msg, /4 attempts left/);
  assert.equal((await row(d.id)).status, "accepted");

  const ok = await complete(d.id, traveler.token, codeFor(d.id, d.handoverSalt));
  assert.equal(ok.status, 200);
  const after = await row(d.id);
  assert.equal(after.status, "delivered");
  assert.ok(after.deliveredAt);
  assert.ok(!("handoverSalt" in ok.body.delivery));
});

test("five wrong codes lock the delivery, even for the right code afterwards", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await complete(d.id, traveler.token, wrongCode(d))).status);
  assert.deepEqual(codes, [400, 400, 400, 400, 400]);
  const locked = await complete(d.id, traveler.token, codeFor(d.id, d.handoverSalt));
  assert.equal(locked.status, 423);
  assert.equal((await row(d.id)).status, "accepted");
});

test("parallel guesses cannot beat the attempt limit", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);
  const results = await Promise.all(Array.from({ length: 14 }, () => complete(d.id, traveler.token, wrongCode(d))));
  assert.equal(results.filter((r) => r.status === 400).length, 5, "exactly five guesses may be evaluated");
  assert.equal(results.filter((r) => r.status === 423).length, 9);
  assert.equal((await row(d.id)).handoverAttempts, 5);
});

test("an admin can complete a stuck delivery without a code; the sender and strangers cannot complete at all", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const admin = await person("admin");
  const d = await job(sender, traveler);
  const code = codeFor(d.id, d.handoverSalt);
  assert.equal((await complete(d.id, sender.token, code)).status, 409);
  assert.equal((await complete(d.id, stranger.token, code)).status, 409);
  assert.equal((await complete(d.id, admin.token)).status, 200);
});

// ------------------------------------------------------------------------------------------------ confirming and disputing
test("the sender confirms a delivered package; nobody else can, and only from 'delivered'", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const d = await job(sender, traveler);
  const confirm = (who) => request(app).post(`/api/deliveries/${d.id}/confirm`).set(auth(who.token));

  assert.equal((await confirm(sender)).status, 409, "not delivered yet");
  await prisma.delivery.update({ where: { id: d.id }, data: { status: "delivered", deliveredAt: new Date() } });
  assert.equal((await confirm(stranger)).status, 409);
  assert.equal((await confirm(traveler)).status, 409, "the traveler cannot confirm their own delivery");
  assert.equal((await confirm(sender)).status, 200);
  const after = await row(d.id);
  assert.equal(after.status, "confirmed");
  assert.ok(after.confirmedAt);
  assert.equal((await confirm(sender)).status, 409, "only once");
});

test("disputes: reason required, sender only, allowed while carrying or inside the window, not after", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const dispute = (d, who, reason = "The package never arrived at all") => request(app).post(`/api/deliveries/${d.id}/dispute`).set(auth(who.token)).send({ reason });

  const carrying = await job(sender, traveler);
  assert.equal((await dispute(carrying, sender, "short")).status, 400);
  assert.equal((await dispute(carrying, stranger)).status, 409);
  assert.equal((await dispute(carrying, traveler)).status, 409, "the traveler cannot dispute");
  assert.equal((await dispute(carrying, sender)).status, 200);
  const r = await row(carrying.id);
  assert.equal(r.status, "disputed");
  assert.match(r.disputeReason, /never arrived/);

  const recent = await job(sender, traveler, { status: "delivered", deliveredAt: new Date(Date.now() - 2 * HOUR) });
  assert.equal((await dispute(recent, sender)).status, 200);

  const late = await job(sender, traveler, { status: "delivered", deliveredAt: new Date(Date.now() - 73 * HOUR) });
  assert.equal((await dispute(late, sender)).status, 409, "the 72h window has closed");

  const confirmed = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  assert.equal((await dispute(confirmed, sender)).status, 409, "cannot dispute after confirming");
});

test("a disputed delivery cannot be confirmed or completed", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);
  await request(app).post(`/api/deliveries/${d.id}/dispute`).set(auth(sender.token)).send({ reason: "Traveler stopped replying to me" });
  assert.equal((await request(app).post(`/api/deliveries/${d.id}/confirm`).set(auth(sender.token))).status, 409);
  assert.equal((await complete(d.id, traveler.token, codeFor(d.id, d.handoverSalt))).status, 409);
});

// ------------------------------------------------------------------------------------------------ who is owed money
test("payout readiness: confirmed, or delivered and past the window; never disputed, refunded, unpaid or already paid out", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const confirmed = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  const timedOut = await job(sender, traveler, { status: "delivered", deliveredAt: new Date(Date.now() - 73 * HOUR) });
  const waiting = await job(sender, traveler, { status: "delivered", deliveredAt: new Date(Date.now() - 1 * HOUR) });
  const carrying = await job(sender, traveler);
  const disputed = await job(sender, traveler, { status: "disputed" });
  const refunded = await job(sender, traveler, { status: "confirmed", paymentStatus: "refunded" });
  const unpaid = await job(sender, traveler, { status: "confirmed", paymentStatus: "unpaid" });
  const paidOut = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  await prisma.payout.create({ data: { deliveryId: paidOut.id, travelerId: traveler.id, grossCents: 1000, feeCents: 200, netCents: 800, currency: "usd", reference: "x", paidById: admin.id } });

  const all = [confirmed, timedOut, waiting, carrying, disputed, refunded, unpaid, paidOut].map((d) => d.id);
  const ready = (await prisma.delivery.findMany({ where: { ...payoutReadyWhere(), id: { in: all } } })).map((d) => d.id).sort();
  assert.deepEqual(ready, [confirmed.id, timedOut.id].sort());
});

test("the split is whole cents and adds up", () => {
  assert.deepEqual(splitAmount(1000, 20), { grossCents: 1000, feeCents: 200, netCents: 800 });
  const odd = splitAmount(1001, 15);
  assert.equal(odd.feeCents + odd.netCents, 1001);
  assert.ok(Number.isInteger(odd.feeCents) && Number.isInteger(odd.netCents));
  assert.deepEqual(splitAmount(1000, 0), { grossCents: 1000, feeCents: 0, netCents: 1000 });
});

// ------------------------------------------------------------------------------------------------ the admin screens' API
test("admin endpoints need an admin", async () => {
  const user = await person();
  for (const [method, path] of [["get", "/api/admin/payouts/ready"], ["get", "/api/admin/payouts/history"], ["get", "/api/admin/disputes"], ["post", "/api/admin/payouts/7f9c2d44-1b0e-4f3a-9d57-0a6b1c2d3e4f"], ["post", "/api/admin/disputes/7f9c2d44-1b0e-4f3a-9d57-0a6b1c2d3e4f/resolve"]]) {
    assert.equal((await request(app)[method](path)).status, 401, `${method} ${path} without a token`);
    assert.equal((await request(app)[method](path).set(auth(user.token))).status, 403, `${method} ${path} as a normal user`);
  }
});

test("ready list shows what each traveler is owed; marking paid works once and records the split", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const d = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  const unfinished = await job(sender, traveler);

  const list = await request(app).get("/api/admin/payouts/ready").set(auth(admin.token));
  assert.equal(list.status, 200);
  const mine = list.body.find((x) => x.id === d.id);
  assert.ok(mine);
  assert.equal(list.body.find((x) => x.id === unfinished.id), undefined);
  assert.deepEqual([mine.grossCents, mine.feeCents, mine.netCents, mine.currency], [1000, 200, 800, "usd"]);
  assert.equal(mine.traveler.email, traveler.email);
  assert.ok(!JSON.stringify(list.body).includes("handoverSalt"));
  assert.ok(!JSON.stringify(list.body).includes("$2"), "no password hashes");

  const pay = (body) => request(app).post(`/api/admin/payouts/${d.id}`).set(auth(admin.token)).send(body);
  assert.equal((await pay({})).status, 400, "a payment reference is required");
  assert.equal((await pay({ reference: "ab" })).status, 400);
  const first = await pay({ reference: "Bank transfer 2026-10-26 #4471" });
  assert.equal(first.status, 201);
  assert.deepEqual([first.body.grossCents, first.body.feeCents, first.body.netCents, first.body.paidById], [1000, 200, 800, admin.id]);
  assert.equal((await pay({ reference: "Bank transfer again" })).status, 409, "no second payout");

  const after = await request(app).get("/api/admin/payouts/ready").set(auth(admin.token));
  assert.equal(after.body.find((x) => x.id === d.id), undefined);
  const history = await request(app).get("/api/admin/payouts/history").set(auth(admin.token));
  assert.ok(history.body.some((p) => p.deliveryId === d.id && p.reference.startsWith("Bank transfer 2026")));
});

test("two admins paying out the same delivery at once: exactly one payout is recorded", async () => {
  const sender = await person();
  const traveler = await person();
  const a1 = await person("admin");
  const a2 = await person("admin");
  const d = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  const results = await Promise.all([a1, a2, a1, a2].map((a, i) => request(app).post(`/api/admin/payouts/${d.id}`).set(auth(a.token)).send({ reference: `ref-${i}-abc` })));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(await prisma.payout.count({ where: { deliveryId: d.id } }), 1);
});

test("cannot pay out a delivery that is not ready", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  for (const extra of [{}, { status: "disputed" }, { status: "delivered", deliveredAt: new Date() }, { status: "confirmed", paymentStatus: "refunded" }]) {
    const d = await job(sender, traveler, extra);
    assert.equal((await request(app).post(`/api/admin/payouts/${d.id}`).set(auth(admin.token)).send({ reference: "ref-12345" })).status, 409, JSON.stringify(extra));
  }
});

test("disputes: the admin sees them and can release the money to the traveler", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const d = await job(sender, traveler);
  await request(app).post(`/api/deliveries/${d.id}/dispute`).set(auth(sender.token)).send({ reason: "Recipient says nothing arrived" });

  const list = await request(app).get("/api/admin/disputes").set(auth(admin.token));
  const item = list.body.find((x) => x.id === d.id);
  assert.match(item.disputeReason, /nothing arrived/);
  assert.equal(item.sender.email, sender.email);
  assert.equal(item.traveler.email, traveler.email);

  const resolve = (body) => request(app).post(`/api/admin/disputes/${d.id}/resolve`).set(auth(admin.token)).send(body);
  assert.equal((await resolve({ action: "release" })).status, 400, "a note is required");
  assert.equal((await resolve({ action: "keep", note: "whatever" })).status, 400);
  assert.equal((await resolve({ action: "release", note: "Recipient confirmed by phone" })).status, 200);
  const r = await row(d.id);
  assert.equal(r.status, "confirmed");
  assert.match(r.resolutionNote, /Recipient confirmed/);
  assert.equal((await resolve({ action: "release", note: "again please" })).status, 409, "already resolved");
  assert.equal((await prisma.delivery.count({ where: { ...payoutReadyWhere(), id: d.id } })), 1, "now due for payout");
});

test("disputes: a refund goes through Stripe once, closes the delivery and is never payable to the traveler", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const d = await job(sender, traveler);
  const payment = await prisma.payment.findFirst({ where: { deliveryId: d.id } });
  await request(app).post(`/api/deliveries/${d.id}/dispute`).set(auth(sender.token)).send({ reason: "The traveler never showed up" });

  const res = await request(app).post(`/api/admin/disputes/${d.id}/resolve`).set(auth(admin.token)).send({ action: "refund", note: "No-show confirmed" });
  assert.equal(res.status, 200);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].params.payment_intent, payment.stripePaymentIntentId);
  assert.equal(refunds[0].opts.idempotencyKey, `refund-${d.id}`);
  const r = await row(d.id);
  assert.deepEqual([r.status, r.paymentStatus], ["refunded", "refunded"]);
  assert.equal((await prisma.payment.findUnique({ where: { id: payment.id } })).status, "refunded");
  assert.equal(await prisma.delivery.count({ where: { ...payoutReadyWhere(), id: d.id } }), 0);
  assert.equal((await request(app).post(`/api/admin/disputes/${d.id}/resolve`).set(auth(admin.token)).send({ action: "refund", note: "second try" })).status, 409);
  assert.equal(refunds.length, 1, "no second refund");
});

test("a refund Stripe refuses changes nothing", async () => {
  setStripeForTests({ refunds: { create: async () => { throw new Error("card_declined"); } } });
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const d = await job(sender, traveler, { status: "disputed" });
  const res = await request(app).post(`/api/admin/disputes/${d.id}/resolve`).set(auth(admin.token)).send({ action: "refund", note: "Refund requested" });
  assert.equal(res.status, 502);
  assert.equal((await row(d.id)).status, "disputed");
  assert.equal((await prisma.payment.findFirst({ where: { deliveryId: d.id } })).status, "paid");
});
