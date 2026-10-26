// routes/tripRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const ensureVerified = require('../middleware/ensureVerified');
const requireTerms = require('../middleware/requireTerms');
const { validate, schemas } = require('../middleware/validate');

// Posting a trip makes someone a traveler, so they must be ID-verified and have accepted the current rules.
router.post('/', verifyToken, ensureVerified, requireTerms, validate(schemas.trip), async (req, res) => {
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
        startLat,
        startLng,
        endLat,
        endLng,
        departure,
      },
    });

    // 👇 Step 2: Auto-match with pending deliveries
    const matchedDeliveries = await prisma.delivery.findMany({
      where: {
        pickup: start,
        dropoff: end,
        // Only deliveries a traveler may actually take: paid, unclaimed, and not the traveler's own.
        status: 'pending',
        paymentStatus: 'paid',
        travelerId: null,
        senderId: { not: req.user.id },
        createdAt: { lte: departure },
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
    res.status(500).json({ msg: 'Error creating trip' });
  }
});

module.exports = router;
