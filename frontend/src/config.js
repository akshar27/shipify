// Single source of truth for where the backend lives. Override with REACT_APP_API_URL (e.g. in frontend/.env).
// Default is 5050, not 5000: on macOS port 5000 is taken by the AirPlay Receiver.
export const API_ORIGIN = process.env.REACT_APP_API_URL || "http://localhost:5050";
export const API_BASE = `${API_ORIGIN}/api`;
