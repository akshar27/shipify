const express = require("express");
const { rules } = require("../config/legal");

const router = express.Router();

// Public: the signup page needs it before anyone has an account. Everything on the Terms and prohibited-items screens comes from here.
router.get("/rules", (_req, res) => res.json(rules()));

module.exports = router;
