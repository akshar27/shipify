const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const ensureVerified = require('../middleware/ensureVerified');
const { haversineDistance } = require('../utils/geo');

// Create delivery
router.post('/', verifyToken, ensureVerified, async (req, res) => {
  const { pickup, dropoff, pickupLat, pickupLng, dropoffLat, dropoffLng, itemType, size, weight } = req.body;
  try {
    const delivery = await prisma.delivery.create({
      data: {
        senderId: req.user.id,
        pickup,
        dropoff,
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        dropoffLat: parseFloat(dropoffLat),
        dropoffLng: parseFloat(dropoffLng),
        itemType,
        size,
        weight: parseFloat(weight)
      },
    });
    res.status(201).json(delivery);
  } catch (err) {
    console.error("Delivery creation error:", err);
    res.status(500).json({ msg: 'Failed to create delivery', error: err.message });
  }
});

// Fetch deliveries for logged-in sender
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const deliveries = await prisma.delivery.findMany({
      where: { senderId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        requests: {
          select: {
            travelerId: true,
            status: true,
          },
        },
      },
    });

    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch deliveries', error: err.message });
  }
});


// // GET /api/deliveries/:id/match - Find matching trips based on geolocation
// router.get('/:id/match', verifyToken, async (req, res) => {
//   const deliveryId = req.params.id;
//   const MATCH_RADIUS_KM = 30;

//   try {
//     const delivery = await prisma.delivery.findUnique({
//       where: { id: deliveryId },
//     });

//     if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

//     if (
//       delivery.pickupLat == null || delivery.pickupLng == null ||
//       delivery.dropoffLat == null || delivery.dropoffLng == null
//     ) {
//       return res.status(400).json({ msg: "Delivery is missing geolocation data." });
//     }

//     const allTrips = await prisma.trip.findMany({
//       where: {
//         departure: {
//           gte: new Date(),
//         },
//       },
//       include: {
//         traveler: {
//           select: { id: true, name: true, email: true, isVerified: true },
//         },
//       },
//     });

//     const matchingTrips = allTrips.filter(trip => {
//       if (
//         trip.startLat == null || trip.startLng == null ||
//         trip.endLat == null || trip.endLng == null
//       ) return false;

//       const pickupDistance = haversineDistance(
//         delivery.pickupLat, delivery.pickupLng,
//         trip.startLat, trip.startLng
//       );

//       const dropoffDistance = haversineDistance(
//         delivery.dropoffLat, delivery.dropoffLng,
//         trip.endLat, trip.endLng
//       );

//       return pickupDistance <= MATCH_RADIUS_KM && dropoffDistance <= MATCH_RADIUS_KM;
//     });

//     res.json({
//       matches: matchingTrips,
//       count: matchingTrips.length,
//     });

//   } catch (err) {
//     console.error("Error in delivery match:", err);
//     res.status(500).json({ msg: "Failed to find matching trips", error: err.message });
//   }
// });

router.patch('/:id/complete', verifyToken, ensureVerified, async (req, res) => {
  const { id } = req.params;

  try {
    const delivery = await prisma.delivery.update({
      where: { id },
      data: { status: 'delivered' }
    });

    res.json({ msg: 'Delivery marked as complete', delivery });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to mark as complete', error: err.message });
  }
});

// Accept a delivery by traveler
router.patch('/:id/accept', verifyToken, ensureVerified, async (req, res) => {
  const { id } = req.params;

  try {
    const delivery = await prisma.delivery.update({
      where: { id },
      data: { status: 'accepted' }
    });

    res.json({ msg: 'Delivery accepted by traveler', delivery });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to accept delivery', error: err.message });
  }
});

module.exports = router;
