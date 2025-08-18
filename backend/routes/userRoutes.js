const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const path = require('path');

// ✅ Use diskStorage to preserve file extensions
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Get original file extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ✅ POST /api/users/upload-doc
router.post('/upload-doc', verifyToken, upload.single('document'), async (req, res) => {
  try {
    const documentUrl = `/uploads/${req.file.filename}`; // will now have correct extension

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        documentUrl,
        isVerified: false, // Mark as unverified
      },
    });

    res.json({ msg: 'Document uploaded. Pending admin verification.' });
  } catch (err) {
    res.status(500).json({ msg: 'Upload failed', error: err.message });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        receivedRatings: true,
      },
    });

    const ratings = user.receivedRatings.map(r => r.rating);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

    res.json({
      name: user.name,
      email: user.email,
      documentUrl: user.documentUrl,
      isVerified: user.isVerified,
      avgRating,
    });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch profile", error: err.message });
  }
});

router.patch('/update-profile', verifyToken, async (req, res) => {
  const { name } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
    });

    res.json({ msg: 'Profile updated', user: updated });
  } catch (err) {
    res.status(500).json({ msg: 'Update failed', error: err.message });
  }
});


module.exports = router;
