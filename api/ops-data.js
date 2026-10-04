const { bearer, verifySession } = require('../server/ops-session');
const store = require('../server/ops-store');

async function authenticate(request) {
  const session = verifySession(bearer(request), process.env.LEGACY_OPS_SESSION_SECRET);
  if (!session) return null;
  const users = await store.select(`daria_ops_users?id=eq.${encodeURIComponent(session.sub)}&active=eq.true&select=id,name,role,telegram_user_id`);
  const user = users[0];
  return user && String(user.telegram_user_id) === String(session.tid) ? user : null;
}

function allowedTask(row, user, existing = null) {
  const status = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_DECISION', 'DONE', 'CANCELLED'].includes(row.task_status) ? row.task_status : 'OPEN';
  const priority = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(row.priority) ? row.priority : 'NORMAL';
  return {
    title: String(row.title || '').trim().slice(0, 240),
    details: String(row.details || '').trim().slice(0, 4000),
    concert_id: row.concert_id || null,
    task_status: status,
    priority,
    due_date: row.due_date || null,
    assignee_ops_user_id: row.assignee_ops_user_id || user.id,
    blocked_by_ops_user_id: status === 'WAITING_FOR_DECISION' ? row.blocked_by_ops_user_id || null : null,
    created_by_ops_user_id: existing?.created_by_ops_user_id || user.id,
    completed_at: status === 'DONE' ? existing?.completed_at || new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
}

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  try {
    const user = await authenticate(request);
    if (!user) return response.status(401).json({ error: 'invalid_session' });
    if (request.method === 'GET') {
      const [users, tasks, concerts, documents] = await Promise.all([
        store.select('daria_ops_users?active=eq.true&select=id,name,role&order=name.asc'),
        store.select('daria_operational_tasks?select=id,title,details,concert_id,task_status,priority,due_date,assignee_ops_user_id,blocked_by_ops_user_id,created_by_ops_user_id,created_at,updated_at&order=due_date.asc.nullslast,created_at.desc'),
        store.select('daria_concerts?select=id,event_name,city,event_date,venue,status,risk_status&order=event_date.asc.nullslast'),
        store.select('daria_source_documents?select=id,source_name,document_type,source_date,notes,created_at&order=created_at.desc&limit=50')
      ]);
      return response.status(200).json({ user, users, tasks, concerts, documents });
    }
    if (request.method === 'POST') {
      if (request.body?.entity !== 'task') return response.status(400).json({ error: 'unknown_entity' });
      const row = request.body.row || {};
      let existing = null;
      if (row.id) existing = (await store.select(`daria_operational_tasks?id=eq.${encodeURIComponent(row.id)}&select=*`))[0] || null;
      if (row.id && !existing) return response.status(404).json({ error: 'not_found' });
      const clean = allowedTask(row, user, existing);
      if (!clean.title) return response.status(400).json({ error: 'title_required' });
      const saved = existing
        ? await store.update(`daria_operational_tasks?id=eq.${encodeURIComponent(row.id)}`, clean)
        : await store.insert('daria_operational_tasks', clean);
      return response.status(200).json({ data: saved[0] });
    }
    if (request.method === 'DELETE') {
      if (request.body?.entity !== 'task' || !request.body?.id) return response.status(400).json({ error: 'invalid_delete' });
      const current = (await store.select(`daria_operational_tasks?id=eq.${encodeURIComponent(request.body.id)}&select=id,created_by_ops_user_id`))[0];
      if (!current) return response.status(404).json({ error: 'not_found' });
      if (!['OWNER', 'OPERATIONS_ADMIN'].includes(user.role) && current.created_by_ops_user_id !== user.id) return response.status(403).json({ error: 'forbidden' });
      await store.remove(`daria_operational_tasks?id=eq.${encodeURIComponent(request.body.id)}`);
      return response.status(200).json({ deleted: true });
    }
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'server_error' });
  }
};

