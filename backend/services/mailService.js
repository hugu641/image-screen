/**
 * Sends the account emails (password reset, invitation).
 *
 * Configured with environment variables (never commit them):
 *   MAIL_TRANSPORT  smtp | file | none   (default: smtp when SMTP_HOST is set, otherwise none)
 *   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for port 465), SMTP_USER, SMTP_PASS
 *   MAIL_FROM       sender address, e.g. "ImageScreen <no-reply@votredomaine.fr>"
 *   APP_URL         public address of the web interface, used in the links
 *
 * "file" writes the emails to DATA_DIR/outbox.jsonl instead of sending them (tests, debugging).
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { DATA_DIR } = require('../config/paths');

function transportMode() {
  const explicit = String(process.env.MAIL_TRANSPORT || '').toLowerCase();
  if (explicit) return explicit;
  return process.env.SMTP_HOST ? 'smtp' : 'none';
}

function mailEnabled() {
  return transportMode() !== 'none';
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    });
  }
  return transporter;
}

/** Returns true when the message was handed to the transport. */
async function sendMail({ to, subject, text }) {
  const mode = transportMode();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'ImageScreen';
  if (mode === 'smtp') {
    await getTransporter().sendMail({ from, to, subject, text });
    return true;
  }
  if (mode === 'file') {
    fs.appendFileSync(path.join(DATA_DIR, 'outbox.jsonl'), JSON.stringify({ to, subject, text }) + '\n', { mode: 0o600 });
    return true;
  }
  return false;
}

/** Absolute link into the web interface. */
function appUrl(pathAndQuery) {
  return `${String(process.env.APP_URL || '').replace(/\/$/, '')}${pathAndQuery}`;
}

module.exports = { sendMail, mailEnabled, appUrl };
