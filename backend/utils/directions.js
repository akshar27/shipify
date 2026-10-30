// Google Directions lookups for trip routes, cached. A trip's route does not change, so one lookup per trip is enough; without
// this every load of the traveler's jobs page paid for one Google call per trip. Coordinates are rounded to ~100 m so
// near-identical trips share an entry. Failures are not cached.
const axios = require("axios");
const polyline = require("@mapbox/polyline");

const TTL_MS = 24 * 3600 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map();
const defaultFetcher = (params) => axios.get("https://maps.googleapis.com/maps/api/directions/json", { params, timeout: 8000 }).then((r) => r.data);
let fetcher = defaultFetcher;

exports.setFetcherForTests = (fn) => {
  fetcher = fn;
  cache.clear();
};

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Decoded route points [{lat,lng}] for a trip, or null if Google has no route or the call fails. */
exports.routePoints = async (trip, now = Date.now()) => {
  const key = [trip.startLat, trip.startLng, trip.endLat, trip.endLng].map(r3).join(",");
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.points;

  // Development only: with no Maps key, treat the route as the straight line between the endpoints so the traveler flow can be
  // exercised locally. In production a missing key is a configuration error and fails (the trip is skipped), never a silent downgrade.
  if (!process.env.GOOGLE_MAPS_API_KEY && process.env.NODE_ENV !== "production" && fetcher === defaultFetcher) {
    return Array.from({ length: 41 }, (_, i) => ({
      lat: trip.startLat + ((trip.endLat - trip.startLat) * i) / 40,
      lng: trip.startLng + ((trip.endLng - trip.startLng) * i) / 40,
    }));
  }

  try {
    const data = await fetcher({
      origin: `${trip.startLat},${trip.startLng}`,
      destination: `${trip.endLat},${trip.endLng}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
    });
    const route = data?.routes?.[0];
    if (!route) return null;
    const points = polyline.decode(route.overview_polyline.points).map(([lat, lng]) => ({ lat, lng }));
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { at: now, points });
    return points;
  } catch (err) {
    console.error("[directions] lookup failed:", err.message);
    return null;
  }
};
