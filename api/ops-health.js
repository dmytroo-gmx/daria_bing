const store = require('../server/ops-store');

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    await Promise.all([
      store.select('daria_ops_users?active=eq.true&select=id,name,role,telegram_user_id&order=name.asc&limit=1'),
      store.select('daria_operational_tasks?select=id,title,details,concert_id,task_status,priority,due_date,assignee_ops_user_id,blocked_by_ops_user_id,created_by_ops_user_id,created_at,updated_at&order=due_date.asc.nullslast,created_at.desc&limit=1'),
      store.select('daria_concerts?select=id,event_name,city,event_date,venue,status,risk_status&order=event_date.asc.nullslast&limit=1'),
      store.select('daria_source_documents?select=id,source_name,document_type,source_date,notes,created_at&order=created_at.desc&limit=1'),
      store.select('daria_ops_reminder_log?select=id&limit=1')
    ]);
    const reminders = process.env.CRON_SECRET && process.env.TELEGRAM_BOT_TOKEN ? 'ready' : 'not_configured';
    return response.status(200).json({ ok: true, database: 'ready', reminders, check: 'all_panel_queries' });
  } catch (error) {
    return response.status(503).json({
      ok: false,
      database: 'unavailable',
      error: error.message || 'database_unavailable'
    });
  }
};
