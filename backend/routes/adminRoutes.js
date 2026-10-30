const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { z } = require('zod');
const { resolveDocumentUrl } = require('../utils/documents');
const router = express.Router();
const isId = (id) => z.string().uuid().safeParse(id).success;

// Documents are private: hand the admin a short-lived URL instead of the stored reference.
const withDocUrl = (req, u) => ({
  ...u,
  documentType: u.documentUrl && /\.pdf$/i.test(u.documentUrl) ? 'pdf' : 'image',
  documentUrl: resolveDocumentUrl(u.documentUrl, `${req.protocol}://${req.get('host')}`),
});

// GET single user by ID
router.get('/user/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, documentUrl: true, isVerified: true },
  });

  if (!user) return res.status(404).json({ msg: "User not found" });
  res.json(withDocUrl(req, user));
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

// DELETE a user. Accounts with any history (payments, deliveries, messages, verification requests) are kept, because that history
// is owed to other people; use reject-user to turn down an ID instead.
router.delete('/delete-user/:id', verifyToken, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  if (!isId(req.params.id)) return res.status(404).json({ msg: 'User not found' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role === 'admin') return res.status(409).json({ msg: 'Admin accounts cannot be deleted here' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    if (err.code === 'P2003') return res.status(409).json({ msg: 'This account has activity and cannot be deleted. Reject their ID instead.' });
    next(err);
  }
});

// Turn down a submitted ID: the document is cleared and the account stays unverified, so the person can upload another one.
router.post('/reject-user/:id', verifyToken, requireAdmin, async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(404).json({ msg: 'User not found' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role === 'admin') return res.status(409).json({ msg: 'Admin accounts cannot be rejected' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { isVerified: false, documentUrl: null } }),
      prisma.verificationRequest.updateMany({ where: { userId: req.params.id, status: 'pending' }, data: { status: 'rejected' } }),
    ]);
    res.json({ msg: 'ID rejected. The person can upload a new one.' });
  } catch (err) {
    next(err);
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

    res.json(users.map((u) => withDocUrl(req, u)));
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

    res.json(users.map((u) => withDocUrl(req, u)));
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch users', error: err.message });
  }
});

// PATCH /api/admin/verify-user/:id
router.patch('/verify-user/:id', verifyToken, requireAdmin, async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(404).json({ msg: 'User not found' });
  try {
    if (!(await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } }))) return res.status(404).json({ msg: 'User not found' });
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { isVerified: true }, select: { id: true, name: true, email: true, isVerified: true } }),
      prisma.verificationRequest.updateMany({ where: { userId: req.params.id, status: 'pending' }, data: { status: 'approved' } }),
    ]);
    res.json({ msg: 'User verified successfully', user: updatedUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;