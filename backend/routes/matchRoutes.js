const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const prisma = require("../config/prisma");
const { routePoints: getRoutePoints } = require("../utils/directions");
const { isPointNearRoute } = require("../utils/geo");
const { visibleToTraveler } = require("../utils/deliveryState");
const { publicDelivery } = require("../utils/handover");

const MAX_RADIUS_KM = 15;

router.get("/matches-for-traveler", verifyToken, async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { travelerId: req.user.id },
    });

    if (!trips.length) {
      console.log("🔴 No trips found for this user.");
      return res.json([]);
    }

    const deliveries = await prisma.delivery.findMany({
      where: visibleToTraveler(req.user.id),
      include: {
        sender: {
          select: { id: true, name: true }, // no email: a sender's address is not for every traveler who drives past
        },
      },
    });    

    const matches = [];

    for (const trip of trips) {
      if (!trip.startLat || !trip.endLat || !trip.startLng || !trip.endLng) {
        console.log(`⚠️ Skipping trip ${trip.id} - missing lat/lng`);
        continue;
      }

      const routePoints = await getRoutePoints(trip);
      if (!routePoints) {
        console.log(`❌ No route for trip ${trip.id}`);
        continue;
      }

      for (const delivery of deliveries) {
        if (
          !delivery.pickupLat || !delivery.pickupLng ||
          !delivery.dropoffLat || !delivery.dropoffLng
        ) {
          console.log(`⚠️ Skipping delivery ${delivery.id} - missing lat/lng`);
          continue;
        }

        const pickupNear = isPointNearRoute(
          routePoints,
          delivery.pickupLat,
          delivery.pickupLng,
          MAX_RADIUS_KM
        );

        const dropoffNear = isPointNearRoute(
          routePoints,
          delivery.dropoffLat,
          delivery.dropoffLng,
          MAX_RADIUS_KM
        );

        if (pickupNear && dropoffNear) {
          matches.push({
            tripId: trip.id,
            deliveryId: delivery.id,
            delivery: publicDelivery(delivery),
          });
          console.log(`✅ Delivery ${delivery.id} matches trip ${trip.id}`);
        } else {
          console.log(`🚫 Delivery ${delivery.id} does NOT match trip ${trip.id}`);
        }
      }
    }

    res.json(matches);
  } catch (err) {
    console.error("🔥 Geo Match Error:", err);
    res.status(500).json({ msg: "Failed to fetch geo-matched deliveries" });
  }
});

module.exports = router;
