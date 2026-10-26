// The handover code. The sender shows it to whoever receives the package; the traveler types it in at drop-off.
// It is never stored: it is recomputed from the delivery id, a random per-delivery salt, and a server secret, so a database
// leak does not reveal anyone's code. Six digits is guessable, so wrong tries are counted and the delivery locks at MAX_ATTEMPTS.
const crypto = require("crypto");

exports.MAX_ATTEMPTS = 5;

exports.newSalt = () => crypto.randomBytes(16).toString("hex");

exports.codeFor = (deliveryId, salt) => {
  const mac = crypto.createHmac("sha256", `${process.env.JWT_SECRET}:handover`).update(`${deliveryId}:${salt}`).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, "0");
};

exports.codesMatch = (a, b) => typeof a === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// A delivery as the API shows it: without the salt or the attempt counter.
exports.publicDelivery = (d) => {
  if (!d) return d;
  const { handoverSalt, handoverAttempts, ...rest } = d;
  return rest;
};
