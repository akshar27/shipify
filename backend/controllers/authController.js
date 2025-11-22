// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ---------------- REGISTER USER -----------------
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ msg: 'Email already exists' });

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // email verification token
    const emailToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        emailToken,
      }
    });

    // SEND EMAIL VERIFICATION EMAIL
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS,
      }
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${emailToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: "Verify your email",
      html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`
    });

    res.status(201).json({
      msg: "Account created. Check email to verify your account."
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: 'Error registering user', error: err.message });
  }
};

// ---------------- LOGIN USER -----------------
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    if (!user.emailVerified) {
      return res.status(401).json({ msg: "Please verify your email first." });
    }

    const token = generateToken(user);
    res.json({ token, user });

  } catch (err) {
    res.status(500).json({ msg: 'Login failed', error: err.message });
  }
};

// ---------------- FORGOT PASSWORD -----------------
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    return res.status(404).json({ msg: "User not found" });

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 15);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiry: expiry,
    }
  });

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASS,
    }
  });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: user.email,
    subject: "Reset your password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`
  });

  res.json({ msg: "Reset link sent to email." });
};

// ---------------- RESET PASSWORD -----------------
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gte: new Date() }
    }
  });

  if (!user)
    return res.status(400).json({ msg: "Invalid or expired token" });

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  res.json({ msg: "Password reset successful" });
};

// ---------------- VERIFY EMAIL -----------------
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  const user = await prisma.user.findFirst({
    where: { emailToken: token }
  });

  if (!user)
    return res.status(400).json({ msg: "Invalid verification token" });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailToken: null,
    }
  });

  res.json({ msg: "Email verified successfully" });
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ msg: "Email is already verified." });
    }

    const newToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: { emailToken: newToken }
    });

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS,
      },
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${newToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: "Verify your email (Resent)",
      html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`
    });

    res.json({ msg: "Verification email resent successfully!" });

  } catch (err) {
    console.log("Resend Error:", err);
    res.status(500).json({ msg: "Something went wrong", error: err.message });
  }
};


exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Auto-create Google account
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: "", // no password for Google users
          role: "user",
          emailVerified: true, // Google already verified
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });

  } catch (err) {
    console.log(err);
    res.status(400).json({ msg: "Google login failed." });
  }
};

