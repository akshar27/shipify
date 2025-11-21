const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const prisma = require("../config/prisma");
const axios = require("axios");
const polyline = require("@mapbox/polyline");
const { isPointNearRoute } = require("../utils/geo");

const MAX_RADIUS_KM = 15; // temporarily increase for debugging

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
      where: {
        senderId: { not: req.user.id },
        status: {
          in: ["pending", "accepted"],
        },
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
      },
    });    

    const matches = [];
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    for (const trip of trips) {
      if (!trip.startLat || !trip.endLat || !trip.startLng || !trip.endLng) {
        console.log(`⚠️ Skipping trip ${trip.id} - missing lat/lng`);
        continue;
      }

      // 1️⃣ Fetch route from Google with full resolution
      const directionsRes = await axios.get("https://maps.googleapis.com/maps/api/directions/json", {
        params: {
          origin: `${trip.startLat},${trip.startLng}`,
          destination: `${trip.endLat},${trip.endLng}`,
          key: apiKey,
          overview: "full", // high resolution polyline
        },
      });

      const route = directionsRes.data.routes[0];
      if (!route) {
        console.log(`❌ No route found for trip ${trip.id}`);
        continue;
      }

      const decodedPoints = polyline.decode(route.overview_polyline.points);
      const routePoints = decodedPoints.map(([lat, lng]) => ({ lat, lng }));

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
            delivery,
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
    res.status(500).json({ msg: "Failed to fetch geo-matched deliveries", error: err.message });
  }
});

module.exports = router;
