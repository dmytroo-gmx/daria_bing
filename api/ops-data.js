const { bearer, verifySession } = require('../server/ops-session');
const store = require('../server/ops-store');
const { sendTelegram } = require('../server/telegram-message');
const regulation = require('../shared/regulation');

async function authenticate(request) {
  const session = verifySession(bearer(request), process.env.LEGACY_OPS_SESSION_SECRET);
  if (!session) return null;
  const users = await store.select(`daria_ops_users?id=eq.${encodeURIComponent(session.sub)}&active=eq.true&select=id,name,role,telegram_user_id`);
  const user = users[0];
  return user && String(user.telegram_user_id) === String(session.tid) ? user : null;
}

function publicOpsUser(user) {
  const telegramId = String(user.telegram_user_id || '');
  const name = String(user.name || '').toLowerCase();
  const business_title = telegramId === '707507251' ? 'Основатель, продюсер'
    : telegramId === '7803517817' ? 'Руководитель аппарата и цифровых проектов'
    : name.includes('daria') || name.includes('дария') || name.includes('даша') ? 'Букинг-менеджер'
    : user.role === 'OPERATIONS_ADMIN' ? 'Администратор операций' : 'Команда';
  return { id: user.id, name: user.name, role: user.role, business_title };
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
      if (request.query?.scope !== 'regulation') {
        const [users, tasks, concerts, documents] = await Promise.all([
          store.select('daria_ops_users?active=eq.true&select=id,name,role,telegram_user_id&order=name.asc'),
          store.select('daria_operational_tasks?select=id,title,details,concert_id,task_status,priority,due_date,assignee_ops_user_id,blocked_by_ops_user_id,created_by_ops_user_id,created_at,updated_at&order=due_date.asc.nullslast,created_at.desc'),
          store.select('daria_concerts?select=id,event_name,project_name,city,event_date,venue,capacity,average_ticket_price,planned_marketing_budget,currency,status,risk_status&order=event_date.asc.nullslast'),
          store.select('daria_source_documents?select=id,concert_id,source_name,document_type,source_date,notes,created_at&order=created_at.desc')
        ]);
        return response.status(200).json({ user: publicOpsUser(user), users: users.map(publicOpsUser), tasks, concerts, documents });
      }
      const concertId = String(request.query?.concert_id || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(concertId)) return response.status(400).json({ error: 'concert_id_required' });
      const byConcert = `concert_id=eq.${encodeURIComponent(concertId)}`;
      const optional = await Promise.allSettled([
        store.select(`daria_regulation_steps?${byConcert}&select=*&order=updated_at.desc`),
        store.select(`daria_channel_plans?${byConcert}&select=*`),
        store.select(`daria_funding_sources?${byConcert}&select=*`),
        store.select(`daria_creative_reviews?${byConcert}&select=*`),
        store.select(`daria_expenses?${byConcert}&select=concert_id,expense_type,include_in_projected_cost,amount,currency,due_date,payment_status`),
        store.select(`daria_control_dates?${byConcert}&select=concert_id,milestone_type,target_date,status`),
        store.select(`daria_campaigns?${byConcert}&select=id,concert_id,actual_spend`),
        store.select(`daria_tracking_links?${byConcert}&select=id,concert_id`),
        store.rpc('daria_concert_metrics'),
        store.select(`daria_daily_sales_snapshots?${byConcert}&select=concert_id,operator_id,snapshot_date,tickets_sold_total,source_document_id`),
        store.rpc('daria_channel_metrics', byConcert)
      ]);
      const values = optional.map(item => item.status === 'fulfilled' ? item.value : []);
      return response.status(200).json({ regulationAvailable: optional.every(item => item.status === 'fulfilled'), regulationSteps: values[0], channelPlans: values[1], fundingSources: values[2], creatives: values[3], expenses: values[4], milestones: values[5], campaigns: values[6], links: values[7], metrics: values[8], snapshots: values[9], channelMetrics: values[10] });
    }
    if (request.method === 'POST') {
      if (request.body?.action === 'test_reminder') {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return response.status(503).json({ error: 'telegram_not_configured' });
        await sendTelegram(botToken, user.telegram_user_id, 'Legacy Imperial · тестовое напоминание\n\nСвязь с пультом «Всё под рукой» работает. Ежедневные уведомления будут приходить сюда.');
        return response.status(200).json({ sent: true });
      }
      if (request.body?.entity === 'regulation_step') {
        const row = request.body.row || {};
        if (!regulation.steps.some(item => item.code === row.step_code)) return response.status(400).json({ error: 'unknown_step' });
        if (!regulation.statuses[row.status]) return response.status(400).json({ error: 'unknown_status' });
        if (['VERIFIED', 'EXCEPTION'].includes(row.status) && !['OWNER', 'OPERATIONS_ADMIN'].includes(user.role)) return response.status(403).json({ error: 'approval_requires_leadership' });
        const concerts = await store.select(`daria_concerts?id=eq.${encodeURIComponent(row.concert_id || '')}&select=id,event_name,project_name,city,event_date,capacity,average_ticket_price,planned_marketing_budget,currency,status`);
        const concert = concerts[0]; if (!concert) return response.status(404).json({ error: 'concert_not_found' });
        const [existingRows, channelPlans, fundingSources, creatives, expenses, milestones, campaigns, links, documents, allConcerts, metrics, snapshots, channelMetrics] = await Promise.all([
          store.select(`daria_regulation_steps?concert_id=eq.${concert.id}&step_code=eq.${encodeURIComponent(row.step_code)}&select=*`),
          store.select(`daria_channel_plans?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_funding_sources?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_creative_reviews?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_expenses?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_control_dates?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_campaigns?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_tracking_links?concert_id=eq.${concert.id}&select=*`),
          store.select(`daria_source_documents?select=id,concert_id`),
          store.select('daria_concerts?select=id,project_name,status'),
          store.rpc('daria_concert_metrics'),
          store.select(`daria_daily_sales_snapshots?concert_id=eq.${concert.id}&select=concert_id,operator_id,snapshot_date,tickets_sold_total,source_document_id`),
          store.rpc('daria_channel_metrics', `concert_id=eq.${encodeURIComponent(concert.id)}`)
        ]);
        const sourceId = row.source_document_id || null;
        const previousIds = new Set(row.step_code === 'PRODUCT_PROOF' ? allConcerts.filter(item => item.id !== concert.id && item.status === 'COMPLETED' && concert.project_name && item.project_name?.trim().toLowerCase() === concert.project_name.trim().toLowerCase()).map(item => item.id) : []);
        if (sourceId && !documents.some(item => item.id === sourceId && (!item.concert_id || item.concert_id === concert.id || previousIds.has(item.concert_id)))) return response.status(400).json({ error: 'invalid_source_document' });
        const metric = metrics.find(item => item.concert_id === concert.id);
        const evaluation = regulation.evaluate(concert, { channelPlans, fundingSources, creatives, expenses, milestones, campaigns, links, documents, concerts: allConcerts, metrics, snapshots, channelMetrics, soldTickets: metric?.paid_tickets || 0 });
        const clean = { concert_id: concert.id, step_code: row.step_code, status: row.status, reviewer_name: ['VERIFIED', 'EXCEPTION'].includes(row.status) ? user.name : String(row.reviewer_name || '').trim().slice(0, 160), professional_name: String(row.professional_name || '').trim().slice(0, 160), notes: String(row.notes || '').trim().slice(0, 4000), source_document_id: sourceId, decision: row.step_code === 'CHECKPOINTS' && ['VERIFIED','EXCEPTION'].includes(row.status) && ['CONTINUE','POSTPONE','CANCEL'].includes(row.decision) ? row.decision : null, reviewed_at: ['VERIFIED', 'EXCEPTION'].includes(row.status) ? new Date().toISOString() : null, updated_by_ops_user_id: user.id, updated_by_auth_user_id: null, updated_at: new Date().toISOString() };
        const validation = regulation.validateStep(clean, evaluation);
        if (validation) return response.status(400).json({ error: validation });
        const existing = existingRows[0];
        if (existing && ['VERIFIED', 'EXCEPTION'].includes(existing.status) && !['OWNER', 'OPERATIONS_ADMIN'].includes(user.role)) return response.status(403).json({ error: 'approval_requires_leadership' });
        const saved = existing ? await store.update(`daria_regulation_steps?id=eq.${existing.id}`, clean) : await store.insert('daria_regulation_steps', clean);
        return response.status(200).json({ data: saved[0] });
      }
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
      if (request.body?.entity === 'regulation_step') {
        if (!['OWNER', 'OPERATIONS_ADMIN'].includes(user.role)) return response.status(403).json({ error: 'forbidden' });
        const id = request.body?.id; if (!id) return response.status(400).json({ error: 'invalid_delete' });
        await store.remove(`daria_regulation_steps?id=eq.${encodeURIComponent(id)}`);
        return response.status(200).json({ deleted: true });
      }
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

