const store = require('../server/ops-store');

const dateText = value => value ? value.split('-').reverse().join('.') : 'без даты';

async function sendTelegram(botToken, telegramUserId, text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramUserId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(`telegram_${response.status}`);
  return result.result?.message_id || null;
}

module.exports = async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' });
  const cronSecret = process.env.CRON_SECRET;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!cronSecret || !botToken) return response.status(503).json({ error: 'reminders_not_configured' });
  if (request.headers.authorization !== `Bearer ${cronSecret}`) return response.status(401).json({ error: 'unauthorized' });

  const today = new Date().toISOString().slice(0, 10);
  try {
    const [users, tasks, milestones, concerts, sent] = await Promise.all([
      store.select('daria_ops_users?active=eq.true&telegram_user_id=not.is.null&select=id,name,role,telegram_user_id'),
      store.select(`daria_operational_tasks?task_status=in.(OPEN,IN_PROGRESS,WAITING_FOR_DECISION)&due_date=lte.${today}&select=id,title,due_date,assignee_ops_user_id,blocked_by_ops_user_id,concert_id`),
      store.select(`daria_control_dates?status=eq.OPEN&target_date=lte.${today}&select=id,title,target_date,milestone_type,concert_id`),
      store.select('daria_concerts?select=id,event_name,city'),
      store.select(`daria_ops_reminder_log?reminder_date=eq.${today}&select=ops_user_id,entity_type,entity_id`)
    ]);
    const concertById = new Map(concerts.map(item => [item.id, item]));
    const sentKeys = new Set(sent.map(item => `${item.ops_user_id}:${item.entity_type}:${item.entity_id}`));
    let recipients = 0, reminders = 0;

    for (const user of users) {
      const userTasks = tasks.filter(task => (task.assignee_ops_user_id === user.id || task.blocked_by_ops_user_id === user.id) && !sentKeys.has(`${user.id}:TASK:${task.id}`)).slice(0, 10);
      const userMilestones = ['OWNER', 'OPERATIONS_ADMIN'].includes(user.role)
        ? milestones.filter(item => !sentKeys.has(`${user.id}:MILESTONE:${item.id}`)).slice(0, 10)
        : [];
      if (!userTasks.length && !userMilestones.length) continue;

      const lines = [`Legacy Imperial · напоминание на ${dateText(today)}`];
      if (userTasks.length) {
        lines.push('', 'Задачи:');
        userTasks.forEach(task => {
          const concert = concertById.get(task.concert_id);
          lines.push(`• ${task.title} · срок ${dateText(task.due_date)}${concert ? ` · ${concert.event_name}, ${concert.city}` : ''}`);
        });
      }
      if (userMilestones.length) {
        lines.push('', 'Контрольные даты:');
        userMilestones.forEach(item => {
          const concert = concertById.get(item.concert_id);
          lines.push(`• ${item.title} · ${dateText(item.target_date)}${concert ? ` · ${concert.event_name}, ${concert.city}` : ''}`);
        });
      }
      lines.push('', 'Открой «Всё под рукой», чтобы обновить состояние.');
      const messageId = await sendTelegram(botToken, user.telegram_user_id, lines.join('\n'));
      const logRows = [
        ...userTasks.map(task => ({ ops_user_id: user.id, entity_type: 'TASK', entity_id: task.id, reminder_date: today, telegram_message_id: messageId })),
        ...userMilestones.map(item => ({ ops_user_id: user.id, entity_type: 'MILESTONE', entity_id: item.id, reminder_date: today, telegram_message_id: messageId }))
      ];
      await store.insert('daria_ops_reminder_log?on_conflict=ops_user_id,entity_type,entity_id,reminder_date', logRows);
      recipients += 1;
      reminders += logRows.length;
    }
    return response.status(200).json({ ok: true, recipients, reminders });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'reminder_failed' });
  }
};
