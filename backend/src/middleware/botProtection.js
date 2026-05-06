const logger = require('../config/logger');

// Common paths that scanners/bots probe — blocked outright with 404
const SCANNER_PATHS = [
  /\/\.env($|\.|\/)/i,
  /\/\.git($|\/)/i,
  /\/\.aws($|\/)/i,
  /\/\.ssh($|\/)/i,
  /\/\.vscode($|\/)/i,
  /\/wp-admin($|\/)/i,
  /\/wp-login/i,
  /\/wp-content/i,
  /\/wp-includes/i,
  /\/wordpress($|\/)/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/phpinfo/i,
  /\.php$/i,
  /\.asp$/i,
  /\.aspx$/i,
  /\.jsp$/i,
  /\/cgi-bin/i,
  /\/admin\.php/i,
  /\/config\.(json|yml|yaml|php|bak)/i,
  /\/backup($|\/|\.)/i,
  /\/sql($|\/)/i,
  /\/database\.sql/i,
  /\/owa($|\/)/i,
  /\/autodiscover/i,
  /\/actuator($|\/)/i,
  /\/server-status/i,
  /\/server-info/i,
  /\/_ignition/i,
  /\/vendor\/phpunit/i,
  /\/HNAP1/i,
  /\/boaform/i,
  /\/manager\/html/i,
  /\/console($|\/)/i,
  /\/setup\.cgi/i,
];

// Suspicious User-Agent substrings (case-insensitive) — block on web routes
// NOTE: We ALLOW these on /api/mt4/* because MT4 EA may send minimal/odd UAs
const BAD_UA_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /nessus/i,
  /acunetix/i,
  /burpsuite/i,
  /wpscan/i,
  /gobuster/i,
  /dirbuster/i,
  /feroxbuster/i,
  /zgrab/i,
  /shodan/i,
  /censys/i,
  /netsparker/i,
  /qualys/i,
  /openvas/i,
  /nuclei/i,
  /httpx/i,
  /xenu/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
];

// Block requests to obvious scanner paths
const blockScannerPaths = (req, res, next) => {
  if (SCANNER_PATHS.some((re) => re.test(req.path))) {
    logger.warn(`[BOT] Blocked scanner path: ${req.method} ${req.path} from ${req.ip} UA="${req.get('user-agent') || ''}"`);
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};

// Block requests with malicious/suspicious User-Agents
// Skips MT4 EA push endpoints so the EA isn't blocked
const blockBadUserAgents = (req, res, next) => {
  // Allow MT4 EA + health endpoints to bypass UA check
  if (req.path.startsWith('/api/mt4/') || req.path === '/health') {
    return next();
  }

  const ua = req.get('user-agent') || '';

  if (BAD_UA_PATTERNS.some((re) => re.test(ua))) {
    logger.warn(`[BOT] Blocked bad UA: ${req.method} ${req.path} from ${req.ip} UA="${ua}"`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Block requests to /auth or /api with empty UA (real browsers always send one)
  if (!ua && (req.path.startsWith('/auth') || req.path.startsWith('/api/'))) {
    logger.warn(`[BOT] Blocked empty UA: ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

module.exports = {
  blockScannerPaths,
  blockBadUserAgents,
};
