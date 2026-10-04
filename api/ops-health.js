const store = require('../server/ops-store');

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    await store.select('daria_ops_users?select=id,name,role,telegram_user_id,active&active=eq.true&limit=1');
    return response.status(200).json({ ok: true, database: 'ready' });
  } catch (error) {
    return response.status(503).json({
      ok: false,
      database: 'unavailable',
      error: error.message || 'database_unavailable'
    });
  }
};
