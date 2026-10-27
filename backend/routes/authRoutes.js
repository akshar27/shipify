// routes/auth.js
const express = require('express');
const { publicUser } = require('../utils/publicUser');
const router = express.Router();
const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  googleLogin,
  acceptTerms,
} = require('../controllers/authController');

const verifyToken = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const prisma = require('../config/prisma');
const { TERMS_VERSION } = require('../config/legal');

// Public Routes
router.post('/register', authLimiter, validate(schemas.register), registerUser);
router.post('/login', authLimiter, validate(schemas.login), loginUser);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post("/resend-verification", authLimiter, validate(schemas.resendVerification), resendVerification);
router.post("/google-login", authLimiter, googleLogin);

router.post('/accept-terms', verifyToken, authLimiter, validate(schemas.acceptTerms), acceptTerms);

// Protected Route
// The current user, as the app should see them now (isVerified changes when an admin approves their ID).
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json(publicUser(user));
  } catch {
    res.status(500).json({ msg: 'Failed to fetch user' });
  }
});

module.exports = router;
