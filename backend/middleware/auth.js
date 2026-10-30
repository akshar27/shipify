// middleware/auth.js
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

// The token proves who the caller is; the role and existence of the account are read from the database on every request,
// so deleting a user or changing their role takes effect immediately instead of when their (up to 7-day) token expires.
module.exports = async function (req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ msg: "No token, authorization denied" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ msg: "Token is not valid" });
  }
  if (!decoded.id) return res.status(401).json({ msg: "Token is not valid" });

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, role: true, termsVersion: true } });
    if (!user) return res.status(401).json({ msg: "Account no longer exists" });
    req.user = { id: user.id, role: user.role, termsVersion: user.termsVersion };
    next();
  } catch (err) {
    next(err);
  }
};
