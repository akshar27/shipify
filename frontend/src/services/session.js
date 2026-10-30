// The logged-in user and token live in localStorage. Anything can be in there (an old version, a half-written value, someone
// editing it), so reading must never throw: a bad value means "logged out", not a blank page.
export function getUser() {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user && typeof user === "object" ? user : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
