const axios = require("axios");
const polyline = require("@mapbox/polyline");

const getRoutePoints = async (start, end) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&key=${apiKey}`;

  const res = await axios.get(url);
  const routes = res.data.routes;

  if (!routes || routes.length === 0) return [];

  // Decode polyline to get array of lat/lng
  const points = polyline.decode(routes[0].overview_polyline.points);
  return points.map(([lat, lng]) => ({ lat, lng }));
};

module.exports = getRoutePoints;
