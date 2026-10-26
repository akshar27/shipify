const h = require("./helpers");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.AUTH_RATE_LIMIT = "1000";
const { app } = require("../app");
const { request, prisma, createUser, loginToken, PNG, FAKE_PNG } = h;
const { sniff } = require("../utils/documents");

after(h.cleanup);

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function submit(token, buffer, filename = "id.png", type = "image/png") {
  return request(app).post("/api/verification").set(auth(token)).field("fullName", "Test Person").attach("document", buffer, { filename, contentType: type });
}

test("file sniffing recognises real PNG/JPEG/PDF and nothing else", () => {
  assert.equal(sniff(PNG).ext, "png");
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])).ext, "jpg");
  assert.equal(sniff(Buffer.from("%PDF-1.7\n")).ext, "pdf");
  assert.equal(sniff(FAKE_PNG), null);
  assert.equal(sniff(Buffer.from("<html><script>alert(1)</script>")), null);
  assert.equal(sniff(Buffer.alloc(0)), null);
});

test("an executable renamed .png (with an image content-type) is rejected", async () => {
  const user = await createUser();
  const res = await submit(await loginToken(app, user), FAKE_PNG, "id.png", "image/png");
  assert.equal(res.status, 400);
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).documentUrl, null);
});

test("upload stores an opaque reference, returns no URL, and is not publicly reachable", async () => {
  const user = await createUser();
  const res = await submit(await loginToken(app, user), PNG);
  assert.equal(res.status, 201);
  assert.ok(!JSON.stringify(res.body).includes("documents/"), "response leaked the storage key");

  const { documentUrl } = await prisma.user.findUnique({ where: { id: user.id } });
  assert.match(documentUrl, /^doc:documents\/[0-9a-f]{32}\.png$/);

  const key = documentUrl.slice("doc:".length);
  for (const p of [`/uploads/${key}`, `/uploads/documents/${key.split("/")[1]}`, `/${key}`]) {
    assert.equal((await request(app).get(p)).status, 404, p);
  }
});

test("hostile filenames cannot influence where the file is written", async () => {
  const user = await createUser();
  const res = await submit(await loginToken(app, user), PNG, "../../../../etc/evil.png");
  assert.equal(res.status, 201);
  const { documentUrl } = await prisma.user.findUnique({ where: { id: user.id } });
  assert.match(documentUrl, /^doc:documents\/[0-9a-f]{32}\.png$/, "stored name must be random, not derived from the upload name");
});

test("a second submission while one is pending is refused", async () => {
  const user = await createUser();
  const t = await loginToken(app, user);
  assert.equal((await submit(t, PNG)).status, 201);
  assert.equal((await submit(t, PNG)).status, 400);
});

test("only an admin can get a document URL; it serves the exact bytes", async () => {
  const user = await createUser();
  const admin = await createUser({ role: "admin" });
  const other = await createUser();
  await submit(await loginToken(app, user), PNG);

  const asOther = await request(app).get(`/api/admin/user/${user.id}`).set(auth(await loginToken(app, other)));
  assert.equal(asOther.status, 403);
  const asSelf = await request(app).get(`/api/admin/user/${user.id}`).set(auth(await loginToken(app, user)));
  assert.equal(asSelf.status, 403);

  const asAdmin = await request(app).get(`/api/admin/user/${user.id}`).set(auth(await loginToken(app, admin)));
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.body.documentType, "image");
  const path = new URL(asAdmin.body.documentUrl).pathname;
  assert.match(path, /^\/api\/documents\//);

  const file = await request(app).get(path).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(file.status, 200);
  assert.equal(file.headers["content-type"], "image/png");
  assert.match(file.headers["cache-control"], /no-store/);
  assert.ok(file.body.equals(PNG));
});

test("document tokens: forged, expired, wrong-purpose and path-escaping ones all get 404", async () => {
  const secret = `${process.env.JWT_SECRET}:document`;
  const forged = jwt.sign({ purpose: "document", key: "documents/x.png" }, "not-the-secret", { expiresIn: 60 });
  const expired = jwt.sign({ purpose: "document", key: "documents/x.png" }, secret, { expiresIn: -10 });
  const wrongPurpose = jwt.sign({ purpose: "login", key: "documents/x.png" }, secret, { expiresIn: 60 });
  const escaping = jwt.sign({ purpose: "document", key: "../../../etc/passwd" }, secret, { expiresIn: 60 });
  const loginToken = jwt.sign({ id: "abc", role: "admin" }, process.env.JWT_SECRET, { expiresIn: 60 });
  for (const t of [forged, expired, wrongPurpose, escaping, loginToken, "garbage"]) {
    assert.equal((await request(app).get(`/api/documents/${t}`)).status, 404);
  }
});

test("the full user record an admin lists never exposes the stored reference", async () => {
  const user = await createUser();
  const admin = await createUser({ role: "admin" });
  await submit(await loginToken(app, user), PNG);
  const res = await request(app).get("/api/admin/all-users").set(auth(await loginToken(app, admin)));
  assert.equal(res.status, 200);
  assert.ok(!JSON.stringify(res.body).includes("doc:documents"), "raw document reference leaked into the admin list");
});

test("approving a user does not return their password hash or tokens", async () => {
  const user = await createUser();
  const admin = await createUser({ role: "admin" });
  const res = await request(app).patch(`/api/admin/verify-user/${user.id}`).set(auth(await loginToken(app, admin)));
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.user).sort(), ["email", "id", "isVerified", "name"]);
});
