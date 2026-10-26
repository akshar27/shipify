const express = require("express");
const { openLocalDocument } = require("../utils/documents");

const router = express.Router();

// Local-dev only: with S3 the signed URL points straight at the bucket and this route never sees a request.
// The token in the URL is the authorisation; admin endpoints hand one out for five minutes at a time.
router.get("/:token", (req, res) => {
  const doc = openLocalDocument(req.params.token);
  if (!doc) return res.status(404).json({ msg: "Not found" });
  res.set({ "Content-Type": doc.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  res.sendFile(doc.full);
});

module.exports = router;
