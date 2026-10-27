const nodemailer = require('nodemailer');

const smtpConfigured = () => Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASS);

// SMTP_HOST (with SMTP_PORT, default 587) points at any provider's SMTP relay (SES, Postmark, Resend, SendGrid...).
// Without it we fall back to Gmail, which is only fit for a small closed beta. SMTP_FROM is the visible sender address;
// with a transactional provider it must be an address on a domain you have verified there.
const transport = () =>
  nodemailer.createTransport(
    process.env.SMTP_HOST
      ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASS } }
      : { service: 'Gmail', auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASS } }
  );

/**
 * Sends an email through Gmail SMTP when SMTP_EMAIL and SMTP_PASS are set.
 * Without them (local development) nothing is sent: the message, including the link inside it, is printed to the
 * server console and the call succeeds, so signup / verify / reset flows can be exercised with no mail account.
 */
exports.sendMail = async ({ to, subject, html, link }) => {
  if (!smtpConfigured()) {
    console.log(`[mailer] SMTP not configured, not sending "${subject}" to ${to}${link ? `\n[mailer] link: ${link}` : ''}`);
    return { sent: false };
  }
  await transport().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_EMAIL, to, subject, html });
  return { sent: true };
};
