const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "5";
const { app } = require("../app");
const { request, createUser, loginToken, uniqueEmail } = h;

after(h.cleanup);

test("auth endpoints are rate limited per IP (5 allowed here, then 429)", async () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const res = await request(app).post("/api/auth/login").send({ email: uniqueEmail("x"), password: "whatever-pass" });
    codes.push(res.status);
  }
  assert.deepEqual(codes.slice(0, 5), [400, 400, 400, 400, 400]);
  assert.deepEqual(codes.slice(5), [429, 429, 429]);
});

test("a rate-limited client gets a JSON message and a Retry-After style header, not a stack trace", async () => {
  const res = await request(app).post("/api/auth/register").send({});
  assert.equal(res.status, 429);
  assert.equal(res.body.msg, "Too many requests, please try again later.");
  assert.ok(res.headers["ratelimit"] || res.headers["ratelimit-policy"]);
});

test("CORS only allows the configured origins", async () => {
  const evil = await request(app).options("/api/auth/me").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "GET");
  assert.equal(evil.headers["access-control-allow-origin"], undefined);
  const good = await request(app).options("/api/auth/me").set("Origin", "http://localhost:3000").set("Access-Control-Request-Method", "GET");
  assert.equal(good.headers["access-control-allow-origin"], "http://localhost:3000");
});

test("security headers are set and the framework is not advertised", async () => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-powered-by"], undefined);
  assert.ok(res.headers["strict-transport-security"]);
});

test("oversized and malformed JSON bodies get clean errors", async () => {
  const big = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send(JSON.stringify({ a: "x".repeat(200_000) }));
  assert.equal(big.status, 413);
  const bad = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{not json");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.msg, "Invalid JSON");
});

test("payments answer 503 (not a crash) when Stripe is not configured", async () => {
  const user = await createUser();
  await require("./helpers").prisma.user.update({ where: { id: user.id }, data: { isVerified: true } }); // checkout requires a verified user
  // note: the auth limiter above is at its cap for /api/auth, but /api/auth/login is not used here: tokens are minted directly
  const jwt = require("jsonwebtoken");
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: 60 });
  const res = await request(app).post("/api/payments/create-checkout-session").set("Authorization", `Bearer ${token}`).send({ deliveryId: "7f9c2d44-1b0e-4f3a-9d57-0a6b1c2d3e4f" });
  assert.equal(res.status, 503);
  assert.match(res.body.msg, /temporarily unavailable/);
  assert.doesNotMatch(res.body.msg, /STRIPE|SECRET|KEY/);
});
