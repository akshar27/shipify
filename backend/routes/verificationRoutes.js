const express = require('express');
const multer = require('multer');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// Multer config (save in /uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

// Upload ID document
router.post('/', verifyToken, upload.single('document'), async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: 'Document is required' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;

    const existing = await prisma.verificationRequest.findFirst({
      where: {
        userId: req.user.id,
        status: 'pending',
      },
    });

    if (existing) {
      return res.status(400).json({ msg: 'Verification already pending' });
    }

    const request = await prisma.verificationRequest.create({
      data: {
        userId: req.user.id,
        fullName,
        documentUrl,
      },
    });

    res.status(201).json({ msg: 'Verification submitted', request });
  } catch (err) {
    res.status(500).json({ msg: 'Error uploading document', error: err.message });
  }
});

module.exports = router;
