const state = { user: null, users: [], tasks: [], concerts: [], documents: [], token: '', filter: 'mine' };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const labels = {
  OPEN:'Открыта', IN_PROGRESS:'В работе', WAITING_FOR_DECISION:'Ждёт решения', DONE:'Готово', CANCELLED:'Отменена',
  LOW:'Низкий', NORMAL:'Обычный', HIGH:'Высокий', CRITICAL:'Критический',
  DRAFT:'Черновик', PLANNED:'Запланирован', ON_SALE:'В продаже', ACTIVE:'В работе', ON_HOLD:'На паузе',
  POSTPONED:'Перенесён', COMPLETED:'Завершён', PDF:'Документ', CSV:'Табличная выгрузка', OTHER:'Другой'
};

function toast(message) { const node = $('toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2400); }
function formatDate(value) { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle:'medium', timeZone:'Europe/Warsaw' }).format(new Date(`${value}T12:00:00Z`)) : 'без даты'; }
function person(id) { return state.users.find(item => item.id === id)?.name || 'Не назначено'; }
function showView(view) { document.querySelectorAll('[data-panel]').forEach(item => item.classList.toggle('active', item.dataset.panel === view)); document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view)); if (view === 'tasks') renderTasks(); }
async function api(url, options = {}) { const response = await fetch(url, { ...options, headers:{ 'content-type':'application/json', authorization:`Bearer ${state.token}`, ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Ошибка соединения'); return body; }

function taskCard(task, editable = true) {
  const concert = state.concerts.find(item => item.id === task.concert_id);
  return `<article class="card" data-task-id="${escapeHtml(task.id)}"><div class="row"><h3>${escapeHtml(task.title)}</h3><b>${escapeHtml(labels[task.priority] || task.priority)}</b></div><p>${escapeHtml(labels[task.task_status] || task.task_status)} · ${escapeHtml(person(task.assignee_ops_user_id))} · ${escapeHtml(formatDate(task.due_date))}</p>${concert ? `<p>${escapeHtml(concert.event_name)} · ${escapeHtml(concert.city)}</p>` : ''}${task.details ? `<p>${escapeHtml(task.details)}</p>` : ''}${editable ? '<button type="button" data-edit-task>Изменить</button>' : ''}</article>`;
}
function renderToday() {
  const open = state.tasks.filter(task => !['DONE','CANCELLED'].includes(task.task_status));
  const mine = open.filter(task => task.assignee_ops_user_id === state.user.id || task.blocked_by_ops_user_id === state.user.id);
  const upcoming = state.concerts.filter(item => item.event_date && item.event_date >= new Date().toISOString().slice(0,10) && !['CANCELLED','COMPLETED'].includes(item.status)).slice(0,5);
  $('today-task-count').textContent = mine.length;
  $('today-event-count').textContent = upcoming.length;
  $('today-tasks').innerHTML = mine.length ? mine.slice(0,5).map(task => taskCard(task, false)).join('') : '<div class="empty">Открытых задач для тебя нет.</div>';
  $('today-events').innerHTML = upcoming.length ? upcoming.map(item => `<article class="card"><h3>${escapeHtml(item.event_name)}</h3><p>${escapeHtml(formatDate(item.event_date))} · ${escapeHtml(item.city)}${item.venue ? ` · ${escapeHtml(item.venue)}` : ''}</p></article>`).join('') : '<div class="empty">Ближайшие концерты не найдены.</div>';
}
function filteredTasks() {
  if (state.filter === 'mine') return state.tasks.filter(task => task.assignee_ops_user_id === state.user.id && !['DONE','CANCELLED'].includes(task.task_status));
  if (state.filter === 'decision') return state.tasks.filter(task => task.blocked_by_ops_user_id === state.user.id && task.task_status === 'WAITING_FOR_DECISION');
  if (state.filter === 'done') return state.tasks.filter(task => task.task_status === 'DONE');
  return state.tasks;
}
function renderTasks() { const tasks = filteredTasks(); $('task-list').innerHTML = tasks.length ? tasks.map(task => taskCard(task)).join('') : '<div class="empty">По этому фильтру задач нет.</div>'; }
function renderEvents() { $('event-list').innerHTML = state.concerts.length ? state.concerts.map(item => `<article class="card"><div class="row"><h3>${escapeHtml(item.event_name)}</h3><b>${escapeHtml(labels[item.status] || 'Не указан')}</b></div><p>${escapeHtml(formatDate(item.event_date))} · ${escapeHtml(item.city)}${item.venue ? ` · ${escapeHtml(item.venue)}` : ''}</p></article>`).join('') : '<div class="empty">Концерты ещё не внесены.</div>'; }
function renderDocuments() { $('document-list').innerHTML = state.documents.length ? state.documents.map(item => `<article class="card"><div class="row"><h3>${escapeHtml(item.title)}</h3><b>${escapeHtml(labels[item.document_type] || 'Документ')}</b></div><p>${escapeHtml(formatDate(item.source_date))}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</p></article>`).join('') : '<div class="empty">Документы не найдены.</div>'; }
function renderTeam() { $('team-list').innerHTML = state.users.map(item => `<article class="card"><div class="row"><h3>${escapeHtml(item.name)}</h3><b>${item.role === 'OWNER' ? 'Владелец' : item.role === 'OPERATIONS_ADMIN' ? 'Администратор' : 'Команда'}</b></div></article>`).join(''); }
function render() { $('avatar').textContent = state.user.name.slice(0,1).toUpperCase(); $('greeting').textContent = `Добрый день, ${state.user.name}`; renderToday(); renderTasks(); renderEvents(); renderDocuments(); renderTeam(); }

function taskOptions(select, includeEmpty = false) { select.innerHTML = `${includeEmpty ? '<option value="">Не назначено</option>' : ''}${state.users.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`; }
function openTask(task = null) {
  const form = $('task-form'); form.reset(); form.elements.id.value = task?.id || ''; form.elements.title.value = task?.title || ''; form.elements.details.value = task?.details || ''; form.elements.concert_id.innerHTML = `<option value="">Не привязано</option>${state.concerts.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.event_name)} · ${escapeHtml(item.city)}</option>`).join('')}`; form.elements.concert_id.value = task?.concert_id || ''; taskOptions(form.elements.assignee_ops_user_id); taskOptions(form.elements.blocked_by_ops_user_id, true); form.elements.assignee_ops_user_id.value = task?.assignee_ops_user_id || state.user.id; form.elements.blocked_by_ops_user_id.value = task?.blocked_by_ops_user_id || ''; form.elements.due_date.value = task?.due_date || ''; form.elements.priority.value = task?.priority || 'NORMAL'; form.elements.task_status.value = task?.task_status || 'OPEN'; $('task-dialog-title').textContent = task ? 'Изменить задачу' : 'Новая задача'; $('delete-task').hidden = !task; $('decision-owner').hidden = form.elements.task_status.value !== 'WAITING_FOR_DECISION'; $('task-error').textContent = ''; $('task-dialog').showModal();
}
async function saveTask(event) { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); try { await api('/api/ops-data', { method:'POST', body:JSON.stringify({ entity:'task', row:raw }) }); $('task-dialog').close(); await loadData(); toast('Задача сохранена'); } catch(error) { $('task-error').textContent = `Не удалось сохранить: ${error.message}`; } }
async function deleteTask() { const id = $('task-form').elements.id.value; const task = state.tasks.find(item => item.id === id); if (!task || !confirm(`Удалить задачу «${task.title}»?`)) return; try { await api('/api/ops-data', { method:'DELETE', body:JSON.stringify({ entity:'task', id }) }); $('task-dialog').close(); await loadData(); toast('Задача удалена'); } catch(error) { $('task-error').textContent = `Не удалось удалить: ${error.message}`; } }
async function loadData() { const data = await api('/api/ops-data'); Object.assign(state, data); render(); }

async function initialize() {
  $('today-date').textContent = new Intl.DateTimeFormat('ru-RU', { weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Warsaw' }).format(new Date());
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) { $('startup').innerHTML = '<b>Legacy Imperial</b><span>Открой пульт через Telegram-бота Legacy Imperial.</span>'; return; }
  webApp.ready(); webApp.expand();
  try {
    const response = await fetch('/api/telegram-auth', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ initData:webApp.initData }) });
    const result = await response.json();
    if (response.status === 403) { $('startup').hidden = true; $('shell').hidden = false; showView('access'); $('access-message').textContent = `Запрос на доступ создан. Твой Telegram ID: ${result.telegramUserId}. Владелец должен подтвердить его.`; return; }
    if (!response.ok) throw new Error(result.error || 'Не удалось проверить доступ');
    state.user = result.user; state.token = result.sessionToken; await loadData(); $('startup').hidden = true; $('shell').hidden = false;
  } catch(error) { $('startup').innerHTML = `<b>Не удалось открыть пульт</b><span>${escapeHtml(error.message)}</span>`; }
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-task-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.taskFilter; document.querySelectorAll('[data-task-filter]').forEach(item => item.classList.toggle('active', item === button)); renderTasks(); }));
$('new-task').onclick = () => openTask();
$('task-list').onclick = event => { const card = event.target.closest('[data-task-id]'); if (card && event.target.closest('[data-edit-task]')) openTask(state.tasks.find(item => item.id === card.dataset.taskId)); };
$('task-form').onsubmit = saveTask;
$('task-form').elements.task_status.onchange = event => { $('decision-owner').hidden = event.target.value !== 'WAITING_FOR_DECISION'; };
$('delete-task').onclick = deleteTask;
document.querySelector('[data-close]').onclick = () => $('task-dialog').close();
initialize();

