let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}
const logger = require('../config/logger');

let transporter = null;

const getTransporter = () => {
  if (!nodemailer) {
    logger.warn('emailService: nodemailer not installed, email notifications disabled');
    return null;
  }
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('emailService: SMTP not configured, email notifications disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT) || 587,
    secure: parseInt(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
};

/**
 * Send an email.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
const sendMail = async (to, subject, html) => {
  const t = getTransporter();
  if (!t) return;

  try {
    const info = await t.sendMail({
      from: `"SeizeWeb Alert" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`emailService: sent "${subject}" → ${to} (${info.messageId})`);
  } catch (err) {
    logger.error('emailService: sendMail error:', err.message);
  }
};

/**
 * Send an email — throws on error (for test/diagnostic use).
 */
const sendMailOrThrow = async (to, subject, html) => {
  if (!nodemailer) throw new Error('nodemailer module not installed');
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error(`SMTP not configured (SMTP_HOST=${SMTP_HOST}, SMTP_USER=${SMTP_USER})`);

  const t = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT) || 587,
    secure: parseInt(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const info = await t.sendMail({
    from: `"SeizeWeb Alert" <${SMTP_USER}>`,
    to,
    subject,
    html,
  });
  return info;
};

module.exports = { sendMail, sendMailOrThrow };
