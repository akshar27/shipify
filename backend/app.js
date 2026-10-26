const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { Server } = require('socket.io');
const verifyTokenSocket = require('./middleware/socketAuth'); // You’ll create this
const prisma = require('./config/prisma'); // Assuming this exists

const app = express();
const server = http.createServer(app); // ⬅️ Create HTTP server

// ✅ Wide open CORS for debugging
app.use(cors());
app.use(express.json());
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
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/rating', require('./routes/ratingRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// ✅ Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Set your frontend domain in production
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
