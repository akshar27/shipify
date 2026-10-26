// The rules for who may see and move a delivery, in one place. Routes call these instead of each writing their own query.

// The jobs a traveler may see: paid and not yet taken (by anyone), or the ones they have taken themselves.
// An unpaid delivery is never shown to travelers, and nobody sees another traveler's accepted job.
exports.visibleToTraveler = (userId) => ({
  senderId: { not: userId },
  OR: [
    { status: "pending", paymentStatus: "paid", travelerId: null },
    { travelerId: userId, status: { in: ["accepted", "in-transit"] } },
  ],
});

/**
 * Atomically claims a pending, paid delivery for a traveler. The conditions live in the UPDATE itself, so when two
 * travelers click at once exactly one update matches and the other gets count 0 (no read-then-write race).
 * Returns true if this traveler got it.
 */
exports.claimDelivery = async (tx, deliveryId, travelerId, status = "accepted") => {
  const { count } = await tx.delivery.updateMany({
    where: { id: deliveryId, status: "pending", paymentStatus: "paid", travelerId: null, senderId: { not: travelerId } },
    data: { status, travelerId },
  });
  return count === 1;
};
