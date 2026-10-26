const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const verifyToken = require("../middleware/auth");
const ensureVerified = require("../middleware/ensureVerified");
const env = require("../config/env");
const { getStripe } = require("../utils/stripe");

const router = express.Router();

const NOT_CONFIGURED = { msg: "Payments are not configured (STRIPE_SECRET_KEY is not set)." };
const CHECKOUT_REUSE_MS = 20 * 60 * 1000; // a Checkout session stays open for 24h; reusing a fresh one stops double-clicks creating duplicates

/* ------------------------------------------------------------------------------------------------
   Start a payment. The browser says only WHICH delivery; the amount, currency and payer come from the server.
------------------------------------------------------------------------------------------------ */
router.post("/create-checkout-session", verifyToken, ensureVerified, async (req, res, next) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json(NOT_CONFIGURED);

  const parsed = z.object({ deliveryId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ msg: "deliveryId is required" });
  const { deliveryId } = parsed.data;

  try {
    // 404 (not 403) for someone else's delivery, so ids cannot be probed.
    const delivery = await prisma.delivery.findFirst({ where: { id: deliveryId, senderId: req.user.id } });
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    if (delivery.paymentStatus !== "unpaid" || delivery.status !== "pending") {
      return res.status(409).json({ msg: "This delivery cannot be paid for." });
    }

    const recent = await prisma.payment.findFirst({
      where: { deliveryId, status: "pending", checkoutUrl: { not: null }, createdAt: { gte: new Date(Date.now() - CHECKOUT_REUSE_MS) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return res.json({ url: recent.checkoutUrl, paymentId: recent.id, reused: true });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.PAYMENT_CURRENCY,
            unit_amount: env.DELIVERY_FEE_CENTS,
            product_data: { name: "Package delivery fee" },
          },
        },
      ],
      client_reference_id: deliveryId,
      metadata: { deliveryId, userId: req.user.id },
      success_url: `${env.CLIENT_URL}/payment-success?deliveryId=${deliveryId}`,
      cancel_url: `${env.CLIENT_URL}/payment-cancel`,
    });

    const payment = await prisma.payment.create({
      data: {
        deliveryId,
        userId: req.user.id,
        amountCents: env.DELIVERY_FEE_CENTS,
        currency: env.PAYMENT_CURRENCY,
        stripeSessionId: session.id,
        checkoutUrl: session.url,
      },
    });
    res.json({ url: session.url, paymentId: payment.id });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------------------------------------
   What the success page asks, instead of believing the redirect. Sender (or an admin) only.
------------------------------------------------------------------------------------------------ */
router.get("/delivery/:deliveryId", verifyToken, async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.deliveryId).success) return res.status(404).json({ msg: "Delivery not found" });
  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id: req.params.deliveryId, ...(req.user.role === "admin" ? {} : { senderId: req.user.id }) },
      select: {
        id: true,
        paymentStatus: true,
        payments: { select: { id: true, status: true, amountCents: true, currency: true, createdAt: true, paidAt: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    res.json(delivery);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------------------------------------
   Stripe -> us. This is the ONLY place a delivery becomes paid.
   app.js mounts express.raw() for this exact path before the JSON parser: the signature is computed over the raw bytes.
------------------------------------------------------------------------------------------------ */
async function applyEvent(tx, event) {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const payment = await tx.payment.findUnique({ where: { stripeSessionId: obj.id } });
      if (!payment) return console.warn(`[stripe] ${event.type}: no payment for session ${obj.id}`);
      if (payment.status === "paid") return;
      // "completed" also fires for delayed methods that have not been paid yet: only a settled payment counts.
      if (obj.payment_status !== "paid") return;
      // Defence in depth: what Stripe says was charged must be what we asked for.
      if (obj.amount_total !== payment.amountCents || String(obj.currency).toLowerCase() !== payment.currency) {
        return console.error(`[stripe] amount/currency mismatch on session ${obj.id}: got ${obj.amount_total} ${obj.currency}, expected ${payment.amountCents} ${payment.currency}`);
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "paid", paidAt: new Date(), stripePaymentIntentId: typeof obj.payment_intent === "string" ? obj.payment_intent : null },
      });
      await tx.delivery.update({ where: { id: payment.deliveryId }, data: { paymentStatus: "paid" } });
      return;
    }
    case "checkout.session.expired": {
      await tx.payment.updateMany({ where: { stripeSessionId: obj.id, status: "pending" }, data: { status: "expired" } });
      return;
    }
    case "charge.refunded": {
      if (!obj.refunded || typeof obj.payment_intent !== "string") return; // partial refunds are not modelled
      const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: obj.payment_intent } });
      if (!payment) return;
      await tx.payment.update({ where: { id: payment.id }, data: { status: "refunded" } });
      await tx.delivery.update({ where: { id: payment.deliveryId }, data: { paymentStatus: "refunded" } });
      return;
    }
    default:
      return; // events we did not subscribe to are acknowledged and ignored
  }
}

router.post("/webhook", async (req, res) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).json({ msg: "Webhook is not configured" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch {
    return res.status(400).json({ msg: "Invalid signature" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Recording the event id and applying it succeed or fail together; a replay hits the primary key and is skipped.
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      await applyEvent(tx, event);
    });
  } catch (err) {
    if (err.code === "P2002") return res.json({ received: true, duplicate: true });
    console.error("[stripe] webhook processing failed", err);
    return res.status(500).json({ msg: "Processing failed" }); // non-2xx: Stripe retries
  }
  res.json({ received: true });
});

module.exports = router;
