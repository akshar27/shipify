// routes/tripRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');

router.post('/', verifyToken, async (req, res) => {
  const {
    start,
    end,
    departure,
    startLat,
    startLng,
    endLat,
    endLng
  } = req.body;

  try {
    const trip = await prisma.trip.create({
      data: {
        travelerId: req.user.id,
        start,
        end,
        startLat: parseFloat(startLat),
        startLng: parseFloat(startLng),
        endLat: parseFloat(endLat),
        endLng: parseFloat(endLng),
        departure: new Date(departure),
      },
    });

    // 👇 Step 2: Auto-match with pending deliveries
    const matchedDeliveries = await prisma.delivery.findMany({
      where: {
        pickup: start,
        dropoff: end,
        status: 'pending',
        createdAt: { lte: new Date(departure) },
      },
    });

    for (const delivery of matchedDeliveries) {
      const alreadyRequested = await prisma.deliveryRequest.findFirst({
        where: {
          deliveryId: delivery.id,
          travelerId: req.user.id,
        },
      });

      if (!alreadyRequested) {
        await prisma.deliveryRequest.create({
          data: {
            deliveryId: delivery.id,
            travelerId: req.user.id,
          },
        });
      }
    }

    res.status(201).json(trip);
  } catch (err) {
    console.error("Trip creation failed:", err);
    res.status(500).json({ msg: 'Error creating trip', error: err.message });
  }
});

module.exports = router;
