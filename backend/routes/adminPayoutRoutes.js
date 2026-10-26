// Admin: who is owed money, who has been paid, and disputes. Mounted under /api/admin. Payouts are manual in the MVP:
// the admin pays the traveler outside the app (bank transfer etc.) and records the reference here; the app records that
// it happened exactly once and what was paid.
const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { validate, schemas } = require("../middleware/validate");
const { payoutReadyWhere, splitAmount, confirmWindowMs } = require("../utils/payouts");
const { publicDelivery } = require("../utils/handover");
const { getStripe } = require("../utils/stripe");

const router = express.Router();
router.use(verifyToken, requireAdmin);

const person = { select: { id: true, name: true, email: true } };
const isId = (v) => z.string().uuid().safeParse(v).success;
const paidPayment = (d) => d.payments.find((p) => p.status === "paid");

/** Deliveries whose traveler is owed money now, oldest first, with the split already worked out. */
router.get("/payouts/ready", async (_req, res, next) => {
  try {
    const rows = await prisma.delivery.findMany({
      where: payoutReadyWhere(),
      orderBy: { deliveredAt: "asc" },
      include: { sender: person, traveler: person, payments: { where: { status: "paid" } } },
    });
    res.json(
      rows
        .filter((d) => paidPayment(d))
        .map((d) => {
          const p = paidPayment(d);
          return {
            ...publicDelivery(d),
            payments: undefined,
            currency: p.currency,
            ...splitAmount(p.amountCents),
            // who made it payable: the sender, an admin who released a dispute, or the silent confirm window
            confirmedBy: d.status !== "confirmed" ? "timeout" : d.resolutionNote?.startsWith("Released to traveler") ? "admin" : "sender",
            readySince: d.status === "confirmed" ? d.confirmedAt : new Date(d.deliveredAt.getTime() + confirmWindowMs()),
          };
        })
    );
  } catch (err) {
    next(err);
  }
});

/** Record that the traveler has been paid. Once per delivery: the unique deliveryId rejects a second click or a second admin. */
router.post("/payouts/:deliveryId", validate(schemas.payout), async (req, res, next) => {
  if (!isId(req.params.deliveryId)) return res.status(404).json({ msg: "Delivery not found" });
  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id: req.params.deliveryId, ...payoutReadyWhere() },
      include: { payments: { where: { status: "paid" } } },
    });
    const payment = delivery && paidPayment(delivery);
    if (!payment) return res.status(409).json({ msg: "This delivery is not ready for payout (or was already paid out)" });

    try {
      const payout = await prisma.payout.create({
        data: {
          deliveryId: delivery.id,
          travelerId: delivery.travelerId,
          currency: payment.currency,
          reference: req.body.reference,
          paidById: req.user.id,
          ...splitAmount(payment.amountCents),
        },
      });
      res.status(201).json(payout);
    } catch (err) {
      if (err.code === "P2002") return res.status(409).json({ msg: "Already paid out" });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.get("/payouts/history", async (_req, res, next) => {
  try {
    res.json(
      await prisma.payout.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { traveler: person, paidBy: person, delivery: { select: { id: true, pickup: true, dropoff: true } } },
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get("/disputes", async (_req, res, next) => {
  try {
    const rows = await prisma.delivery.findMany({
      where: { status: "disputed" },
      orderBy: { disputedAt: "asc" },
      include: { sender: person, traveler: person },
    });
    res.json(rows.map(publicDelivery));
  } catch (err) {
    next(err);
  }
});

/**
 * Decide a dispute. "release": the traveler did the job, so the delivery becomes confirmed and the payout is due.
 * "refund": the sender gets their money back through Stripe and the delivery is closed.
 */
router.post("/disputes/:deliveryId/resolve", validate(schemas.resolve), async (req, res, next) => {
  if (!isId(req.params.deliveryId)) return res.status(404).json({ msg: "Delivery not found" });
  const { action, note } = req.body;
  const id = req.params.deliveryId;

  try {
    const delivery = await prisma.delivery.findFirst({ where: { id, status: "disputed" }, include: { payments: { where: { status: "paid" } } } });
    if (!delivery) return res.status(409).json({ msg: "This delivery is not in dispute" });

    if (action === "release") {
      await prisma.delivery.updateMany({ where: { id, status: "disputed" }, data: { status: "confirmed", confirmedAt: new Date(), resolutionNote: `Released to traveler: ${note}` } });
      return res.json({ msg: "Released: the payout is now due" });
    }

    const payment = paidPayment(delivery);
    if (!payment?.stripePaymentIntentId) return res.status(409).json({ msg: "No Stripe payment to refund for this delivery" });
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ msg: "Stripe is not configured" });

    try {
      // The delivery id makes the refund idempotent: clicking twice cannot refund twice.
      await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId }, { idempotencyKey: `refund-${id}` });
    } catch (err) {
      console.error("[stripe] refund failed", err);
      return res.status(502).json({ msg: "Stripe refused the refund; nothing was changed" });
    }
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "refunded" } }),
      prisma.delivery.update({ where: { id }, data: { status: "refunded", paymentStatus: "refunded", resolutionNote: `Refunded to sender: ${note}` } }),
    ]);
    res.json({ msg: "Refunded to the sender" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
