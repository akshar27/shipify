const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
// Created only when a key is set, so the server still boots without Stripe (payments then answer 503).
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const verifyToken = require('../middleware/auth');

router.post('/create-checkout-session', verifyToken, async (req, res) => {
  if (!stripe) return res.status(503).json({ msg: 'Payments are not configured (STRIPE_SECRET_KEY is not set).' });

  const { amount, deliveryId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Package Delivery Fee',
            },
            unit_amount: amount * 100, // amount in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success?deliveryId=${deliveryId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      metadata: {
        userId: req.user.id,
        deliveryId,
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Error", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
