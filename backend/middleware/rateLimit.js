const rateLimit = require("express-rate-limit");

const handler = (_req, res) => res.status(429).json({ msg: "Too many requests, please try again later." });

// Everything: generous, only stops runaway clients.
exports.globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false, handler });

// Login, register, password reset, resend: the endpoints worth brute-forcing or abusing to send mail.
exports.authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, handler });
