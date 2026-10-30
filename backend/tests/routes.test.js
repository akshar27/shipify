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

test("/auth/me returns the public user including isVerified, never the password hash", async () => {
  const u = await person();
  const res = await request(app).get("/api/auth/me").set(auth(u.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.isVerified, true);
  assert.equal(res.body.termsAccepted, true);
  assert.equal(res.body.password, undefined);
  assert.equal(res.body.emailToken, undefined);
});

test("with no Maps key (development), a trip's route is the straight line, so matching still works", async () => {
  const saved = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete require.cache[require.resolve("../utils/directions")];
  const fresh = require("../utils/directions");
  const pts = await fresh.routePoints({ startLat: 0, startLng: 0, endLat: 10, endLng: 20 });
  process.env.GOOGLE_MAPS_API_KEY = saved || "";
  if (!saved) delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(pts.length, 41);
  assert.deepEqual(pts[20], { lat: 5, lng: 10 });
});

// ------------------------------------------------------------------------------------------------ chat
test("chat: only the sender and traveler of a delivery can read or write its messages, in order, with a server-chosen receiver", async () => {
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const d = await job(sender, traveler, { status: "in-transit" });
  const open = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", itemType: "book", size: "small", weight: 1 } });
  const send = (u, body) => request(app).post("/api/messages").set(auth(u.token)).send(body);
  const list = (u, id) => request(app).get(`/api/messages/${id}`).set(auth(u.token));

  const first = await send(sender, { deliveryId: d.id, content: "  hello  ", receiverId: stranger.id });
  assert.equal(first.status, 201);
  assert.equal(first.body.content, "hello", "trimmed");
  assert.equal(first.body.receiverId, traveler.id, "a client-chosen receiver is ignored");
  assert.equal((await send(traveler, { deliveryId: d.id, content: "on my way" })).body.receiverId, sender.id);

  const msgs = await list(traveler, d.id);
  assert.equal(msgs.status, 200);
  assert.deepEqual(msgs.body.map((m) => m.content), ["hello", "on my way"]);

  assert.equal((await list(stranger, d.id)).status, 404, "strangers cannot read");
  assert.equal((await send(stranger, { deliveryId: d.id, content: "spam" })).status, 404, "strangers cannot write");
  assert.equal((await send(sender, { deliveryId: open.id, content: "anyone?" })).status, 404, "no chat before a traveler is assigned");
  assert.equal((await list(sender, "not-a-uuid")).status, 404);
  assert.equal((await send(sender, { deliveryId: d.id, content: "   " })).status, 400);
  assert.equal((await send(sender, { deliveryId: d.id, content: "x".repeat(2001) })).status, 400);
  assert.equal((await send(sender, { deliveryId: d.id, content: { $ne: 1 } })).status, 400);
  assert.equal((await request(app).get(`/api/messages/${d.id}`)).status, 401);
});

test("chat sockets: a stranger cannot join a delivery's room or post into it", async (t) => {
  const { io: connect } = require("socket.io-client");
  const { server, io: sio } = require("../app");
  const sender = await person();
  const traveler = await person();
  const stranger = await person();
  const d = await job(sender, traveler, { status: "in-transit" });
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const open = (u) => new Promise((res, rej) => { const s = connect(url, { auth: { token: u.token }, transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); });
  const [a, b, x] = await Promise.all([open(sender), open(traveler), open(stranger)]);
  t.after(() => { [a, b, x].forEach((s) => s.close()); sio.close(); }); // io.close() also closes the http server

  const heard = { b: [], x: [] };
  b.on("receiveMessage", (m) => heard.b.push(m));
  x.on("receiveMessage", (m) => heard.x.push(m));
  for (const s of [a, b, x]) s.emit("joinDeliveryRoom", { deliveryId: d.id });
  await new Promise((r) => setTimeout(r, 200));

  x.emit("sendMessage", { deliveryId: d.id, receiverId: sender.id, content: "injected" });
  a.emit("sendMessage", { deliveryId: d.id, receiverId: stranger.id, content: "real" });
  await new Promise((r) => setTimeout(r, 400));

  assert.deepEqual(heard.b.map((m) => m.content), ["real"], "the traveler hears only the sender, not the stranger's injected message");
  assert.equal(heard.b[0].receiverId, traveler.id, "receiver chosen by the server");
  assert.deepEqual(heard.x, [], "the stranger heard nothing");
  const stored = await prisma.message.findMany({ where: { deliveryId: d.id } });
  assert.deepEqual(stored.map((m) => m.content), ["real"]);
});

test("travelers never receive a sender's email address from the match or request lists", async () => {
  const sender = await person();
  const traveler = await person();
  const d = await prisma.delivery.create({ data: { senderId: sender.id, pickup: "A", dropoff: "B", pickupLat: 37.77, pickupLng: -122.41, dropoffLat: 37.33, dropoffLng: -121.88, itemType: "x", size: "s", weight: 1, paymentStatus: "paid" } });
  await prisma.deliveryRequest.create({ data: { deliveryId: d.id, travelerId: traveler.id } });
  const res = await request(app).get("/api/request/mine").set(auth(traveler.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.ok(!JSON.stringify(res.body).includes(sender.email), "sender email leaked in /request/mine");
  assert.equal(res.body[0].delivery.sender.name, sender.name);
});

test("ratings: a delivery the sender never answered for (past the confirm window) can be rated, a fresh one cannot", async () => {
  const sender = await person();
  const traveler = await person();
  const old = await job(sender, traveler, { status: "delivered", deliveredAt: new Date(Date.now() - 100 * 3600 * 1000) });
  const fresh = await job(sender, traveler, { status: "delivered", deliveredAt: new Date() });
  const post = (id) => request(app).post("/api/ratings").set(auth(sender.token)).send({ deliveryId: id, rating: 5 });
  assert.equal((await post(old.id)).status, 201);
  assert.equal((await post(fresh.id)).status, 404);
});

// ------------------------------------------------------------------------------------------------ admin: ID review
test("admin ID review: approve marks the request approved, reject clears the ID but keeps the account, delete refuses accounts with history", async () => {
  const admin = await createUser({ role: "admin" });
  admin.token = await loginToken(app, admin);
  const member = await person();
  const other = await person();
  const call = (method, path, token) => request(app)[method](path).set(auth(token));

  // A submitted ID (this is what the mobile route stores: the user's documentUrl plus a pending request).
  const submit = async (u) => {
    await prisma.user.update({ where: { id: u.id }, data: { isVerified: false, documentUrl: "doc:x" } });
    return prisma.verificationRequest.create({ data: { userId: u.id, fullName: u.name, documentUrl: "doc:x" } });
  };

  const req1 = await submit(member);
  assert.equal((await call("post", `/api/admin/reject-user/${member.id}`, member.token)).status, 403, "users cannot reject");
  assert.equal((await call("post", `/api/admin/reject-user/${member.id}`, admin.token)).status, 200);
  const after = await prisma.user.findUnique({ where: { id: member.id } });
  assert.equal(after.documentUrl, null);
  assert.equal(after.isVerified, false);
  assert.equal((await prisma.verificationRequest.findUnique({ where: { id: req1.id } })).status, "rejected");

  const req2 = await submit(member);
  assert.equal((await call("patch", `/api/admin/verify-user/${member.id}`, admin.token)).status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: member.id } })).isVerified, true);
  assert.equal((await prisma.verificationRequest.findUnique({ where: { id: req2.id } })).status, "approved");

  // Unknown ids and non-ids are clean 404s, not 500s that leak a database error.
  for (const path of ["/api/admin/reject-user", "/api/admin/verify-user"]) {
    const res = await call(path.includes("reject") ? "post" : "patch", `${path}/00000000-0000-4000-8000-000000000000`, admin.token);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, undefined);
  }
  assert.equal((await call("patch", "/api/admin/verify-user/not-an-id", admin.token)).status, 404);

  // Deleting someone who has a history is refused (409) instead of crashing on a foreign key.
  await submit(other);
  const del = await call("delete", `/api/admin/delete-user/${other.id}`, admin.token);
  assert.equal(del.status, 409);
  assert.equal(del.body.error, undefined);
  assert.ok(await prisma.user.findUnique({ where: { id: other.id } }), "the account is still there");
  assert.equal((await call("delete", `/api/admin/delete-user/${admin.id}`, admin.token)).status, 409, "admins cannot be deleted here");
});
