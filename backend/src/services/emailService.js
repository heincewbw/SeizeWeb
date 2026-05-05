const https = require('https');
const logger = require('../config/logger');

/**
 * Send email via Brevo REST API (HTTPS — works on Railway which blocks SMTP).
 */
const sendViaBrevoAPI = (to, subject, html) => {
  return new Promise((resolve, reject) => {
    const { BREVO_API_KEY, SMTP_USER } = process.env;
    if (!BREVO_API_KEY) return reject(new Error('BREVO_API_KEY tidak di-set di environment variables'));

    const payload = JSON.stringify({
      sender: { name: 'AceCapital Alert', email: SMTP_USER || 'noreply@acecapital.app' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
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
          reject(new Error(`Brevo API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Brevo API request timeout')); });
    req.write(payload);
    req.end();
  });
};

/**
 * Send an email (fire-and-forget, swallows errors).
 */
const sendMail = async (to, subject, html) => {
  try {
    const result = await sendViaBrevoAPI(to, subject, html);
    logger.info(`emailService: sent "${subject}" → ${to} (messageId=${result.messageId})`);
  } catch (err) {
    logger.error(`emailService: sendMail error: ${err.message}`);
  }
};

/**
 * Send an email — throws on error (for test/diagnostic use).
 */
const sendMailOrThrow = async (to, subject, html) => {
  const result = await sendViaBrevoAPI(to, subject, html);
  return result;
};

module.exports = { sendMail, sendMailOrThrow };
