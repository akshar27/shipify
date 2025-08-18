const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');

// Public Routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected Route
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch user' });
  }
});

module.exports = router;
