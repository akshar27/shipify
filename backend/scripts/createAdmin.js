require("dotenv").config();
const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

async function createAdmin() {
  try {
    const email = "admin@shipify.com";
    const password = "Admin@123";

    // Check if admin exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      console.log("⚠️ Admin already exists:", existing.email);
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: email,
        password: hashedPassword,
        role: "admin",
        emailVerified: true
      }
    });

    console.log("✅ Admin created successfully!");
    console.log("Email:", admin.email);
    console.log("Password: Admin@123");

  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
