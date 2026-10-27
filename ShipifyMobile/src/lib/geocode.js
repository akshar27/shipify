import * as Location from 'expo-location';

/**
 * Coordinates for an address typed by hand, or {} if the device cannot find it (offline, web build, unknown place). The backend
 * requires coordinates for a delivery or trip (without them it could never be matched), so callers must treat {} as "not found".
 */
export async function geocode(address) {
  try {
    const [hit] = await Location.geocodeAsync(address);
    return hit ? { lat: hit.latitude, lng: hit.longitude } : {};
  } catch {
    return {};
  }
}
