// Use after verifyToken (which loads the role from the database).
module.exports = function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ msg: "Forbidden" });
  next();
};
