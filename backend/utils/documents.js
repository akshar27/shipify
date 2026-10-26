// Private storage for identity documents. Unlike profile photos these never get a public URL:
//   - S3: the object is uploaded with no ACL (the bucket must block public access) and read through a short-lived signed URL.
//   - Local dev (no AWS_BUCKET_NAME): the file goes to backend/private-uploads/, which nothing serves statically, and is read
//     through a short-lived signed token handled by routes/documentRoutes.js.
// The database stores an opaque reference ("doc:<key>"), never a URL. Only admin endpoints turn it into a URL, on demand.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AWS = require("aws-sdk");

const PRIVATE_DIR = path.join(__dirname, "..", "private-uploads");
const REF_PREFIX = "doc:";
const URL_TTL_SECONDS = 300;

const usingS3 = () => Boolean(process.env.AWS_BUCKET_NAME);
const s3 = () =>
  new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION,
    signatureVersion: "v4",
  });

// Signing key for local document tokens, kept separate from login tokens so one can never be used as the other.
const docSecret = () => `${process.env.JWT_SECRET}:document`;

// The client-supplied mimetype and filename are not trusted: the content has to start like a real PNG, JPEG or PDF.
const SIGNATURES = [
  { ext: "png", type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", type: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "pdf", type: "application/pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];

exports.sniff = (buffer) => SIGNATURES.find((s) => s.test(buffer)) || null;

exports.storeDocument = async (file) => {
  const kind = exports.sniff(file.buffer);
  if (!kind) {
    const err = new Error("Unsupported file: upload a PNG, JPEG or PDF");
    err.status = 400;
    throw err;
  }
  // The name is random and the extension comes from the sniffed type, so nothing the client sends reaches the filesystem path.
  const key = `documents/${crypto.randomBytes(16).toString("hex")}.${kind.ext}`;
  if (usingS3()) {
    await s3().putObject({ Bucket: process.env.AWS_BUCKET_NAME, Key: key, Body: file.buffer, ContentType: kind.type }).promise();
  } else {
    const dest = path.join(PRIVATE_DIR, key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, file.buffer, { mode: 0o600 });
  }
  return REF_PREFIX + key;
};

/** Turns a stored reference into a URL that stops working after a few minutes. Returns null for no document. */
exports.resolveDocumentUrl = (ref, origin) => {
  if (!ref) return null;
  if (!ref.startsWith(REF_PREFIX)) return ref; // legacy row written before private storage: an old full URL, returned unchanged
  const key = ref.slice(REF_PREFIX.length);
  if (usingS3()) {
    return s3().getSignedUrl("getObject", { Bucket: process.env.AWS_BUCKET_NAME, Key: key, Expires: URL_TTL_SECONDS });
  }
  const token = jwt.sign({ purpose: "document", key }, docSecret(), { expiresIn: URL_TTL_SECONDS });
  return `${origin}/api/documents/${token}`;
};

/** Local-dev counterpart of a signed S3 URL: validates the token and returns the file path and content type, or null. */
exports.openLocalDocument = (token) => {
  let claims;
  try {
    claims = jwt.verify(token, docSecret());
  } catch {
    return null;
  }
  if (claims.purpose !== "document" || typeof claims.key !== "string") return null;
  const full = path.resolve(PRIVATE_DIR, claims.key);
  if (!full.startsWith(PRIVATE_DIR + path.sep) || !fs.existsSync(full)) return null; // never leave the private folder
  const type = SIGNATURES.find((s) => full.endsWith("." + s.ext))?.type || "application/octet-stream";
  return { full, type };
};
