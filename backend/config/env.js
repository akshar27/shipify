// Fails fast at boot instead of failing later in a request handler with a confusing error.
const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  // Comma-separated browser origins allowed to call the API and open sockets.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Number of reverse proxies in front of the app (nginx etc.), so rate limiting sees real client IPs. 0 = none.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}
if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_SECRET.length < 32) {
  console.error("Invalid environment configuration:\n  - JWT_SECRET must be at least 32 characters in production");
  process.exit(1);
}

module.exports = { ...parsed.data, corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) };
