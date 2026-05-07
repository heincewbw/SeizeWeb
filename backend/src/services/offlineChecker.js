/**
 * offlineChecker.js
 *
 * Runs every 15 minutes.
 * On weekdays (Mon–Fri), checks if any connected MT4 account has not pushed
 * data for more than 1 hour (based on last_synced). If so, sends one email
 * alert to all admin users and suppresses repeat alerts until the account
 * comes back online then goes offline again.
 */

const supabase = require('../config/supabase');
const logger   = require('../config/logger');
const { sendMail } = require('./emailService');

// In-memory map: account ID → timestamp when alert was last sent
const alertedAccounts = new Map();

const OFFLINE_THRESHOLD_MS  = 60 * 60 * 1000;       // 1 hour
const REPEAT_ALERT_MS       = 4 * 60 * 60 * 1000;   // re-alert after 4 hours if still offline
const CHECK_INTERVAL_MS     = 15 * 60 * 1000;        // every 15 minutes

const isWeekend = (date) => {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6;
};

const buildEmailHtml = (offlineAccounts) => {
  const rows = offlineAccounts
    .map(
      (a) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${a.login}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${a.server}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${a.account_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#f87171;">${a.lastSyncedStr}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;">
      <h2 style="color:#f43f5e;margin-top:0;">⚠️ MT4 Account Offline Alert</h2>
      <p style="color:#94a3b8;">The following MT4 account(s) have not pushed data for <strong>more than 1 hour</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#1e293b;">
            <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Login</th>
            <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Server</th>
            <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Account Name</th>
            <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Last Seen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">
        This alert was generated automatically by AceCapital at ${new Date().toUTCString()}.
        No further alert will be sent for these accounts until they reconnect.
      </p>
    </div>`;
};

const runOfflineCheck = async () => {
  const now = new Date();

  // Skip weekends
  if (isWeekend(now)) {
    logger.info('offlineChecker: skipping — weekend');
    return;
  }

  try {
    // Fetch all connected accounts with their last_synced time
    const { data: accounts, error } = await supabase
      .from('mt4_accounts')
      .select('id, login, server, account_name, last_synced, user_id')
      .eq('is_connected', true);

    if (error) throw error;
    if (!accounts || accounts.length === 0) return;

    const offline = [];
    const backOnline = [];

    for (const acc of accounts) {
      if (!acc.last_synced) {
        // Never synced — treat as offline
        if (!alertedAccounts.has(acc.id)) {
          offline.push({
            ...acc,
            lastSyncedStr: 'Never',
          });
        }
        continue;
      }

      const lastSync = new Date(acc.last_synced);
      const silentMs = now - lastSync;

      if (silentMs > OFFLINE_THRESHOLD_MS) {
        const lastAlerted = alertedAccounts.get(acc.id);
        const shouldAlert = !lastAlerted || (now - lastAlerted) >= REPEAT_ALERT_MS;
        if (shouldAlert) {
          offline.push({
            ...acc,
            lastSyncedStr: lastSync.toUTCString(),
          });
        }
      } else {
        // Account is online — clear alert flag so we re-alert if it goes offline again
        if (alertedAccounts.has(acc.id)) {
          backOnline.push(acc.id);
          alertedAccounts.delete(acc.id);
        }
      }
    }

    if (backOnline.length > 0) {
      logger.info(`offlineChecker: ${backOnline.length} account(s) back online, alert cleared`);
    }

    if (offline.length === 0) {
      logger.info('offlineChecker: all accounts responding normally');
      return;
    }

    logger.warn(`offlineChecker: ${offline.length} account(s) offline — sending alert email`);

    // Mark as alerted with current timestamp
    for (const acc of offline) alertedAccounts.set(acc.id, now);

    // Fetch all admin emails
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (!admins || admins.length === 0) {
      logger.warn('offlineChecker: no admin users found to notify');
      return;
    }

    const subject = `[AceCapital] ${offline.length} MT4 Account${offline.length > 1 ? 's' : ''} Offline > 1 Hour`;
    const html = buildEmailHtml(offline);

    for (const admin of admins) {
      await sendMail(admin.email, subject, html);
    }
  } catch (err) {
    logger.error('offlineChecker error:', err.message);
  }
};

const startOfflineChecker = () => {
  // Run once shortly after startup
  setTimeout(runOfflineCheck, 5 * 60 * 1000); // first check 5 min after boot
  setInterval(runOfflineCheck, CHECK_INTERVAL_MS);
  logger.info('offlineChecker: started (checks every 15 min, skips weekends)');
};

module.exports = { startOfflineChecker, runOfflineCheck };
