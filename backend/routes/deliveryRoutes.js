const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const ensureVerified = require('../middleware/ensureVerified');
const requireTerms = require('../middleware/requireTerms');
const { haversineDistance } = require('../utils/geo');
const { validate, schemas } = require('../middleware/validate');
const { claimDelivery } = require('../utils/deliveryState');
const { newSalt, codeFor, codesMatch, publicDelivery, MAX_ATTEMPTS } = require('../utils/handover');
const { confirmCutoff } = require('../utils/payouts');
const { notify } = require('../utils/notify');

// Create delivery
router.post('/', verifyToken, ensureVerified, requireTerms, validate(schemas.delivery), async (req, res) => {
  const { pickup, dropoff, pickupLat, pickupLng, dropoffLat, dropoffLng, itemType, size, weight, declaredValue } = req.body;
  try {
    const delivery = await prisma.delivery.create({
      data: {
        senderId: req.user.id,
        pickup,
        dropoff,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        itemType,
        size,
        weight,
        declaredValueCents: Math.round(declaredValue * 100),
        contentsConfirmedAt: new Date(), // the sender ticked the prohibited-items declaration (validated as true)
      },
    });
    res.status(201).json(publicDelivery(delivery));
  } catch (err) {
    console.error("Delivery creation error:", err);
    res.status(500).json({ msg: 'Failed to create delivery' });
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

    res.json(deliveries.map(publicDelivery));
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch deliveries' });
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

const notFound = (res) => res.status(404).json({ msg: 'Delivery not found' });
const validId = (req) => schemas.id.safeParse(req.params).success;
const CARRYING = ['accepted', 'in-transit'];

// A traveler takes a paid, unclaimed delivery. The claim is one conditional UPDATE, so two travelers cannot both get it.
router.patch('/:id/accept', verifyToken, ensureVerified, requireTerms, async (req, res, next) => {
  if (!validId(req)) return notFound(res);
  const { id } = req.params;

  try {
    const claimed = await claimDelivery(prisma, id, req.user.id, 'accepted');
    if (!claimed) return res.status(409).json({ msg: 'This delivery is not available' });

    const delivery = await prisma.delivery.findUnique({ where: { id } });
    notify('accepted', id);
    res.json({ msg: 'Delivery accepted by traveler', delivery: publicDelivery(delivery) });
  } catch (err) {
    next(err);
  }
});

// The sender looks up the handover code to give to the recipient. Nobody else can: not the traveler, who has to get it from the recipient.
router.get('/:id/handover-code', verifyToken, async (req, res, next) => {
  if (!validId(req)) return notFound(res);
  const { id } = req.params;

  try {
    let delivery = await prisma.delivery.findFirst({ where: { id, senderId: req.user.id, paymentStatus: 'paid', status: { in: CARRYING } } });
    if (!delivery) return notFound(res);
    if (!delivery.handoverSalt) {
      // A delivery accepted before handover codes existed: issue its salt now (only if still missing, so two requests agree).
      await prisma.delivery.updateMany({ where: { id, handoverSalt: null }, data: { handoverSalt: newSalt() } });
      delivery = await prisma.delivery.findUnique({ where: { id } });
    }
    res.json({ code: codeFor(id, delivery.handoverSalt) });
  } catch (err) {
    next(err);
  }
});

// The assigned traveler marks the package delivered by entering the code the recipient gives them. (An admin can complete one
// without a code, to fix a stuck job.) Wrong codes are counted atomically and lock the delivery at MAX_ATTEMPTS.
router.patch('/:id/complete', verifyToken, ensureVerified, validate(schemas.complete), async (req, res, next) => {
  if (!validId(req)) return notFound(res);
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';

  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id, status: { in: CARRYING }, ...(isAdmin ? {} : { travelerId: req.user.id }) },
    });
    if (!delivery) return res.status(409).json({ msg: 'This delivery cannot be completed by you right now' });

    if (!isAdmin) {
      if (!req.body.code) return res.status(400).json({ msg: 'Enter the 6-digit code from the recipient' });
      if (!delivery.handoverSalt) return res.status(409).json({ msg: 'No code has been issued yet: ask the sender to open their code first' });

      // Count the attempt before looking at the code, in one conditional UPDATE, so parallel guesses cannot exceed the limit.
      const counted = await prisma.delivery.updateMany({ where: { id, handoverAttempts: { lt: MAX_ATTEMPTS } }, data: { handoverAttempts: { increment: 1 } } });
      if (counted.count !== 1) return res.status(423).json({ msg: 'Too many wrong codes. This delivery is locked: contact support.' });

      if (!codesMatch(req.body.code, codeFor(id, delivery.handoverSalt))) {
        const left = MAX_ATTEMPTS - (delivery.handoverAttempts + 1);
        return res.status(400).json({ msg: left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Wrong code. This delivery is now locked: contact support.' });
      }
    }

    const { count } = await prisma.delivery.updateMany({ where: { id, status: { in: CARRYING } }, data: { status: 'delivered', deliveredAt: new Date() } });
    if (count !== 1) return res.status(409).json({ msg: 'This delivery cannot be completed right now' });
    notify('delivered', id);

    res.json({ msg: 'Delivery marked as complete', delivery: publicDelivery(await prisma.delivery.findUnique({ where: { id } })) });
  } catch (err) {
    next(err);
  }
});

// The sender confirms they (or the recipient) got the package. This is what makes the traveler's payout due.
router.post('/:id/confirm', verifyToken, async (req, res, next) => {
  if (!validId(req)) return notFound(res);
  try {
    const { count } = await prisma.delivery.updateMany({
      where: { id: req.params.id, senderId: req.user.id, status: 'delivered' },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    if (count !== 1) return res.status(409).json({ msg: 'This delivery cannot be confirmed' });
    notify('confirmed', req.params.id);
    res.json({ msg: 'Delivery confirmed', delivery: publicDelivery(await prisma.delivery.findUnique({ where: { id: req.params.id } })) });
  } catch (err) {
    next(err);
  }
});

// The sender reports a problem: before delivery (it never arrived) or within the confirm window after it. Freezes the payout until an admin decides.
router.post('/:id/dispute', verifyToken, validate(schemas.dispute), async (req, res, next) => {
  if (!validId(req)) return notFound(res);
  try {
    const { count } = await prisma.delivery.updateMany({
      where: {
        id: req.params.id,
        senderId: req.user.id,
        paymentStatus: 'paid',
        OR: [{ status: { in: CARRYING } }, { status: 'delivered', deliveredAt: { gt: confirmCutoff() } }],
      },
      data: { status: 'disputed', disputeReason: req.body.reason, disputedAt: new Date() },
    });
    if (count !== 1) return res.status(409).json({ msg: 'This delivery cannot be disputed (the window may have closed)' });
    notify('disputed', req.params.id);
    res.json({ msg: 'Thanks, an admin will look into it', delivery: publicDelivery(await prisma.delivery.findUnique({ where: { id: req.params.id } })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
