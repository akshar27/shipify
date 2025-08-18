// routes/requestRoutes.js or matchRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const prisma = require("../config/prisma");

router.get("/matches-for-traveler", verifyToken, async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { travelerId: req.user.id },
    });    

    if (!trips.length) return res.json([]);

    const conditions = trips.map((t) => ({
      pickup: t.start,
      dropoff: t.end,
    }));

    const deliveries = await prisma.delivery.findMany({
      where: {
        senderId: { not: req.user.id }, 
        OR: conditions,
        status: "pending",
      },
      include: {
        sender: {
          select: { name: true, email: true },
        },
      },
    });    

    res.json(deliveries);
  } catch (err) {
    console.error("Match error", err);
    res.status(500).json({ msg: "Failed to fetch matching deliveries" });
  }
});

module.exports = router;
