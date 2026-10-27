// Status emails: one place that knows who is told what when a delivery changes state.
//
// Sending is fire-and-forget. A mail outage must never fail or slow down the request that caused it, and the state change has
// already been committed by the time we are called, so errors are logged and swallowed. Without SMTP the mailer prints the
// message to the console, so none of this needs a mail account in development.
const prisma = require("../config/prisma");
const env = require("../config/env");
const mailer = require("./mailer");

const person = { select: { id: true, name: true, email: true } };
const pending = new Set();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (cents, currency = env.PAYMENT_CURRENCY) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format(cents / 100);
const first = (u) => (u?.name || "there").split(" ")[0];
const route = (d) => `${d.pickup} → ${d.dropoff}`;
const brand = () => env.COMPANY_NAME || "Shipify";
const link = (path) => `${env.CLIENT_URL.replace(/\/$/, "")}${path}`;

/** The messages for one event. Each is { to, subject, lines, cta: [label, path] }; `lines` are plain text, escaped when rendered. */
const messages = {
  paid: ({ d }) => [
    {
      to: d.sender,
      subject: "Payment received: we're finding you a traveler",
      lines: [`Thanks, your payment for ${route(d)} went through.`, "Your delivery is now visible to travelers. We'll email you as soon as one accepts it."],
      cta: ["View your deliveries", "/my-deliveries"],
    },
  ],

  accepted: ({ d }) => [
    {
      to: d.sender,
      subject: "A traveler accepted your delivery",
      lines: [
        `${first(d.traveler)} will carry your package for ${route(d)}.`,
        "When the package reaches the recipient, they give the traveler a 6-digit code. Open your delivery to see that code and share it with the recipient.",
      ],
      cta: ["See the handover code", "/my-deliveries"],
    },
  ],

  delivered: ({ d }) => {
    const hours = env.AUTO_CONFIRM_HOURS;
    return [
      {
        to: d.sender,
        subject: "Your package was delivered: please confirm",
        lines: [
          `${first(d.traveler)} marked your delivery (${route(d)}) as delivered.`,
          hours > 0
            ? `If everything is fine, confirm it. If you do nothing, it is confirmed automatically in ${hours} hours and the traveler is paid. If something is wrong, report it before then and we'll look into it.`
            : "Please confirm that it arrived, or report a problem.",
        ],
        cta: ["Confirm or report a problem", "/my-deliveries"],
      },
      {
        to: d.traveler,
        subject: "Delivery recorded: payout is next",
        lines: [
          `Your delivery for ${route(d)} is recorded as delivered.`,
          hours > 0 ? `Your payout becomes due when the sender confirms it, or after ${hours} hours if they don't respond.` : "Your payout becomes due once the sender confirms.",
        ],
        cta: ["View your jobs", "/my-requests"],
      },
    ];
  },

  confirmed: ({ d }) => [
    {
      to: d.traveler,
      subject: "Delivery confirmed: your payout is due",
      lines: [`The delivery for ${route(d)} is confirmed. Your payout is queued, and we'll email you again when it has been sent.`],
      cta: ["View your jobs", "/my-requests"],
    },
  ],

  disputed: ({ d, admins }) => [
    {
      to: d.sender,
      subject: "We received your report",
      lines: [`We've paused the payout for ${route(d)} and an admin will review it.`, "You don't need to do anything else; we'll email you the outcome."],
      cta: ["View your deliveries", "/my-deliveries"],
    },
    {
      to: d.traveler,
      subject: "A problem was reported on your delivery",
      lines: [`The sender reported a problem with ${route(d)}. Your payout is on hold while an admin reviews it.`, "We'll email you the outcome."],
      cta: ["View your jobs", "/my-requests"],
    },
    ...admins.map((to) => ({
      to,
      subject: "Dispute opened",
      lines: [`${route(d)}`, `Reason: ${d.disputeReason || "(none given)"}`],
      cta: ["Review disputes", "/admin/payouts"],
    })),
  ],

  refunded: ({ d }) => [
    {
      to: d.sender,
      subject: "Your delivery was refunded",
      lines: [`After reviewing ${route(d)}, we refunded your payment. It can take a few days to show on your statement.`],
      cta: ["View your deliveries", "/my-deliveries"],
    },
    {
      to: d.traveler,
      subject: "Dispute decided: refunded to the sender",
      lines: [`After reviewing ${route(d)}, the payment was refunded to the sender, so there is no payout for this delivery.`],
      cta: ["View your jobs", "/my-requests"],
    },
  ],

  reminder: ({ d }) => [
    {
      to: d.sender,
      subject: "Reminder: confirm your delivery or report a problem",
      lines: [
        `Your delivery for ${route(d)} was marked delivered. It will be confirmed automatically, and the traveler paid, at ${new Date(d.deliveredAt.getTime() + env.AUTO_CONFIRM_HOURS * 3600e3).toUTCString()}.`,
        "If something is wrong, report it before then.",
      ],
      cta: ["Confirm or report a problem", "/my-deliveries"],
    },
  ],

  autoConfirmed: ({ d }) => [
    {
      to: d.sender,
      subject: "Your delivery was confirmed automatically",
      lines: [`The ${env.AUTO_CONFIRM_HOURS}-hour window for ${route(d)} ended with no report, so it is now confirmed and the traveler will be paid.`],
      cta: ["View your deliveries", "/my-deliveries"],
    },
    {
      to: d.traveler,
      subject: "Delivery confirmed: your payout is due",
      lines: [`The sender didn't report a problem with ${route(d)}, so it is confirmed. Your payout is queued, and we'll email you again when it has been sent.`],
      cta: ["View your jobs", "/my-requests"],
    },
  ],

  paidOut: ({ d, payout }) => [
    {
      to: d.traveler,
      subject: `You've been paid ${money(payout.netCents, payout.currency)}`,
      lines: [
        `Your payout for ${route(d)} has been sent.`,
        `Delivery fee ${money(payout.grossCents, payout.currency)}, platform fee ${money(payout.feeCents, payout.currency)}, paid to you ${money(payout.netCents, payout.currency)}.`,
        `Reference: ${payout.reference}`,
      ],
      cta: ["View your jobs", "/my-requests"],
    },
  ],
};

const render = ({ subject, lines, cta }, to) => {
  const url = link(cta[1]);
  const html =
    `<div style="font-family:sans-serif;max-width:520px">` +
    `<h2 style="margin:0 0 12px">${esc(subject)}</h2>` +
    `<p>Hi ${esc(first(to))},</p>` +
    lines.map((l) => `<p>${esc(l)}</p>`).join("") +
    `<p><a href="${esc(url)}">${esc(cta[0])}</a></p>` +
    `<p style="color:#666;font-size:12px">${esc(brand())}</p></div>`;
  return { to: to.email, subject: `[${brand()}] ${subject}`, html, link: url };
};

async function send(event, deliveryId, extra) {
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { sender: person, traveler: person } });
  if (!d) return;
  const admins = event === "disputed" ? (await prisma.user.findMany({ where: { role: "admin" }, select: { id: true, name: true, email: true } })) : [];
  const payout = event === "paidOut" ? extra.payout : undefined;
  const list = messages[event]({ d, admins, payout });

  for (const m of list) {
    const to = m.to;
    if (!to?.email) continue; // e.g. no traveler yet
    try {
      await mailer.sendMail(render(m, to));
    } catch (err) {
      console.error(`[notify] ${event} email to ${to.id} failed:`, err.message);
    }
  }
}

/** Queue the emails for `event` on a delivery. Returns immediately; never throws. */
exports.notify = (event, deliveryId, extra = {}) => {
  const p = send(event, deliveryId, extra)
    .catch((err) => console.error(`[notify] ${event} for ${deliveryId} failed:`, err.message))
    .finally(() => pending.delete(p));
  pending.add(p);
};

/** Resolves when every queued email has been handed to the mailer (tests use this instead of sleeping). */
exports.flush = async () => {
  while (pending.size) await Promise.all([...pending]);
};
