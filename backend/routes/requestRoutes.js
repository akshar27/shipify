const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth'); // Make sure this is imported

// Create a delivery request
router.post('/', async (req, res) => {
  const { deliveryId, travelerId } = req.body;

  try {
    const existing = await prisma.deliveryRequest.findFirst({
      where: { deliveryId, travelerId }
    });

    if (existing) return res.status(400).json({ msg: 'Already requested' });

    const request = await prisma.deliveryRequest.create({
      data: { deliveryId, travelerId }
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to create request', error: err.message });
  }
});

// ✅ Accept a delivery request
router.patch('/:id/accept', async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data: { status: 'accepted' }
    });

    // Update delivery status
    await prisma.delivery.update({
      where: { id: updated.deliveryId },
      data: { status: 'in-transit' }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: 'Error accepting request', error: err.message });
  }
});

// Get requests sent to the logged-in traveler
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const requests = await prisma.deliveryRequest.findMany({
      where: { travelerId: req.user.id },
      include: {
        delivery: {
          include: { sender: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch requests', error: err.message });
  }
});


module.exports = router;
