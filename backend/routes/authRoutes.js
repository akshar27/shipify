// routes/auth.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  googleLogin,
} = require('../controllers/authController');

const verifyToken = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const prisma = require('../config/prisma');

// Public Routes
router.post('/register', authLimiter, validate(schemas.register), registerUser);
router.post('/login', authLimiter, validate(schemas.login), loginUser);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post("/resend-verification", authLimiter, validate(schemas.resendVerification), resendVerification);
router.post("/google-login", authLimiter, googleLogin);

// Protected Route
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(user);
  } catch {
    res.status(500).json({ msg: 'Failed to fetch user' });
  }
});

module.exports = router;
