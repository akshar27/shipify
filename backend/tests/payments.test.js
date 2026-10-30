const h = require("./helpers");
const { test, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.DELIVERY_FEE_CENTS = "1250";
const Stripe = require("stripe");
const { setStripeForTests } = require("../utils/stripe");
const { app } = require("../app");
const { request, prisma, createUser, loginToken } = h;

after(h.cleanup);

// A fake for the one network call we make (creating a Checkout session). Webhook signing uses Stripe's real code, offline.
const real = Stripe("sk_test_dummy");
let sessions;
beforeEach(() => {
  sessions = [];
  setStripeForTests({
    checkout: {
      sessions: {
        create: async (params) => {
          const id = `cs_test_${sessions.length + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          sessions.push({ id, params });
          return { id, url: `https://checkout.stripe.test/${id}` };
        },
      },
    },
    webhooks: real.webhooks,
  });
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const newDelivery = (sender, extra = {}) =>
  prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, ...extra } });

let evCounter = 0;
async function sendEvent(type, object, { id = `evt_test_${process.pid}_${Date.now()}_${evCounter++}`, secret = process.env.STRIPE_WEBHOOK_SECRET, tamper = false } = {}) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const sig = real.webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post("/api/payments/webhook").set("Content-Type", "application/json").set("stripe-signature", sig).send(tamper ? payload.replace("cs_", "cx_") : payload);
}

async function startCheckout(user, deliveryId) {
  const token = await loginToken(app, user);
  return request(app).post("/api/payments/create-checkout-session").set(auth(token)).send({ deliveryId });
}

// ------------------------------------------------------------------------------------------------ checkout
test("the price comes from the server: a client-sent amount is ignored", async () => {
  const sender = await createUser({ verified: true });
  await prisma.user.update({ where: { id: sender.id }, data: { isVerified: true } });
  const d = await newDelivery(sender);
  const token = await loginToken(app, sender);
  const res = await request(app).post("/api/payments/create-checkout-session").set(auth(token)).send({ deliveryId: d.id, amount: 0.01 });
  assert.equal(res.status, 200);
  const line = sessions[0].params.line_items[0].price_data;
  assert.equal(line.unit_amount, 1250);
  assert.equal(line.currency, "usd");
  const pay = await prisma.payment.findFirst({ where: { deliveryId: d.id } });
  assert.equal(pay.amountCents, 1250);
  assert.equal(pay.status, "pending");
  assert.equal(sessions[0].params.metadata.userId, sender.id);
});

test("you cannot pay for someone else's delivery (404, not a hint it exists)", async () => {
  const owner = await createUser();
  const other = await createUser();
  await prisma.user.updateMany({ where: { id: { in: [owner.id, other.id] } }, data: { isVerified: true } });
  const d = await newDelivery(owner);
  const res = await startCheckout(other, d.id);
  assert.equal(res.status, 404);
  assert.equal(sessions.length, 0);
});

test("checkout input is validated, and double-clicks reuse the open session", async () => {
  const sender = await createUser();
  await prisma.user.update({ where: { id: sender.id }, data: { isVerified: true } });
  assert.equal((await startCheckout(sender, "not-a-uuid")).status, 400);
  const d = await newDelivery(sender);
  const a = await startCheckout(sender, d.id);
  const b = await startCheckout(sender, d.id);
  assert.equal(a.status, 200);
  assert.equal(b.body.reused, true);
  assert.equal(b.body.url, a.body.url);
  assert.equal(sessions.length, 1, "a second Stripe session was created for the same delivery");
});

test("an already paid (or taken) delivery cannot be paid again", async () => {
  const sender = await createUser();
  await prisma.user.update({ where: { id: sender.id }, data: { isVerified: true } });
  const paid = await newDelivery(sender, { paymentStatus: "paid" });
  const taken = await newDelivery(sender, { status: "accepted" });
  assert.equal((await startCheckout(sender, paid.id)).status, 409);
  assert.equal((await startCheckout(sender, taken.id)).status, 409);
});

test("without Stripe configured, checkout and the webhook answer 503", async () => {
  setStripeForTests(null);
  const sender = await createUser();
  await prisma.user.update({ where: { id: sender.id }, data: { isVerified: true } });
  const d = await newDelivery(sender);
  assert.equal((await startCheckout(sender, d.id)).status, 503);
  assert.equal((await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").send("{}")).status, 503);
});

// ------------------------------------------------------------------------------------------------ webhook
async function pendingPayment() {
  const sender = await createUser();
  await prisma.user.update({ where: { id: sender.id }, data: { isVerified: true } });
  const d = await newDelivery(sender);
  const res = await startCheckout(sender, d.id);
  const pay = await prisma.payment.findUnique({ where: { id: res.body.paymentId } });
  return { sender, d, pay };
}
const completed = (pay, over = {}) => ({ id: pay.stripeSessionId, payment_status: "paid", amount_total: pay.amountCents, currency: "usd", payment_intent: `pi_${pay.id.slice(0, 8)}`, ...over });

test("redirecting to the success URL does NOT mark anything paid", async () => {
  const { sender, d } = await pendingPayment();
  const token = await loginToken(app, sender);
  const res = await request(app).get(`/api/payments/delivery/${d.id}`).set(auth(token));
  assert.equal(res.status, 200);
  assert.equal(res.body.paymentStatus, "unpaid");
  assert.equal(res.body.payments[0].status, "pending");
});

test("a correctly signed completed event marks the payment and the delivery paid", async () => {
  const { sender, d, pay } = await pendingPayment();
  const res = await sendEvent("checkout.session.completed", completed(pay));
  assert.equal(res.status, 200);
  const after = await prisma.payment.findUnique({ where: { id: pay.id } });
  assert.equal(after.status, "paid");
  assert.ok(after.paidAt);
  assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).paymentStatus, "paid");
  const status = await request(app).get(`/api/payments/delivery/${d.id}`).set(auth(await loginToken(app, sender)));
  assert.equal(status.body.paymentStatus, "paid");
});

test("forged, tampered or wrongly-signed webhooks are rejected and change nothing", async () => {
  const { d, pay } = await pendingPayment();
  const noSig = await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").send(JSON.stringify({ id: "evt_x", type: "checkout.session.completed", data: { object: completed(pay) } }));
  assert.equal(noSig.status, 400);
  assert.equal((await sendEvent("checkout.session.completed", completed(pay), { secret: "whsec_wrong" })).status, 400);
  assert.equal((await sendEvent("checkout.session.completed", completed(pay), { tamper: true })).status, 400);
  assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).paymentStatus, "unpaid");
});

test("replaying the same event is a no-op (idempotent)", async () => {
  const { pay } = await pendingPayment();
  const id = `evt_replay_${process.pid}_${Date.now()}`;
  const first = await sendEvent("checkout.session.completed", completed(pay), { id });
  const second = await sendEvent("checkout.session.completed", completed(pay), { id });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(await prisma.stripeEvent.count({ where: { id } }), 1);
});

test("an amount or currency that differs from what we asked for is not accepted as payment", async () => {
  const a = await pendingPayment();
  const b = await pendingPayment();
  assert.equal((await sendEvent("checkout.session.completed", completed(a.pay, { amount_total: 1 }))).status, 200);
  assert.equal((await sendEvent("checkout.session.completed", completed(b.pay, { currency: "jpy" }))).status, 200);
  for (const { d, pay } of [a, b]) {
    assert.equal((await prisma.payment.findUnique({ where: { id: pay.id } })).status, "pending");
    assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).paymentStatus, "unpaid");
  }
});

test("'completed' without payment_status=paid (delayed methods) is not paid yet", async () => {
  const { d, pay } = await pendingPayment();
  await sendEvent("checkout.session.completed", completed(pay, { payment_status: "unpaid" }));
  assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).paymentStatus, "unpaid");
  await sendEvent("checkout.session.async_payment_succeeded", completed(pay));
  assert.equal((await prisma.delivery.findUnique({ where: { id: d.id } })).paymentStatus, "paid");
});

test("an event for a session we never created, and unknown event types, are acknowledged without effect", async () => {
  assert.equal((await sendEvent("checkout.session.completed", { id: "cs_unknown", payment_status: "paid", amount_total: 1250, currency: "usd" })).status, 200);
  assert.equal((await sendEvent("customer.created", { id: "cus_1" })).status, 200);
});

test("expired sessions are marked expired; a full refund marks the delivery refunded", async () => {
  const e = await pendingPayment();
  await sendEvent("checkout.session.expired", { id: e.pay.stripeSessionId });
  assert.equal((await prisma.payment.findUnique({ where: { id: e.pay.id } })).status, "expired");

  const r = await pendingPayment();
  const pi = `pi_refund_${r.pay.id.slice(0, 8)}`;
  await sendEvent("checkout.session.completed", completed(r.pay, { payment_intent: pi }));
  await sendEvent("charge.refunded", { id: "ch_1", refunded: true, payment_intent: pi });
  assert.equal((await prisma.payment.findUnique({ where: { id: r.pay.id } })).status, "refunded");
  assert.equal((await prisma.delivery.findUnique({ where: { id: r.d.id } })).paymentStatus, "refunded");
});

test("payment status is visible only to the sender (or an admin)", async () => {
  const { d } = await pendingPayment();
  const stranger = await createUser();
  const admin = await createUser({ role: "admin" });
  assert.equal((await request(app).get(`/api/payments/delivery/${d.id}`).set(auth(await loginToken(app, stranger)))).status, 404);
  assert.equal((await request(app).get(`/api/payments/delivery/${d.id}`).set(auth(await loginToken(app, admin)))).status, 200);
  assert.equal((await request(app).get(`/api/payments/delivery/${d.id}`)).status, 401);
});
