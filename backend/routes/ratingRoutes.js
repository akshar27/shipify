const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { confirmCutoff } = require('../utils/payouts');
const verifyToken = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

/**
 * Rate the other party of a delivery. Only the sender or the traveler of a confirmed delivery may rate, once each, and the person
 * being rated is always the other party: the client's receiverId is ignored, so nobody can rate strangers or inflate their own score.
 */
router.post('/', verifyToken, validate(schemas.rating), async (req, res, next) => {
  const { deliveryId, rating, comment } = req.body;

  try {
    const delivery = await prisma.delivery.findFirst({
      where: {
        id: deliveryId,
        AND: [
          { OR: [{ senderId: req.user.id }, { travelerId: req.user.id }] },
          // Confirmed by the sender, or delivered and the sender's confirm window passed in silence (which counts as confirmed).
          { OR: [{ status: 'confirmed' }, { status: 'delivered', deliveredAt: { lte: confirmCutoff() } }] },
        ],
      },
    });
    if (!delivery) return res.status(404).json({ msg: 'You can rate a delivery once it is confirmed, if you took part in it' });

    const receiverId = delivery.senderId === req.user.id ? delivery.travelerId : delivery.senderId;
    if (!receiverId || receiverId === req.user.id) return res.status(400).json({ msg: 'There is nobody to rate' });

    const existing = await prisma.rating.findFirst({ where: { deliveryId, raterId: req.user.id } });
    if (existing) return res.status(400).json({ msg: 'You already rated this delivery.' });

    res.status(201).json(await prisma.rating.create({ data: { deliveryId, raterId: req.user.id, receiverId, rating, comment } }));
  } catch (err) {
    next(err);
  }
});


/**
 * Get ratings received by a user (Profile Page)
 */
router.get('/user/:userId', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.userId)) return res.status(404).json({ msg: 'User not found' });
  try {
    const ratings = await prisma.rating.findMany({
      where: { receiverId: req.params.userId },
      include: {
        rater: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const avgRating = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : null;

    res.json({
      avgRating,
      totalRatings: ratings.length,
      ratings
    });

  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch ratings" });
  }
});


/**
 * Check if logged-in user already rated this delivery
 */
router.get('/delivery/:deliveryId', verifyToken, async (req, res) => {
  try {
    const rating = await prisma.rating.findFirst({
      where: {
        deliveryId: req.params.deliveryId,
        raterId: req.user.id
      }
    });

    res.json(rating);

  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch rating" });
  }
});

module.exports = router;
