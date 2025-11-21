// utils/geo.js

/**
 * Compute haversine distance between two coordinates (in km)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const toRad = deg => deg * (Math.PI / 180);
  
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }
  
  /**
   * Check if a target point is within a threshold (km) of any point on a route
   * @param {Array<{lat:number,lng:number}>} routePoints - decoded polyline points
   * @param {number} targetLat
   * @param {number} targetLng
   * @param {number} thresholdKm - default 2km
   * @returns {boolean}
   */
  function isPointNearRoute(routePoints, targetLat, targetLng, thresholdKm = 2) {
    return routePoints.some(p =>
      haversineDistance(p.lat, p.lng, targetLat, targetLng) <= thresholdKm
    );
  }

  function isPointBetweenTrip(pickupLat, pickupLng, dropoffLat, dropoffLng, tripStartLat, tripStartLng, tripEndLat, tripEndLng) {
    const pickupToStart = haversineDistance(pickupLat, pickupLng, tripStartLat, tripStartLng);
    const pickupToEnd = haversineDistance(pickupLat, pickupLng, tripEndLat, tripEndLng);
    const tripLength = haversineDistance(tripStartLat, tripStartLng, tripEndLat, tripEndLng);
  
    const dropoffToStart = haversineDistance(dropoffLat, dropoffLng, tripStartLat, tripStartLng);
    const dropoffToEnd = haversineDistance(dropoffLat, dropoffLng, tripEndLat, tripEndLng);
  
    // If pickup and dropoff are within some range of the path
    return (
      pickupToStart + pickupToEnd <= tripLength + 20 && // buffer
      dropoffToStart + dropoffToEnd <= tripLength + 20
    );
  }
  
  module.exports = {
    haversineDistance,
    isPointNearRoute
  };
  