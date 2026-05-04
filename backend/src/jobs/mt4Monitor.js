/**
 * MT4 Account Monitor Job
 *
 * Berjalan setiap 15 menit.
 * Cek akun MT4 yang is_connected=true tapi last_synced > 1 jam lalu.
 * Kirim notif WhatsApp ke admin, kecuali hari Sabtu (6) & Minggu (0).
 * Anti-spam: akun yang sudah dinotif tidak diulang dalam 2 jam.
 */

const supabase = require('../config/supabase');
const { notifyAdmin } = require('../services/whatsapp');
const logger = require('../config/logger');

const CHECK_INTERVAL_MS = 15 * 60 * 1000;   // 15 menit
const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000; // 1 jam
const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 jam cooldown per akun

// In-memory: { accountId: lastNotifiedTimestamp }
const notifiedAt = new Map();

const isWeekend = () => {
  const day = new Date().getDay(); // 0=Minggu, 6=Sabtu
  return day === 0 || day === 6;
};

const formatDuration = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} jam ${m} menit`;
  return `${m} menit`;
};

const runCheck = async () => {
  if (isWeekend()) {
    logger.debug('MT4 Monitor: hari Sabtu/Minggu, skip.');
    return;
  }

  try {
    const { data: accounts, error } = await supabase
      .from('mt4_accounts')
      .select('id, login, server, account_name, last_synced, currency')
      .eq('is_connected', true)
      .not('last_synced', 'is', null);

    if (error) {
      logger.error('MT4 Monitor: gagal fetch accounts:', error);
      return;
    }

    const now = Date.now();
    const offlineAccounts = (accounts || []).filter((acc) => {
      const lastSync = new Date(acc.last_synced).getTime();
      return now - lastSync > OFFLINE_THRESHOLD_MS;
    });

    if (offlineAccounts.length === 0) {
      logger.debug('MT4 Monitor: semua akun aktif.');
      return;
    }

    // Filter yang belum melewati cooldown notifikasi
    const toNotify = offlineAccounts.filter((acc) => {
      const last = notifiedAt.get(acc.id) || 0;
      return now - last >= NOTIFY_COOLDOWN_MS;
    });

    if (toNotify.length === 0) {
      logger.debug('MT4 Monitor: ada akun offline tapi masih dalam cooldown notif.');
      return;
    }

    // Susun pesan
    const lines = toNotify.map((acc) => {
      const offlineDuration = now - new Date(acc.last_synced).getTime();
      const name = acc.account_name || `${acc.login}@${acc.server}`;
      return `• *${name}* (${acc.login}@${acc.server})\n  Offline: ${formatDuration(offlineDuration)}`;
    });

    const message =
      `⚠️ *SeizeWeb Alert*\n\n` +
      `${toNotify.length} akun MT4 tidak merespons lebih dari 1 jam:\n\n` +
      lines.join('\n\n') +
      `\n\n_Cek koneksi EA atau VPS masing-masing akun._\n` +
      `_${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_`;

    logger.warn(`MT4 Monitor: ${toNotify.length} akun offline, kirim notif WA...`);
    const sent = await notifyAdmin(message);

    if (sent) {
      toNotify.forEach((acc) => notifiedAt.set(acc.id, now));
    }
  } catch (err) {
    logger.error('MT4 Monitor: unhandled error:', err.message);
  }
};

const startMT4Monitor = () => {
  logger.info('MT4 Monitor: started (interval 15 menit, skip Sabtu-Minggu).');
  // Jalankan pertama kali setelah 1 menit agar server siap
  setTimeout(() => {
    runCheck();
    setInterval(runCheck, CHECK_INTERVAL_MS);
  }, 60 * 1000);
};

module.exports = { startMT4Monitor };
