const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const router = express.Router();

// GET single user by ID
router.get('/user/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, documentUrl: true, isVerified: true },
  });

  if (!user) return res.status(404).json({ msg: "User not found" });
  res.json(user);
});

// GET verified users
router.get('/verified-users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  const users = await prisma.user.findMany({
    where: { isVerified: true },
    select: { id: true, name: true, email: true },
  });

  res.json(users);
});

// DELETE (Reject) user
router.delete('/delete-user/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete user', error: err.message });
  }
});

// GET unverified users with uploaded documents
router.get('/unverified-users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  try {
    const users = await prisma.user.findMany({
      where: {
        isVerified: false,
        NOT: { documentUrl: null }, // ensure document is uploaded
      },
      select: {
        id: true,
        name: true,
        email: true,
        documentUrl: true,
      },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch users', error: err.message });
  }
});

// GET all non-admin users
router.get('/all-users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  try {
    const users = await prisma.user.findMany({
      where: {
        NOT: { role: 'admin' }, // 👈 Exclude admin users
      },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
        documentUrl: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch users', error: err.message });
  }
});

// PATCH /api/admin/verify-user/:id
router.patch('/verify-user/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden: Admins only' });

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        isVerified: true,
      },
    });

    res.json({ msg: 'User verified successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to verify user', error: err.message });
  }
});


module.exports = router;