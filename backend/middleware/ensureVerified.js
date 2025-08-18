const prisma = require('../config/prisma');

module.exports = async function (req, res, next) {
  if (req.user.role === 'admin') return next(); // allow admins

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.isVerified) {
    return res.status(403).json({ msg: 'User not verified' });
  }

  next();
};
