const { z } = require("zod");

// bcrypt only uses the first 72 bytes of a password, so longer ones are rejected instead of silently truncated.
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

// Optional coordinates arrive as numbers or numeric strings, or not at all (the user typed an address without picking a suggestion).
const coord = (min, max) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(min).max(max).optional());

exports.schemas = {
  delivery: z.object({
    pickup: z.string().trim().min(1).max(300),
    dropoff: z.string().trim().min(1).max(300),
    pickupLat: coord(-90, 90),
    pickupLng: coord(-180, 180),
    dropoffLat: coord(-90, 90),
    dropoffLng: coord(-180, 180),
    itemType: z.string().trim().min(1).max(100),
    size: z.string().trim().min(1).max(100),
    weight: z.coerce.number().positive().max(1000),
  }),
  id: z.object({ id: z.string().uuid() }),
  complete: z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional() }),
  dispute: z.object({ reason: z.string().trim().min(10, "Please describe what went wrong (at least 10 characters)").max(1000) }),
  payout: z.object({ reference: z.string().trim().min(3, "Enter the payment reference").max(200) }),
  resolve: z.object({ action: z.enum(["release", "refund"]), note: z.string().trim().min(3, "A note is required").max(1000) }),
  register: z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email,
    password,
  }), // a client-supplied role is ignored on purpose: accounts are always created as plain users
  login: z.object({ email, password: z.string().min(1).max(72) }),
  forgotPassword: z.object({ email }),
  resetPassword: z.object({ token: z.string().min(10).max(200), password }),
  resendVerification: z.object({ email }),
};

/** Express middleware: replaces req.body with the parsed value (unknown fields dropped) or answers 400 with the first problem. */
exports.validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ msg: result.error.issues[0].message });
  }
  req.body = result.data;
  next();
};
