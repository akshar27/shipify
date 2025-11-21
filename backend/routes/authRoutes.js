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
const prisma = require('../config/prisma');

// Public Routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/google-login", googleLogin);

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
