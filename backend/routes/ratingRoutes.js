const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');

// routes/ratingRoutes.js
router.post('/', verifyToken, async (req, res) => {
    const { deliveryId, receiverId, rating, comment } = req.body;
  
    try {
      const existing = await prisma.rating.findFirst({
        where: {
          deliveryId,
          raterId: req.user.id,
        },
      });
  
      if (existing) return res.status(400).json({ msg: "You already rated this delivery." });
  
      const newRating = await prisma.rating.create({
        data: {
          deliveryId,
          raterId: req.user.id,
          receiverId,
          rating,
          comment,
        },
      });
  
      res.status(201).json(newRating);
    } catch (err) {
      res.status(500).json({ msg: 'Failed to submit rating', error: err.message });
    }
  });
  

router.get('/user/:userId', async (req, res) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { receiverId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    });

    const avgRating = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : null;

    res.json({ avgRating, ratings });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch ratings", error: err.message });
  }
});

router.get('/delivery/:deliveryId', verifyToken, async (req, res) => {
    try {
      const rating = await prisma.rating.findFirst({
        where: {
          deliveryId: req.params.deliveryId,
          raterId: req.user.id,
        },
      });
      res.json(rating);
    } catch (err) {
      res.status(500).json({ msg: 'Failed to fetch rating', error: err.message });
    }
  });
  

module.exports = router;
