const { validateTelegramInitData } = require('../server/telegram-init-data');
const { signSession } = require('../server/ops-session');
const store = require('../server/ops-store');

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const sessionSecret = process.env.LEGACY_OPS_SESSION_SECRET;
  if (!botToken || !sessionSecret) return response.status(503).json({ error: 'telegram_not_configured' });
  const validation = validateTelegramInitData(request.body?.initData, botToken);
  if (!validation.valid || !validation.user?.id) return response.status(401).json({ error: validation.reason || 'invalid_init_data' });
  const telegramId = String(validation.user.id);
  try {
    const users = await store.select('daria_ops_users?select=id,name,role,telegram_user_id,active&active=eq.true');
    const matches = users.filter(user => String(user.telegram_user_id) === telegramId);
    if (matches.length > 1) return response.status(409).json({ error: 'duplicate_telegram_mapping' });
    if (!matches[0]) {
      await store.insert('daria_ops_access_requests?on_conflict=telegram_user_id', {
        telegram_user_id: telegramId,
        telegram_name: [validation.user.first_name, validation.user.last_name].filter(Boolean).join(' '),
        telegram_username: validation.user.username || null
      });
      return response.status(403).json({ error: 'telegram_user_not_mapped', telegramUserId: telegramId });
    }
    const user = matches[0];
    return response.status(200).json({ user, sessionToken: signSession(user, sessionSecret) });
  } catch (error) {
    return response.status(502).json({ error: error.message || 'profile_lookup_failed' });
  }
};

