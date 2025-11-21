// scripts/resetDatabase.js
const prisma = require("../config/prisma");

async function resetDB() {
  console.log("🚨 Wiping ALL data from ALL tables...");

  await prisma.message.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.verificationRequest.deleteMany({});
  await prisma.deliveryRequest.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🧹 All tables cleared!");

  // Reset sequences for uuid tables not needed
  // But if you ever add autoincrement IDs, reset like this:
  // await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`);

  await prisma.$disconnect();
  console.log("✨ Done!");
}

resetDB().catch((err) => {
  console.error(err);
  prisma.$disconnect();
});
