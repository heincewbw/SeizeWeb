const https = require('https');
const logger = require('../config/logger');

/**
 * Send email via Resend REST API (HTTPS — works on Railway, DKIM compliant).
 */
const sendViaResendAPI = (to, subject, html) => {
  return new Promise((resolve, reject) => {
    const { RESEND_API_KEY } = process.env;
    if (!RESEND_API_KEY) return reject(new Error('RESEND_API_KEY tidak di-set di environment variables'));

    const senderEmail = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';

    const payload = JSON.stringify({
      from: `AceCapital Alert <${senderEmail}>`,
      to: [to],
      subject,
      html,
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Resend API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Resend API request timeout')); });
    req.write(payload);
    req.end();
  });
};

/**
 * Send an email (fire-and-forget, swallows errors).
 */
const sendMail = async (to, subject, html) => {
  try {
    const result = await sendViaResendAPI(to, subject, html);
    logger.info(`emailService: sent "${subject}" → ${to} (id=${result.id})`);
  } catch (err) {
    logger.error(`emailService: sendMail error: ${err.message}`);
  }
};

/**
 * Send an email — throws on error (for test/diagnostic use).
 */
const sendMailOrThrow = async (to, subject, html) => {
  const result = await sendViaResendAPI(to, subject, html);
  return result;
};

module.exports = { sendMail, sendMailOrThrow };
