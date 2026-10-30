const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const handler = (_req, res) => res.status(429).json({ msg: "Too many requests, please try again later." });
const common = { windowMs: 15 * 60 * 1000, standardHeaders: "draft-7", legacyHeaders: false, handler };

// Everything: generous, only stops runaway clients.
exports.globalLimiter = rateLimit({ ...common, limit: env.GLOBAL_RATE_LIMIT });

// Login, register, password reset, resend: the endpoints worth brute-forcing or abusing to send mail.
exports.authLimiter = rateLimit({ ...common, limit: env.AUTH_RATE_LIMIT });
