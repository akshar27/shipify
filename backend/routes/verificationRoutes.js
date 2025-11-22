const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/auth');
const upload = require('../config/multer'); // <-- unified memoryStorage
const { uploadToS3 } = require("../utils/s3Upload");

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
    const s3Url = await uploadToS3(req.file, "documents");

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

    // Create verification request
    const request = await prisma.verificationRequest.create({
      data: {
        userId: req.user.id,
        fullName,
        documentUrl: s3Url,
      },
    });

    // Update user table also
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        documentUrl: s3Url,
        isVerified: false, // waiting for admin
      },
    });

    res.status(201).json({
      msg: 'Verification submitted successfully',
      documentUrl: s3Url,
      request,
    });

  } catch (err) {
    res.status(500).json({
      msg: 'Error uploading document',
      error: err.message,
    });
  }
});

module.exports = router;
