require("dotenv").config();
const crypto = require("crypto");
const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

// Usage: ADMIN_EMAIL=you@example.com [ADMIN_PASSWORD=...] node scripts/createAdmin.js
// If no password is given, a random one is generated and printed once. There is no default password.
async function createAdmin() {
  try {
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!email) {
      console.error("Set ADMIN_EMAIL (and optionally ADMIN_PASSWORD).");
      process.exit(1);
    }
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
    if (password.length < 8) {
      console.error("ADMIN_PASSWORD must be at least 8 characters.");
      process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log("Admin already exists:", existing.email);
      process.exit(0);
    }

    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email,
        password: await bcrypt.hash(password, 10),
        role: "admin",
        emailVerified: true,
      },
    });

    console.log("Admin created:", admin.email);
    if (generated) console.log("Generated password (shown once):", password);
  } catch (err) {
    console.error("Error creating admin:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
