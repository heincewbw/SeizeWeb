const supabase = require('../config/supabase');
const logger = require('../config/logger');
const mt4Bridge = require('../services/mt4Bridge');

// GET /api/accounts
const getAccounts = async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('mt4_accounts')
      .select('id, login, server, broker, account_name, currency, leverage, balance, equity, margin, free_margin, profit, is_connected, last_synced, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('GetAccounts error:', error);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    return res.json({ accounts: accounts || [] });
  } catch (err) {
    logger.error('GetAccounts exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/accounts/connect
const connectAccount = async (req, res) => {
  const { login, password, server, account_name } = req.body;

  if (!login || !password || !server) {
    return res.status(400).json({ error: 'login, password, and server are required' });
  }

  try {
    // Attempt MT4 connection via bridge
    const mt4Data = await mt4Bridge.connectAccount(login, password, server);

    if (!mt4Data.success) {
      return res.status(400).json({ error: mt4Data.error || 'Failed to connect to MT4 account' });
    }

    // Check if account already exists for this user
    const { data: existing } = await supabase
      .from('mt4_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('login', String(login))
      .eq('server', server)
      .single();

    let account;
    if (existing) {
      const { data, error } = await supabase
        .from('mt4_accounts')
        .update({
          account_name: account_name || mt4Data.name,
          broker: mt4Data.broker,
          currency: mt4Data.currency,
          leverage: mt4Data.leverage,
          balance: mt4Data.balance,
          equity: mt4Data.equity,
          margin: mt4Data.margin,
          free_margin: mt4Data.freeMargin,
          profit: mt4Data.profit,
          is_connected: true,
          last_synced: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      account = data;
    } else {
      const { data, error } = await supabase
        .from('mt4_accounts')
        .insert({
          user_id: req.user.id,
          login: String(login),
          server,
          broker: mt4Data.broker,
          account_name: account_name || mt4Data.name || `Account ${login}`,
          currency: mt4Data.currency || 'USD',
          leverage: mt4Data.leverage || 100,
          balance: mt4Data.balance || 0,
          equity: mt4Data.equity || 0,
          margin: mt4Data.margin || 0,
          free_margin: mt4Data.freeMargin || 0,
          profit: mt4Data.profit || 0,
          is_connected: true,
          last_synced: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      account = data;
    }

    logger.info(`MT4 account connected: login=${login}, server=${server}, user=${req.user.id}`);
    return res.status(201).json({ message: 'MT4 account connected successfully', account });
  } catch (err) {
    logger.error('ConnectAccount exception:', err);
    return res.status(500).json({ error: 'Failed to connect MT4 account' });
  }
};

// DELETE /api/accounts/:id
const disconnectAccount = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: account, error: fetchError } = await supabase
      .from('mt4_accounts')
      .select('id, login, server')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await mt4Bridge.disconnectAccount(account.login, account.server);

    const { error } = await supabase
      .from('mt4_accounts')
      .update({ is_connected: false })
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Account disconnected successfully' });
  } catch (err) {
    logger.error('DisconnectAccount exception:', err);
    return res.status(500).json({ error: 'Failed to disconnect account' });
  }
};

// POST /api/accounts/:id/sync
const syncAccount = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: account, error: fetchError } = await supabase
      .from('mt4_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const mt4Data = await mt4Bridge.getAccountInfo(account.login, account.server);

    if (!mt4Data.success) {
      return res.status(400).json({ error: mt4Data.error || 'Failed to sync account' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('mt4_accounts')
      .update({
        balance: mt4Data.balance,
        equity: mt4Data.equity,
        margin: mt4Data.margin,
        free_margin: mt4Data.freeMargin,
        profit: mt4Data.profit,
        is_connected: true,
        last_synced: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Save equity snapshot for chart
    await supabase.from('equity_snapshots').insert({
      mt4_account_id: id,
      user_id: req.user.id,
      balance: mt4Data.balance,
      equity: mt4Data.equity,
      profit: mt4Data.profit,
    });

    return res.json({ message: 'Account synced successfully', account: updated });
  } catch (err) {
    logger.error('SyncAccount exception:', err);
    return res.status(500).json({ error: 'Failed to sync account' });
  }
};

module.exports = { getAccounts, connectAccount, disconnectAccount, syncAccount };
