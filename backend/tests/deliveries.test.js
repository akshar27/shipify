const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
const { app } = require("../app");
const { visibleToTraveler } = require("../utils/deliveryState");
const { request, prisma, createUser, loginToken } = h;

after(h.cleanup);

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const verifiedUser = async (role = "user") => {
  const u = await createUser({ role });
  await prisma.user.update({ where: { id: u.id }, data: { isVerified: true } });
  return { ...u, token: await loginToken(app, u) };
};
const newDelivery = (sender, extra = {}) =>
  prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, ...extra } });
const patch = (path, token) => request(app).patch(path).set(auth(token));
const statusOf = async (id) => (await prisma.delivery.findUnique({ where: { id } }));

// ------------------------------------------------------------------------------------------------ creating
test("creating a delivery: the sender is the caller, it starts pending and unpaid, bad input is rejected", async () => {
  const sender = await verifiedUser();
  const ok = await request(app).post("/api/deliveries").set(auth(sender.token)).send({ pickup: "SF", dropoff: "LA", itemType: "laptop", size: "medium", weight: "2.5", pickupLat: "37.77", pickupLng: "-122.4" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.senderId, sender.id);
  assert.equal(ok.body.status, "pending");
  assert.equal(ok.body.paymentStatus, "unpaid");
  assert.equal(ok.body.weight, 2.5);

  const injected = await request(app).post("/api/deliveries").set(auth(sender.token)).send({ pickup: "SF", dropoff: "LA", itemType: "x", size: "s", weight: 1, paymentStatus: "paid", status: "delivered", senderId: "someone-else" });
  assert.equal(injected.status, 201);
  assert.equal(injected.body.paymentStatus, "unpaid", "a client must not be able to create a delivery as already paid");
  assert.equal(injected.body.status, "pending");
  assert.equal(injected.body.senderId, sender.id);

  for (const bad of [{ pickup: "", dropoff: "B", itemType: "x", size: "s", weight: 1 }, { pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: -3 }, { pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: "abc" }, { pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1, pickupLat: 999 }]) {
    assert.equal((await request(app).post("/api/deliveries").set(auth(sender.token)).send(bad)).status, 400, JSON.stringify(bad));
  }
});

// ------------------------------------------------------------------------------------------------ accepting
test("a traveler can only take a delivery that has been paid for", async () => {
  const sender = await verifiedUser();
  const traveler = await verifiedUser();
  const unpaid = await newDelivery(sender);
  assert.equal((await patch(`/api/deliveries/${unpaid.id}/accept`, traveler.token)).status, 409);
  assert.equal((await statusOf(unpaid.id)).status, "pending");

  const paid = await newDelivery(sender, { paymentStatus: "paid" });
  const res = await patch(`/api/deliveries/${paid.id}/accept`, traveler.token);
  assert.equal(res.status, 200);
  const row = await statusOf(paid.id);
  assert.equal(row.status, "accepted");
  assert.equal(row.travelerId, traveler.id, "the accepting traveler must be recorded");
});

test("two travelers racing for one delivery: exactly one wins", async () => {
  const sender = await verifiedUser();
  const a = await verifiedUser();
  const b = await verifiedUser();
  const d = await newDelivery(sender, { paymentStatus: "paid" });
  const results = await Promise.all([patch(`/api/deliveries/${d.id}/accept`, a.token), patch(`/api/deliveries/${d.id}/accept`, b.token)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results[0].status === 200 ? a : b;
  assert.equal((await statusOf(d.id)).travelerId, winner.id);
});

test("accept is refused for your own delivery, unverified users, missing tokens and junk ids", async () => {
  const sender = await verifiedUser();
  const d = await newDelivery(sender, { paymentStatus: "paid" });
  assert.equal((await patch(`/api/deliveries/${d.id}/accept`, sender.token)).status, 409);
  const unverified = await createUser();
  assert.equal((await patch(`/api/deliveries/${d.id}/accept`, await loginToken(app, unverified))).status, 403);
  assert.equal((await request(app).patch(`/api/deliveries/${d.id}/accept`)).status, 401);
  assert.equal((await patch(`/api/deliveries/not-a-uuid/accept`, sender.token)).status, 404);
  assert.equal((await statusOf(d.id)).status, "pending");
});

// ------------------------------------------------------------------------------------------------ completing
test("only the assigned traveler (or an admin) can complete a delivery", async () => {
  const sender = await verifiedUser();
  const carrier = await verifiedUser();
  const stranger = await verifiedUser();
  const admin = await verifiedUser("admin");
  const d = await newDelivery(sender, { paymentStatus: "paid" });

  assert.equal((await patch(`/api/deliveries/${d.id}/complete`, carrier.token)).status, 409, "cannot complete before accepting");
  await patch(`/api/deliveries/${d.id}/accept`, carrier.token);

  assert.equal((await patch(`/api/deliveries/${d.id}/complete`, stranger.token)).status, 409, "a stranger must not be able to complete it");
  assert.equal((await patch(`/api/deliveries/${d.id}/complete`, sender.token)).status, 409);
  assert.equal((await statusOf(d.id)).status, "accepted");

  assert.equal((await patch(`/api/deliveries/${d.id}/complete`, carrier.token)).status, 200);
  assert.equal((await statusOf(d.id)).status, "delivered");
  assert.equal((await patch(`/api/deliveries/${d.id}/complete`, carrier.token)).status, 409, "already delivered");

  const d2 = await newDelivery(sender, { paymentStatus: "paid", status: "accepted", travelerId: carrier.id });
  assert.equal((await patch(`/api/deliveries/${d2.id}/complete`, admin.token)).status, 200);
});

// ------------------------------------------------------------------------------------------------ what travelers can see
test("travelers see paid, unclaimed deliveries and their own jobs, never unpaid or someone else's", async () => {
  const sender = await verifiedUser();
  const me = await verifiedUser();
  const other = await verifiedUser();
  const unpaid = await newDelivery(sender);
  const open = await newDelivery(sender, { paymentStatus: "paid" });
  const mine = await newDelivery(sender, { paymentStatus: "paid", status: "accepted", travelerId: me.id });
  const theirs = await newDelivery(sender, { paymentStatus: "paid", status: "accepted", travelerId: other.id });
  const own = await newDelivery(me, { paymentStatus: "paid" });
  const delivered = await newDelivery(sender, { paymentStatus: "paid", status: "delivered", travelerId: me.id });
  const refunded = await newDelivery(sender, { paymentStatus: "refunded" });

  const ids = (await prisma.delivery.findMany({ where: { ...visibleToTraveler(me.id), id: { in: [unpaid, open, mine, theirs, own, delivered, refunded].map((d) => d.id) } } })).map((d) => d.id).sort();
  assert.deepEqual(ids, [open.id, mine.id].sort());
});

// ------------------------------------------------------------------------------------------------ requests (used to have no auth at all)
test("the request routes require a login", async () => {
  assert.equal((await request(app).post("/api/request").send({ deliveryId: "x", travelerId: "y" })).status, 401);
  assert.equal((await request(app).patch("/api/request/abc/accept")).status, 401);
  assert.equal((await request(app).get("/api/request/mine")).status, 401);
});

test("a sender can request a traveler for their own paid delivery only", async () => {
  const sender = await verifiedUser();
  const traveler = await verifiedUser();
  const stranger = await verifiedUser();
  const paid = await newDelivery(sender, { paymentStatus: "paid" });
  const unpaid = await newDelivery(sender);

  assert.equal((await request(app).post("/api/request").set(auth(stranger.token)).send({ deliveryId: paid.id, travelerId: traveler.id })).status, 404, "not your delivery");
  assert.equal((await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: unpaid.id, travelerId: traveler.id })).status, 409, "unpaid");
  assert.equal((await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: paid.id, travelerId: sender.id })).status, 400, "cannot request yourself");
  const ok = await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: paid.id, travelerId: traveler.id });
  assert.equal(ok.status, 201);
  assert.equal((await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: paid.id, travelerId: traveler.id })).status, 400, "duplicate");
});

test("only the requested traveler can accept; it claims the delivery and rejects the other requests", async () => {
  const sender = await verifiedUser();
  const a = await verifiedUser();
  const b = await verifiedUser();
  const d = await newDelivery(sender, { paymentStatus: "paid" });
  const ra = (await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: d.id, travelerId: a.id })).body;
  const rb = (await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: d.id, travelerId: b.id })).body;

  assert.equal((await patch(`/api/request/${ra.id}/accept`, b.token)).status, 404, "someone else's request");
  assert.equal((await patch(`/api/request/${ra.id}/accept`, sender.token)).status, 404, "the sender cannot accept on a traveler's behalf");

  assert.equal((await patch(`/api/request/${ra.id}/accept`, a.token)).status, 200);
  const row = await statusOf(d.id);
  assert.equal(row.status, "in-transit");
  assert.equal(row.travelerId, a.id);
  assert.equal((await prisma.deliveryRequest.findUnique({ where: { id: rb.id } })).status, "rejected");
  assert.equal((await patch(`/api/request/${rb.id}/accept`, b.token)).status, 404, "a rejected request cannot be accepted afterwards");
});

test("accepting a request for a delivery that has since been taken or refunded fails and changes nothing", async () => {
  const sender = await verifiedUser();
  const a = await verifiedUser();
  const taker = await verifiedUser();
  const d = await newDelivery(sender, { paymentStatus: "paid" });
  const ra = (await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: d.id, travelerId: a.id })).body;
  await patch(`/api/deliveries/${d.id}/accept`, taker.token); // someone else grabbed it first
  assert.equal((await patch(`/api/request/${ra.id}/accept`, a.token)).status, 409);
  const row = await statusOf(d.id);
  assert.equal(row.travelerId, taker.id);
  assert.equal((await prisma.deliveryRequest.findUnique({ where: { id: ra.id } })).status, "pending", "the transaction must roll back");
});

test("/request/mine shows the sender's name and email but never their password hash or tokens", async () => {
  const sender = await verifiedUser();
  const traveler = await verifiedUser();
  const d = await newDelivery(sender, { paymentStatus: "paid" });
  await request(app).post("/api/request").set(auth(sender.token)).send({ deliveryId: d.id, travelerId: traveler.id });
  const res = await request(app).get("/api/request/mine").set(auth(traveler.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.deepEqual(Object.keys(res.body[0].delivery.sender).sort(), ["email", "id", "name", "profilePicture"]);
  assert.ok(!JSON.stringify(res.body).includes("$2"), "a bcrypt hash leaked");
});
