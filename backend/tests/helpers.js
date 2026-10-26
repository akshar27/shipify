// Must be the first require in every test file: it sets the environment before the app (and Prisma) read it.
const os = require("os");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-1234";
process.env.PORT = "0";
process.env.CORS_ORIGINS = "http://localhost:3000";
delete process.env.SMTP_EMAIL;
delete process.env.SMTP_PASS;
delete process.env.AWS_BUCKET_NAME;
delete process.env.STRIPE_SECRET_KEY;
process.env.PRIVATE_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "shipify-private-"));
process.env.DATABASE_URL =
  process.env.DATABASE_URL || `postgresql://${os.userInfo().username}@localhost:5432/shipify_test`;

// These tests delete rows. Never let them run against a database that is not obviously a test one.
const dbName = new URL(process.env.DATABASE_URL).pathname.replace("/", "");
if (!/test/i.test(dbName)) {
  throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
}

const request = require("supertest");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const PASSWORD = "Correct-horse-1";
let counter = 0;
const uniqueEmail = (label = "u") => `${label}.${process.pid}.${Date.now()}.${counter++}@shipify-test.local`;

/** Creates a verified user directly in the DB (the signup/verify flow itself is covered in auth.test.js). */
async function createUser({ role = "user", verified = true, label } = {}) {
  const email = uniqueEmail(label || role);
  const user = await prisma.user.create({
    data: { name: `Test ${role}`, email, password: await bcrypt.hash(PASSWORD, 4), role, emailVerified: verified },
  });
  return { ...user, plainPassword: PASSWORD };
}

async function loginToken(app, user) {
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: user.plainPassword });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

// Test files run in parallel processes against one database, so each process may only delete the users it created itself
// (their emails carry this process id), never another file's users that are still in use.
const mine = { email: { startsWith: "", contains: `.${process.pid}.`, endsWith: "@shipify-test.local" } };

async function cleanup() {
  await prisma.verificationRequest.deleteMany({ where: { user: mine } });
  await prisma.user.deleteMany({ where: mine });
  fs.rmSync(process.env.PRIVATE_UPLOAD_DIR, { recursive: true, force: true });
  await prisma.$disconnect();
}

// 1x1 PNG, and a Windows executable header that lies about being a PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const FAKE_PNG = Buffer.from("MZ\x90\x00 this is not an image");

module.exports = { request, prisma, createUser, loginToken, cleanup, uniqueEmail, PASSWORD, PNG, FAKE_PNG };
