const h = require("./helpers");
const { test, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.AUTO_CONFIRM_HOURS = "72";
const Stripe = require("stripe");
const { setStripeForTests } = require("../utils/stripe");
const mailer = require("../utils/mailer");
const { flush } = require("../utils/notify");
const { codeFor } = require("../utils/handover");
const { app } = require("../app");
const { request, prisma, createUser, loginToken } = h;

after(h.cleanup);

const real = Stripe("sk_test_dummy");
let outbox;
let failMail = false;
beforeEach(() => {
  outbox = [];
  failMail = false;
  mailer.sendMail = async (m) => {
    if (failMail) throw new Error("smtp down");
    outbox.push(m);
    return { sent: true };
  };
  setStripeForTests({
    checkout: { sessions: { create: async () => ({ id: `cs_n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, url: "https://checkout.stripe.test/x" }) } },
    refunds: { create: async () => ({ id: "re_1" }) },
    webhooks: real.webhooks,
  });
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
const rnd = () => `${process.pid}_${Date.now()}_${seq++}`;
const person = async (role = "user") => {
  const u = await createUser({ role });
  await prisma.user.update({ where: { id: u.id }, data: { isVerified: true } });
  return { ...u, token: await loginToken(app, u) };
};
const to = (u) => outbox.filter((m) => m.to === u.email);

async function job(sender, traveler, extra = {}) {
  const d = await prisma.delivery.create({
    data: { senderId: sender.id, pickup: "Oakland", dropoff: "Austin", itemType: "book", size: "small", weight: 1, paymentStatus: "paid", status: "accepted", travelerId: traveler.id, handoverSalt: `salt${rnd()}`, ...extra },
  });
  await prisma.payment.create({ data: { deliveryId: d.id, userId: sender.id, amountCents: 1000, currency: "usd", status: "paid", stripeSessionId: `cs_${rnd()}`, stripePaymentIntentId: `pi_${rnd()}`, paidAt: new Date() } });
  return d;
}

test("the paid webhook emails the sender, once, and only after the payment is recorded", async () => {
  const sender = await person();
  const d = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1 } });
  const co = await request(app).post("/api/payments/create-checkout-session").set(auth(sender.token)).send({ deliveryId: d.id });
  const pay = await prisma.payment.findUnique({ where: { id: co.body.paymentId } });
  const send = (id) => {
    const payload = JSON.stringify({ id, type: "checkout.session.completed", data: { object: { id: pay.stripeSessionId, payment_status: "paid", amount_total: pay.amountCents, currency: pay.currency, payment_intent: `pi_${rnd()}` } } });
    const sig = real.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    return request(app).post("/api/payments/webhook").set("Content-Type", "application/json").set("stripe-signature", sig).send(payload);
  };

  const evt = `evt_n_${rnd()}`;
  assert.equal((await send(evt)).status, 200);
  await flush();
  assert.equal(to(sender).length, 1);
  assert.match(to(sender)[0].subject, /Payment received/);

  assert.equal((await send(evt)).body.duplicate, true); // Stripe retries the same event
  await flush();
  assert.equal(to(sender).length, 1, "a replayed event must not email again");
});

test("an unsigned (forged) webhook sends no email", async () => {
  await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").send("{}");
  await flush();
  assert.equal(outbox.length, 0);
});

test("accepting a job emails the sender with the traveler's first name only", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, paymentStatus: "paid" } });
  const res = await request(app).patch(`/api/deliveries/${d.id}/accept`).set(auth(traveler.token));
  assert.equal(res.status, 200);
  await flush();
  const [mail] = to(sender);
  assert.match(mail.subject, /accepted/);
  assert.ok(!mail.html.includes(traveler.email), "never reveal the traveler's email");
  assert.equal(to(traveler).length, 0);
});

test("a failed accept (already taken) sends nothing", async () => {
  const sender = await person();
  const t1 = await person();
  const t2 = await person();
  const d = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, paymentStatus: "paid" } });
  await request(app).patch(`/api/deliveries/${d.id}/accept`).set(auth(t1.token));
  await flush();
  outbox.length = 0;
  assert.equal((await request(app).patch(`/api/deliveries/${d.id}/accept`).set(auth(t2.token))).status, 409);
  await flush();
  assert.equal(outbox.length, 0);
});

test("delivered tells the sender the auto-confirm window and the traveler what happens next; wrong code sends nothing", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);

  await request(app).patch(`/api/deliveries/${d.id}/complete`).set(auth(traveler.token)).send({ code: codeFor(d.id, d.handoverSalt) === "000000" ? "111111" : "000000" });
  await flush();
  assert.equal(outbox.length, 0);

  const ok = await request(app).patch(`/api/deliveries/${d.id}/complete`).set(auth(traveler.token)).send({ code: codeFor(d.id, d.handoverSalt) });
  assert.equal(ok.status, 200);
  await flush();
  assert.match(to(sender)[0].html, /72 hours/);
  assert.match(to(traveler)[0].subject, /payout is next/);
});

test("confirming emails the traveler; disputing emails sender, traveler and every admin with the reason escaped", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");
  const a = await job(sender, traveler, { status: "delivered", deliveredAt: new Date() });
  assert.equal((await request(app).post(`/api/deliveries/${a.id}/confirm`).set(auth(sender.token))).status, 200);
  await flush();
  assert.match(to(traveler)[0].subject, /payout is due/);
  assert.equal(to(sender).length, 0);

  outbox.length = 0;
  const b = await job(sender, traveler, { status: "in-transit" });
  const res = await request(app).post(`/api/deliveries/${b.id}/dispute`).set(auth(sender.token)).send({ reason: "never came <script>alert(1)</script>" });
  assert.equal(res.status, 200);
  await flush();
  assert.equal(to(sender).length, 1);
  assert.equal(to(traveler).length, 1);
  const adminMail = to(admin);
  assert.equal(adminMail.length, 1);
  assert.ok(!adminMail[0].html.includes("<script>"), "user text must be escaped in the HTML");
  assert.match(adminMail[0].html, /&lt;script&gt;/);
});

test("admin release, refund and payout each email the right people", async () => {
  const sender = await person();
  const traveler = await person();
  const admin = await person("admin");

  const rel = await job(sender, traveler, { status: "disputed", disputedAt: new Date(), disputeReason: "x" });
  const r1 = await request(app).post(`/api/admin/disputes/${rel.id}/resolve`).set(auth(admin.token)).send({ action: "release", note: "photo proves it" });
  assert.equal(r1.status, 200);
  await flush();
  assert.match(to(traveler)[0].subject, /payout is due/);

  outbox.length = 0;
  const ref = await job(sender, traveler, { status: "disputed", disputedAt: new Date(), disputeReason: "x" });
  const r2 = await request(app).post(`/api/admin/disputes/${ref.id}/resolve`).set(auth(admin.token)).send({ action: "refund", note: "lost" });
  assert.equal(r2.status, 200);
  await flush();
  assert.match(to(sender)[0].subject, /refunded/);
  assert.match(to(traveler)[0].subject, /no payout|refunded/i);

  outbox.length = 0;
  const pay = await job(sender, traveler, { status: "confirmed", confirmedAt: new Date() });
  const r3 = await request(app).post(`/api/admin/payouts/${pay.id}`).set(auth(admin.token)).send({ reference: "WIRE-123" });
  assert.equal(r3.status, 201);
  await flush();
  const mail = to(traveler)[0];
  assert.match(mail.subject, /\$8\.00/); // $10.00 less the 20% platform fee
  assert.match(mail.html, /WIRE-123/);

  outbox.length = 0;
  assert.equal((await request(app).post(`/api/admin/payouts/${pay.id}`).set(auth(admin.token)).send({ reference: "again" })).status, 409);
  await flush();
  assert.equal(outbox.length, 0, "a rejected second payout must not email");
});

test("a mail outage never fails the request or loses the state change", async () => {
  failMail = true;
  const sender = await person();
  const traveler = await person();
  const d = await job(sender, traveler);
  const res = await request(app).patch(`/api/deliveries/${d.id}/complete`).set(auth(traveler.token)).send({ code: codeFor(d.id, d.handoverSalt) });
  assert.equal(res.status, 200);
  await flush();
  assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).status, "delivered");
});

// ------------------------------------------------------------------------------------------------ time-based emails
const { sweep } = require("../utils/sweep");
const HOUR = 3600 * 1000;
const ago = (h) => new Date(Date.now() - h * HOUR);

test("the sweep reminds the sender in the last day of the window, once, and never earlier", async () => {
  const sender = await person();
  const traveler = await person();
  const early = await job(sender, traveler, { status: "delivered", deliveredAt: ago(10) }); // 62h left
  const late = await job(sender, traveler, { status: "delivered", deliveredAt: ago(60) }); // 12h left

  await sweep();
  await flush();
  const mails = to(sender);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Reminder/);
  assert.equal((await prisma.delivery.findUnique({ where: { id: early.id } })).reminderSentAt, null);
  assert.ok((await prisma.delivery.findUnique({ where: { id: late.id } })).reminderSentAt);

  await sweep();
  await flush();
  assert.equal(to(sender).length, 1, "a second pass must not remind again");
});

test("two overlapping sweeps still send a reminder only once", async () => {
  const sender = await person();
  const traveler = await person();
  await job(sender, traveler, { status: "delivered", deliveredAt: ago(60) });
  await Promise.all([sweep(), sweep(), sweep()]);
  await flush();
  assert.equal(to(sender).length, 1);
});

test("when the window passes in silence, sender and traveler are told once; disputed and unpaid ones are left alone", async () => {
  const sender = await person();
  const traveler = await person();
  const quiet = await job(sender, traveler, { status: "delivered", deliveredAt: ago(80) });
  await job(sender, traveler, { status: "disputed", deliveredAt: ago(80), disputedAt: new Date() });
  await job(sender, traveler, { status: "delivered", deliveredAt: ago(80), paymentStatus: "refunded" });

  await sweep();
  await flush();
  assert.equal(to(sender).length, 1);
  assert.match(to(sender)[0].subject, /automatically/);
  assert.equal(to(traveler).length, 1);
  assert.match(to(traveler)[0].subject, /payout is due/);
  assert.ok((await prisma.delivery.findUnique({ where: { id: quiet.id } })).autoConfirmNoticeAt);

  await sweep();
  await flush();
  assert.equal(to(sender).length, 1);
  assert.equal(to(traveler).length, 1);
});

test("a delivery the sender already confirmed gets no reminder", async () => {
  const sender = await person();
  const traveler = await person();
  await job(sender, traveler, { status: "confirmed", deliveredAt: ago(60), confirmedAt: ago(50) });
  await sweep();
  await flush();
  assert.equal(outbox.filter((m) => [sender.email, traveler.email].includes(m.to)).length, 0);
});
