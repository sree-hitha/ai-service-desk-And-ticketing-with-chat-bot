const nodemailer = require('nodemailer');

function buildTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null; // No SMTP configured — we'll log instead of sending.
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const transporter = buildTransport();

async function sendWelcomeEmail(toEmail, name) {
  const subject = 'Welcome to Relay Service Desk';
  const text = `Hi ${name},\n\nYour Relay Service Desk account has been created. You can now sign in and raise support tickets any time.\n\n- Relay Support Team`;

  if (!transporter) {
    console.log(`[email:fallback] Would send welcome email to ${toEmail}: "${subject}"`);
    return { delivered: false, fallback: true };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'support@relay.local',
      to: toEmail,
      subject,
      text,
    });
    return { delivered: true, fallback: false };
  } catch (err) {
    console.error('Email send failed, falling back to log:', err.message);
    console.log(`[email:fallback] Would send welcome email to ${toEmail}: "${subject}"`);
    return { delivered: false, fallback: true };
  }
}

module.exports = { sendWelcomeEmail };
