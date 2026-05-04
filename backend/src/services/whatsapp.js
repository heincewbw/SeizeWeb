/**
 * WhatsApp Notification Service via Fonnte API
 * Docs: https://fonnte.com/docs
 *
 * Required env vars:
 *   FONNTE_TOKEN       — API token dari dashboard Fonnte
 *   ADMIN_WA_NUMBER    — Nomor WA admin (format: 628xxx, tanpa +)
 */

const logger = require('../config/logger');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
const ADMIN_WA_NUMBER = process.env.ADMIN_WA_NUMBER;

/**
 * Kirim pesan WhatsApp ke nomor target.
 * @param {string} target  - Nomor tujuan, e.g. "628123456789"
 * @param {string} message - Isi pesan
 */
const sendWhatsApp = async (target, message) => {
  if (!FONNTE_TOKEN || !target) {
    logger.warn('WhatsApp: FONNTE_TOKEN atau target tidak dikonfigurasi, notif dilewati.');
    return false;
  }

  try {
    const body = new URLSearchParams({
      target,
      message,
      countryCode: '62',
    });

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: FONNTE_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.status === false) {
      logger.error('WhatsApp send failed:', json);
      return false;
    }

    logger.info(`WhatsApp terkirim ke ${target}`);
    return true;
  } catch (err) {
    logger.error('WhatsApp sendWhatsApp error:', err.message);
    return false;
  }
};

/**
 * Kirim notifikasi ke admin.
 * @param {string} message
 */
const notifyAdmin = (message) => {
  if (!ADMIN_WA_NUMBER) {
    logger.warn('WhatsApp: ADMIN_WA_NUMBER tidak dikonfigurasi.');
    return Promise.resolve(false);
  }
  return sendWhatsApp(ADMIN_WA_NUMBER, message);
};

module.exports = { sendWhatsApp, notifyAdmin };
