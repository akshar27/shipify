// Time-based emails. Nothing else in the app reacts to the clock (confirmation by timeout is computed on read, see
// utils/payouts.js), so this job only sends the two emails that would otherwise never go out:
//   1. a reminder to the sender shortly before the auto-confirm window ends, and
//   2. the "confirmed automatically / payout due" notice once it has.
// Each is claimed with a conditional UPDATE on a timestamp column before sending, so it goes out at most once even if the job
// overlaps itself or several server instances run it. If the send then fails it is not retried: a missed reminder is better
// than a duplicate one.
const prisma = require("../config/prisma");
const env = require("../config/env");
const { notify } = require("./notify");
const { confirmWindowMs, confirmCutoff } = require("./payouts");

const HOUR = 3600 * 1000;
const reminderLeadMs = () => Math.min(24 * HOUR, confirmWindowMs() / 2);

async function claimAndNotify(where, stampField, event) {
  const due = await prisma.delivery.findMany({ where: { ...where, [stampField]: null }, select: { id: true } });
  let sent = 0;
  for (const { id } of due) {
    const { count } = await prisma.delivery.updateMany({ where: { id, [stampField]: null }, data: { [stampField]: new Date() } });
    if (count === 1) {
      notify(event, id);
      sent++;
    }
  }
  return sent;
}

/** One pass. Returns how many of each email it queued. */
exports.sweep = async (now = new Date()) => {
  if (confirmWindowMs() === 0) return { reminders: 0, autoConfirmed: 0 }; // no window, nothing to remind about
  const cutoff = confirmCutoff(now);
  const base = { status: "delivered", paymentStatus: "paid", disputedAt: null };
  const reminders = await claimAndNotify(
    { ...base, deliveredAt: { gt: cutoff, lte: new Date(cutoff.getTime() + reminderLeadMs()) } },
    "reminderSentAt",
    "reminder"
  );
  const autoConfirmed = await claimAndNotify({ ...base, deliveredAt: { lte: cutoff } }, "autoConfirmNoticeAt", "autoConfirmed");
  return { reminders, autoConfirmed };
};

exports.startSweep = (everyMs = 10 * 60 * 1000) => {
  const run = () => exports.sweep().catch((err) => console.error("[sweep] failed:", err.message));
  run();
  return setInterval(run, everyMs).unref();
};
