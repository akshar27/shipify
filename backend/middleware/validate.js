const { z } = require("zod");

// bcrypt only uses the first 72 bytes of a password, so longer ones are rejected instead of silently truncated.
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

exports.schemas = {
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
