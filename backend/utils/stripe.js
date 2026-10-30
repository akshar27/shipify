// One place that owns the Stripe client, so routes never build their own and tests can swap in a fake.
const Stripe = require("stripe");

let client; // undefined = not resolved yet, null = not configured

exports.getStripe = () => {
  if (client === undefined) client = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
};

/** Tests only: replace the client (a fake, or null for "not configured"). */
exports.setStripeForTests = (c) => {
  client = c;
};
