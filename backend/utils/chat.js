const { z } = require("zod");
const prisma = require("../config/prisma");

const MAX_LENGTH = 2000;
const uuid = z.string().uuid();

/**
 * Chat belongs to the two people on a delivery: its sender and the traveler who took it. Anyone else (including other travelers
 * and users who guessed an id) gets nothing. Returns { otherId } for a participant, or null.
 */
exports.chatAccess = async (userId, deliveryId) => {
  if (!uuid.safeParse(deliveryId).success) return null;
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { senderId: true, travelerId: true } });
  if (!d || !d.travelerId) return null;
  if (userId === d.senderId) return { otherId: d.travelerId };
  if (userId === d.travelerId) return { otherId: d.senderId };
  return null;
};

/** Trimmed message text, or null if it is empty, not a string, or too long. */
exports.cleanContent = (content) => {
  if (typeof content !== "string") return null;
  const text = content.trim();
  return text && text.length <= MAX_LENGTH ? text : null;
};

exports.MAX_LENGTH = MAX_LENGTH;
