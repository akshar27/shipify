// Use after verifyToken, on the actions that put a user inside the marketplace: creating or taking a delivery, posting a trip,
// paying. Finishing, confirming and disputing a delivery are deliberately NOT gated, so nobody gets stuck mid-delivery when the
// terms change. Admins are exempt.
const { TERMS_VERSION } = require("../config/legal");

module.exports = function requireTerms(req, res, next) {
  if (req.user.role === "admin" || req.user.termsVersion === TERMS_VERSION) return next();
  res.status(403).json({ code: "TERMS_REQUIRED", msg: "Please accept the Terms and the prohibited-items rules to continue." });
};
