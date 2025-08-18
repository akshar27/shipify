const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const ensureVerified = require('../middleware/ensureVerified');

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


// GET /api/deliveries/:id/match - find matching trips for a delivery
router.get('/:id/match', verifyToken, async (req, res) => {
  const deliveryId = req.params.id;

  try {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

    const trips = await prisma.trip.findMany({
      where: {
        start: delivery.pickup,
        end: delivery.dropoff,
        travelDate: {
          gte: new Date(), // only future trips
        },
      },
      orderBy: { travelDate: 'asc' },
      include: { traveler: true },
    });

    res.json(trips);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to find matches', error: err.message });
  }
});

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
