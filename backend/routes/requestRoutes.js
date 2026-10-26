const express = require('express');
const { z } = require('zod');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const ensureVerified = require('../middleware/ensureVerified');
const requireTerms = require('../middleware/requireTerms');
const { claimDelivery } = require('../utils/deliveryState');
const { publicDelivery } = require('../utils/handover');

// The sender asks a specific traveler to carry a (paid) delivery. The sender is always the caller.
router.post('/', verifyToken, ensureVerified, requireTerms, async (req, res, next) => {
  const parsed = z.object({ deliveryId: z.string().uuid(), travelerId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ msg: 'deliveryId and travelerId are required' });
  const { deliveryId, travelerId } = parsed.data;

  try {
    const delivery = await prisma.delivery.findFirst({ where: { id: deliveryId, senderId: req.user.id } });
    if (!delivery) return res.status(404).json({ msg: 'Delivery not found' });
    if (delivery.paymentStatus !== 'paid' || delivery.status !== 'pending' || delivery.travelerId) {
      return res.status(409).json({ msg: 'This delivery is not open for requests' });
    }

    const traveler = await prisma.user.findUnique({ where: { id: travelerId }, select: { id: true, isVerified: true } });
    if (!traveler || !traveler.isVerified || traveler.id === req.user.id) {
      return res.status(400).json({ msg: 'That traveler cannot be requested' });
    }

    const existing = await prisma.deliveryRequest.findFirst({ where: { deliveryId, travelerId } });
    if (existing) return res.status(400).json({ msg: 'Already requested' });

    const request = await prisma.deliveryRequest.create({ data: { deliveryId, travelerId } });
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

// The requested traveler accepts. Claiming the delivery and updating the requests happen in one transaction.
router.patch('/:id/accept', verifyToken, ensureVerified, requireTerms, async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ msg: 'Request not found' });

  try {
    const request = await prisma.deliveryRequest.findFirst({ where: { id: req.params.id, travelerId: req.user.id, status: 'pending' } });
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const updated = await prisma.$transaction(async (tx) => {
      if (!(await claimDelivery(tx, request.deliveryId, req.user.id, 'in-transit'))) return null;
      await tx.deliveryRequest.updateMany({ where: { deliveryId: request.deliveryId, id: { not: request.id }, status: 'pending' }, data: { status: 'rejected' } });
      return tx.deliveryRequest.update({ where: { id: request.id }, data: { status: 'accepted' } });
    });
    if (!updated) return res.status(409).json({ msg: 'This delivery is no longer available' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Requests sent to the logged-in traveler. The sender is selected field by field: it used to be the whole user row (password hash included).
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const requests = await prisma.deliveryRequest.findMany({
      where: { travelerId: req.user.id },
      include: {
        delivery: {
          include: { sender: { select: { id: true, name: true, email: true, profilePicture: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests.map((r) => ({ ...r, delivery: publicDelivery(r.delivery) })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
