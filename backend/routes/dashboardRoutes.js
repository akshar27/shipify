const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const verifyToken = require("../middleware/auth");

router.get("/summary", verifyToken, async (req, res) => {
  try {
    const [totalTrips, totalDeliveries, inTransit, delivered, recentDeliveries] = await Promise.all([
      prisma.trip.count({ where: { travelerId: req.user.id } }),
      prisma.delivery.count({ where: { senderId: req.user.id } }),
      prisma.delivery.count({ where: { senderId: req.user.id, status: "in-transit" } }),
      prisma.delivery.count({ where: { senderId: req.user.id, status: "delivered" } }),
      prisma.delivery.findMany({
        where: { senderId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    res.json({
      stats: { totalTrips, totalDeliveries, inTransit, delivered },
      recentDeliveries
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ msg: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
