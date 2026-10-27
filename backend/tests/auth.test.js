const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AUTH_RATE_LIMIT = "1000"; // this file is about behaviour, not limits (see hardening.test.js)
const { app } = require("../app");
const { request, prisma, createUser, loginToken, uniqueEmail, PASSWORD } = h;

after(h.cleanup);

test("signup -> verify email -> login works, and the role is always 'user'", async () => {
  const email = uniqueEmail("signup");
  // role: "admin" in the body must be ignored
  const reg = await request(app).post("/api/auth/register").send({ name: "New Person", email, password: PASSWORD, role: "admin", acceptTerms: true });
  assert.equal(reg.status, 201);

  const row = await prisma.user.findUnique({ where: { email } });
  assert.equal(row.role, "user");
  assert.equal(row.emailVerified, false);

  const early = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  assert.equal(early.status, 401, "login must be refused until the email is verified");

  const verify = await request(app).get(`/api/auth/verify-email/${row.emailToken}`);
  assert.equal(verify.status, 200);
  const again = await request(app).get(`/api/auth/verify-email/${row.emailToken}`);
  assert.equal(again.status, 200, "opening the link twice (e.g. a mail scanner first) must not turn into an error");
  assert.equal((await request(app).get("/api/auth/verify-email/not-a-real-token")).status, 400);

  const login = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "user");
});

test("a registered 'admin' hint cannot reach admin endpoints", async () => {
  const email = uniqueEmail("mallory");
  await request(app).post("/api/auth/register").send({ name: "Mallory", email, password: PASSWORD, role: "admin", acceptTerms: true });
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  const token = await loginToken(app, { email, plainPassword: PASSWORD });
  const res = await request(app).get("/api/admin/all-users").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("login and register responses never contain the password hash or tokens", async () => {
  const user = await createUser();
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: user.plainPassword });
  assert.deepEqual(Object.keys(res.body.user).sort(), ["email", "emailVerified", "id", "idSubmitted", "isVerified", "name", "profilePicture", "role", "termsAccepted"]);
  assert.ok(!JSON.stringify(res.body).includes("$2"), "a bcrypt hash leaked");
});

test("input validation: bad email, short password, missing fields, wrong types", async () => {
  const bad = [
    { name: "A", email: "not-an-email", password: PASSWORD, acceptTerms: true },
    { name: "A", email: uniqueEmail(), password: "short", acceptTerms: true },
    { name: "A", email: uniqueEmail(), password: "x".repeat(73), acceptTerms: true },
    { email: uniqueEmail(), password: PASSWORD, acceptTerms: true },
    { name: "A", email: { $ne: null }, password: PASSWORD, acceptTerms: true },
  ];
  for (const body of bad) {
    const res = await request(app).post("/api/auth/register").send(body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test("duplicate email is rejected", async () => {
  const user = await createUser();
  const res = await request(app).post("/api/auth/register").send({ name: "Dup", email: user.email, password: PASSWORD, acceptTerms: true });
  assert.equal(res.status, 400);
});

test("wrong password and unknown email give the same answer", async () => {
  const user = await createUser();
  const wrong = await request(app).post("/api/auth/login").send({ email: user.email, password: "Wrong-password-1" });
  const unknown = await request(app).post("/api/auth/login").send({ email: uniqueEmail("nobody"), password: "Wrong-password-1" });
  assert.equal(wrong.status, 400);
  assert.equal(unknown.status, 400);
  assert.deepEqual(wrong.body, unknown.body);
});

test("forgot-password and resend-verification do not reveal whether an account exists", async () => {
  const known = await createUser({ verified: false });
  for (const path of ["/api/auth/forgot-password", "/api/auth/resend-verification"]) {
    const a = await request(app).post(path).send({ email: known.email });
    const b = await request(app).post(path).send({ email: uniqueEmail("nobody") });
    assert.equal(a.status, 200, path);
    assert.equal(b.status, 200, path);
    assert.deepEqual(a.body, b.body, path);
  }
});

test("password reset: token works once, new password logs in, old one does not", async () => {
  const user = await createUser();
  await request(app).post("/api/auth/forgot-password").send({ email: user.email });
  const { resetToken } = await prisma.user.findUnique({ where: { email: user.email } });
  assert.ok(resetToken);

  const weak = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "short" });
  assert.equal(weak.status, 400);

  const ok = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "Brand-new-pass-2" });
  assert.equal(ok.status, 200);
  const again = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "Another-pass-3" });
  assert.equal(again.status, 400, "a reset token must be single use");

  const newLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: "Brand-new-pass-2" });
  const oldLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: user.plainPassword });
  assert.equal(newLogin.status, 200);
  assert.equal(oldLogin.status, 400);
});

test("expired reset token is refused", async () => {
  const user = await createUser();
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: "expiredtoken-expiredtoken", resetTokenExpiry: new Date(Date.now() - 1000) } });
  const res = await request(app).post("/api/auth/reset-password").send({ token: "expiredtoken-expiredtoken", password: "Brand-new-pass-2" });
  assert.equal(res.status, 400);
});

test("protected routes need a valid token", async () => {
  assert.equal((await request(app).get("/api/auth/me")).status, 401);
  assert.equal((await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage")).status, 401);
});

test("a token stops working the moment its account is deleted", async () => {
  const user = await createUser();
  const token = await loginToken(app, user);
  assert.equal((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status, 200);
  await prisma.user.delete({ where: { id: user.id } });
  assert.equal((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status, 401);
});

test("role comes from the database, not from the token: a demoted admin loses access immediately", async () => {
  const admin = await createUser({ role: "admin" });
  const token = await loginToken(app, admin);
  assert.equal((await request(app).get("/api/admin/all-users").set("Authorization", `Bearer ${token}`)).status, 200);
  await prisma.user.update({ where: { id: admin.id }, data: { role: "user" } });
  assert.equal((await request(app).get("/api/admin/all-users").set("Authorization", `Bearer ${token}`)).status, 403);
});
