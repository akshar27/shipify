const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const env = require('./config/env'); // validates the environment; exits with a clear message if something is missing

const helmet = require('helmet');
const { globalLimiter } = require('./middleware/rateLimit');
const { Server } = require('socket.io');
const verifyTokenSocket = require('./middleware/socketAuth'); // You’ll create this
const prisma = require('./config/prisma'); // Assuming this exists

const app = express();
const server = http.createServer(app); // ⬅️ Create HTTP server

app.set('trust proxy', env.TRUST_PROXY);
// crossOriginResourcePolicy: the React app on another origin has to be able to load profile photos from here.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigins }));
app.use(globalLimiter);
// Stripe signs the exact bytes it sends, so this one route must see the raw body, before the JSON parser touches it.
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));
// Only profile photos are public. Identity documents are never served from here (see utils/documents.js).
app.use('/uploads/profile', express.static(path.join(__dirname, 'uploads', 'profile')));

// All your routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));
app.use('/api/trips', require('./routes/tripRoutes'));
app.use('/api/match', require('./routes/matchRoutes'));
app.use('/api/request', require('./routes/requestRoutes'));
app.use('/api/verification', require('./routes/verificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin', require('./routes/adminPayoutRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/legal', require('./routes/legalRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/rating', require('./routes/ratingRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// ✅ Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: env.corsOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
});

// 🔒 Authenticate sockets
io.use(verifyTokenSocket); // Middleware explained below

// 🔌 Handle socket events
io.on("connection", (socket) => {
  const userId = socket.user.id;
  console.log(`🟢 ${userId} connected`);
  socket.join(userId);

  socket.on("joinDeliveryRoom", ({ deliveryId }) => {
    socket.join(`delivery:${deliveryId}`);
  });  

  socket.on("sendMessage", async ({ deliveryId, receiverId, content }) => {
    try {
      const msg = await prisma.message.create({
        data: {
          deliveryId,
          senderId: userId,
          receiverId,
          content,
        },
      });

      // Send to both parties
      // io.to(receiverId).emit("receiveMessage", msg);
      // io.to(userId).emit("receiveMessage", msg);
      io.to(`delivery:${deliveryId}`).emit("receiveMessage", msg);
    } catch (error) {
      console.error("🔥 Error sending message:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 ${userId} disconnected`);
  });
});

// Last: anything that throws or calls next(err) ends up here. The client gets a generic message, never a stack or a DB error.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ msg: 'Request too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ msg: 'Invalid JSON' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ msg: 'File too large' });
  console.error(err);
  res.status(500).json({ msg: 'Something went wrong' });
});

// Only listen when run directly (node app.js); tests import { app } instead.
if (require.main === module) {
  server.listen(env.PORT, () => console.log(`🚀 Server running on port ${env.PORT}`));
  require('./utils/sweep').startSweep();
}

module.exports = { app, server, io };
