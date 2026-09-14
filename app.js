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
const state = { session: null, concerts: [], totals: new Map(), selectedConcertId: null };
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const fmt = value => new Intl.NumberFormat('pl-PL').format(Number(value) || 0);
const money = (value, currency = 'PLN') => new Intl.NumberFormat('pl-PL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = value => value ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'дату не задано';

function setStatus(message, isError = false) {
  byId('sync-status').textContent = message;
  byId('sync-status').classList.toggle('error', isError);
}

function showView(view) {
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === view));
  document.querySelectorAll('.ops-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  window.history.replaceState(null, '', `#${view}`);
  setStatus(state.session ? `Спільна база · ${state.session.user.email}` : 'Режим перегляду · увійдіть для редагування');
  if (view === 'concerts') loadOperations();
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
  const loggedIn = Boolean(session);
  byId('login-toggle').textContent = loggedIn ? 'ВИЙТИ' : 'УВІЙТИ';
  byId('login-toggle').onclick = loggedIn ? async () => db.auth.signOut() : () => toggleLogin();
  if (loggedIn) toggleLogin(false);
  setStatus(loggedIn ? `Спільна база · ${session.user.email}` : 'Режим перегляду · увійдіть для редагування');
}

function requireEditor(message) {
  if (state.session) return true;
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
  byId('dashboard-concerts').innerHTML = state.concerts.slice(0, 4).map(concert => concertCard(concert, true)).join('') || '<div class="empty">Концертів ще немає.</div>';
  const filter = byId('concert-filter').value;
  const visible = filter === 'ALL' ? state.concerts : state.concerts.filter(concert => concert.status === filter);
  byId('concerts-list').innerHTML = visible.map(concert => concertCard(concert)).join('') || '<div class="empty">За цим фільтром концертів немає.</div>';
}

function detailValue(label, value) { return `<div class="detail-row"><span>${label}</span><strong>${esc(value ?? '—')}</strong></div>`; }

function selectConcert(id) {
  const concert = state.concerts.find(item => item.id === id);
  if (!concert) return;
  state.selectedConcertId = id;
  const total = state.totals.get(id) || { tickets: 0, revenue: 0 };
  byId('concert-detail').innerHTML = `<p class="eyebrow">ДЕТАЛІ КОНЦЕРТУ</p><h2>${esc(concert.event_name)}</h2>
    <div class="detail-grid">
      ${detailValue('ПРОЄКТ', concert.project_name)}${detailValue('МІСТО', concert.city)}${detailValue('ДАТА', dateLabel(concert.event_date))}${detailValue('МАЙДАНЧИК', concert.venue)}
      ${detailValue('МІСТКІСТЬ', concert.capacity)}${detailValue('ПРОДАНО PAID', fmt(total.tickets))}${detailValue('GROSS REVENUE', money(total.revenue, concert.currency || 'PLN'))}${detailValue('BREAK-EVEN', concert.break_even_tickets)}
      ${detailValue('ПЛАН MARKETING', money(concert.planned_marketing_budget, concert.currency || 'PLN'))}${detailValue('СЕРЕДНЯ ЦІНА', money(concert.average_ticket_price, concert.currency || 'PLN'))}${detailValue('РИЗИК', concert.risk_status)}${detailValue('ОНОВЛЕНО', concert.updated_at ? new Date(concert.updated_at).toLocaleString('uk-UA') : '—')}
    </div>
    <div class="detail-notes">${esc(concert.notes || 'Нотаток немає.')}</div>
    <label class="quick-status">ШВИДКА ЗМІНА СТАТУСУ<select id="quick-status">${statuses.map(status => `<option value="${status}" ${status === concert.status ? 'selected' : ''}>${status.replace('_', ' ')}</option>`).join('')}</select></label>
    <div class="detail-actions"><button class="button" type="button" id="edit-selected">РЕДАГУВАТИ</button></div>`;
  byId('quick-status').addEventListener('change', event => updateConcertStatus(concert.id, event.target.value));
  byId('edit-selected').addEventListener('click', () => openConcertForm(concert));
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
    ['m-active', 'm-tickets', 'm-revenue', 'm-spend'].forEach(id => { byId(id).textContent = '—'; });
    byId('dashboard-concerts').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб побачити операційні дані.</div>';
    byId('concerts-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб відкрити реєстр концертів.</div>';
    byId('dashboard-note').classList.remove('error');
    byId('dashboard-note').textContent = 'Дані приховані політиками доступу. Порожня відповідь без авторизації не трактується як нуль.';
    state.concerts = [];
    state.totals = new Map();
    return;
  }
  const [concertsResult, ordersResult, campaignsResult] = await Promise.all([
    db.from('daria_concerts').select('*').order('event_date', { ascending: true, nullsFirst: false }),
    db.from('daria_orders').select('concert_id,ticket_count,gross_revenue,status'),
    db.from('daria_campaigns').select('actual_spend')
  ]);
  const errors = [];
  if (concertsResult.error) errors.push(`concerts: ${concertsResult.error.message}`);
  if (ordersResult.error) errors.push(`orders: ${ordersResult.error.message}`);
  if (campaignsResult.error) errors.push(`campaigns: ${campaignsResult.error.message}`);
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
  const note = byId('dashboard-note');
  note.classList.toggle('error', errors.length > 0);
  note.textContent = errors.length ? `Частину даних не завантажено — нулі не підставлено. ${errors.join(' · ')}` : 'Актуально: PAID orders для продажів і revenue; campaigns.actual_spend для marketing spend.';
  if (!concertsResult.error) renderConcerts();
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
  byId('save-booking').addEventListener('click', saveBooking);
}

async function init() {
  bindEvents();
  renderBooking();
  const initialView = location.hash.slice(1);
  if (initialView && document.querySelector(`[data-panel="${CSS.escape(initialView)}"]`)) showView(initialView);
  const { data } = await db.auth.getSession();
  updateAccess(data.session);
  db.auth.onAuthStateChange((_event, session) => { updateAccess(session); loadOperations(); });
  db.channel('booking-sales-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_sales', filter: 'id=eq.1' }, payload => {
    bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { byId(`${concert.id}-${operator}`).value = payload.new[`${concert.id}_${operator}`] ?? ''; }));
    calculateBooking();
    setStatus('Booking оновлено командою');
  }).subscribe();
  await Promise.all([loadOperations(), loadBooking()]);
}

init().catch(error => { console.error(error); setStatus(`Помилка запуску: ${error.message}`, true); });
