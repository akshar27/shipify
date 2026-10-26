const nodemailer = require('nodemailer');

const smtpConfigured = () => Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASS);

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
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.SMTP_EMAIL, to, subject, html });
  return { sent: true };
};
