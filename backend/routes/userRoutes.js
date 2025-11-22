const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const { uploadToS3 } = require("../utils/s3Upload");
const upload = require("../config/multer");

/* ============================
   📌 Upload Verification Document (S3/documents/)
============================ */
router.post('/upload-doc', verifyToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const s3Url = await uploadToS3(req.file, "documents");

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        documentUrl: s3Url,
        isVerified: false, // mark as pending
      },
    });

    res.json({ msg: 'Document uploaded to S3. Pending admin verification.', documentUrl: s3Url });
  } catch (err) {
    res.status(500).json({ msg: 'Upload failed', error: err.message });
  }
});

/* ============================
   📌 Upload Profile Photo (S3/profile/)
============================ */
router.post("/upload-photo", verifyToken, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const photoUrl = await uploadToS3(req.file, "profile");

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePicture: photoUrl },
    });

    res.json({ msg: "Profile photo updated", photoUrl: updated.profilePicture });
  } catch (err) {
    res.status(500).json({ msg: "Upload failed", error: err.message });
  }
});

/* ============================
   📌 Get Profile
============================ */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        receivedRatings: {
          include: {
            rater: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" }
        },
      },
    });

    const avgRating = user.receivedRatings.length
      ? (user.receivedRatings.reduce((sum, r) => sum + r.rating, 0) /
          user.receivedRatings.length).toFixed(1)
      : null;

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        phone: user.phone,
        profilePicture: user.profilePicture,
        documentUrl: user.documentUrl,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        avgRating,
        totalRatings: user.receivedRatings.length,
        reviews: user.receivedRatings
      });

  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch profile", error: err.message });
  }
});

/* ============================
   📌 Update Name
============================ */
router.patch('/update-profile', verifyToken, async (req, res) => {
  const { name, bio, phone } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        bio,
        phone,
      },
    });

    res.json({ msg: 'Profile updated', user: updated });
  } catch (err) {
    res.status(500).json({ msg: 'Update failed', error: err.message });
  }
});

// GET Public Profile (view another user)
router.get("/public/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        receivedRatings: {
          include: { rater: { select: { name: true, id: true } } },
          orderBy: { createdAt: "desc" },
        },
        deliveries: true,
        trips: true,
      },
    });

    if (!user) return res.status(404).json({ msg: "User not found" });

    const avgRating = user.receivedRatings.length
      ? (
          user.receivedRatings.reduce((sum, r) => sum + r.rating, 0) /
          user.receivedRatings.length
        ).toFixed(1)
      : null;

    // Mask phone number for privacy
    const maskedPhone = user.phone
      ? user.phone.replace(/.(?=.{4})/g, "*")
      : null;

    res.json({
      id: user.id,
      name: user.name,
      profilePicture: user.profilePicture,
      bio: user.bio,
      phone: maskedPhone,
      isVerified: user.isVerified,
      avgRating,
      totalRatings: user.receivedRatings.length,
      reviews: user.receivedRatings,
      completedDeliveries: user.deliveries.filter((d) => d.status === "delivered").length,
      completedTrips: user.trips.length,
      memberSince: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch public profile", error: err.message });
  }
});


module.exports = router;
