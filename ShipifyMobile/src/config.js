import Constants from 'expo-constants';

// Where the API lives. Set EXPO_PUBLIC_API_URL (e.g. https://api.yourdomain.com) for staging and production builds.
// In development, Expo knows the address of the machine serving the bundle, so a phone on the same Wi-Fi reaches the backend
// running on that machine without any configuration.
const devHost = () => Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || `http://${devHost()}:5050`).replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api`;
