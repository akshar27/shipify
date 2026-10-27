const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const prisma = require('../config/prisma');
const { chatAccess, cleanContent, MAX_LENGTH } = require('../utils/chat');

const SENDER_FIELDS = { name: true, id: true };

// Messages of one delivery. Only its sender and its traveler may read them; everyone else gets a 404 so ids cannot be probed.
router.get('/:deliveryId', verifyToken, async (req, res, next) => {
  try {
    if (!(await chatAccess(req.user.id, req.params.deliveryId))) return res.status(404).json({ msg: 'Chat not found' });
    const messages = await prisma.message.findMany({
      where: { deliveryId: req.params.deliveryId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: SENDER_FIELDS }, receiver: { select: SENDER_FIELDS } },
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// Send a message. The receiver is always the other person on the delivery; a receiverId in the body is ignored.
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { deliveryId, content } = req.body ?? {};
    const text = cleanContent(content);
    if (!text) return res.status(400).json({ msg: `Write a message of 1 to ${MAX_LENGTH} characters` });
    const access = await chatAccess(req.user.id, deliveryId);
    if (!access) return res.status(404).json({ msg: 'Chat not found' });
    const message = await prisma.message.create({
      data: { deliveryId, senderId: req.user.id, receiverId: access.otherId, content: text },
      include: { sender: { select: SENDER_FIELDS }, receiver: { select: SENDER_FIELDS } },
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
