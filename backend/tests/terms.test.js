const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
process.env.MAX_ITEM_VALUE_CENTS = "20000";
const { app } = require("../app");
const { setStripeForTests } = require("../utils/stripe");
const { request, prisma, createUser, loginToken, uniqueEmail, PASSWORD, termsVersion } = h;

after(h.cleanup);

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const person = async (opts = {}) => {
  const u = await createUser(opts);
  await prisma.user.update({ where: { id: u.id }, data: { isVerified: true } });
  return { ...u, token: await loginToken(app, u) };
};
const goodDelivery = { pickup: "SF", dropoff: "LA", itemType: "book", size: "small", weight: 1, declaredValue: 25, contentsConfirmed: true, pickupLat: 37.77, pickupLng: -122.4, dropoffLat: 34.05, dropoffLng: -118.24 };
const goodTrip = { start: "SF", end: "LA", departure: new Date(Date.now() + 86400000).toISOString(), startLat: 37.77, startLng: -122.4, endLat: 34.05, endLng: -118.24 };
const post = (path, token, body) => request(app).post(path).set(auth(token)).send(body);

// ------------------------------------------------------------------------------------------------ the rules endpoint
test("the rules are public and complete: version, value cap, prohibited list, traveler rules", async () => {
  const res = await request(app).get("/api/legal/rules");
  assert.equal(res.status, 200);
  assert.equal(res.body.termsVersion, termsVersion());
  assert.equal(res.body.maxItemValueCents, 20000);
  assert.ok(res.body.prohibited.length >= 8);
  for (const item of res.body.prohibited) assert.ok(item.id && item.title && item.detail);
  const ids = res.body.prohibited.map((p) => p.id);
  for (const must of ["money", "drugs", "weapons", "identity", "value"]) assert.ok(ids.includes(must), `missing ${must}`);
  assert.ok(res.body.travelerRules.length >= 3);
  assert.ok("companyName" in res.body && "supportEmail" in res.body, "unset legal contact details must be reported as null, not invented");
});

// ------------------------------------------------------------------------------------------------ signup
test("signup is refused unless the terms are accepted, and records which version when they are", async () => {
  const base = { name: "New", password: PASSWORD };
  for (const extra of [{}, { acceptTerms: false }, { acceptTerms: "true" }, { acceptTerms: 1 }, { acceptTerms: null }]) {
    const res = await request(app).post("/api/auth/register").send({ ...base, email: uniqueEmail("t"), ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra));
    assert.match(res.body.msg, /Terms/);
  }
  const email = uniqueEmail("terms");
  assert.equal((await request(app).post("/api/auth/register").send({ ...base, email, acceptTerms: true })).status, 201);
  const row = await prisma.user.findUnique({ where: { email } });
  assert.equal(row.termsVersion, termsVersion());
  assert.ok(row.termsAcceptedAt);
});

test("login and /me report whether the user has accepted the current terms", async () => {
  const ok = await createUser();
  const old = await createUser();
  await prisma.user.update({ where: { id: old.id }, data: { termsVersion: "2020-ancient" } });
  const none = await createUser({ terms: false });
  for (const [user, expected] of [[ok, true], [old, false], [none, false]]) {
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: user.plainPassword });
    assert.equal(login.body.user.termsAccepted, expected);
    const me = await request(app).get("/api/auth/me").set(auth(login.body.token));
    assert.equal(me.body.termsAccepted, expected);
    assert.ok(!("termsVersion" in me.body));
  }
});

// ------------------------------------------------------------------------------------------------ the gate
test("without accepting the current terms, the marketplace actions answer 403 TERMS_REQUIRED", async () => {
  setStripeForTests({ checkout: { sessions: { create: async () => ({ id: "cs_x", url: "https://x" }) } } });
  const none = await person({ terms: false });
  const stale = await person();
  await prisma.user.update({ where: { id: stale.id }, data: { termsVersion: "2020-ancient" } });
  const sender = await person();
  const delivery = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1, paymentStatus: "paid" } });
  const own = await prisma.delivery.create({ data: { senderId: none.id, pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1 } });

  for (const who of [none, stale]) {
    const attempts = [
      post("/api/deliveries", who.token, goodDelivery),
      post("/api/trips", who.token, goodTrip),
      request(app).patch(`/api/deliveries/${delivery.id}/accept`).set(auth(who.token)),
      post("/api/request", who.token, { deliveryId: own.id, travelerId: sender.id }),
      request(app).patch(`/api/request/${delivery.id}/accept`).set(auth(who.token)),
      post("/api/payments/create-checkout-session", who.token, { deliveryId: own.id }),
    ];
    for (const res of await Promise.all(attempts)) {
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "TERMS_REQUIRED");
    }
  }
  assert.equal((await prisma.delivery.findUnique({ where: { id: delivery.id } })).travelerId, null, "a refused accept must not claim anything");
});

test("finishing, confirming and disputing a delivery are NOT blocked by the terms gate", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await prisma.delivery.create({ data: { senderId: sender.id, travelerId: traveler.id, pickup: "A", dropoff: "B", itemType: "x", size: "s", weight: 1, paymentStatus: "paid", status: "accepted", handoverSalt: "s" } });
  // terms change after they accepted
  await prisma.user.updateMany({ where: { id: { in: [sender.id, traveler.id] } }, data: { termsVersion: "2020-ancient" } });
  const code = require("../utils/handover").codeFor(d.id, "s");
  const complete = await request(app).patch(`/api/deliveries/${d.id}/complete`).set(auth(traveler.token)).send({ code });
  assert.equal(complete.status, 200, "the traveler must be able to finish a job they already took");
  assert.equal((await request(app).post(`/api/deliveries/${d.id}/confirm`).set(auth(sender.token))).status, 200);
  assert.equal((await request(app).get("/api/deliveries/mine").set(auth(sender.token))).status, 200);
});

test("accepting the terms lifts the gate; admins are exempt", async () => {
  const none = await person({ terms: false });
  assert.equal((await post("/api/deliveries", none.token, goodDelivery)).status, 403);
  assert.equal((await post("/api/auth/accept-terms", none.token, { accept: false })).status, 400);
  assert.equal((await post("/api/auth/accept-terms", none.token, {})).status, 400);
  assert.equal((await post("/api/auth/accept-terms", none.token, { accept: true })).status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: none.id } })).termsVersion, termsVersion());
  assert.equal((await post("/api/deliveries", none.token, goodDelivery)).status, 201);
  assert.equal((await request(app).post("/api/auth/accept-terms").send({ accept: true })).status, 401);

  const admin = await person({ role: "admin", terms: false });
  assert.equal((await post("/api/deliveries", admin.token, goodDelivery)).status, 201);
});

// ------------------------------------------------------------------------------------------------ the declaration
test("a delivery needs a declared value under the cap and the prohibited-items confirmation", async () => {
  const sender = await person();
  for (const [body, why] of [
    [{ ...goodDelivery, contentsConfirmed: false }, "unticked"],
    [{ ...goodDelivery, contentsConfirmed: undefined }, "missing confirmation"],
    [{ ...goodDelivery, contentsConfirmed: "yes" }, "not boolean true"],
    [{ ...goodDelivery, declaredValue: undefined }, "no value"],
    [{ ...goodDelivery, declaredValue: 0 }, "zero value"],
    [{ ...goodDelivery, declaredValue: -5 }, "negative value"],
    [{ ...goodDelivery, declaredValue: "lots" }, "not a number"],
    [{ ...goodDelivery, declaredValue: 200.01 }, "just over the $200 cap"],
    [{ ...goodDelivery, declaredValue: 5000 }, "far over the cap"],
  ]) {
    const res = await post("/api/deliveries", sender.token, body);
    assert.equal(res.status, 400, why);
  }
  assert.equal(await prisma.delivery.count({ where: { senderId: sender.id } }), 0, "a refused delivery must not be saved");

  const exactly = await post("/api/deliveries", sender.token, { ...goodDelivery, declaredValue: 200 });
  assert.equal(exactly.status, 201, "the cap itself is allowed");
  assert.equal(exactly.body.declaredValueCents, 20000);
  assert.ok(exactly.body.contentsConfirmedAt);

  const cents = await post("/api/deliveries", sender.token, { ...goodDelivery, declaredValue: "19.99" });
  assert.equal(cents.body.declaredValueCents, 1999);
});

test("missing or unreadable numbers get a plain message, never a validation-library one", async () => {
  const sender = await person();
  const msg = async (body) => (await post("/api/deliveries", sender.token, body)).body.msg;
  assert.equal(await msg({ ...goodDelivery, declaredValue: undefined }), "Enter the item's value");
  assert.equal(await msg({ ...goodDelivery, declaredValue: "lots" }), "Enter the item's value");
  assert.equal(await msg({ ...goodDelivery, weight: "heavy" }), "Enter the weight in kg");
  assert.equal(await msg({ ...goodDelivery, weight: undefined }), "Enter the weight in kg");
  assert.match(await msg({ ...goodDelivery, declaredValue: 500 }), /cannot be more than 200/);
  for (const m of [await msg({ ...goodDelivery, declaredValue: NaN }), await msg({ ...goodDelivery, weight: null })]) assert.ok(!/NaN|expected number|Invalid input/.test(m), m);
});

test("travelers see the declared value of a delivery they might take", async () => {
  const sender = await person();
  const traveler = await person();
  const d = (await post("/api/deliveries", sender.token, { ...goodDelivery, declaredValue: 80 })).body;
  await prisma.delivery.update({ where: { id: d.id }, data: { paymentStatus: "paid" } });
  const { visibleToTraveler } = require("../utils/deliveryState");
  const seen = await prisma.delivery.findMany({ where: { ...visibleToTraveler(traveler.id), id: d.id } });
  assert.equal(seen[0].declaredValueCents, 8000);
});

// ------------------------------------------------------------------------------------------------ trips
test("posting a trip needs an ID-verified, terms-accepted user and valid input", async () => {
  const unverified = await createUser();
  assert.equal((await post("/api/trips", await loginToken(app, unverified), goodTrip)).status, 403, "ID verification required");
  const traveler = await person();
  assert.equal((await post("/api/trips", traveler.token, { ...goodTrip, start: "" })).status, 400);
  assert.equal((await post("/api/trips", traveler.token, { ...goodTrip, departure: "not a date" })).status, 400);
  assert.equal((await post("/api/trips", traveler.token, { ...goodTrip, startLat: 999 })).status, 400);
  const ok = await post("/api/trips", traveler.token, { ...goodTrip, startLat: "37.77", startLng: "-122.4" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.startLat, 37.77);
});

test("a new trip only auto-requests deliveries the traveler could really take: paid, unclaimed, not their own", async () => {
  const sender = await person();
  const traveler = await person();
  // A route no other test uses, so only the deliveries created here can match.
  const from = `From-${process.pid}-${Date.now()}`;
  const to = `To-${process.pid}-${Date.now()}`;
  const mk = (extra) => prisma.delivery.create({ data: { senderId: sender.id, pickup: from, dropoff: to, itemType: "x", size: "s", weight: 1, ...extra } });
  const good = await mk({ paymentStatus: "paid" });
  const unpaid = await mk({});
  const refunded = await mk({ paymentStatus: "refunded" });
  const claimed = await mk({ paymentStatus: "paid", status: "accepted", travelerId: sender.id });
  const own = await prisma.delivery.create({ data: { senderId: traveler.id, pickup: from, dropoff: to, itemType: "x", size: "s", weight: 1, paymentStatus: "paid" } });

  assert.equal((await post("/api/trips", traveler.token, { ...goodTrip, start: from, end: to })).status, 201);
  const requested = (await prisma.deliveryRequest.findMany({ where: { travelerId: traveler.id } })).map((r) => r.deliveryId);
  assert.deepEqual(requested, [good.id]);
  for (const bad of [unpaid, refunded, claimed, own]) assert.ok(!requested.includes(bad.id));
});
