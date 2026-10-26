const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const upload = require('../config/multer'); // <-- unified memoryStorage
const { storeDocument } = require("../utils/documents");

const router = express.Router();

/* ==========================================
   📌 Submit Verification Document (S3)
========================================== */
router.post('/', verifyToken, upload.single('document'), async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: 'Document is required' });
    }

    // Upload to S3 → folder = "documents"
    // Check pending requests
    const existing = await prisma.verificationRequest.findFirst({
      where: {
        userId: req.user.id,
        status: 'pending',
      },
    });

    if (existing) {
      return res.status(400).json({ msg: 'Verification already pending' });
    }

    const docRef = await storeDocument(req.file);

    // Create verification request
    const request = await prisma.verificationRequest.create({
      data: {
        userId: req.user.id,
        fullName,
        documentUrl: docRef,
      },
    });

    // Update user table also
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        documentUrl: docRef,
        isVerified: false, // waiting for admin
      },
    });

    // The document reference stays server-side; only admins can turn it into a (short-lived) URL.
    res.status(201).json({
      msg: 'Verification submitted successfully',
      request: { id: request.id, status: request.status, createdAt: request.createdAt },
    });

  } catch (err) {
    res.status(err.status || 500).json({
      msg: err.status ? err.message : 'Error uploading document',
    });
  }
});

module.exports = router;
