const env = require("../config/env");

const HOUR = 60 * 60 * 1000;

exports.confirmWindowMs = () => env.AUTO_CONFIRM_HOURS * HOUR;

exports.confirmCutoff = (now = new Date()) => new Date(now.getTime() - exports.confirmWindowMs());

// A delivery is ready to pay the traveler when it was paid for and either the sender confirmed it, or it was delivered and the
// sender's confirm/dispute window passed in silence. Already paid out, disputed, refunded and unfinished deliveries never match.
exports.payoutReadyWhere = (now = new Date()) => ({
  paymentStatus: "paid",
  travelerId: { not: null },
  payout: { is: null },
  OR: [{ status: "confirmed" }, { status: "delivered", deliveredAt: { lte: exports.confirmCutoff(now) } }],
});

// Splits what the sender paid into the platform's fee and what the traveler is owed, in whole cents (the traveler gets the remainder).
exports.splitAmount = (grossCents, feePercent = env.PLATFORM_FEE_PERCENT) => {
  const feeCents = Math.round((grossCents * feePercent) / 100);
  return { grossCents, feeCents, netCents: grossCents - feeCents };
};
