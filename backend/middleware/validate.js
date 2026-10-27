const { z } = require("zod");
const env = require("../config/env");

// bcrypt only uses the first 72 bytes of a password, so longer ones are rejected instead of silently truncated.
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

// Optional coordinates arrive as numbers or numeric strings, or not at all (the user typed an address without picking a suggestion).
// Must be exactly `true` (a missing or false value gets the given message, not a type error).
const mustBeTrue = (message) => z.any().refine((v) => v === true, { message });

// A number field that may arrive as a string or not at all: missing or unreadable input gets a plain-language message
// instead of zod's "expected number, received NaN".
const num = (message) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.any().refine((v) => typeof v === "number" && Number.isFinite(v), { message }));

const coord = (min, max) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(min).max(max).optional());

// Where a package or trip starts and ends has to be a real point: matching skips anything without coordinates, so a delivery saved
// without them could be paid for and then never reach a single traveler.
const placeMsg = "Choose the place from the suggestions or click it on the map, so travelers can find it";
const required = (min, max) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number({ error: placeMsg }).min(min, placeMsg).max(max, placeMsg));

exports.schemas = {
  delivery: z.object({
    pickup: z.string().trim().min(1).max(300),
    dropoff: z.string().trim().min(1).max(300),
    pickupLat: required(-90, 90),
    pickupLng: required(-180, 180),
    dropoffLat: required(-90, 90),
    dropoffLng: required(-180, 180),
    itemType: z.string().trim().min(1).max(100),
    size: z.string().trim().min(1).max(100),
    weight: num("Enter the weight in kg").pipe(z.number().positive("Enter the weight in kg").max(1000, "The weight cannot be more than 1000 kg")),
    // What the sender says the item is worth (in the platform currency's major unit) and that it is not on the prohibited list.
    declaredValue: num("Enter the item's value").pipe(z.number().positive("Enter the item's value").max(env.MAX_ITEM_VALUE_CENTS / 100, `The declared value cannot be more than ${env.MAX_ITEM_VALUE_CENTS / 100}: more valuable items are not allowed`)),
    contentsConfirmed: mustBeTrue("You must confirm the package contains nothing on the prohibited list"),
  }),
  trip: z.object({
    start: z.string().trim().min(1).max(300),
    end: z.string().trim().min(1).max(300),
    departure: z.coerce.date(),
    startLat: required(-90, 90),
    startLng: required(-180, 180),
    endLat: required(-90, 90),
    endLng: required(-180, 180),
  }),
  id: z.object({ id: z.string().uuid() }),
  rating: z.object({ deliveryId: z.string().uuid(), rating: z.coerce.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"), comment: z.string().trim().max(500).optional() }),
  complete: z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional() }),
  dispute: z.object({ reason: z.string().trim().min(10, "Please describe what went wrong (at least 10 characters)").max(1000) }),
  payout: z.object({ reference: z.string().trim().min(3, "Enter the payment reference").max(200) }),
  resolve: z.object({ action: z.enum(["release", "refund"]), note: z.string().trim().min(3, "A note is required").max(1000) }),
  register: z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email,
    password,
    acceptTerms: mustBeTrue("You must accept the Terms and the prohibited-items rules"),
  }),
  acceptTerms: z.object({ accept: mustBeTrue("You must accept the Terms and the prohibited-items rules") }), // a client-supplied role is ignored on purpose: accounts are always created as plain users
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
