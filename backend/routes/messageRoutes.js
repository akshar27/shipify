const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');

// GET messages for a specific delivery between two users
router.get('/:deliveryId', verifyToken, async (req, res) => {
  const { deliveryId } = req.params;
  try {
    const messages = await prisma.message.findMany({
      where: {
        deliveryId,
        OR: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      orderBy: { timestamp: 'asc' },
      include: {
        sender: { select: { name: true, id: true } },
        receiver: { select: { name: true, id: true } },
      }
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load messages', error: err.message });
  }
});

// POST a new message
router.post('/', verifyToken, async (req, res) => {
  const { deliveryId, receiverId, content } = req.body;
  try {
    const message = await prisma.message.create({
      data: {
        deliveryId,
        senderId: req.user.id,
        receiverId,
        content
      }
    });
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to send message', error: err.message });
  }
});

module.exports = router;
