const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000";
const polyline = require("@mapbox/polyline");
const directions = require("../utils/directions");
const { app } = require("../app");
const { request, prisma, createUser, loginToken } = h;

after(h.cleanup);

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const person = async () => {
  const u = await createUser();
  await prisma.user.update({ where: { id: u.id }, data: { isVerified: true } });
  return { ...u, token: await loginToken(app, u) };
};
const job = (sender, traveler, extra = {}) =>
  prisma.delivery.create({ data: { senderId: sender.id, travelerId: traveler.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1, paymentStatus: "paid", status: "confirmed", ...extra } });

test("/health answers without logging in and does not expose internals", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

// ------------------------------------------------------------------------------------------------ ratings
test("ratings: reachable at /api/ratings, and only for a confirmed delivery you took part in", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const open = await job(sender, traveler, { status: "delivered" });
  const done = await job(sender, traveler);
  const post = (u, body) => request(app).post("/api/ratings").set(auth(u.token)).send(body);

  assert.equal((await post(sender, { deliveryId: open.id, rating: 5 })).status, 404, "not confirmed yet");
  assert.equal((await post(stranger, { deliveryId: done.id, rating: 1 })).status, 404, "strangers cannot rate");
  assert.equal((await request(app).post("/api/ratings").send({ deliveryId: done.id, rating: 5 })).status, 401);
  assert.equal((await post(sender, { deliveryId: done.id, rating: 9 })).status, 400);
  assert.equal((await post(sender, { deliveryId: done.id, rating: 0 })).status, 400);

  const ok = await post(sender, { deliveryId: done.id, rating: 4, comment: "great" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.receiverId, traveler.id);
  assert.equal((await post(sender, { deliveryId: done.id, rating: 5 })).status, 400, "once only");

  const back = await post(traveler, { deliveryId: done.id, rating: 5 });
  assert.equal(back.status, 201);
  assert.equal(back.body.receiverId, sender.id);

  const mine = await request(app).get(`/api/ratings/delivery/${done.id}`).set(auth(sender.token));
  assert.equal(mine.body.rating, 4);
});

test("ratings: a client-supplied receiverId is ignored, so you cannot rate someone else", async () => {
  const sender = await person();
  const traveler = await person();
  const victim = await person();
  const d = await job(sender, traveler);
  const res = await request(app).post("/api/ratings").set(auth(sender.token)).send({ deliveryId: d.id, receiverId: victim.id, rating: 1 });
  assert.equal(res.status, 201);
  assert.equal(res.body.receiverId, traveler.id);
  assert.equal(await prisma.rating.count({ where: { receiverId: victim.id } }), 0);
});

test("ratings: a malformed user id is a 404, not a 500", async () => {
  assert.equal((await request(app).get("/api/ratings/user/not-an-id")).status, 404);
});

// ------------------------------------------------------------------------------------------------ directions cache
test("the traveler's jobs list asks Google once per route, not once per request", async () => {
  const sender = await person();
  const traveler = await person();
  const calls = [];
  const line = polyline.encode([[37.8, -122.3], [37.0, -121.0], [34.0, -118.2]]);
  directions.setFetcherForTests(async (params) => {
    calls.push(params);
    return { routes: [{ overview_polyline: { points: line } }] };
  });

  await prisma.trip.create({ data: { travelerId: traveler.id, start: "Oakland", end: "LA", startLat: 37.8, startLng: -122.3, endLat: 34.0, endLng: -118.2, departure: new Date(Date.now() + 86400000) } });
  const d = await prisma.delivery.create({
    data: { senderId: sender.id, pickup: "Oakland", dropoff: "LA", pickupLat: 37.8, pickupLng: -122.3, dropoffLat: 34.0, dropoffLng: -118.2, itemType: "book", size: "small", weight: 1, paymentStatus: "paid" },
  });

  const get = () => request(app).get("/api/match/matches-for-traveler").set(auth(traveler.token));
  const first = await get();
  assert.equal(first.status, 200);
  assert.ok(first.body.some((m) => m.deliveryId === d.id));
  await get();
  await get();
  assert.equal(calls.length, 1);
});

test("a Google failure skips that trip instead of failing the page, and is not cached", async () => {
  const traveler = await person();
  let n = 0;
  directions.setFetcherForTests(async () => {
    n++;
    throw new Error("quota exceeded");
  });
  await prisma.trip.create({ data: { travelerId: traveler.id, start: "X", end: "Y", startLat: 10, startLng: 10, endLat: 11, endLng: 11, departure: new Date() } });
  const res = await request(app).get("/api/match/matches-for-traveler").set(auth(traveler.token));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
  await request(app).get("/api/match/matches-for-traveler").set(auth(traveler.token));
  assert.equal(n, 2, "failures are retried, not cached");
});
