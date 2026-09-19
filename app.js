const SUPABASE_URL = 'https://zrqdeksliembgzmivqcu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MeIQ3HFdObe1CyUebdwt8Q_qAA4s3S6';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const bookingConcerts = [
  { id: 'wroclaw', date: '29.09.2026', city: 'Вроцлав', title: 'Vivaldi vs. Piazzolla', venue: 'Radio Wrocław', capacity: 500, breakEven: 249 },
  { id: 'kielce', date: '04.10.2026', city: 'Кельце', title: 'Vintage Rock Legends', venue: 'Filharmonia Świętokrzyska', capacity: 506, breakEven: 286 }
];
const bookingOperators = [
  ['kupbilecik', 'KupBilecik', 'основні продажі'],
  ['ebilet', 'eBilet', 'партнерські продажі'],
  ['bilety24', 'Bilety24', 'партнерські продажі']
];
const statuses = ['DRAFT', 'PLANNED', 'ON_SALE', 'ACTIVE', 'ON_HOLD', 'POSTPONED', 'CANCELLED', 'COMPLETED'];
const state = { session: null, role: null, concerts: [], totals: new Map(), selectedConcertId: null, detailTab: 'OVERVIEW', detail: null, expenses: [], orders: [], operators: [], channels: [], campaigns: [], trackingLinks: [] };
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const fmt = value => new Intl.NumberFormat('pl-PL').format(Number(value) || 0);
const money = (value, currency = 'PLN') => new Intl.NumberFormat('pl-PL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = value => value ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'дату не задано';

function setStatus(message, isError = false) {
  byId('sync-status').textContent = message;
  byId('sync-status').classList.toggle('error', isError);
}

function accessStatus() {
  if (!state.session) return { message: 'Режим перегляду · увійдіть для редагування', isError: false };
  if (state.role) return { message: `Спільна база · ${state.session.user.email} · ${state.role}`, isError: false };
  return { message: `Є вхід: ${state.session.user.email} · роль не призначена`, isError: true };
}

function showAccessStatus() {
  const current = accessStatus();
  setStatus(current.message, current.isError);
}

function showView(view) {
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === view));
  document.querySelectorAll('.ops-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  window.history.replaceState(null, '', `#${view}`);
  showAccessStatus();
  if (view === 'concerts') loadOperations();
  if (view === 'sales') loadSalesModule();
  if (view === 'channels') loadChannelsModule();
  if (view === 'operators') loadOperatorsModule();
  if (view === 'reports') loadReportsModule();
  if (view === 'finance') loadFinance();
}

function toggleLogin(force) {
  const panel = byId('login-panel');
  panel.classList.toggle('open', force ?? !panel.classList.contains('open'));
}

async function sendMagicLink() {
  const email = byId('editor-email').value.trim();
  if (!email) { byId('login-note').textContent = 'Введіть робочий email.'; return; }
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  byId('login-note').textContent = error ? `Не вдалося надіслати посилання: ${error.message}` : 'Посилання надіслано. Відкрийте його в цьому браузері.';
}

function updateAccess(session) {
  state.session = session;
  state.role = null;
  const loggedIn = Boolean(session);
  byId('login-toggle').textContent = loggedIn ? 'ВИЙТИ' : 'УВІЙТИ';
  byId('login-toggle').onclick = loggedIn ? async () => db.auth.signOut() : () => toggleLogin();
  if (loggedIn) toggleLogin(false);
  showAccessStatus();
  if (loggedIn) loadCurrentRole();
}

async function loadCurrentRole() {
  if (!state.session) return;
  const { data, error } = await db.from('daria_user_roles').select('role').eq('user_id', state.session.user.id).maybeSingle();
  if (!state.session) return;
  state.role = error ? null : data?.role || null;
  showAccessStatus();
}

function requireEditor(message) {
  if (state.session && ['ADMIN', 'MANAGER'].includes(state.role)) return true;
  if (state.session) { setStatus('Вхід є, але роль MANAGER ще не підтверджена', true); return false; }
  toggleLogin(true);
  setStatus(message, true);
  return false;
}

function riskClass(risk) { return `risk-${String(risk || 'GRAY').toLowerCase()}`; }

function concertCard(concert, compact = false) {
  const total = state.totals.get(concert.id) || { tickets: 0, revenue: 0 };
  return `<article class="ops-concert ${state.selectedConcertId === concert.id ? 'selected' : ''}" data-concert-id="${esc(concert.id)}">
    <div><small>${esc(concert.status)} · ${esc(concert.city)} · ${esc(dateLabel(concert.event_date))}</small><h3>${esc(concert.event_name)}</h3><small>${esc(concert.venue || 'майданчик не задано')} · ${fmt(total.tickets)} квитків · ${money(total.revenue, concert.currency || 'PLN')}</small></div>
    <div class="concert-actions"><span class="risk ${riskClass(concert.risk_status)}">${esc(concert.risk_status || 'GRAY')}</span>${compact ? '' : `<button class="text-button" type="button" data-action="details" data-id="${esc(concert.id)}">ДЕТАЛІ</button><button class="text-button" type="button" data-action="edit" data-id="${esc(concert.id)}">РЕДАГУВАТИ</button>`}</div>
  </article>`;
}

function renderConcerts() {
  const period = byId('dashboard-period')?.value || 'ALL';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(now); if (period === 'MONTH') end.setMonth(end.getMonth() + 1); else if (period !== 'ALL') end.setDate(end.getDate() + Number(period));
  const dashboardConcerts = state.concerts.filter(concert => {
    if (!['ON_SALE', 'ACTIVE'].includes(concert.status)) return false;
    if (period === 'ALL' || !concert.event_date) return true;
    const date = new Date(`${concert.event_date}T12:00:00`); return date >= now && date <= end;
  });
  byId('dashboard-concerts').innerHTML = dashboardConcerts.map(concert => concertCard(concert, true)).join('') || '<div class="empty">У вибраному періоді активних концертів немає.</div>';
  const filter = byId('concert-filter').value;
  const visible = filter === 'ALL' ? state.concerts : state.concerts.filter(concert => concert.status === filter);
  byId('concerts-list').innerHTML = visible.map(concert => concertCard(concert)).join('') || '<div class="empty">За цим фільтром концертів немає.</div>';
}

function detailValue(label, value) { return `<div class="detail-row"><span>${label}</span><strong>${esc(value ?? '—')}</strong></div>`; }

const detailTabs = ['OVERVIEW', 'SALES', 'CHANNELS', 'FINANCE', 'TRACKING', 'ORDERS', 'NOTES'];

function renderConcertDetail() {
  const concert = state.concerts.find(item => item.id === state.selectedConcertId);
  if (!concert) return;
  const detail = state.detail;
  if (!detail) { byId('concert-detail').innerHTML = '<p class="eyebrow">КАРТКА КОНЦЕРТУ</p><h2>Завантаження даних…</h2>'; return; }
  const metric = detail.metric;
  const sold = Number(metric.paid_tickets || 0), capacity = Number(concert.capacity || 0), remaining = capacity ? Math.max(0, capacity - sold) : null;
  const breakNeeded = concert.break_even_tickets == null ? null : Math.max(0, Number(concert.break_even_tickets) - sold);
  const tabs = detailTabs.map(tab => `<button type="button" class="detail-tab ${state.detailTab === tab ? 'active' : ''}" data-detail-tab="${tab}">${tab}</button>`).join('');
  let content = '';
  if (state.detailTab === 'OVERVIEW') content = `<div class="detail-grid">${detailValue('ПРОДАНО PAID', fmt(sold))}${detailValue('ЗАЛИШОК', remaining == null ? '—' : fmt(remaining))}${detailValue('ЗАПОВНЕННЯ', capacity ? `${Math.round(sold / capacity * 100)}%` : '—')}${detailValue('ДО BREAK-EVEN', breakNeeded == null ? '—' : fmt(breakNeeded))}${detailValue('GROSS REVENUE', money(metric.gross_revenue, concert.currency))}${detailValue('NET REVENUE', money(metric.net_revenue, concert.currency))}${detailValue('ВЖЕ СПЛАЧЕНО', money(metric.already_spent, concert.currency))}${detailValue('ОБОВʼЯЗКОВО ПОПЕРЕДУ', money(metric.mandatory_future, concert.currency))}${detailValue('ПОВОРОТНІ ЗАСТАВИ', money(metric.refundable_deposits, concert.currency))}${detailValue('ОПЕРАЦІЙНИЙ РЕЗУЛЬТАТ', money(metric.operational_result, concert.currency))}</div><div class="truth-note">${detail.server ? 'Метрики розраховані в Supabase. Валюти не конвертуються автоматично.' : 'Серверні метрики ще не завантажені; показано лише доступний локальний підсумок.'}</div>`;
  if (state.detailTab === 'SALES' || state.detailTab === 'ORDERS') { const orders = state.detailTab === 'SALES' ? detail.orders.filter(order => order.status === 'PAID') : detail.orders; content = orders.map(order => `<div class="detail-line"><b>${esc(order.external_order_id)}</b><span>${fmt(order.ticket_count)} кв. · ${money(order.gross_revenue, order.currency)} · ${esc(order.attribution_type)}</span></div>`).join('') || '<div class="empty">Записів ще немає.</div>'; }
  if (state.detailTab === 'CHANNELS') content = detail.campaigns.map(campaign => `<div class="detail-line"><b>${esc(campaign.campaign_name)}</b><span>${esc(campaign.source_code)} · spend ${money(campaign.actual_spend, concert.currency)} · platform ${fmt(campaign.platform_reported_orders)}</span></div>`).join('') || '<div class="empty">Кампаній ще немає.</div>';
  if (state.detailTab === 'FINANCE') content = detail.expenses.map(expense => `<div class="detail-line"><b>${esc(expense.description || expense.category)}</b><span>${esc(expense.expense_type)} · ${esc(expense.payment_status)} · ${money(expense.amount, expense.currency)}</span></div>`).join('') || '<div class="empty">Витрат ще немає.</div>';
  if (state.detailTab === 'TRACKING') content = detail.links.map(link => `<div class="detail-line"><b>${esc(link.source_code)}</b><span>${esc(link.destination_url || link.statistical_url || 'URL не задано')}</span></div>`).join('') || '<div class="empty">Tracking links ще немає.</div>';
  if (state.detailTab === 'NOTES') content = `<div class="detail-notes">${esc(concert.notes || 'Нотаток немає.')}</div>`;
  byId('concert-detail').innerHTML = `<p class="eyebrow">КАРТКА КОНЦЕРТУ · ${detail.server ? 'СПІЛЬНА БАЗА' : 'ОБМЕЖЕНИЙ ПЕРЕГЛЯД'}</p><h2>${esc(concert.event_name)}</h2><small>${esc(concert.city)} · ${esc(dateLabel(concert.event_date))} · ${esc(concert.venue || 'майданчик не задано')}</small><div class="detail-tabs">${tabs}</div><div class="detail-content">${content}</div><label class="quick-status">ШВИДКА ЗМІНА СТАТУСУ<select id="quick-status">${statuses.map(status => `<option value="${status}" ${status === concert.status ? 'selected' : ''}>${status.replace('_', ' ')}</option>`).join('')}</select></label><div class="detail-actions"><button class="button" type="button" id="edit-selected">РЕДАГУВАТИ</button></div>`;
  document.querySelectorAll('[data-detail-tab]').forEach(button => button.addEventListener('click', () => { state.detailTab = button.dataset.detailTab; renderConcertDetail(); }));
  byId('quick-status').addEventListener('change', event => updateConcertStatus(concert.id, event.target.value));
  byId('edit-selected').addEventListener('click', () => openConcertForm(concert));
}

async function selectConcert(id) {
  const concert = state.concerts.find(item => item.id === id);
  if (!concert) return;
  state.selectedConcertId = id;
  state.detail = null; renderConcertDetail(); renderConcerts();
  const fallback = state.totals.get(id) || { tickets: 0, revenue: 0 };
  if (!state.session) { state.detail = { server: false, metric: { paid_tickets: fallback.tickets, gross_revenue: fallback.revenue }, orders: [], expenses: [], campaigns: [], links: [] }; renderConcertDetail(); return; }
  const [metricsResult, ordersResult, expensesResult, campaignsResult, linksResult] = await Promise.all([
    db.rpc('daria_concert_metrics'), db.from('daria_orders').select('*').eq('concert_id', id).order('order_date', { ascending: false }), db.from('daria_expenses').select('*').eq('concert_id', id).order('due_date'), db.from('daria_campaigns').select('*').eq('concert_id', id), db.from('daria_tracking_links').select('*').eq('concert_id', id)
  ]);
  const metric = metricsResult.data?.find(item => item.concert_id === id) || { paid_tickets: fallback.tickets, gross_revenue: fallback.revenue };
  state.detail = { server: !metricsResult.error, metric, orders: ordersResult.data || [], expenses: expensesResult.data || [], campaigns: campaignsResult.data || [], links: linksResult.data || [] };
  renderConcertDetail();
  renderConcerts();
}

function numberOrNull(value) { return value === '' ? null : Number(value); }

function concertPayload(form) {
  const raw = Object.fromEntries(new FormData(form));
  return { id: raw.id, payload: {
    event_name: raw.event_name.trim(), project_name: raw.project_name.trim() || null, city: raw.city.trim(), venue: raw.venue.trim() || null,
    event_date: raw.event_date || null, capacity: numberOrNull(raw.capacity), status: raw.status, ticket_sales_start_date: raw.ticket_sales_start_date || null,
    average_ticket_price: numberOrNull(raw.average_ticket_price), break_even_mode: raw.break_even_mode, break_even_tickets: numberOrNull(raw.break_even_tickets),
    planned_marketing_budget: Number(raw.planned_marketing_budget || 0), currency: raw.currency.trim().toUpperCase() || 'PLN', notes: raw.notes.trim(), risk_status: raw.risk_status,
    updated_at: new Date().toISOString()
  } };
}

function openConcertForm(concert = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати концерти.')) return;
  const form = byId('concert-form');
  form.reset();
  form.hidden = false;
  byId('form-mode').textContent = concert ? 'РЕДАГУВАННЯ' : 'НОВИЙ КОНЦЕРТ';
  byId('form-title').textContent = concert ? concert.event_name : 'Додати подію';
  byId('concert-form-note').textContent = '';
  form.elements.id.value = concert?.id || '';
  const fields = ['event_name', 'project_name', 'city', 'venue', 'event_date', 'capacity', 'status', 'ticket_sales_start_date', 'average_ticket_price', 'break_even_mode', 'break_even_tickets', 'planned_marketing_budget', 'currency', 'notes', 'risk_status'];
  if (concert) fields.forEach(field => { form.elements[field].value = concert[field] ?? ''; });
  else { form.elements.status.value = 'DRAFT'; form.elements.risk_status.value = 'GRAY'; form.elements.break_even_mode.value = 'MANUAL'; form.elements.planned_marketing_budget.value = '0'; form.elements.currency.value = 'PLN'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveConcert(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти концерт.')) return;
  const form = event.currentTarget;
  const { id, payload } = concertPayload(form);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  byId('concert-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_concerts').update(payload).eq('id', id) : await db.from('daria_concerts').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('concert-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true;
  setStatus(id ? 'Концерт оновлено у спільній базі' : 'Концерт додано до спільної бази');
  await loadOperations();
  if (id) selectConcert(id);
}

async function updateConcertStatus(id, nextStatus) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб змінити статус.')) { selectConcert(id); return; }
  const { error } = await db.from('daria_concerts').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { setStatus(`Не вдалося змінити статус: ${error.message}`, true); selectConcert(id); return; }
  setStatus(`Статус змінено на ${nextStatus}`);
  await loadOperations();
  selectConcert(id);
}

async function loadOperations() {
  if (!state.session) {
    ['m-active', 'm-tickets', 'm-revenue', 'm-spend', 'm-mandatory', 'm-projected', 'm-risk'].forEach(id => { byId(id).textContent = '—'; });
    byId('dashboard-concerts').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб побачити операційні дані.</div>';
    byId('concerts-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб відкрити реєстр концертів.</div>';
    byId('dashboard-note').classList.remove('error');
    byId('dashboard-note').textContent = 'Дані приховані політиками доступу. Порожня відповідь без авторизації не трактується як нуль.';
    state.concerts = [];
    state.totals = new Map();
    return;
  }
  const [concertsResult, ordersResult, campaignsResult, expensesResult] = await Promise.all([
    db.from('daria_concerts').select('*').order('event_date', { ascending: true, nullsFirst: false }),
    db.from('daria_orders').select('concert_id,ticket_count,gross_revenue,status'),
    db.from('daria_campaigns').select('actual_spend'),
    db.from('daria_expenses').select('amount,currency,expense_type,payment_status')
  ]);
  const errors = [];
  if (concertsResult.error) errors.push(`concerts: ${concertsResult.error.message}`);
  if (ordersResult.error) errors.push(`orders: ${ordersResult.error.message}`);
  if (campaignsResult.error) errors.push(`campaigns: ${campaignsResult.error.message}`);
  if (expensesResult.error) errors.push(`expenses: ${expensesResult.error.message}`);
  if (concertsResult.error) {
    byId('dashboard-concerts').innerHTML = '<div class="empty">Немає доступу до реєстру концертів. Увійдіть у робочий акаунт.</div>';
    byId('concerts-list').innerHTML = '<div class="empty">Не вдалося завантажити концерти.</div>';
  } else state.concerts = concertsResult.data || [];
  state.totals = new Map();
  const paidOrders = ordersResult.error ? [] : (ordersResult.data || []).filter(order => order.status === 'PAID');
  paidOrders.forEach(order => {
    const total = state.totals.get(order.concert_id) || { tickets: 0, revenue: 0 };
    total.tickets += Number(order.ticket_count) || 0;
    total.revenue += Number(order.gross_revenue) || 0;
    state.totals.set(order.concert_id, total);
  });
  byId('m-active').textContent = concertsResult.error ? '!' : state.concerts.filter(concert => ['ACTIVE', 'ON_SALE'].includes(concert.status)).length;
  byId('m-tickets').textContent = ordersResult.error ? '!' : fmt(paidOrders.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('m-revenue').textContent = ordersResult.error ? '!' : money(paidOrders.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0));
  byId('m-spend').textContent = campaignsResult.error ? '!' : money((campaignsResult.data || []).reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0));
  const mandatory = expensesResult.error ? [] : (expensesResult.data || []).filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && !['PAID', 'REFUNDED'].includes(expense.payment_status));
  const paid = expensesResult.error ? [] : (expensesResult.data || []).filter(expense => expense.expense_type === 'ALREADY_PAID' && expense.payment_status === 'PAID');
  const gross = paidOrders.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0);
  const mandatoryValue = mandatory.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const paidValue = paid.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  byId('m-mandatory').textContent = expensesResult.error ? '!' : currencyTotals(mandatory);
  byId('m-projected').textContent = expensesResult.error || ordersResult.error ? '!' : money(gross - paidValue - mandatoryValue);
  byId('m-risk').textContent = concertsResult.error ? '!' : state.concerts.filter(concert => ['YELLOW', 'RED'].includes(concert.risk_status)).length;
  const note = byId('dashboard-note');
  note.classList.toggle('error', errors.length > 0);
  note.textContent = errors.length ? `Частину даних не завантажено — нулі не підставлено. ${errors.join(' · ')}` : 'Факт: PAID orders, внесені витрати та campaigns.actual_spend. Операційний результат не включає поворотні застави й не є фінансовою рекомендацією.';
  if (!concertsResult.error) renderConcerts();
}

function populateOrderOptions() {
  const concertOptions = state.concerts.map(concert => `<option value="${esc(concert.id)}">${esc(concert.event_name)} · ${esc(concert.city)}</option>`).join('');
  const operatorOptions = state.operators.map(operator => `<option value="${esc(operator.id)}">${esc(operator.name)}</option>`).join('');
  byId('order-concert').innerHTML = concertOptions;
  byId('order-operator').innerHTML = `<option value="">НЕ ВКАЗАНО</option>${operatorOptions}`;
  const campaignOptions = state.campaigns.map(campaign => `<option value="${esc(campaign.id)}">${esc(campaign.source_code)} · ${esc(campaign.campaign_name)}</option>`).join('');
  byId('order-campaign').innerHTML = `<option value="">НЕ ВСТАНОВЛЕНО — UNKNOWN</option>${campaignOptions}`;
  const selected = byId('order-concert-filter').value;
  byId('order-concert-filter').innerHTML = `<option value="ALL">УСІ</option>${concertOptions}`;
  if ([...byId('order-concert-filter').options].some(option => option.value === selected)) byId('order-concert-filter').value = selected;
}

function renderSales() {
  const concertFilter = byId('order-concert-filter').value;
  const statusFilter = byId('order-status-filter').value;
  const visible = state.orders.filter(order => (concertFilter === 'ALL' || order.concert_id === concertFilter) && (statusFilter === 'ALL' || order.status === statusFilter));
  byId('order-list').innerHTML = visible.map(order => {
    const concert = state.concerts.find(item => item.id === order.concert_id);
    const operator = state.operators.find(item => item.id === order.operator_id);
    return `<article class="expense-row"><div><small>${esc(concert ? `${concert.event_name} · ${concert.city}` : 'Концерт не знайдено')}</small><h3>${esc(order.external_order_id)}</h3><small>${esc(operator?.name || 'оператор не вказаний')} · ${esc(order.attribution_type.replaceAll('_', ' '))}${order.source_code ? ` · ${esc(order.source_code)}` : ''}</small></div><strong class="expense-amount">${fmt(order.ticket_count)} кв. · ${money(order.gross_revenue, order.currency)}</strong><div class="expense-meta"><span class="expense-status ${order.status === 'PAID' ? 'paid' : ''}">${esc(order.status)}</span><span>${order.order_date ? esc(new Date(order.order_date).toLocaleString('uk-UA')) : 'час не задано'}</span></div><button class="text-button" type="button" data-edit-order="${esc(order.id)}">РЕДАГУВАТИ</button></article>`;
  }).join('') || '<div class="empty">За цим фільтром замовлень немає.</div>';
  const paid = state.orders.filter(order => order.status === 'PAID');
  byId('s-paid-tickets').textContent = fmt(paid.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('s-paid-gross').textContent = currencyTotals(paid, 'gross_revenue');
  byId('s-refunded').textContent = fmt(state.orders.filter(order => order.status === 'REFUNDED').reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('s-unknown').textContent = state.orders.filter(order => order.attribution_type === 'UNKNOWN').length;
}

async function loadSalesModule() {
  if (!state.session) {
    ['s-paid-tickets', 's-paid-gross', 's-refunded', 's-unknown'].forEach(id => { byId(id).textContent = '—'; });
    byId('order-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб відкрити замовлення.</div>';
    byId('sales-note').textContent = 'Дані приховані політиками доступу; порожня відповідь не трактується як нуль продажів.';
    state.orders = [];
    return;
  }
  if (!state.concerts.length) await loadOperations();
  const [ordersResult, operatorsResult, campaignsResult] = await Promise.all([
    db.from('daria_orders').select('*').order('order_date', { ascending: false, nullsFirst: false }),
    db.from('daria_ticketing_operators').select('id,name').order('name'),
    db.from('daria_campaigns').select('id,campaign_name,source_code,concert_id').order('start_date', { ascending: false, nullsFirst: false })
  ]);
  const errors = [ordersResult.error && `orders: ${ordersResult.error.message}`, operatorsResult.error && `operators: ${operatorsResult.error.message}`, campaignsResult.error && `campaigns: ${campaignsResult.error.message}`].filter(Boolean);
  if (errors.length) {
    byId('order-list').innerHTML = `<div class="empty">Не вдалося завантажити sales: ${esc(errors.join(' · '))}</div>`;
    byId('sales-note').classList.add('error');
    return;
  }
  state.orders = ordersResult.data || [];
  state.operators = operatorsResult.data || [];
  state.campaigns = campaignsResult.data || [];
  populateOrderOptions();
  renderSales();
  byId('sales-note').classList.remove('error');
  byId('sales-note').textContent = 'PAID входять у продажі. REFUNDED і CANCELLED не додаються. Attribution type показує рівень доказовості джерела.';
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function openOrderForm(order = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати замовлення.')) return;
  if (!state.concerts.length) { setStatus('Спочатку додайте концерт до реєстру.', true); return; }
  const form = byId('order-form');
  populateOrderOptions();
  form.reset();
  form.hidden = false;
  byId('order-form-mode').textContent = order ? 'РЕДАГУВАННЯ ЗАМОВЛЕННЯ' : 'НОВЕ ЗАМОВЛЕННЯ';
  byId('order-form-title').textContent = order ? order.external_order_id : 'Додати результат';
  byId('order-form-note').textContent = '';
  form.elements.id.value = order?.id || '';
  const fields = ['concert_id', 'operator_id', 'campaign_id', 'external_order_id', 'ticket_count', 'gross_revenue', 'net_revenue', 'currency', 'source_code', 'attribution_type', 'promo_code', 'status', 'notes'];
  if (order) {
    fields.forEach(field => { form.elements[field].value = order[field] ?? ''; });
    form.elements.order_date.value = localDateTime(order.order_date);
  } else {
    form.elements.currency.value = 'PLN'; form.elements.attribution_type.value = 'UNKNOWN'; form.elements.status.value = 'PAID'; form.elements.order_date.value = localDateTime(new Date().toISOString());
  }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveOrder(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти замовлення.')) return;
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const id = raw.id;
  const payload = { concert_id: raw.concert_id, operator_id: raw.operator_id || null, campaign_id: raw.campaign_id || null, external_order_id: raw.external_order_id.trim(), order_date: raw.order_date ? new Date(raw.order_date).toISOString() : null, ticket_count: Number(raw.ticket_count), gross_revenue: Number(raw.gross_revenue), net_revenue: numberOrNull(raw.net_revenue), currency: raw.currency.trim().toUpperCase() || 'PLN', source_code: raw.source_code.trim() || null, attribution_type: raw.attribution_type, promo_code: raw.promo_code.trim() || null, status: raw.status, notes: raw.notes.trim() };
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  byId('order-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_orders').update(payload).eq('id', id) : await db.from('daria_orders').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('order-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true;
  setStatus(id ? 'Замовлення оновлено у спільній базі' : 'Замовлення додано до спільної бази');
  await Promise.all([loadSalesModule(), loadOperations()]);
}

function setSelectOptions(id, options, includeEmpty = false, emptyLabel = 'НЕ ВКАЗАНО') {
  byId(id).innerHTML = `${includeEmpty ? `<option value="">${emptyLabel}</option>` : ''}${options}`;
}

function populateChannelOptions() {
  const concerts = state.concerts.map(concert => `<option value="${esc(concert.id)}">${esc(concert.event_name)} · ${esc(concert.city)}</option>`).join('');
  const channels = state.channels.map(channel => `<option value="${esc(channel.id)}">${esc(channel.name)} · ${esc(channel.code)}</option>`).join('');
  const campaigns = state.campaigns.map(campaign => `<option value="${esc(campaign.id)}">${esc(campaign.campaign_name)} · ${esc(campaign.source_code)}</option>`).join('');
  const operators = state.operators.map(operator => `<option value="${esc(operator.id)}">${esc(operator.name)}</option>`).join('');
  setSelectOptions('campaign-concert', concerts);
  setSelectOptions('campaign-channel', channels);
  setSelectOptions('tracking-concert', concerts);
  setSelectOptions('tracking-campaign', campaigns, true);
  setSelectOptions('tracking-channel', channels, true);
  setSelectOptions('tracking-operator', operators, true);
}

function renderChannels() {
  byId('channel-list').innerHTML = state.channels.map(channel => `<article class="ops-concert"><div><small>${esc(channel.code)}</small><h3>${esc(channel.name)}</h3><small>${channel.is_active ? 'ACTIVE' : 'INACTIVE'}</small></div><button class="text-button" type="button" data-edit-channel="${esc(channel.id)}">РЕДАГУВАТИ</button></article>`).join('') || '<div class="empty">Каналів ще немає.</div>';
  byId('campaign-list').innerHTML = state.campaigns.map(campaign => {
    const channel = state.channels.find(item => item.id === campaign.channel_id);
    const concert = state.concerts.find(item => item.id === campaign.concert_id);
    const planned = Number(campaign.planned_budget || 0), actual = Number(campaign.actual_spend || 0), platformOrders = Number(campaign.platform_reported_orders || 0);
    const delta = actual - planned, currency = concert?.currency || 'PLN';
    const deltaLabel = delta === 0 ? 'за планом' : delta > 0 ? `+${money(delta, currency)} понад план` : `${money(Math.abs(delta), currency)} не використано`;
    return `<article class="ops-concert"><div><small>${esc(campaign.status)} · ${esc(campaign.attribution_quality)} · ${esc(channel?.name || 'канал не знайдено')}</small><h3>${esc(campaign.campaign_name)}</h3><small>${esc(concert?.event_name || 'концерт не знайдено')} · план ${money(planned, currency)} · факт ${money(actual, currency)} · ${deltaLabel} · platform orders ${fmt(platformOrders)}${platformOrders ? ` · platform CPA ${money(actual / platformOrders, currency)}` : ''}</small></div><button class="text-button" type="button" data-edit-campaign="${esc(campaign.id)}">РЕДАГУВАТИ</button></article>`;
  }).join('') || '<div class="empty">Кампаній ще немає.</div>';
  byId('tracking-link-list').innerHTML = state.trackingLinks.map(link => {
    const campaign = state.campaigns.find(item => item.id === link.campaign_id);
    const channel = state.channels.find(item => item.id === link.channel_id);
    return `<article class="expense-row"><div><small>${esc(link.status)} · ${esc(channel?.name || 'канал не вказано')} · ${esc(campaign?.campaign_name || 'кампанія не вказана')}</small><h3>${esc(link.source_code)}</h3><small>${esc(link.destination_url || link.statistical_url || 'URL не задано')}</small></div><strong class="expense-amount">${esc(link.utm_source || '—')} / ${esc(link.utm_medium || '—')}</strong><div class="expense-meta"><span>${esc(link.promo_code || 'без promo code')}</span><span>${link.utm_campaign ? `utm: ${esc(link.utm_campaign)}` : 'utm campaign не задано'}</span></div><button class="text-button" type="button" data-edit-link="${esc(link.id)}">РЕДАГУВАТИ</button></article>`;
  }).join('') || '<div class="empty">Tracking links ще немає.</div>';
  byId('c-active').textContent = state.campaigns.filter(campaign => ['TESTING', 'WORKING'].includes(campaign.status)).length;
  byId('c-spend').textContent = money(state.campaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0));
  byId('c-platform-orders').textContent = fmt(state.campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_orders) || 0), 0));
  byId('c-active-links').textContent = state.trackingLinks.filter(link => link.status === 'ACTIVE').length;
}

async function loadChannelsModule() {
  if (!state.session) {
    ['c-active', 'c-spend', 'c-platform-orders', 'c-active-links'].forEach(id => { byId(id).textContent = '—'; });
    byId('channel-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб завантажити канали.</div>';
    byId('campaign-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб завантажити кампанії.</div>';
    byId('tracking-link-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб завантажити посилання.</div>';
    byId('channels-note').textContent = 'Дані приховані політиками доступу; порожня відповідь не трактується як відсутність кампаній.';
    state.channels = []; state.campaigns = []; state.trackingLinks = [];
    return;
  }
  if (!state.concerts.length) await loadOperations();
  const [channelsResult, campaignsResult, linksResult, operatorsResult] = await Promise.all([
    db.from('daria_sales_channels').select('*').order('name'),
    db.from('daria_campaigns').select('*').order('start_date', { ascending: false, nullsFirst: false }),
    db.from('daria_tracking_links').select('*').order('created_at', { ascending: false }),
    db.from('daria_ticketing_operators').select('id,name').order('name')
  ]);
  const errors = [channelsResult.error && `channels: ${channelsResult.error.message}`, campaignsResult.error && `campaigns: ${campaignsResult.error.message}`, linksResult.error && `links: ${linksResult.error.message}`, operatorsResult.error && `operators: ${operatorsResult.error.message}`].filter(Boolean);
  if (errors.length) {
    byId('channels-note').classList.add('error');
    byId('channels-note').textContent = `Частину даних не завантажено: ${errors.join(' · ')}`;
    return;
  }
  state.channels = channelsResult.data || [];
  state.campaigns = campaignsResult.data || [];
  state.trackingLinks = linksResult.data || [];
  state.operators = operatorsResult.data || state.operators;
  populateChannelOptions();
  renderChannels();
  byId('channels-note').classList.remove('error');
  byId('channels-note').textContent = 'Platform orders не додаються до confirmed sales автоматично. Зв’язок з order зберігається окремо через source code, campaign і tracking link.';
}

function openChannelForm(channel = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати канали.')) return;
  const form = byId('channel-form'); form.reset(); form.hidden = false;
  byId('channel-form-mode').textContent = channel ? 'РЕДАГУВАННЯ КАНАЛУ' : 'НОВИЙ КАНАЛ';
  byId('channel-form-title').textContent = channel ? channel.name : 'Додати канал';
  byId('channel-form-note').textContent = ''; form.elements.id.value = channel?.id || '';
  if (channel) { form.elements.name.value = channel.name; form.elements.code.value = channel.code; form.elements.is_active.checked = channel.is_active; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveChannel(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти канал.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const payload = { name: raw.name.trim(), code: raw.code.trim().toUpperCase(), is_active: form.elements.is_active.checked };
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('channel-form-note').textContent = 'Збереження…';
  const result = raw.id ? await db.from('daria_sales_channels').update(payload).eq('id', raw.id) : await db.from('daria_sales_channels').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('channel-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true; setStatus(raw.id ? 'Канал оновлено' : 'Канал додано'); await loadChannelsModule();
}

function openCampaignForm(campaign = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати кампанії.')) return;
  if (!state.concerts.length || !state.channels.length) { setStatus('Спочатку додайте концерт і канал.', true); return; }
  const form = byId('campaign-form'); populateChannelOptions(); form.reset(); form.hidden = false;
  byId('campaign-form-mode').textContent = campaign ? 'РЕДАГУВАННЯ КАМПАНІЇ' : 'НОВА КАМПАНІЯ'; byId('campaign-form-title').textContent = campaign ? campaign.campaign_name : 'Додати кампанію'; byId('campaign-form-note').textContent = ''; form.elements.id.value = campaign?.id || '';
  const fields = ['concert_id', 'channel_id', 'campaign_name', 'source_code', 'planned_budget', 'actual_spend', 'start_date', 'end_date', 'status', 'attribution_quality', 'entries', 'platform_reported_orders', 'platform_reported_value', 'notes'];
  if (campaign) fields.forEach(field => { form.elements[field].value = campaign[field] ?? ''; });
  else { form.elements.status.value = 'TESTING'; form.elements.attribution_quality.value = 'UNKNOWN'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCampaign(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти кампанію.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const id = raw.id, payload = { concert_id: raw.concert_id, channel_id: raw.channel_id, campaign_name: raw.campaign_name.trim(), source_code: raw.source_code.trim(), planned_budget: Number(raw.planned_budget || 0), actual_spend: Number(raw.actual_spend || 0), start_date: raw.start_date || null, end_date: raw.end_date || null, status: raw.status, attribution_quality: raw.attribution_quality, entries: numberOrNull(raw.entries), platform_reported_orders: numberOrNull(raw.platform_reported_orders), platform_reported_value: numberOrNull(raw.platform_reported_value), notes: raw.notes.trim(), updated_at: new Date().toISOString() };
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('campaign-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_campaigns').update(payload).eq('id', id) : await db.from('daria_campaigns').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('campaign-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true; setStatus(id ? 'Кампанію оновлено' : 'Кампанію додано'); await Promise.all([loadChannelsModule(), loadOperations()]);
}

function openTrackingForm(link = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати tracking links.')) return;
  if (!state.concerts.length) { setStatus('Спочатку додайте концерт.', true); return; }
  const form = byId('tracking-link-form'); populateChannelOptions(); form.reset(); form.hidden = false;
  byId('tracking-form-mode').textContent = link ? 'РЕДАГУВАННЯ ПОСИЛАННЯ' : 'НОВЕ ПОСИЛАННЯ'; byId('tracking-form-title').textContent = link ? link.source_code : 'Додати tracking link'; byId('tracking-form-note').textContent = ''; form.elements.id.value = link?.id || '';
  const fields = ['concert_id', 'campaign_id', 'operator_id', 'channel_id', 'source_code', 'statistical_url', 'destination_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'promo_code', 'status', 'notes'];
  if (link) fields.forEach(field => { form.elements[field].value = link[field] ?? ''; });
  else form.elements.status.value = 'ACTIVE';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveTrackingLink(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти tracking link.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)), id = raw.id;
  const nullable = ['campaign_id', 'operator_id', 'channel_id', 'statistical_url', 'destination_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'promo_code'];
  const payload = { concert_id: raw.concert_id, source_code: raw.source_code.trim(), status: raw.status, notes: raw.notes.trim() };
  nullable.forEach(field => { payload[field] = raw[field]?.trim() || null; });
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('tracking-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_tracking_links').update(payload).eq('id', id) : await db.from('daria_tracking_links').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('tracking-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true; setStatus(id ? 'Tracking link оновлено' : 'Tracking link додано'); await loadChannelsModule();
}

function commission(value) { return value == null ? '—' : `${Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 4 })}%`; }

function renderOperators() {
  byId('operator-list').innerHTML = state.operators.map(operator => `<article class="operator-card"><p class="eyebrow">${esc(operator.legacy_recommendation)}</p><h2>${esc(operator.name)}</h2><p><b>Marketplace / own:</b> ${commission(operator.marketplace_commission)} / ${commission(operator.own_sales_commission)}</p><p><b>Tracking:</b> Pixel ${operator.supports_meta_pixel ? '✓' : '—'} · CAPI ${operator.supports_capi ? '✓' : '—'} · GTM ${operator.supports_gtm ? '✓' : '—'}</p><p><b>Дані:</b> ${esc(operator.customer_data_access || 'не вказано')}</p><p><b>Виплата:</b> ${esc(operator.payout_timing || 'не вказано')}</p><button class="text-button" type="button" data-edit-operator="${esc(operator.id)}">РЕДАГУВАТИ</button></article>`).join('') || '<div class="empty">Операторів ще немає.</div>';
}

async function loadOperatorsModule() {
  if (!state.session) {
    byId('operator-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб завантажити операторів.</div>';
    byId('operators-note').textContent = 'Дані приховані політиками доступу; відсутність відповіді не означає відсутність умов договору.';
    return;
  }
  const { data, error } = await db.from('daria_ticketing_operators').select('*').order('name');
  if (error) {
    byId('operator-list').innerHTML = `<div class="empty">Не вдалося завантажити операторів: ${esc(error.message)}</div>`;
    byId('operators-note').classList.add('error');
    return;
  }
  state.operators = data || [];
  renderOperators();
  byId('operators-note').classList.remove('error');
  byId('operators-note').textContent = 'Відображені лише внесені умови. Порожнє поле означає «не зафіксовано», а не «немає».';
}

function openOperatorForm(operator = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати операторів.')) return;
  const form = byId('operator-form'); form.reset(); form.hidden = false;
  byId('operator-form-mode').textContent = operator ? 'РЕДАГУВАННЯ ОПЕРАТОРА' : 'НОВИЙ ОПЕРАТОР'; byId('operator-form-title').textContent = operator ? operator.name : 'Додати оператора'; byId('operator-form-note').textContent = ''; form.elements.id.value = operator?.id || '';
  const fields = ['name', 'website', 'marketplace_commission', 'own_sales_commission', 'payment_provider_fee', 'setup_fee', 'monthly_fee', 'capi_fee', 'customer_data_access', 'customer_email_access', 'customer_phone_access', 'payout_timing', 'exclusive_required', 'exclusive_terms', 'negotiation_status', 'legacy_recommendation', 'contract_notes', 'notes'];
  const flags = ['supports_meta_pixel', 'supports_capi', 'supports_gtm', 'supports_statistical_links', 'supports_promo_codes', 'has_marketplace', 'sms_marketing_available', 'email_marketing_available'];
  if (operator) { fields.forEach(field => { form.elements[field].value = operator[field] ?? ''; }); flags.forEach(flag => { form.elements[flag].checked = Boolean(operator[flag]); }); }
  else { form.elements.negotiation_status.value = 'TO_BE_CLARIFIED'; form.elements.legacy_recommendation.value = 'NEGOTIATING'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveOperator(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти оператора.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)), id = raw.id;
  const numberFields = ['marketplace_commission', 'own_sales_commission', 'payment_provider_fee', 'setup_fee', 'monthly_fee', 'capi_fee'];
  const textFields = ['website', 'customer_data_access', 'customer_email_access', 'customer_phone_access', 'payout_timing', 'exclusive_required', 'exclusive_terms', 'negotiation_status', 'legacy_recommendation', 'contract_notes', 'notes'];
  const flags = ['supports_meta_pixel', 'supports_capi', 'supports_gtm', 'supports_statistical_links', 'supports_promo_codes', 'has_marketplace', 'sms_marketing_available', 'email_marketing_available'];
  const payload = { name: raw.name.trim(), updated_at: new Date().toISOString() };
  numberFields.forEach(field => { payload[field] = numberOrNull(raw[field]); });
  textFields.forEach(field => { payload[field] = raw[field]?.trim() || (['contract_notes', 'notes'].includes(field) ? '' : null); });
  flags.forEach(flag => { payload[flag] = form.elements[flag].checked; });
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('operator-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_ticketing_operators').update(payload).eq('id', id) : await db.from('daria_ticketing_operators').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('operator-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true; setStatus(id ? 'Оператора оновлено' : 'Оператора додано'); await Promise.all([loadOperatorsModule(), loadChannelsModule(), loadSalesModule()]);
}

function ratio(numerator, denominator, suffix = '') {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return '—';
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(numerator / denominator)}${suffix}`;
}

function reportCard(concert, orders, expenses, campaigns) {
  const paid = orders.filter(order => order.status === 'PAID');
  const paidTickets = paid.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0);
  const campaignOrders = paid.filter(order => order.campaign_id);
  const paidExpenses = expenses.filter(expense => expense.payment_status === 'PAID');
  const mandatory = expenses.filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && expense.payment_status !== 'PAID');
  const spend = campaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0);
  const platformOrders = campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_orders) || 0), 0);
  const platformValue = campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_value) || 0), 0);
  const confirmedGross = campaignOrders.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0);
  return `<article class="report-card"><p class="eyebrow">${esc(concert.status)} · ${esc(concert.risk_status)}</p><h2>${esc(concert.event_name)}</h2><small>${esc(concert.city)} · ${esc(dateLabel(concert.event_date))} · ${esc(concert.venue || 'майданчик не задано')}</small><div class="report-grid"><div class="report-item"><span>PAID TICKETS</span><strong>${fmt(paidTickets)}</strong></div><div class="report-item"><span>PAID GROSS</span><strong>${currencyTotals(paid, 'gross_revenue')}</strong></div><div class="report-item"><span>ACTUAL SPEND</span><strong>${money(spend)}</strong></div><div class="report-item"><span>PAID EXPENSES</span><strong>${currencyTotals(paidExpenses)}</strong></div><div class="report-item"><span>MANDATORY FUTURE</span><strong>${currencyTotals(mandatory)}</strong></div><div class="report-item"><span>UNATTRIBUTED PAID</span><strong>${fmt(paid.filter(order => !order.campaign_id).reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0))}</strong></div><div class="report-item"><span>PLATFORM ORDERS</span><strong>${fmt(platformOrders)}</strong></div><div class="report-item"><span>CAMPAIGNS</span><strong>${campaigns.length}</strong></div></div><div class="report-meta"><div><b>Platform CPA</b>${ratio(spend, platformOrders, ' zł')}<br><small>actual spend / platform orders</small></div><div><b>Confirmed CPA</b>${ratio(spend, campaignOrders.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0), ' zł')}<br><small>actual spend / paid orders з campaign_id</small></div><div><b>Platform ROAS</b>${ratio(platformValue, spend, '×')}<br><small>platform value / actual spend</small></div></div></article>`;
}

async function loadReportsModule() {
  if (!state.session) {
    ['r-concerts', 'r-paid-tickets', 'r-spend', 'r-unattributed'].forEach(id => { byId(id).textContent = '—'; });
    byId('report-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб побачити звіти.</div>';
    byId('reports-note').textContent = 'Дані приховані політиками доступу; порожня відповідь не трактується як нуль.';
    return;
  }
  const [concertsResult, ordersResult, expensesResult, campaignsResult] = await Promise.all([
    db.from('daria_concerts').select('*').order('event_date', { ascending: true, nullsFirst: false }),
    db.from('daria_orders').select('concert_id,campaign_id,ticket_count,gross_revenue,currency,status'),
    db.from('daria_expenses').select('concert_id,amount,currency,expense_type,payment_status'),
    db.from('daria_campaigns').select('concert_id,actual_spend,platform_reported_orders,platform_reported_value')
  ]);
  const errors = [concertsResult.error && `concerts: ${concertsResult.error.message}`, ordersResult.error && `orders: ${ordersResult.error.message}`, expensesResult.error && `expenses: ${expensesResult.error.message}`, campaignsResult.error && `campaigns: ${campaignsResult.error.message}`].filter(Boolean);
  if (errors.length) { byId('report-list').innerHTML = `<div class="empty">Не вдалося зібрати звіт: ${esc(errors.join(' · '))}</div>`; byId('reports-note').classList.add('error'); return; }
  const concerts = concertsResult.data || [], orders = ordersResult.data || [], expenses = expensesResult.data || [], campaigns = campaignsResult.data || [];
  const paid = orders.filter(order => order.status === 'PAID');
  byId('r-concerts').textContent = concerts.length;
  byId('r-paid-tickets').textContent = fmt(paid.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('r-spend').textContent = money(campaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0));
  byId('r-unattributed').textContent = fmt(paid.filter(order => !order.campaign_id).reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('report-list').innerHTML = concerts.map(concert => reportCard(concert, orders.filter(order => order.concert_id === concert.id), expenses.filter(expense => expense.concert_id === concert.id), campaigns.filter(campaign => campaign.concert_id === concert.id))).join('') || '<div class="empty">Концертів ще немає.</div>';
  byId('reports-note').classList.remove('error');
  byId('reports-note').textContent = 'CPA і ROAS показано лише як відношення внесених даних. Platform і confirmed навмисно не об’єднуються.';
}

function amountMap(items, field = 'amount') {
  const totals = new Map();
  items.forEach(item => totals.set(item.currency || 'PLN', (totals.get(item.currency || 'PLN') || 0) + (Number(item[field]) || 0)));
  return totals;
}

function currencyTotals(items, field = 'amount') {
  const totals = amountMap(items, field);
  return totals.size ? [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(' · ') : '0 zł';
}

function populateConcertOptions() {
  const options = state.concerts.map(concert => `<option value="${esc(concert.id)}">${esc(concert.event_name)} · ${esc(concert.city)}</option>`).join('');
  byId('expense-concert').innerHTML = options;
  const selected = byId('expense-concert-filter').value;
  byId('expense-concert-filter').innerHTML = `<option value="ALL">УСІ</option>${options}`;
  if ([...byId('expense-concert-filter').options].some(option => option.value === selected)) byId('expense-concert-filter').value = selected;
}

function renderFinance() {
  const concertFilter = byId('expense-concert-filter').value;
  const paymentFilter = byId('expense-payment-filter').value;
  const visible = state.expenses.filter(expense => (concertFilter === 'ALL' || expense.concert_id === concertFilter) && (paymentFilter === 'ALL' || expense.payment_status === paymentFilter));
  byId('expense-list').innerHTML = visible.map(expense => {
    const concert = state.concerts.find(item => item.id === expense.concert_id);
    return `<article class="expense-row"><div><small>${esc(concert ? `${concert.event_name} · ${concert.city}` : 'Концерт не знайдено')}</small><h3>${esc(expense.description)}</h3><small>${esc(expense.category)} · ${esc(expense.expense_type.replaceAll('_', ' '))}${expense.supplier ? ` · ${esc(expense.supplier)}` : ''}</small></div><strong class="expense-amount">${money(expense.amount, expense.currency)}</strong><div class="expense-meta"><span class="expense-status ${expense.payment_status === 'PAID' ? 'paid' : ''}">${esc(expense.payment_status.replaceAll('_', ' '))}</span><span>${expense.due_date ? `до ${esc(dateLabel(expense.due_date))}` : 'строк не задано'}</span></div><button class="text-button" type="button" data-edit-expense="${esc(expense.id)}">РЕДАГУВАТИ</button></article>`;
  }).join('') || '<div class="empty">За цим фільтром записів немає.</div>';
  byId('f-paid').textContent = currencyTotals(state.expenses.filter(expense => expense.payment_status === 'PAID'));
  byId('f-mandatory').textContent = currencyTotals(state.expenses.filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && expense.payment_status !== 'PAID'));
  byId('f-optional').textContent = currencyTotals(state.expenses.filter(expense => expense.expense_type === 'OPTIONAL_FUTURE' && expense.payment_status !== 'PAID'));
  byId('f-deposits').textContent = currencyTotals(state.expenses.filter(expense => expense.expense_type === 'REFUNDABLE_DEPOSIT' && expense.payment_status !== 'REFUNDED'));
}

async function loadFinance() {
  if (!state.session) {
    ['f-paid', 'f-mandatory', 'f-optional', 'f-deposits'].forEach(id => { byId(id).textContent = '—'; });
    byId('expense-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб відкрити реєстр витрат.</div>';
    byId('finance-note').textContent = 'Дані приховані політиками доступу; порожня відповідь не трактується як відсутність витрат.';
    state.expenses = [];
    return;
  }
  if (!state.concerts.length) await loadOperations();
  const { data, error } = await db.from('daria_expenses').select('*').order('due_date', { ascending: true, nullsFirst: false });
  if (error) {
    byId('expense-list').innerHTML = `<div class="empty">Не вдалося завантажити витрати: ${esc(error.message)}</div>`;
    byId('finance-note').classList.add('error');
    return;
  }
  state.expenses = data || [];
  populateConcertOptions();
  renderFinance();
  byId('finance-note').classList.remove('error');
  byId('finance-note').textContent = 'Факт: PAID. Майбутні обов’язкові, опційні витрати та поворотні застави показані окремо. Валюти не змішуються.';
}

function openExpenseForm(expense = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати витрати.')) return;
  if (!state.concerts.length) { setStatus('Спочатку додайте концерт до реєстру.', true); return; }
  const form = byId('expense-form');
  populateConcertOptions();
  form.reset();
  form.hidden = false;
  byId('expense-form-mode').textContent = expense ? 'РЕДАГУВАННЯ ВИТРАТИ' : 'НОВА ВИТРАТА';
  byId('expense-form-title').textContent = expense ? expense.description : 'Додати запис';
  byId('expense-form-note').textContent = '';
  form.elements.id.value = expense?.id || '';
  const fields = ['concert_id', 'category', 'description', 'amount', 'currency', 'expense_type', 'payment_status', 'due_date', 'supplier', 'notes'];
  if (expense) fields.forEach(field => { form.elements[field].value = expense[field] ?? ''; });
  else { form.elements.currency.value = 'PLN'; form.elements.expense_type.value = 'MANDATORY_FUTURE'; form.elements.payment_status.value = 'UNPAID'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveExpense(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти витрату.')) return;
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const id = raw.id;
  const payload = { concert_id: raw.concert_id, category: raw.category.trim().toUpperCase(), description: raw.description.trim(), amount: Number(raw.amount), currency: raw.currency.trim().toUpperCase() || 'PLN', expense_type: raw.expense_type, due_date: raw.due_date || null, payment_status: raw.payment_status, supplier: raw.supplier.trim() || null, notes: raw.notes.trim(), updated_at: new Date().toISOString() };
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  byId('expense-form-note').textContent = 'Збереження…';
  const result = id ? await db.from('daria_expenses').update(payload).eq('id', id) : await db.from('daria_expenses').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('expense-form-note').textContent = `Помилка: ${result.error.message}`; return; }
  form.hidden = true;
  setStatus(id ? 'Витрату оновлено у спільній базі' : 'Витрату додано до спільної бази');
  await loadFinance();
}

function bookingValue(id) {
  const value = parseInt(byId(id)?.value, 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function renderBooking() {
  byId('booking-list').innerHTML = bookingConcerts.map(concert => `<article class="booking-card"><div class="booking-head"><div><p>${concert.date} · ${concert.city}</p><h2>${concert.title}</h2><small>${concert.venue}</small></div><button class="text-button" type="button" data-clear-booking="${concert.id}">ОЧИСТИТИ</button></div><div class="operators">${bookingOperators.map(([id, name, note]) => `<label class="operator"><b>${name}</b><small>${note}</small><div class="field"><input id="${concert.id}-${id}" inputmode="numeric" pattern="[0-9]*" placeholder="0"><span>квитків</span></div></label>`).join('')}</div><div class="booking-summary"><div><span>ПРОДАНО</span><strong id="${concert.id}-sold">0</strong><small>із ${fmt(concert.capacity)} місць</small></div><div><span>ДО BREAK-EVEN</span><strong id="${concert.id}-break">${fmt(concert.breakEven)}</strong><small>орієнтир ${concert.breakEven}</small></div><div><span>ДО SOLD OUT</span><strong id="${concert.id}-soldout">${fmt(concert.capacity)}</strong><small>повна місткість</small></div></div></article>`).join('');
  document.querySelectorAll('.field input').forEach(input => input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); calculateBooking(); setStatus('Є незбережені booking-зміни'); }));
  document.querySelectorAll('[data-clear-booking]').forEach(button => button.addEventListener('click', () => { bookingOperators.forEach(([operator]) => byId(`${button.dataset.clearBooking}-${operator}`).value = ''); calculateBooking(); setStatus('Є незбережені booking-зміни'); }));
}

function calculateBooking() {
  let all = 0;
  bookingConcerts.forEach(concert => {
    const sold = Math.min(bookingOperators.reduce((sum, [operator]) => sum + bookingValue(`${concert.id}-${operator}`), 0), concert.capacity);
    all += sold;
    byId(`${concert.id}-sold`).textContent = fmt(sold);
    byId(`${concert.id}-break`).textContent = fmt(Math.max(0, concert.breakEven - sold));
    byId(`${concert.id}-soldout`).textContent = fmt(Math.max(0, concert.capacity - sold));
  });
  byId('all-sold').textContent = fmt(all);
}

function bookingRow() {
  const row = { updated_at: new Date().toISOString() };
  bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { row[`${concert.id}_${operator}`] = bookingValue(`${concert.id}-${operator}`); }));
  return row;
}

async function loadBooking() {
  const { data, error } = await db.from('booking_sales').select('*').eq('id', 1).single();
  if (error) { setStatus(`Booking не завантажено: ${error.message}`, true); return; }
  bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { byId(`${concert.id}-${operator}`).value = data[`${concert.id}_${operator}`] ?? ''; }));
  calculateBooking();
  setStatus('Booking синхронізовано зі спільною базою');
}

async function saveBooking() {
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти booking.')) return;
  const button = byId('save-booking');
  button.disabled = true;
  setStatus('Збереження booking…');
  const { error } = await db.from('booking_sales').update(bookingRow()).eq('id', 1);
  button.disabled = false;
  setStatus(error ? `Booking не збережено: ${error.message}` : 'Booking збережено для всієї команди', Boolean(error));
}

function bindEvents() {
  document.querySelectorAll('.ops-nav button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
  byId('dashboard-period').addEventListener('change', () => { if (state.concerts.length) renderConcerts(); });
  document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', async () => {
    const target = button.dataset.quick;
    showView(target === 'expense' ? 'finance' : 'channels');
    if (target === 'expense') { await loadFinance(); openExpenseForm(); }
    if (target === 'campaign') { await loadChannelsModule(); openCampaignForm(); }
  }));
  byId('send-login').addEventListener('click', sendMagicLink);
  byId('add-concert').addEventListener('click', () => openConcertForm());
  byId('cancel-concert').addEventListener('click', () => { byId('concert-form').hidden = true; });
  byId('concert-form').addEventListener('submit', saveConcert);
  byId('concert-filter').addEventListener('change', renderConcerts);
  byId('concerts-list').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const concert = state.concerts.find(item => item.id === button.dataset.id);
    if (button.dataset.action === 'details') selectConcert(button.dataset.id);
    if (button.dataset.action === 'edit') openConcertForm(concert);
  });
  byId('add-order').addEventListener('click', () => openOrderForm());
  byId('add-campaign-result').addEventListener('click', async () => { await loadSalesModule(); openOrderForm(); });
  byId('cancel-order').addEventListener('click', () => { byId('order-form').hidden = true; });
  byId('order-form').addEventListener('submit', saveOrder);
  byId('order-concert-filter').addEventListener('change', renderSales);
  byId('order-status-filter').addEventListener('change', renderSales);
  byId('order-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-order]');
    if (!button) return;
    openOrderForm(state.orders.find(order => order.id === button.dataset.editOrder));
  });
  byId('add-channel').addEventListener('click', () => openChannelForm());
  byId('cancel-channel').addEventListener('click', () => { byId('channel-form').hidden = true; });
  byId('channel-form').addEventListener('submit', saveChannel);
  byId('channel-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-channel]');
    if (button) openChannelForm(state.channels.find(channel => channel.id === button.dataset.editChannel));
  });
  byId('add-campaign').addEventListener('click', () => openCampaignForm());
  byId('cancel-campaign').addEventListener('click', () => { byId('campaign-form').hidden = true; });
  byId('campaign-form').addEventListener('submit', saveCampaign);
  byId('campaign-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-campaign]');
    if (button) openCampaignForm(state.campaigns.find(campaign => campaign.id === button.dataset.editCampaign));
  });
  byId('add-tracking-link').addEventListener('click', () => openTrackingForm());
  byId('cancel-tracking-link').addEventListener('click', () => { byId('tracking-link-form').hidden = true; });
  byId('tracking-link-form').addEventListener('submit', saveTrackingLink);
  byId('tracking-link-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-link]');
    if (button) openTrackingForm(state.trackingLinks.find(link => link.id === button.dataset.editLink));
  });
  byId('add-operator').addEventListener('click', () => openOperatorForm());
  byId('cancel-operator').addEventListener('click', () => { byId('operator-form').hidden = true; });
  byId('operator-form').addEventListener('submit', saveOperator);
  byId('operator-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-operator]');
    if (button) openOperatorForm(state.operators.find(operator => operator.id === button.dataset.editOperator));
  });
  byId('add-expense').addEventListener('click', () => openExpenseForm());
  byId('cancel-expense').addEventListener('click', () => { byId('expense-form').hidden = true; });
  byId('expense-form').addEventListener('submit', saveExpense);
  byId('expense-concert-filter').addEventListener('change', renderFinance);
  byId('expense-payment-filter').addEventListener('change', renderFinance);
  byId('expense-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-expense]');
    if (!button) return;
    openExpenseForm(state.expenses.find(expense => expense.id === button.dataset.editExpense));
  });
  byId('save-booking').addEventListener('click', saveBooking);
}

async function init() {
  bindEvents();
  renderBooking();
  const initialView = location.hash.slice(1);
  if (initialView && document.querySelector(`[data-panel="${CSS.escape(initialView)}"]`)) showView(initialView);
  const { data } = await db.auth.getSession();
  updateAccess(data.session);
  db.auth.onAuthStateChange((_event, session) => {
    updateAccess(session);
    loadOperations();
    if (document.querySelector('[data-panel="sales"]').classList.contains('active')) loadSalesModule();
    if (document.querySelector('[data-panel="channels"]').classList.contains('active')) loadChannelsModule();
    if (document.querySelector('[data-panel="operators"]').classList.contains('active')) loadOperatorsModule();
    if (document.querySelector('[data-panel="reports"]').classList.contains('active')) loadReportsModule();
    if (document.querySelector('[data-panel="finance"]').classList.contains('active')) loadFinance();
  });
  db.channel('booking-sales-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_sales', filter: 'id=eq.1' }, payload => {
    bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { byId(`${concert.id}-${operator}`).value = payload.new[`${concert.id}_${operator}`] ?? ''; }));
    calculateBooking();
    setStatus('Booking оновлено командою');
  }).subscribe();
  await Promise.all([loadOperations(), loadBooking()]);
}

init().catch(error => { console.error(error); setStatus(`Помилка запуску: ${error.message}`, true); });
