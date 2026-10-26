import API from "./api";

let cached = null;

// The rules (prohibited items, value cap, traveler rules, terms version, contact details) come from the server, so what
// people read here is always what the server enforces. Fetched once per page load.
export function getRules() {
  if (!cached) {
    cached = API.get("/legal/rules")
      .then((res) => res.data)
      .catch((err) => {
        cached = null; // try again next time instead of caching a failure
        throw err;
      });
  }
  return cached;
}

export const money = (cents, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);
