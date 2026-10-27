import * as Location from 'expo-location';

/**
 * Coordinates for an address typed by hand, or {} if the device cannot find it (offline, web build, unknown place). The backend
 * accepts a delivery or trip without coordinates; it just cannot be auto-matched to routes.
 */
export async function geocode(address) {
  try {
    const [hit] = await Location.geocodeAsync(address);
    return hit ? { lat: hit.latitude, lng: hit.longitude } : {};
  } catch {
    return {};
  }
}
