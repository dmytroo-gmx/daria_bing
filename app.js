const SUPABASE_URL = 'https://zrqdeksliembgzmivqcu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MeIQ3HFdObe1CyUebdwt8Q_qAA4s3S6';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const bookingConcerts = [
  { id: 'wroclaw', date: '29.09.2026', eventDate: '2026-09-29', city: 'Вроцлав', title: 'Vivaldi vs. Piazzolla', venue: 'Radio Wrocław', capacity: 500, breakEven: 249 },
  { id: 'kielce', date: '04.10.2026', eventDate: '2026-10-04', city: 'Кельце', title: 'Vintage Rock Legends', venue: 'Filharmonia Świętokrzyska', capacity: 506, breakEven: 286 }
];
const bookingOperators = [
  ['kupbilecik', 'KupBilecik', 'основні продажі'],
  ['ebilet', 'eBilet', 'партнерські продажі'],
  ['bilety24', 'Bilety24', 'партнерські продажі']
];
const statuses = ['DRAFT', 'PLANNED', 'ON_SALE', 'ACTIVE', 'ON_HOLD', 'POSTPONED', 'CANCELLED', 'COMPLETED'];
const labels = {
  status: { DRAFT: 'ЧЕРНОВИК', PLANNED: 'ЗАПЛАНИРОВАН', ON_SALE: 'В ПРОДАЖЕ', ACTIVE: 'В РАБОТЕ', ON_HOLD: 'НА ПАУЗЕ', POSTPONED: 'ПЕРЕНЕСЁН', CANCELLED: 'ОТМЕНЁН', COMPLETED: 'ЗАВЕРШЁН' },
  risk: { GRAY: 'НЕ ОЦЕНЁН', GREEN: 'НИЗКИЙ РИСК', YELLOW: 'ТРЕБУЕТ ВНИМАНИЯ', RED: 'ВЫСОКИЙ РИСК' },
  taskStatus: { OPEN: 'ОТКРЫТА', IN_PROGRESS: 'В РАБОТЕ', DONE: 'ВЫПОЛНЕНА', CANCELLED: 'ОТМЕНЕНА' },
  priority: { LOW: 'НИЗКИЙ', NORMAL: 'ОБЫЧНЫЙ', HIGH: 'ВЫСОКИЙ', CRITICAL: 'КРИТИЧЕСКИЙ' },
  orderStatus: { PAID: 'ОПЛАЧЕН', PENDING: 'ОЖИДАЕТ ОПЛАТЫ', REFUNDED: 'ВОЗВРАТ', CANCELLED: 'ОТМЕНЁН' },
  attribution: { UNKNOWN: 'ИСТОЧНИК НЕ УСТАНОВЛЕН', CONFIRMED: 'ПОДТВЕРЖДЁННЫЙ ИСТОЧНИК', PLATFORM_ATTRIBUTED: 'УКАЗАНО ПЛАТФОРМОЙ' },
  campaignStatus: { TESTING: 'ПРОВЕРКА', WORKING: 'РАБОТАЕТ', WEAK: 'СЛАБАЯ', STOPPED: 'ОСТАНОВЛЕНА' },
  attributionQuality: { UNKNOWN: 'НЕ ОЦЕНЕНО', HIGH: 'ВЫСОКАЯ', MEDIUM: 'СРЕДНЯЯ', LOW: 'НИЗКАЯ' },
  expenseType: { ALREADY_PAID: 'УЖЕ ОПЛАЧЕНО', MANDATORY_FUTURE: 'ОБЯЗАТЕЛЬНО ОПЛАТИТЬ', OPTIONAL_FUTURE: 'НЕОБЯЗАТЕЛЬНЫЙ РАСХОД', REFUNDABLE_DEPOSIT: 'ВОЗВРАТНЫЙ ЗАЛОГ' },
  paymentStatus: { UNPAID: 'НЕ ОПЛАЧЕНО', PAID: 'ОПЛАЧЕНО', PARTIALLY_PAID: 'ОПЛАЧЕНО ЧАСТИЧНО', REFUNDED: 'ВОЗВРАТ' },
  linkStatus: { ACTIVE: 'АКТИВНА', PAUSED: 'НА ПАУЗЕ', ARCHIVED: 'В АРХИВЕ' }
};
const state = { session: null, role: null, concerts: [], totals: new Map(), concertFinance: new Map(), selectedConcertId: null, detailTab: 'OVERVIEW', detail: null, expenses: [], orders: [], campaignOrders: [], operators: [], channels: [], campaigns: [], trackingLinks: [], documents: [], csvImports: [], tasks: [] };
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const fmt = value => new Intl.NumberFormat('pl-PL').format(Number(value) || 0);
const money = (value, currency = 'PLN') => new Intl.NumberFormat('pl-PL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = value => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'дата не указана';
const label = (group, value) => labels[group]?.[value] || String(value ?? '—').replaceAll('_', ' ');
const help = (text, explanation) => `${text} <span class="term-help" tabindex="0" data-tooltip="${esc(explanation)}">?</span>`;

const staticRussianLabels = {
  'УСІ': 'ВСЕ', 'ДОДАТИ': 'ДОБАВИТЬ', 'РЕДАГУВАТИ': 'ИЗМЕНИТЬ', 'ЗБЕРЕГТИ': 'СОХРАНИТЬ', 'ЗАКРИТИ': 'ЗАКРЫТЬ',
  'НОВИЙ КАНАЛ': 'НОВЫЙ КАНАЛ', 'Додати канал': 'Добавить канал', 'АКТИВНИЙ': 'АКТИВЕН',
  'НОВЕ ДЖЕРЕЛО': 'НОВЫЙ ИСТОЧНИК', 'Завантажити документ': 'Загрузить документ', 'ЗАВАНТАЖИТИ': 'ЗАГРУЗИТЬ',
  'НЕ ПРИВ’ЯЗАНО': 'НЕ ПРИВЯЗАНО', 'ДАТА ДЖЕРЕЛА': 'ДАТА ИСТОЧНИКА', 'НОТАТКИ': 'ЗАМЕТКИ',
  'Активні події': 'Активные события', 'Завантаження операційних даних…': 'Загрузка операционных данных…', 'Метрики завантажуються незалежно: збій одного джерела не маскується нулями.': 'Показатели загружаются независимо: сбой одного источника не подменяется нулями.',
  'Увійдіть, щоб відкрити задачі.': 'Войдите, чтобы открыть задачи.', 'Реєстр подій': 'Реестр событий', 'ДОДАТИ КОНЦЕРТ': 'ДОБАВИТЬ КОНЦЕРТ', 'Оберіть концерт': 'Выберите концерт', 'Тут з’являться операційні параметри, статус і ризик обраної події.': 'Здесь появятся рабочие параметры, статус и риск выбранного события.',
  'НОВИЙ КОНЦЕРТ': 'НОВЫЙ КОНЦЕРТ', 'Додати подію': 'Добавить событие', 'ЩОДЕННИЙ ЗРІЗ ПРОДАЖІВ': 'ЕЖЕДНЕВНЫЙ СРЕЗ ПРОДАЖ', 'Додати снапшот': 'Добавить срез', 'ДАТА ЗРІЗУ': 'ДАТА СРЕЗА', 'ПРОДАНО ВСЬОГО': 'ПРОДАНО ВСЕГО', 'ВИРУЧКА ВСЬОГО': 'ВЫРУЧКА ВСЕГО',
  'ДОКУМЕНТ-ДЖЕРЕЛО': 'ФАЙЛ-ИСТОЧНИК', 'КОМЕНТАР ДО ДЖЕРЕЛА': 'КОММЕНТАРИЙ К ИСТОЧНИКУ', 'Наприклад: сторінка 2 операторського PDF-звіту': 'Например: страница 2 отчёта оператора', 'ЗБЕРЕГТИ ЗРІЗ': 'СОХРАНИТЬ СРЕЗ', 'Не додавай сюди загальні суми різних операторів як один рядок.': 'Не добавляйте сюда общие суммы разных операторов одной строкой.',
  'Увійдіть, щоб відкрити замовлення.': 'Войдите, чтобы открыть заказы.', 'Довідник': 'Справочник', 'Активність': 'Активность', 'Увійдіть, щоб завантажити канали.': 'Войдите, чтобы загрузить каналы.', 'Увійдіть, щоб завантажити кампанії.': 'Войдите, чтобы загрузить кампании.', 'Увійдіть, щоб відкрити документи.': 'Войдите, чтобы открыть документы.',
  'Комісії, доступ до даних і CAPI фіксуються як умови договору або підтверджені факти, а не припущення.': 'Комиссии, доступ к данным и серверная передача фиксируются как условия договора или подтверждённые факты, а не предположения.', 'Увійдіть, щоб завантажити операторів.': 'Войдите, чтобы загрузить операторов.', 'Увійдіть, щоб відкрити реєстр витрат.': 'Войдите, чтобы открыть реестр расходов.', 'Увійдіть, щоб побачити звіти.': 'Войдите, чтобы увидеть отчёты.',
  'PDF REPORT': 'ОТЧЁТ В ДОКУМЕНТЕ', 'META CSV': 'ВЫГРУЗКА META', 'OPERATOR CSV': 'ВЫГРУЗКА ОПЕРАТОРА', 'OTHER CSV': 'ДРУГАЯ ВЫГРУЗКА',
  'NEW — ПОТРЕБУЄ ПЕРЕВІРКИ': 'НОВОЕ — ТРЕБУЕТ ПРОВЕРКИ', 'REVIEWED': 'ПРОВЕРЕНО', 'APPLIED': 'ПРИМЕНЕНО', 'REJECTED': 'ОТКЛОНЕНО',
  'WEBSITE': 'САЙТ', 'MARKETPLACE COMMISSION, %': 'КОМИССИЯ МАРКЕТПЛЕЙСА, %', 'OWN SALES COMMISSION, %': 'КОМИССИЯ СОБСТВЕННЫХ ПРОДАЖ, %',
  'PAYMENT FEE, %': 'КОМИССИЯ ПЛАТЕЖА, %', 'SETUP FEE': 'РАЗОВЫЙ ЗАПУСК', 'MONTHLY FEE': 'ЕЖЕМЕСЯЧНАЯ ПЛАТА', 'CAPI FEE': 'ПЛАТА ЗА СЕРВЕРНУЮ ПЕРЕДАЧУ',
  'EXCLUSIVITY REQUIRED': 'ЭКСКЛЮЗИВНОСТЬ', 'NEGOTIATION STATUS': 'СТАТУС ПЕРЕГОВОРОВ', 'EXCLUSIVITY TERMS': 'УСЛОВИЯ ЭКСКЛЮЗИВНОСТИ', 'CONTRACT NOTES': 'ЗАМЕТКИ ПО ДОГОВОРУ',
  'Meta Pixel': 'Пиксель Meta', 'CAPI': 'Серверная передача', 'GTM': 'Диспетчер тегов', 'Statistical links': 'Статистические ссылки', 'Promo codes': 'Промокоды', 'Marketplace': 'Маркетплейс', 'SMS marketing': 'СМС-рассылки', 'Email marketing': 'Рассылки по почте',
  'break-even': 'точка безубыточности', 'Операційні дані, не фінансова рекомендація': 'Операционные данные, не финансовая рекомендация',
  'ДОДАТИ ДЖЕРЕЛО': 'ДОБАВИТЬ ИСТОЧНИК', 'ДОДАТИ ЗРІЗ': 'ДОБАВИТЬ СРЕЗ', 'ВІДКРИТИ': 'ОТКРЫТЬ', 'РЕДАГУВАННЯ': 'РЕДАКТИРОВАНИЕ', 'РЕДАГУВАННЯ ЗАДАЧІ': 'РЕДАКТИРОВАНИЕ ЗАДАЧИ', 'НОВА ЗАДАЧА': 'НОВАЯ ЗАДАЧА', 'Додати задачу': 'Добавить задачу', 'РЕДАГУВАННЯ ОПЕРАТОРА': 'РЕДАКТИРОВАНИЕ ОПЕРАТОРА', 'НОВИЙ ОПЕРАТОР': 'НОВЫЙ ОПЕРАТОР', 'Додати оператора': 'Добавить оператора',
  'РЕДАГУВАННЯ ВИТРАТИ': 'РЕДАКТИРОВАНИЕ РАСХОДА', 'НОВА ВИТРАТА': 'НОВЫЙ РАСХОД', 'Додати запис': 'Добавить запись', 'РЕДАГУВАТИ': 'ИЗМЕНИТЬ', 'ОЧИСТИТИ': 'ОЧИСТИТЬ', 'квитків': 'билетов', 'із': 'из', 'місць': 'мест', 'орієнтир': 'ориентир',
  'без дати': 'без даты', 'дата джерела не задана': 'дата источника не указана', 'майданчик не задано': 'площадка не указана', 'Концерт не знайдено': 'Концерт не найден', 'строк не задано': 'срок не указан', 'За цим фільтром задач немає.': 'По этому фильтру задач нет.', 'За цим фільтром замовлень немає.': 'По этому фильтру заказов нет.', 'За цим фільтром записів немає.': 'По этому фильтру записей нет.',
  'Збереження…': 'Сохранение…', 'Помилка:': 'Ошибка:', 'Концерт оновлено у спільній базі': 'Концерт обновлён в общей базе', 'Концерт додано до спільної бази': 'Концерт добавлен в общую базу', 'Замовлення оновлено у спільній базі': 'Заказ обновлён в общей базе', 'Замовлення додано до спільної бази': 'Заказ добавлен в общую базу', 'Кампанію оновлено': 'Кампания обновлена', 'Кампанію додано': 'Кампания добавлена', 'Витрату оновлено у спільній базі': 'Расход обновлён в общей базе', 'Витрату додано до спільної бази': 'Расход добавлен в общую базу', 'Оператора оновлено': 'Оператор обновлён', 'Оператора додано': 'Оператор добавлен',
  'Спочатку додайте концерт до реєстру.': 'Сначала добавьте концерт в реестр.', 'Спочатку додайте концерт.': 'Сначала добавьте концерт.', 'Спочатку додайте або підтвердьте квиткового оператора.': 'Сначала добавьте или подтвердите билетного оператора.', 'Увійдіть через робочу пошту, щоб': 'Войдите через рабочую почту, чтобы', 'не вдалося': 'не удалось', 'Не вдалося': 'Не удалось', 'оновлено': 'обновлён', 'додано': 'добавлен', 'збережено': 'сохранён', 'Зріз': 'Срез', 'зріз': 'срез', 'джерелом': 'источником', 'джерело': 'источник', 'джерела': 'источника', 'Застосування перевірених даних…': 'Применение проверенных данных…', 'Перевірені дані Meta CSV застосовано до кампанії': 'Проверенные данные Meta CSV применены к кампании',
  'ALREADY PAID': 'УЖЕ ОПЛАЧЕНО', 'MANDATORY FUTURE': 'ОБЯЗАТЕЛЬНО ОПЛАТИТЬ', 'OPTIONAL FUTURE': 'НЕОБЯЗАТЕЛЬНЫЙ РАСХОД', 'REFUNDABLE DEPOSIT': 'ВОЗВРАТНЫЙ ЗАЛОГ', 'UNPAID': 'НЕ ОПЛАЧЕНО', 'PARTIALLY PAID': 'ОПЛАЧЕНО ЧАСТИЧНО', 'TO_BE_CLARIFIED': 'ТРЕБУЕТ УТОЧНЕНИЯ', 'NEGOTIATING': 'ПЕРЕГОВОРЫ', 'RECOMMENDED': 'РЕКОМЕНДОВАН', 'BACKUP': 'РЕЗЕРВНЫЙ', 'NOT SUITABLE': 'НЕ ПОДХОДИТ', 'PAUSED': 'НА ПАУЗЕ', 'PDF': 'ДОКУМЕНТ', 'CSV': 'ТАБЛИЧНАЯ ВЫГРУЗКА', 'PREVIEW': 'ПРЕДПРОСМОТР'
};

function translateStaticText(value) {
  return Object.entries(staticRussianLabels).reduce((result, [from, to]) => result.replaceAll(from, to), String(value ?? ''));
}

function localizeStaticInterface() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => { const translated = translateStaticText(node.nodeValue); if (translated !== node.nodeValue) node.nodeValue = translated; });
  document.querySelectorAll('[data-tooltip],[placeholder]').forEach(element => {
    if (element.dataset.tooltip) element.dataset.tooltip = translateStaticText(element.dataset.tooltip);
    if (element.placeholder) element.placeholder = translateStaticText(element.placeholder);
  });
  const observer = new MutationObserver(records => records.forEach(record => {
    if (record.type === 'characterData') { const translated = translateStaticText(record.target.nodeValue); if (translated !== record.target.nodeValue) record.target.nodeValue = translated; }
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) { const translated = translateStaticText(node.nodeValue); if (translated !== node.nodeValue) node.nodeValue = translated; }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const addedText = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        while (addedText.nextNode()) { const translated = translateStaticText(addedText.currentNode.nodeValue); if (translated !== addedText.currentNode.nodeValue) addedText.currentNode.nodeValue = translated; }
        node.querySelectorAll?.('[data-tooltip],[placeholder]').forEach(element => {
          if (element.dataset.tooltip) element.dataset.tooltip = translateStaticText(element.dataset.tooltip);
          if (element.placeholder) element.placeholder = translateStaticText(element.placeholder);
        });
      }
    });
  }));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function setStatus(message, isError = false) {
  byId('sync-status').textContent = message;
  byId('sync-status').classList.toggle('error', isError);
}

function accessStatus() {
  if (!state.session) return { message: 'Режим просмотра · войдите для редактирования', isError: false };
  if (state.role) return { message: `Общая база · ${state.session.user.email} · ${state.role === 'ADMIN' ? 'АДМИНИСТРАТОР' : 'МЕНЕДЖЕР'}`, isError: false };
  return { message: `Вход выполнен: ${state.session.user.email} · роль не назначена`, isError: true };
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
  if (view === 'tasks') loadTasksModule();
  if (view === 'sales') loadSalesModule();
  if (view === 'channels') loadChannelsModule();
  if (view === 'documents') loadDocumentsModule();
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
  if (!email) { byId('login-note').textContent = 'Введите рабочую почту.'; return; }
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  byId('login-note').textContent = error ? `Не удалось отправить ссылку: ${error.message}` : 'Ссылка отправлена. Откройте её в этом браузере.';
}

function updateAccess(session) {
  state.session = session;
  state.role = null;
  const loggedIn = Boolean(session);
  byId('login-toggle').textContent = loggedIn ? 'ВЫЙТИ' : 'ВОЙТИ';
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

function requireEditor() {
  if (state.session && ['ADMIN', 'MANAGER'].includes(state.role)) return true;
  if (state.session) { setStatus('Вход выполнен, но роль менеджера ещё не подтверждена', true); return false; }
  toggleLogin(true);
  setStatus('Войдите через рабочую почту, чтобы вносить изменения.', true);
  return false;
}

function riskClass(risk) { return `risk-${String(risk || 'GRAY').toLowerCase()}`; }

function concertCard(concert, compact = false) {
  const total = state.totals.get(concert.id) || { tickets: 0, revenue: 0 };
  const finance = state.concertFinance.get(concert.id) || { marketing: new Map(), mandatory: new Map(), nextMandatory: null };
  const capacity = Number(concert.capacity) || 0, occupancy = capacity ? `${Math.round(total.tickets / capacity * 100)}%` : '—';
  const breakEven = concert.break_even_tickets == null ? '—' : fmt(Math.max(0, Number(concert.break_even_tickets) - total.tickets));
  const nextMandatory = finance.nextMandatory ? `${money(finance.nextMandatory.amount, finance.nextMandatory.currency)}${finance.nextMandatory.due_date ? ` · до ${dateLabel(finance.nextMandatory.due_date)}` : ''}` : '—';
  return `<article class="ops-concert ${state.selectedConcertId === concert.id ? 'selected' : ''}" data-concert-id="${esc(concert.id)}">
    <div><small>${esc(label('status', concert.status))} · ${esc(concert.city)} · ${esc(dateLabel(concert.event_date))}</small><h3>${esc(concert.event_name)}</h3><small>${esc(concert.venue || 'площадка не указана')} · ${fmt(total.tickets)} из ${capacity ? fmt(capacity) : '—'} билетов · заполнение ${occupancy} · выручка ${money(total.revenue, concert.currency || 'PLN')}</small><div class="concert-facts"><span>РАСХОДЫ НА КАМПАНИИ: ${formatCurrencyMap(finance.marketing)}</span><span>ОБЯЗАТЕЛЬНО ОПЛАТИТЬ: ${formatCurrencyMap(finance.mandatory)}</span><span>БЛИЖАЙШИЙ ПЛАТЁЖ: ${nextMandatory}</span>${concert.break_even_tickets == null ? '' : `<span>ДО ТОЧКИ БЕЗУБЫТОЧНОСТИ: ${breakEven} билетов</span>`}</div></div>
    <div class="concert-actions"><span class="risk ${riskClass(concert.risk_status)}">${esc(label('risk', concert.risk_status || 'GRAY'))}</span>${compact ? `<button class="text-button" type="button" data-action="details" data-id="${esc(concert.id)}">ОТКРЫТЬ</button>` : `<button class="text-button" type="button" data-action="details" data-id="${esc(concert.id)}">ДЕТАЛИ</button><button class="text-button" type="button" data-action="edit" data-id="${esc(concert.id)}">ИЗМЕНИТЬ</button>`}</div>
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
  byId('dashboard-concerts').innerHTML = dashboardConcerts.map(concert => concertCard(concert, true)).join('') || '<div class="empty">В выбранном периоде активных концертов нет.</div>';
  const filter = byId('concert-filter').value;
  const visible = filter === 'ALL' ? state.concerts : state.concerts.filter(concert => concert.status === filter);
  byId('concerts-list').innerHTML = visible.map(concert => concertCard(concert)).join('') || '<div class="empty">По этому фильтру концертов нет.</div>';
}

function attentionTaskTitle(kind) { return { source: 'Привязать файл-источник', snapshot: 'Внести ежедневный срез продаж', edit: 'Указать вместимость площадки' }[kind]; }

function renderDashboardAttention(staleSnapshots, sourceMissing = [], unavailable = false, openTaskKeys = new Set()) {
  const target = byId('dashboard-attention');
  if (unavailable) { target.innerHTML = '<div class="empty">Не удалось проверить полноту данных: значения не подменены нулями.</div>'; return; }
  const missingCapacity = state.concerts.filter(concert => ['ACTIVE', 'ON_SALE'].includes(concert.status) && !Number(concert.capacity));
  const items = [
    ...staleSnapshots.map(concert => {
      const hasSource = !sourceMissing.some(item => item.id === concert.id);
      return { concert, text: 'Нет подтверждённого среза продаж за последние два дня.', action: hasSource ? 'snapshot' : 'source', button: hasSource ? 'ДОБАВИТЬ СРЕЗ' : 'ДОБАВИТЬ ФАЙЛ' };
    }),
    ...sourceMissing.map(concert => ({ concert, text: 'Не привязан файл-источник по концерту.', action: 'source', button: 'ДОБАВИТЬ ФАЙЛ' })),
    ...missingCapacity.map(concert => ({ concert, text: 'Не указана вместимость площадки: заполнение зала не рассчитывается.', action: 'edit', button: 'УКАЗАТЬ МЕСТА' }))
  ];
  target.innerHTML = items.map(({ concert, text, action, button }) => `<article class="attention-item"><div><b>${esc(concert.event_name)}</b><span>${esc(concert.city)} · ${esc(dateLabel(concert.event_date))} · ${esc(text)}</span></div><div><button class="text-button" type="button" data-action="${action}" data-id="${esc(concert.id)}">${button}</button>${openTaskKeys.has(`${concert.id}:${attentionTaskTitle(action)}`) ? '' : `<button class="text-button" type="button" data-attention-task="${action}" data-id="${esc(concert.id)}">СОЗДАТЬ ЗАДАЧУ</button>`}</div></article>`).join('') || '<div class="truth-note">Все активные концерты имеют свежий срез продаж, привязанный файл-источник и указанную вместимость. Это проверка заполненности данных, не прогноз продаж.</div>';
}

function detailValue(label, value) { return `<div class="detail-row"><span>${label}</span><strong>${esc(value ?? '—')}</strong></div>`; }

function snapshotChanges(snapshots) {
  const groups = new Map();
  snapshots.forEach(snapshot => {
    const key = snapshot.operator_id || 'UNSPECIFIED';
    groups.set(key, [...(groups.get(key) || []), snapshot]);
  });
  return [...groups.values()].map(group => {
    const ordered = [...group].sort((left, right) => String(right.snapshot_date).localeCompare(String(left.snapshot_date)));
    const [latest, previous] = ordered;
    const sameCurrency = previous && latest.currency === previous.currency;
    return { latest, previous, ticketDelta: previous ? Number(latest.tickets_sold_total) - Number(previous.tickets_sold_total) : null, revenueDelta: sameCurrency ? Number(latest.revenue_total) - Number(previous.revenue_total) : null };
  });
}

function snapshotTimelines(snapshots) {
  const groups = new Map();
  snapshots.forEach(snapshot => {
    const key = snapshot.operator_id || 'UNSPECIFIED';
    groups.set(key, [...(groups.get(key) || []), snapshot]);
  });
  return [...groups.values()].map(group => {
    const ordered = [...group].sort((left, right) => String(left.snapshot_date).localeCompare(String(right.snapshot_date)));
    const maxTickets = Math.max(...ordered.map(snapshot => Number(snapshot.tickets_sold_total) || 0), 1);
    const name = ordered.at(-1).operator_name || 'оператор не вказаний';
    return `<div class="detail-line"><b>${esc(name)} · динаміка зрізів</b><div class="snapshot-bars">${ordered.map(snapshot => `<span title="${esc(dateLabel(snapshot.snapshot_date))}: ${fmt(snapshot.tickets_sold_total)} кв." style="height:${Math.max(8, Math.round((Number(snapshot.tickets_sold_total) || 0) / maxTickets * 100))}%"><i>${fmt(snapshot.tickets_sold_total)}</i></span>`).join('')}</div><span>${esc(dateLabel(ordered[0].snapshot_date))} → ${esc(dateLabel(ordered.at(-1).snapshot_date))} · лише цей оператор</span></div>`;
  }).join('');
}

const detailTabs = ['OVERVIEW', 'CHECKLIST', 'TASKS', 'SALES', 'DAILY', 'SOURCES', 'CHANNELS', 'FINANCE', 'TRACKING', 'ORDERS', 'NOTES', 'HISTORY'];
const detailTabLabels = { OVERVIEW: 'ОБЗОР', CHECKLIST: 'ПРОВЕРКА', TASKS: 'ЗАДАЧИ', SALES: 'ПРОДАЖИ', DAILY: 'СВОДКИ', SOURCES: 'ИСТОЧНИКИ', CHANNELS: 'КАНАЛЫ', FINANCE: 'РАСХОДЫ', TRACKING: 'ССЫЛКИ', ORDERS: 'ЗАКАЗЫ', NOTES: 'ЗАМЕТКИ', HISTORY: 'ИСТОРИЯ' };

function checklistItem(done, title, copy, action = '') {
  return `<div class="detail-line"><b>${done ? '✓' : '○'} ${esc(title)}</b><span>${esc(copy)}${action ? ` · <button class="text-button" type="button" data-detail-action="${action}">${action === 'source' ? 'ДОДАТИ ДЖЕРЕЛО' : 'ДОДАТИ ЗРІЗ'}</button>` : ''}</span></div>`;
}

function concertChannelPerformance(campaigns, orders, channels, currency) {
  const channelById = new Map(channels.map(channel => [channel.id, channel.name]));
  const grouped = new Map();
  campaigns.forEach(campaign => {
    const key = campaign.channel_id || 'UNSPECIFIED';
    const row = grouped.get(key) || { name: channelById.get(campaign.channel_id) || 'Канал не указан', spend: 0, platformOrders: 0, confirmedOrders: 0, tickets: 0, revenue: 0 };
    row.spend += Number(campaign.actual_spend) || 0;
    row.platformOrders += Number(campaign.platform_reported_orders) || 0;
    const confirmed = orders.filter(order => order.campaign_id === campaign.id && order.status === 'PAID' && order.attribution_type === 'CONFIRMED');
    row.confirmedOrders += confirmed.length;
    row.tickets += confirmed.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0);
    row.revenue += confirmed.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0);
    grouped.set(key, row);
  });
  const rows = [...grouped.values()].sort((a, b) => b.tickets - a.tickets || b.spend - a.spend).map(row => `<tr><td><b>${esc(row.name)}</b></td><td>${money(row.spend, currency)}</td><td>${fmt(row.platformOrders)}<br><small>по данным платформы</small></td><td>${fmt(row.confirmedOrders)}</td><td>${fmt(row.tickets)}</td><td>${money(row.revenue, currency)}</td><td>${ratio(row.spend, row.tickets, ` ${currency}`)}</td><td>${ratio(row.revenue, row.spend, '×')}</td></tr>`);
  return reportTable(['КАНАЛ', 'РАСХОДЫ', 'ЗАКАЗЫ ПЛАТФОРМЫ', 'ПОДТВЕРЖДЁННЫЕ ЗАКАЗЫ', 'БИЛЕТЫ', 'ВЫРУЧКА', 'СТОИМОСТЬ БИЛЕТА', 'ОКУПАЕМОСТЬ'], rows, 'Кампаний у этого концерта ещё нет.');
}

function renderConcertDetail() {
  const concert = state.concerts.find(item => item.id === state.selectedConcertId);
  if (!concert) return;
  const detail = state.detail;
  if (!detail) { byId('concert-detail').innerHTML = '<p class="eyebrow">КАРТОЧКА КОНЦЕРТА</p><h2>Загрузка данных…</h2>'; return; }
  const metric = detail.metric;
  const sold = Number(metric.paid_tickets || 0), capacity = Number(concert.capacity || 0), remaining = capacity ? Math.max(0, capacity - sold) : null;
  const breakNeeded = concert.break_even_tickets == null ? null : Math.max(0, Number(concert.break_even_tickets) - sold);
  const nextMandatory = detail.expenses.filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && !['PAID', 'REFUNDED'].includes(expense.payment_status)).sort((left, right) => String(left.due_date || '9999-12-31').localeCompare(String(right.due_date || '9999-12-31')))[0];
  const tabs = detailTabs.map(tab => `<button type="button" class="detail-tab ${state.detailTab === tab ? 'active' : ''}" data-detail-tab="${tab}">${detailTabLabels[tab]}</button>`).join('');
  let content = '';
  if (state.detailTab === 'OVERVIEW') content = `<div class="detail-grid">${detailValue('ПРОДАНО ОПЛАЧЕННЫХ БИЛЕТОВ', fmt(sold))}${detailValue('ОСТАЛОСЬ', remaining == null ? '—' : fmt(remaining))}${detailValue('ЗАПОЛНЕНИЕ', capacity ? `${Math.round(sold / capacity * 100)}%` : '—')}${detailValue('ДО ТОЧКИ БЕЗУБЫТОЧНОСТИ', breakNeeded == null ? '—' : fmt(breakNeeded))}${detailValue(help('ВЫРУЧКА ДО УДЕРЖАНИЙ', 'Сумма оплаченных заказов до комиссии оператора и расходов.'), money(metric.gross_revenue, concert.currency))}${detailValue(help('ВЫРУЧКА ПОСЛЕ УДЕРЖАНИЙ', 'Внесённая сумма после удержаний оператора.'), money(metric.net_revenue, concert.currency))}${detailValue(help('УЖЕ ОПЛАЧЕНО', 'Подтверждённые расходы, которые уже отмечены как оплаченные.'), money(metric.already_spent, concert.currency))}${detailValue(help('ОБЯЗАТЕЛЬНО ОПЛАТИТЬ', 'Будущие обязательные расходы, которые ещё не оплачены.'), money(metric.mandatory_future, concert.currency))}${detailValue(help('БЛИЖАЙШИЙ ОБЯЗАТЕЛЬНЫЙ ПЛАТЁЖ', 'Самый ранний по сроку неоплаченный обязательный расход.'), nextMandatory ? `${money(nextMandatory.amount, nextMandatory.currency || concert.currency)} · ${nextMandatory.due_date ? dateLabel(nextMandatory.due_date) : 'дата не указана'}` : '—')}${detailValue(help('НЕОБЯЗАТЕЛЬНЫЕ РАСХОДЫ', 'Будущие расходы, которые можно не нести без нарушения обязательств.'), money(metric.optional_future, concert.currency))}${detailValue(help('ВОЗВРАТНЫЕ ЗАЛОГИ', 'Внесённые суммы, которые должны вернуться после выполнения условий. Они не входят в невозвратную себестоимость.'), money(metric.refundable_deposits, concert.currency))}${detailValue(help('РАСХОДЫ НА РЕКЛАМУ', 'Фактически внесённые расходы по кампаниям.'), money(metric.marketing_spend, concert.currency))}${detailValue(help('ПЛАНОВЫЕ НЕВОЗВРАТНЫЕ РАСХОДЫ', 'Уже оплаченные расходы плюс обязательные будущие. Возвратные залоги и необязательные расходы не включены.'), money(metric.projected_nonref_cost, concert.currency))}${detailValue(help('ОПЕРАЦИОННЫЙ ОСТАТОК', 'Расчёт: выручка минус внесённые оплаченные и обязательные расходы.'), money(metric.operational_result, concert.currency))}</div><div class="truth-note">${detail.server ? 'Показатели рассчитаны в общей базе. Валюты автоматически не конвертируются.' : 'Показатели из базы ещё не загружены; показан доступный локальный итог.'}</div>`;
  if (state.detailTab === 'CHECKLIST') { const sourceReady = detail.documents.length > 0, snapshotsReady = detail.snapshots.length > 0, sourcedSnapshots = detail.snapshots.filter(snapshot => snapshot.source_document_id).length; content = `<div class="truth-note">Это техническая готовность данных, а не оценка финансового состояния концерта.</div>${checklistItem(sourceReady, 'Источник для концерта', sourceReady ? `${fmt(detail.documents.length)} файлов привязано` : 'Сначала нужен файл от оператора или Meta', sourceReady ? '' : 'source')}${checklistItem(snapshotsReady, 'Ежедневный срез продаж', snapshotsReady ? `${fmt(detail.snapshots.length)} срезов внесено` : 'После источника внесите первый срез по одному оператору', snapshotsReady || !sourceReady ? '' : 'snapshot')}${checklistItem(!snapshotsReady || sourcedSnapshots === detail.snapshots.length, 'Подтверждения для срезов', !snapshotsReady ? 'Срезов ещё нет' : `${fmt(sourcedSnapshots)} из ${fmt(detail.snapshots.length)} срезов имеют файл-источник`)}`; }
  if (state.detailTab === 'TASKS') content = `<button class="button subtle" type="button" data-add-detail-task="${esc(concert.id)}">+ ДОБАВИТЬ ЗАДАЧУ</button>${detail.tasks.map(task => `<div class="detail-line"><b>${esc(label('priority', task.priority))} · ${esc(label('taskStatus', task.task_status))} · ${esc(task.title)}</b><span>${task.due_date ? esc(dateLabel(task.due_date)) : 'срок не указан'}${task.details ? ` · ${esc(task.details)}` : ''}</span></div>`).join('') || '<div class="empty">Для этого концерта задач ещё нет.</div>'}`;
  if (state.detailTab === 'SALES' || state.detailTab === 'ORDERS') { const orders = state.detailTab === 'SALES' ? detail.orders.filter(order => order.status === 'PAID') : detail.orders; content = orders.map(order => `<div class="detail-line"><b>${esc(order.external_order_id)}</b><span>${fmt(order.ticket_count)} бил. · ${money(order.gross_revenue, order.currency)} · ${esc(order.attribution_type)}</span></div>`).join('') || '<div class="empty">Записей ещё нет.</div>'; }
  if (state.detailTab === 'DAILY') { const changes = snapshotChanges(detail.snapshots); content = `<button class="button subtle" type="button" data-add-snapshot="${esc(concert.id)}">+ ДОБАВИТЬ ЕЖЕДНЕВНЫЙ СРЕЗ</button><div class="truth-note">Изменение считается только между двумя последними срезами одного оператора и одной валюты. Разных операторов здесь не складываем.</div>${changes.map(change => `<div class="detail-line"><b>${esc(change.latest.operator_name || 'оператор не указан')} · по состоянию на ${esc(dateLabel(change.latest.snapshot_date))}</b><span>${fmt(change.latest.tickets_sold_total)} бил. · ${money(change.latest.revenue_total, change.latest.currency)}${change.previous ? ` · изменение: ${change.ticketDelta >= 0 ? '+' : ''}${fmt(change.ticketDelta)} бил.${change.revenueDelta == null ? ' · другая валюта — без изменения выручки' : ` · ${change.revenueDelta >= 0 ? '+' : ''}${money(change.revenueDelta, change.latest.currency)}`}` : ' · предыдущего среза ещё нет'} · ${esc(change.latest.source_name || 'источник не привязан')}</span></div>`).join('') || '<div class="empty">Ежедневных срезов ещё нет.</div>'}${snapshotTimelines(detail.snapshots)}<div class="detail-notes">${detail.snapshots.map(snapshot => `${dateLabel(snapshot.snapshot_date)} · ${snapshot.operator_name || 'оператор не указан'} · ${snapshot.source_name || 'источник не привязан'}${snapshot.source_note ? ` · ${snapshot.source_note}` : ''}`).join('\n') || ''}</div>`; }
  if (state.detailTab === 'SOURCES') content = detail.documents.map(document => `<div class="detail-line"><b>${esc(documentTypeLabels[document.document_type] || document.document_type)} · ${esc(document.source_name)}</b><span>${esc(document.source_date || 'дата джерела не задана')} · ${esc(document.import_status)}${document.notes ? ` · ${esc(document.notes)}` : ''} · <button class="text-button" type="button" data-open-detail-document="${esc(document.id)}">ВІДКРИТИ</button></span></div>`).join('') || '<div class="empty">До цього концерту ще не прив’язано PDF або CSV-джерел.</div>';
  if (state.detailTab === 'CHANNELS') content = `<div class="truth-note">Подтверждённые показатели основаны только на оплаченных заказах с подтверждённым источником. Показатели рекламной платформы показаны отдельно.</div><div class="csv-table">${concertChannelPerformance(detail.campaigns, detail.orders, detail.channels || [], concert.currency || 'PLN')}</div>`;
  if (state.detailTab === 'FINANCE') content = detail.expenses.map(expense => `<div class="detail-line"><b>${esc(expense.description || expense.category)}</b><span>${esc(expense.expense_type)} · ${esc(expense.payment_status)} · ${money(expense.amount, expense.currency)}</span></div>`).join('') || '<div class="empty">Расходов ещё нет.</div>';
  if (state.detailTab === 'TRACKING') content = detail.links.map(link => `<div class="detail-line"><b>${esc(link.source_code)}</b><span>${esc(link.destination_url || link.statistical_url || 'Ссылка не задана')}</span></div>`).join('') || '<div class="empty">Ссылок для отслеживания ещё нет.</div>';
  if (state.detailTab === 'NOTES') content = `<div class="detail-notes">${esc(concert.notes || 'Заметок нет.')}</div>`;
  if (state.detailTab === 'HISTORY') content = detail.auditError ? '<div class="empty">Журнал змін недоступний для цієї ролі. Застосуйте міграцію 0004_manager_audit_read.sql.</div>' : detail.audit.map(entry => `<div class="detail-line"><b>${esc(entry.entity_type)} · ${esc(entry.action)}</b><span>${entry.created_at ? new Date(entry.created_at).toLocaleString('uk-UA') : 'час не зафіксовано'}</span></div>`).join('') || '<div class="empty">Змін цього концерту ще не зафіксовано.</div>';
  byId('concert-detail').innerHTML = `<p class="eyebrow">КАРТКА КОНЦЕРТУ · ${detail.server ? 'СПІЛЬНА БАЗА' : 'ОБМЕЖЕНИЙ ПЕРЕГЛЯД'}</p><h2>${esc(concert.event_name)}</h2><small>${esc(concert.city)} · ${esc(dateLabel(concert.event_date))} · ${esc(concert.venue || 'майданчик не задано')}</small><div class="detail-tabs">${tabs}</div><div class="detail-content">${content}</div><label class="quick-status">ШВИДКА ЗМІНА СТАТУСУ<select id="quick-status">${statuses.map(status => `<option value="${status}" ${status === concert.status ? 'selected' : ''}>${status.replace('_', ' ')}</option>`).join('')}</select></label><div class="detail-actions"><button class="button" type="button" id="edit-selected">РЕДАГУВАТИ</button></div>`;
  document.querySelectorAll('[data-detail-tab]').forEach(button => button.addEventListener('click', () => { state.detailTab = button.dataset.detailTab; renderConcertDetail(); }));
  const addSnapshot = document.querySelector('[data-add-snapshot]');
  if (addSnapshot) addSnapshot.addEventListener('click', () => openSnapshotForm(concert));
  document.querySelectorAll('[data-detail-action]').forEach(button => button.addEventListener('click', async () => {
    if (button.dataset.detailAction === 'source') { showView('documents'); await loadOperations(); openDocumentForm(concert); }
    if (button.dataset.detailAction === 'snapshot') openSnapshotForm(concert);
  }));
  const addDetailTask = document.querySelector('[data-add-detail-task]');
  if (addDetailTask) addDetailTask.addEventListener('click', () => openTaskForm(null, concert));
  document.querySelectorAll('[data-open-detail-document]').forEach(button => button.addEventListener('click', () => openDocumentRecord(detail.documents.find(document => document.id === button.dataset.openDetailDocument))));
  byId('quick-status').addEventListener('change', event => updateConcertStatus(concert.id, event.target.value));
  byId('edit-selected').addEventListener('click', () => openConcertForm(concert));
}

async function selectConcert(id) {
  const concert = state.concerts.find(item => item.id === id);
  if (!concert) return;
  state.selectedConcertId = id;
  state.detail = null; renderConcertDetail(); renderConcerts();
  const fallback = state.totals.get(id) || { tickets: 0, revenue: 0 };
  if (!state.session) { state.detail = { server: false, metric: { paid_tickets: fallback.tickets, gross_revenue: fallback.revenue }, orders: [], snapshots: [], documents: [], tasks: [], expenses: [], campaigns: [], channels: [], links: [] }; renderConcertDetail(); return; }
  const [metricsResult, ordersResult, snapshotsResult, expensesResult, campaignsResult, linksResult, operatorsResult, documentsResult, tasksResult, channelsResult] = await Promise.all([
    db.rpc('daria_concert_metrics'), db.from('daria_orders').select('*').eq('concert_id', id).order('order_date', { ascending: false }), db.from('daria_daily_sales_snapshots').select('*').eq('concert_id', id).order('snapshot_date', { ascending: false }), db.from('daria_expenses').select('*').eq('concert_id', id).order('due_date'), db.from('daria_campaigns').select('*').eq('concert_id', id), db.from('daria_tracking_links').select('*').eq('concert_id', id), db.from('daria_ticketing_operators').select('id,name'), db.from('daria_source_documents').select('*'), db.from('daria_operational_tasks').select('*').eq('concert_id', id).order('due_date', { ascending: true, nullsFirst: false }), db.from('daria_sales_channels').select('id,name')
  ]);
  const metric = metricsResult.data?.find(item => item.concert_id === id) || { paid_tickets: fallback.tickets, gross_revenue: fallback.revenue };
  const allDocuments = documentsResult.data || [];
  const snapshots = (snapshotsResult.data || []).map(snapshot => ({ ...snapshot, operator_name: (operatorsResult.data || []).find(operator => operator.id === snapshot.operator_id)?.name, source_name: allDocuments.find(document => document.id === snapshot.source_document_id)?.source_name }));
  const sourceDocumentIds = new Set(snapshots.map(snapshot => snapshot.source_document_id).filter(Boolean));
  const documents = allDocuments.filter(document => document.concert_id === id || sourceDocumentIds.has(document.id));
  const relatedIds = [id, ...(ordersResult.data || []).map(item => item.id), ...snapshots.map(item => item.id), ...(tasksResult.data || []).map(item => item.id), ...(expensesResult.data || []).map(item => item.id), ...(campaignsResult.data || []).map(item => item.id), ...(linksResult.data || []).map(item => item.id)];
  const auditResult = await db.from('daria_audit_log').select('action,entity_type,entity_id,created_at').in('entity_id', relatedIds).order('created_at', { ascending: false }).limit(30);
  state.detail = { server: !metricsResult.error, metric, orders: ordersResult.data || [], snapshots, documents, tasks: tasksResult.data || [], expenses: expensesResult.data || [], campaigns: campaignsResult.data || [], channels: channelsResult.data || [], links: linksResult.data || [], audit: auditResult.data || [], auditError: auditResult.error };
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

async function openSnapshotForm(concert) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб додати щоденний зріз.')) return;
  if (!state.operators.length) {
    const { data } = await db.from('daria_ticketing_operators').select('id,name').order('name');
    state.operators = data || [];
  }
  await loadDocumentsModule();
  const documents = state.documents.filter(document => !document.concert_id || document.concert_id === concert.id);
  if (!documents.length) { setStatus('Спочатку завантажте PDF або CSV-джерело для цього концерту.', true); showView('documents'); return; }
  if (!state.operators.length) { setStatus('Спочатку додайте або підтвердьте квиткового оператора.', true); showView('operators'); return; }
  const form = byId('snapshot-form'); form.reset(); form.hidden = false;
  byId('snapshot-form-title').textContent = `Зріз · ${concert.event_name}`;
  byId('snapshot-form-note').textContent = ''; form.elements.concert_id.value = concert.id; form.elements.currency.value = concert.currency || 'PLN'; form.elements.snapshot_date.value = new Date().toISOString().slice(0, 10);
  setSelectOptions('snapshot-operator', state.operators.map(operator => `<option value="${esc(operator.id)}">${esc(operator.name)}</option>`).join(''));
  setSelectOptions('snapshot-source-document', documents.map(document => `<option value="${esc(document.id)}">${esc(document.source_name)} · ${esc(document.source_date || 'без дати')}</option>`).join(''));
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveSnapshot(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти щоденний зріз.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const payload = { concert_id: raw.concert_id, operator_id: raw.operator_id, snapshot_date: raw.snapshot_date, tickets_sold_total: Number(raw.tickets_sold_total), revenue_total: Number(raw.revenue_total), currency: raw.currency.trim().toUpperCase() || 'PLN', source_document_id: raw.source_document_id, source_note: raw.source_note.trim() };
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('snapshot-form-note').textContent = 'Збереження зрізу…';
  const { error } = await db.from('daria_daily_sales_snapshots').upsert(payload, { onConflict: 'concert_id,operator_id,snapshot_date' });
  submit.disabled = false;
  if (error) { byId('snapshot-form-note').textContent = `Зріз не збережено: ${error.message}`; return; }
  form.hidden = true; setStatus('Щоденний зріз збережено з прив’язаним джерелом'); await selectConcert(raw.concert_id);
}

function taskIsOpen(task) { return ['OPEN', 'IN_PROGRESS'].includes(task.task_status); }

function renderTasks() {
  const filter = byId('task-status-filter').value;
  const tasks = state.tasks.filter(task => filter === 'ALL' || (filter === 'OPEN' ? taskIsOpen(task) : task.task_status === filter));
  const today = new Date().toISOString().slice(0, 10);
  byId('task-list').innerHTML = tasks.map(task => {
    const concert = state.concerts.find(item => item.id === task.concert_id);
    const overdue = taskIsOpen(task) && task.due_date && task.due_date < today;
    return `<article class="expense-row"><div><small>${esc(task.priority)} · ${esc(task.task_status)}${overdue ? ' · ПРОСТРОЧЕНО' : ''}</small><h3>${esc(task.title)}</h3><small>${esc(concert ? `${concert.event_name} · ${concert.city}` : 'не прив’язано до концерту')} · ${task.due_date ? esc(dateLabel(task.due_date)) : 'строк не задано'}</small></div><div class="expense-meta"><span>${esc(task.details || 'без деталей')}</span><span>${task.completed_at ? `виконано ${esc(new Date(task.completed_at).toLocaleString('uk-UA'))}` : ''}</span></div><button class="text-button" type="button" data-edit-task="${esc(task.id)}">РЕДАГУВАТИ</button></article>`;
  }).join('') || '<div class="empty">За цим фільтром задач немає.</div>';
  const open = state.tasks.filter(taskIsOpen), critical = open.filter(task => task.priority === 'CRITICAL'), overdue = open.filter(task => task.due_date && task.due_date < today);
  byId('t-open').textContent = fmt(open.length); byId('t-critical').textContent = fmt(critical.length); byId('t-overdue').textContent = fmt(overdue.length); byId('t-done').textContent = fmt(state.tasks.filter(task => task.task_status === 'DONE').length);
}

async function loadTasksModule() {
  if (!state.session) {
    ['t-open', 't-critical', 't-overdue', 't-done'].forEach(id => { byId(id).textContent = '—'; });
    byId('task-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы открыть задачи.</div>';
    byId('tasks-note').textContent = 'Задачи скрыты правилами доступа; пустой ответ не означает отсутствия работы.';
    state.tasks = []; return;
  }
  if (!state.concerts.length) await loadOperations();
  const { data, error } = await db.from('daria_operational_tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) { byId('tasks-note').classList.add('error'); byId('tasks-note').textContent = `Задачи не загружены: ${error.message}`; return; }
  state.tasks = data || []; renderTasks(); byId('tasks-note').classList.remove('error'); byId('tasks-note').textContent = 'Задачи фиксируют рабочее действие. Статус «выполнена» не подтверждает финансовый результат.';
}

function openTaskForm(task = null, concert = null, draft = {}) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб редагувати задачі.')) return;
  const form = byId('task-form'); form.reset(); form.hidden = false; byId('task-form-note').textContent = '';
  byId('task-form-mode').textContent = task ? 'РЕДАГУВАННЯ ЗАДАЧІ' : 'НОВА ЗАДАЧА'; byId('task-form-title').textContent = task ? task.title : 'Додати задачу'; form.elements.id.value = task?.id || '';
  const options = state.concerts.map(item => `<option value="${esc(item.id)}">${esc(item.event_name)} · ${esc(item.city)}</option>`).join(''); setSelectOptions('task-concert', options, true, 'НЕ ПРИВ’ЯЗАНО');
  const fields = ['concert_id', 'title', 'details', 'task_status', 'priority', 'due_date'];
  if (task) fields.forEach(field => { form.elements[field].value = task[field] ?? ''; });
  else {
    if (concert) form.elements.concert_id.value = concert.id;
    Object.entries(draft).forEach(([field, value]) => { if (form.elements[field]) form.elements[field].value = value; });
  }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveTask(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти задачу.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)), existing = state.tasks.find(task => task.id === raw.id);
  const payload = { concert_id: raw.concert_id || null, title: raw.title.trim(), details: raw.details.trim(), task_status: raw.task_status, priority: raw.priority, due_date: raw.due_date || null, completed_at: raw.task_status === 'DONE' ? existing?.completed_at || new Date().toISOString() : null, updated_at: new Date().toISOString() };
  if (!raw.id) payload.created_by = state.session.user.id;
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('task-form-note').textContent = 'Збереження…';
  const result = raw.id ? await db.from('daria_operational_tasks').update(payload).eq('id', raw.id) : await db.from('daria_operational_tasks').insert(payload);
  submit.disabled = false;
  if (result.error) { byId('task-form-note').textContent = `Задачу не збережено: ${result.error.message}`; return; }
  form.hidden = true; setStatus(raw.id ? 'Задачу оновлено' : 'Задачу додано'); await loadTasksModule();
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
    ['m-active', 'm-tickets', 'm-revenue', 'm-spend', 'm-mandatory', 'm-projected', 'm-risk', 'm-stale'].forEach(id => { byId(id).textContent = '—'; });
    byId('dashboard-concerts').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы увидеть операционные данные.</div>';
    byId('dashboard-attention').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы увидеть проверку данных.</div>';
    byId('concerts-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы открыть реестр концертов.</div>';
    byId('dashboard-note').classList.remove('error');
    byId('dashboard-note').textContent = 'Данные скрыты правилами доступа. Пустой ответ без входа не трактуется как ноль.';
    state.concerts = [];
    state.totals = new Map();
    return;
  }
  const [concertsResult, ordersResult, campaignsResult, expensesResult, snapshotsResult, documentsResult, tasksResult] = await Promise.all([
    db.from('daria_concerts').select('*').order('event_date', { ascending: true, nullsFirst: false }),
    db.from('daria_orders').select('concert_id,ticket_count,gross_revenue,status'),
    db.from('daria_campaigns').select('concert_id,actual_spend'),
    db.from('daria_expenses').select('concert_id,amount,currency,expense_type,payment_status,due_date'),
    db.from('daria_daily_sales_snapshots').select('concert_id,snapshot_date'),
    db.from('daria_documents').select('concert_id'),
    db.from('daria_operational_tasks').select('concert_id,title,task_status')
  ]);
  const errors = [];
  if (concertsResult.error) errors.push(`concerts: ${concertsResult.error.message}`);
  if (ordersResult.error) errors.push(`orders: ${ordersResult.error.message}`);
  if (campaignsResult.error) errors.push(`campaigns: ${campaignsResult.error.message}`);
  if (expensesResult.error) errors.push(`expenses: ${expensesResult.error.message}`);
  if (snapshotsResult.error) errors.push(`daily snapshots: ${snapshotsResult.error.message}`);
  if (documentsResult.error) errors.push(`documents: ${documentsResult.error.message}`);
  if (concertsResult.error) {
    byId('dashboard-concerts').innerHTML = '<div class="empty">Нет доступа к реестру концертов. Войдите в рабочий аккаунт.</div>';
    byId('dashboard-attention').innerHTML = '<div class="empty">Нет доступа к реестру концертов.</div>';
    byId('concerts-list').innerHTML = '<div class="empty">Не удалось загрузить концерты.</div>';
  } else state.concerts = concertsResult.data || [];
  state.totals = new Map();
  const paidOrders = ordersResult.error ? [] : (ordersResult.data || []).filter(order => order.status === 'PAID');
  paidOrders.forEach(order => {
    const total = state.totals.get(order.concert_id) || { tickets: 0, revenue: 0 };
    total.tickets += Number(order.ticket_count) || 0;
    total.revenue += Number(order.gross_revenue) || 0;
    state.totals.set(order.concert_id, total);
  });
  state.concertFinance = new Map(state.concerts.map(concert => [concert.id, { marketing: new Map(), mandatory: new Map(), nextMandatory: null }]));
  (campaignsResult.data || []).forEach(campaign => {
    const finance = state.concertFinance.get(campaign.concert_id); if (!finance) return;
    const currency = state.concerts.find(concert => concert.id === campaign.concert_id)?.currency || 'PLN';
    finance.marketing.set(currency, (finance.marketing.get(currency) || 0) + (Number(campaign.actual_spend) || 0));
  });
  (expensesResult.data || []).filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && !['PAID', 'REFUNDED'].includes(expense.payment_status)).forEach(expense => {
    const finance = state.concertFinance.get(expense.concert_id); if (!finance) return;
    const currency = expense.currency || 'PLN';
    finance.mandatory.set(currency, (finance.mandatory.get(currency) || 0) + (Number(expense.amount) || 0));
    if (!finance.nextMandatory || (expense.due_date && (!finance.nextMandatory.due_date || expense.due_date < finance.nextMandatory.due_date))) finance.nextMandatory = expense;
  });
  byId('m-active').textContent = concertsResult.error ? '!' : state.concerts.filter(concert => ['ACTIVE', 'ON_SALE'].includes(concert.status)).length;
  byId('m-tickets').textContent = ordersResult.error ? '!' : fmt(paidOrders.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('m-revenue').textContent = ordersResult.error ? '!' : currencyTotals(paidOrders, 'gross_revenue');
  const campaignSpend = new Map();
  (campaignsResult.data || []).forEach(campaign => {
    const currency = state.concerts.find(concert => concert.id === campaign.concert_id)?.currency || 'PLN';
    campaignSpend.set(currency, (campaignSpend.get(currency) || 0) + (Number(campaign.actual_spend) || 0));
  });
  byId('m-spend').textContent = campaignsResult.error ? '!' : formatCurrencyMap(campaignSpend);
  const mandatory = expensesResult.error ? [] : (expensesResult.data || []).filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && !['PAID', 'REFUNDED'].includes(expense.payment_status));
  const paid = expensesResult.error ? [] : (expensesResult.data || []).filter(expense => expense.expense_type === 'ALREADY_PAID' && expense.payment_status === 'PAID');
  const operationalResult = amountMap(paidOrders, 'gross_revenue');
  [paid, mandatory].forEach(items => items.forEach(item => {
    const currency = item.currency || 'PLN';
    operationalResult.set(currency, (operationalResult.get(currency) || 0) - (Number(item.amount) || 0));
  }));
  byId('m-mandatory').textContent = expensesResult.error ? '!' : currencyTotals(mandatory);
  byId('m-projected').textContent = expensesResult.error || ordersResult.error ? '!' : formatCurrencyMap(operationalResult);
  byId('m-risk').textContent = concertsResult.error ? '!' : state.concerts.filter(concert => ['YELLOW', 'RED'].includes(concert.risk_status)).length;
  const latestSnapshots = new Map();
  (snapshotsResult.data || []).forEach(snapshot => {
    const previous = latestSnapshots.get(snapshot.concert_id);
    if (!previous || String(snapshot.snapshot_date) > String(previous)) latestSnapshots.set(snapshot.concert_id, snapshot.snapshot_date);
  });
  const freshCutoff = new Date(); freshCutoff.setHours(0, 0, 0, 0); freshCutoff.setDate(freshCutoff.getDate() - 2);
  const staleSnapshots = state.concerts.filter(concert => ['ACTIVE', 'ON_SALE'].includes(concert.status) && (!latestSnapshots.get(concert.id) || new Date(`${latestSnapshots.get(concert.id)}T12:00:00`) < freshCutoff));
  const concertSources = new Set((documentsResult.data || []).map(document => document.concert_id).filter(Boolean));
  const sourceMissing = state.concerts.filter(concert => ['ACTIVE', 'ON_SALE'].includes(concert.status) && !concertSources.has(concert.id));
  byId('m-stale').textContent = snapshotsResult.error ? '!' : fmt(staleSnapshots.length);
  const openTaskKeys = new Set((tasksResult.data || []).filter(task => taskIsOpen(task)).map(task => `${task.concert_id}:${task.title}`));
  renderDashboardAttention(staleSnapshots, sourceMissing, Boolean(snapshotsResult.error || documentsResult.error || concertsResult.error), openTaskKeys);
  const note = byId('dashboard-note');
  note.classList.toggle('error', errors.length > 0);
  note.textContent = errors.length ? `Частину даних не завантажено — нулі не підставлено. ${errors.join(' · ')}` : `Факт: PAID orders, внесені витрати та campaigns.actual_spend. «Без свіжого зрізу» означає відсутність нового підтвердженого звіту для ${fmt(staleSnapshots.length)} активних концертів, а не відсутність продажів.`;
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

const documentBucket = 'legacy-brain-source-documents';
const documentTypeLabels = { PDF_REPORT: 'ОТЧЁТ ДОКУМЕНТОМ', META_CSV: 'ВЫГРУЗКА РЕКЛАМЫ', OPERATOR_CSV: 'ВЫГРУЗКА ОПЕРАТОРА', OTHER_CSV: 'ДРУГАЯ ВЫГРУЗКА' };
let metaSourceRows = [];
const importNumber = value => Number(String(value ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
function metaRowsFromCsv(text) {
  const rows = parseCsv(text, csvDelimiter(text)); if (rows.length < 2) return [];
  const headers = rows[0], column = phrase => headers.findIndex(header => header.toLowerCase().includes(phrase));
  const campaign = column('название кампании'), spend = column('потраченная сумма'), purchases = column('покупки'), impressions = column('показы'), reach = column('охват'), linkClicks = column('клики по ссылке'), landingPageViews = column('просмотры целевой страницы'), roas = headers.findIndex(header => header.toLowerCase().includes('результаты') && header.toLowerCase().includes('roas'));
  return rows.slice(1).map(row => ({ name: String(row[campaign] || '').trim(), spend: importNumber(row[spend]), purchases: importNumber(row[purchases]), impressions: importNumber(row[impressions]), reach: importNumber(row[reach]), linkClicks: importNumber(row[linkClicks]), landingPageViews: importNumber(row[landingPageViews]), roas: importNumber(row[roas]) })).filter(row => row.name);
}
async function metaRowsForDocument(document) {
  const { data, error } = await db.storage.from(documentBucket).createSignedUrl(document.storage_path, 300); if (error) throw error;
  const response = await fetch(data.signedUrl, { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return metaRowsFromCsv(await response.text());
}
function applyMetaSourceRow() {
  const form = byId('meta-apply-form'), row = metaSourceRows[Number(form.elements.meta_source_row.value)]; if (!row) return;
  form.elements.actual_spend.value = row.spend || 0; form.elements.platform_impressions.value = row.impressions || 0; form.elements.platform_reach.value = row.reach || 0; form.elements.platform_link_clicks.value = row.linkClicks || 0; form.elements.platform_landing_page_views.value = row.landingPageViews || 0; form.elements.platform_orders.value = row.purchases || 0; form.elements.platform_value.value = row.roas ? (row.spend * row.roas).toFixed(2) : '';
  const campaign = state.campaigns.find(item => item.campaign_name.trim().toLowerCase() === row.name.toLowerCase()); if (campaign) form.elements.campaign_id.value = campaign.id;
}

function renderDocuments() {
  const documents = state.documents;
  byId('d-total').textContent = fmt(documents.length);
  byId('d-pdf').textContent = fmt(documents.filter(document => document.document_type === 'PDF_REPORT').length);
  byId('d-review').textContent = fmt(documents.filter(document => document.document_type !== 'PDF_REPORT' && ['NEW', 'REVIEWED'].includes(document.import_status)).length);
  byId('d-applied').textContent = fmt(documents.filter(document => document.import_status === 'APPLIED').length);
  byId('document-list').innerHTML = documents.map(document => {
    const concert = state.concerts.find(item => item.id === document.concert_id);
    const preview = document.document_type === 'PDF_REPORT' ? '' : `<button class="text-button" type="button" data-preview-csv="${esc(document.id)}">ПЕРЕГЛЯД CSV</button>`;
    const apply = document.document_type === 'META_CSV' ? `<button class="text-button" type="button" data-apply-meta="${esc(document.id)}">ЗАСТОСУВАТИ META</button>` : '';
    return `<article class="expense-row"><div><small>${esc(documentTypeLabels[document.document_type] || document.document_type)} · ${esc(document.import_status)}</small><h3>${esc(document.source_name)}</h3><small>${esc(concert?.event_name || 'не прив’язано до концерту')} · ${esc(document.source_date || 'дата джерела не задана')}</small></div><div class="expense-meta"><span>${esc(document.notes || 'без нотатки')}</span><span>${document.created_at ? new Date(document.created_at).toLocaleString('uk-UA') : ''}</span></div><div class="document-actions">${preview}${apply}<button class="text-button" type="button" data-open-document="${esc(document.id)}">ВІДКРИТИ</button></div></article>`;
  }).join('') || '<div class="empty">Документів ще немає.</div>';
}

async function loadDocumentsModule() {
  if (!state.session) {
    ['d-total', 'd-pdf', 'd-review', 'd-applied'].forEach(id => { byId(id).textContent = '—'; });
    byId('document-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб відкрити документи.</div>';
    byId('documents-note').textContent = 'Документи захищені політиками доступу; порожня відповідь не означає, що їх немає.';
    state.documents = [];
    return;
  }
  if (!state.concerts.length) await loadOperations();
  const { data, error } = await db.from('daria_source_documents').select('*').order('source_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) { byId('documents-note').classList.add('error'); byId('documents-note').textContent = `Документи не завантажено: ${error.message}`; return; }
  state.documents = data || [];
  renderDocuments();
  byId('documents-note').classList.remove('error');
  byId('documents-note').textContent = 'PDF — первинне джерело. CSV Meta та операторів зберігається для перевірки й не змінює дані автоматично.';
}

function openDocumentForm(concert = null) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб завантажити документ.')) return;
  const form = byId('document-form');
  form.reset(); form.hidden = false; byId('document-form-note').textContent = '';
  const options = state.concerts.map(concert => `<option value="${esc(concert.id)}">${esc(concert.event_name)} · ${esc(concert.city)}</option>`).join('');
  setSelectOptions('document-concert', options, true, 'НЕ ПРИВ’ЯЗАНО');
  if (concert) form.elements.concert_id.value = concert.id;
}

async function saveDocument(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб завантажити документ.')) return;
  const form = event.currentTarget, file = form.elements.file.files[0];
  const allowed = ['application/pdf', 'text/csv', 'application/csv'];
  if (!file || (!allowed.includes(file.type) && !/\.(pdf|csv)$/i.test(file.name))) { byId('document-form-note').textContent = 'Додайте PDF або CSV файл.'; return; }
  if (file.size > 20971520) { byId('document-form-note').textContent = 'Максимальний розмір файлу — 20 MB.'; return; }
  const raw = Object.fromEntries(new FormData(form));
  const extension = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const storagePath = `${state.session.user.id}/${Date.now()}-${safeName || `source.${extension}`}`;
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('document-form-note').textContent = 'Завантаження файлу…';
  const upload = await db.storage.from(documentBucket).upload(storagePath, file, { contentType: file.type || (extension === 'pdf' ? 'application/pdf' : 'text/csv'), upsert: false });
  if (upload.error) { submit.disabled = false; byId('document-form-note').textContent = `Файл не завантажено: ${upload.error.message}`; return; }
  const payload = { concert_id: raw.concert_id || null, document_type: raw.document_type, source_name: file.name, storage_path: storagePath, mime_type: file.type || (extension === 'pdf' ? 'application/pdf' : 'text/csv'), source_date: raw.source_date || null, import_status: raw.import_status, notes: raw.notes.trim(), uploaded_by: state.session.user.id };
  const result = await db.from('daria_source_documents').insert(payload);
  submit.disabled = false;
  if (result.error) { await db.storage.from(documentBucket).remove([storagePath]); byId('document-form-note').textContent = `Опис документа не збережено: ${result.error.message}`; return; }
  form.hidden = true; setStatus('Джерело збережено у Legacy Brain'); await loadDocumentsModule();
}

async function openDocument(id) {
  return openDocumentRecord(state.documents.find(item => item.id === id));
}

async function openDocumentRecord(document) {
  if (!document) return;
  const { data, error } = await db.storage.from(documentBucket).createSignedUrl(document.storage_path, 300);
  if (error) { setStatus(`Документ не відкрито: ${error.message}`, true); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

function csvDelimiter(text) {
  const line = text.replace(/^\uFEFF/, '').split(/\r?\n/).find(value => value.trim()) || '';
  return [';', ',', '\t'].reduce((best, delimiter) => (line.split(delimiter).length > line.split(best).length ? delimiter : best), ',');
}

function parseCsv(text, delimiter) {
  const rows = [[]]; let field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index], next = text[index + 1];
    if (character === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === delimiter) { rows.at(-1).push(field.trim()); field = ''; continue; }
    if (!quoted && (character === '\n' || character === '\r')) { if (character === '\r' && next === '\n') index += 1; rows.at(-1).push(field.trim()); field = ''; rows.push([]); continue; }
    field += character;
  }
  rows.at(-1).push(field.trim());
  return rows.filter(row => row.some(cell => cell));
}

let orderImport = null;
const normaliseHeader = value => String(value || '').trim().toLowerCase().replace(/[ _.-]+/g, '');
const importFieldHints = { external_order_id: ['orderid', 'order', 'numerzamowienia', 'idzamowienia'], ticket_count: ['tickets', 'ticketcount', 'bilety', 'iloscbiletow'], gross_revenue: ['revenue', 'gross', 'amount', 'kwota', 'przychod'], order_date: ['date', 'orderdate', 'data', 'datazamowienia'], status: ['status', 'orderstatus', 'stan'] };
function importColumnOptions(headers, selected = '') { return `<option value="">НЕ ВЫБРАНО</option>${headers.map((header, index) => `<option value="${index}" ${String(index) === String(selected) ? 'selected' : ''}>${esc(header)}</option>`).join('')}`; }
function openOrderImport() {
  if (!requireEditor('Войдите через рабочую почту, чтобы импортировать продажи.')) return;
  const form = byId('order-import-form'); form.reset(); form.hidden = false; orderImport = null;
  setSelectOptions('import-concert', state.concerts.map(item => `<option value="${esc(item.id)}">${esc(item.event_name)} · ${esc(item.city)}</option>`).join(''));
  setSelectOptions('import-operator', state.operators.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''));
  form.querySelectorAll('.import-column').forEach(select => { select.innerHTML = '<option value="">СНАЧАЛА ВЫБЕРИТЕ ФАЙЛ</option>'; });
  byId('order-import-preview').textContent = 'Выберите файл. До подтверждения ни один заказ не будет добавлен.'; byId('confirm-order-import').disabled = true;
}
function numberFromImport(value) { return Number(String(value ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '')); }
function prepareOrderImport() {
  const form = byId('order-import-form'); if (!orderImport) return;
  const fields = Object.fromEntries(new FormData(form)); const required = ['external_order_id', 'ticket_count', 'gross_revenue'];
  if (required.some(field => fields[field] === '')) { byId('order-import-preview').textContent = 'Выберите номер заказа, количество билетов и выручку.'; byId('confirm-order-import').disabled = true; return; }
  const rows = orderImport.rows.slice(1).map((row, index) => ({ row, index: index + 2 })).filter(item => item.row.some(Boolean));
  const invalid = rows.filter(item => !item.row[fields.external_order_id] || !(numberFromImport(item.row[fields.ticket_count]) > 0) || !(numberFromImport(item.row[fields.gross_revenue]) >= 0));
  const valid = rows.length - invalid.length;
  byId('order-import-preview').innerHTML = `<p><b>Проверка файла:</b> ${fmt(rows.length)} строк. Готово к проверке: ${fmt(valid)}. Ошибок формата: ${fmt(invalid.length)}.</p><p>Перед записью система отдельно проверит дубли у выбранного оператора. Строки с ошибками не будут импортированы.</p>`;
  byId('confirm-order-import').disabled = valid === 0;
}
async function readOrderImportFile(event) {
  const file = event.target.files[0]; if (!file) return;
  if (!/\.csv$/i.test(file.name)) { byId('order-import-preview').textContent = 'Нужна табличная выгрузка в формате CSV.'; return; }
  const rows = parseCsv(await file.text(), csvDelimiter(await file.text()));
  if (rows.length < 2) { byId('order-import-preview').textContent = 'В файле нет строк для импорта.'; return; }
  orderImport = { rows, headers: rows[0] };
  byId('order-import-form').querySelectorAll('.import-column').forEach(select => {
    const hints = importFieldHints[select.name] || [], found = rows[0].findIndex(header => hints.includes(normaliseHeader(header)));
    select.innerHTML = importColumnOptions(rows[0], found >= 0 ? found : '');
  }); prepareOrderImport();
}
async function saveOrderImport(event) {
  event.preventDefault(); if (!requireEditor('Войдите через рабочую почту, чтобы подтвердить импорт.')) return; if (!orderImport) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)); prepareOrderImport(); if (byId('confirm-order-import').disabled) return;
  const rows = orderImport.rows.slice(1).map(row => ({ external_order_id: String(row[raw.external_order_id] || '').trim(), ticket_count: numberFromImport(row[raw.ticket_count]), gross_revenue: numberFromImport(row[raw.gross_revenue]), order_date: raw.order_date === '' ? null : row[raw.order_date] || null, status: raw.status === '' ? 'PAID' : (String(row[raw.status] || 'PAID').trim().toUpperCase() === 'REFUNDED' ? 'REFUNDED' : 'PAID') })).filter(item => item.external_order_id && item.ticket_count > 0 && item.gross_revenue >= 0);
  const ids = [...new Set(rows.map(item => item.external_order_id))]; const { data: existing, error } = await db.from('daria_orders').select('external_order_id').eq('operator_id', raw.operator_id).in('external_order_id', ids);
  if (error) { byId('order-import-note').textContent = `Не удалось проверить дубли: ${error.message}`; return; }
  const duplicates = new Set((existing || []).map(item => item.external_order_id)), seen = new Set(); const fresh = rows.filter(item => { if (duplicates.has(item.external_order_id) || seen.has(item.external_order_id)) return false; seen.add(item.external_order_id); return true; }).map(item => ({ ...item, concert_id: raw.concert_id, operator_id: raw.operator_id, currency: raw.currency, attribution_type: 'UNKNOWN', notes: 'Импорт из CSV после проверки' }));
  const skipped = rows.length - fresh.length;
  if (!fresh.length) { byId('order-import-note').textContent = `Новых заказов нет: ${fmt(skipped)} строк уже есть у оператора или повторяются в файле.`; return; }
  const result = await db.from('daria_orders').insert(fresh);
  if (result.error) { byId('order-import-note').textContent = `Импорт не выполнен: ${result.error.message}`; return; }
  byId('order-import-note').textContent = `Добавлено ${fmt(fresh.length)} заказов. Пропущено повторов: ${fmt(skipped)}.`; form.reset(); orderImport = null; byId('confirm-order-import').disabled = true; await loadSalesModule(); await loadDocumentsModule();
}

async function previewCsvDocument(id) {
  const document = state.documents.find(item => item.id === id), preview = byId('csv-preview');
  if (!document) return;
  preview.hidden = false; preview.textContent = 'Завантаження preview…';
  const { data, error } = await db.storage.from(documentBucket).createSignedUrl(document.storage_path, 300);
  if (error) { preview.textContent = `CSV не відкрито: ${error.message}`; preview.classList.add('error'); return; }
  const response = await fetch(data.signedUrl, { cache: 'no-store' });
  if (!response.ok) { preview.textContent = `CSV не завантажено: HTTP ${response.status}`; preview.classList.add('error'); return; }
  const csvText = await response.text();
  const rows = parseCsv(csvText, csvDelimiter(csvText));
  if (!rows.length) { preview.textContent = 'CSV порожній або не має читабельних рядків.'; preview.classList.add('error'); return; }
  const headers = rows[0], samples = rows.slice(1, 7);
  preview.classList.remove('error');
  preview.innerHTML = `<p class="eyebrow">PREVIEW · ${esc(document.source_name)}</p><p>Виявлено ${fmt(Math.max(0, rows.length - 1))} рядків і ${fmt(headers.length)} колонок. Це лише перегляд: жоден рядок не застосовано до кампаній або продажів.</p><div class="csv-table"><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${samples.map(row => `<tr>${headers.map((_, index) => `<td>${esc(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

async function openMetaApplyForm(id) {
  if (!requireEditor('Увійдіть через робочу пошту, щоб застосувати перевірений Meta CSV.')) return;
  const document = state.documents.find(item => item.id === id);
  if (!document || document.document_type !== 'META_CSV') return;
  if (!state.campaigns.length) await loadChannelsModule();
  if (!state.campaigns.length) { setStatus('Спочатку створіть кампанію для застосування Meta CSV.', true); return; }
  const form = byId('meta-apply-form'); form.reset(); form.hidden = false;
  form.elements.source_document_id.value = id; form.elements.rows_reviewed.value = '0'; byId('meta-apply-note').textContent = '';
  const options = state.campaigns.map(campaign => {
    const concert = state.concerts.find(item => item.id === campaign.concert_id);
    return `<option value="${esc(campaign.id)}">${esc(concert?.event_name || 'концерт')} · ${esc(campaign.campaign_name)} · ${esc(campaign.source_code)}</option>`;
  }).join('');
  setSelectOptions('meta-apply-campaign', options);
  try {
    metaSourceRows = await metaRowsForDocument(document);
    setSelectOptions('meta-source-row', metaSourceRows.map((row, index) => `<option value="${index}">${esc(row.name)} · расход ${money(row.spend)} · покупки ${fmt(row.purchases)}</option>`).join(''));
    applyMetaSourceRow(); byId('meta-apply-note').textContent = `Распознано строк: ${fmt(metaSourceRows.length)}. Проверьте кампанию перед применением.`;
  } catch (error) { metaSourceRows = []; setSelectOptions('meta-source-row', '<option value="">Не удалось прочитать выгрузку</option>'); byId('meta-apply-note').textContent = `Выгрузка не прочитана: ${error.message}`; }
}

async function applyMetaCsv(event) {
  event.preventDefault();
  if (!requireEditor('Увійдіть через робочу пошту, щоб застосувати перевірений Meta CSV.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('meta-apply-note').textContent = 'Застосування перевірених даних…';
  const { error } = await db.rpc('daria_apply_meta_csv_import', {
    p_source_document_id: raw.source_document_id,
    p_campaign_id: raw.campaign_id,
    p_actual_spend: Number(raw.actual_spend),
    p_platform_orders: Number(raw.platform_orders),
    p_platform_value: Number(raw.platform_value),
    p_rows_reviewed: Number(raw.rows_reviewed || 0)
  });
  if (error) { submit.disabled = false; byId('meta-apply-note').textContent = `Meta CSV не застосовано: ${error.message}`; return; }
  const delivery = await db.from('daria_campaigns').update({ platform_impressions: numberOrNull(raw.platform_impressions), platform_reach: numberOrNull(raw.platform_reach), platform_link_clicks: numberOrNull(raw.platform_link_clicks), platform_landing_page_views: numberOrNull(raw.platform_landing_page_views), entries: numberOrNull(raw.platform_landing_page_views), platform_metrics_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', raw.campaign_id);
  submit.disabled = false;
  if (delivery.error) { byId('meta-apply-note').textContent = `Основные показатели применены, но охват и переходы не сохранены: ${delivery.error.message}`; return; }
  form.hidden = true; setStatus('Перевірені дані Meta CSV застосовано до кампанії');
  await Promise.all([loadDocumentsModule(), loadChannelsModule(), loadOperations(), loadReportsModule()]);
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
  byId('channel-list').innerHTML = state.channels.map(channel => `<article class="ops-concert"><div><small>${esc(channel.code)}</small><h3>${esc(channel.name)}</h3><small>${channel.is_active ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</small></div><button class="text-button" type="button" data-edit-channel="${esc(channel.id)}">ИЗМЕНИТЬ</button></article>`).join('') || '<div class="empty">Каналов ещё нет.</div>';
  byId('campaign-list').innerHTML = state.campaigns.map(campaign => {
    const channel = state.channels.find(item => item.id === campaign.channel_id);
    const concert = state.concerts.find(item => item.id === campaign.concert_id);
    const planned = Number(campaign.planned_budget || 0), actual = Number(campaign.actual_spend || 0), platformOrders = Number(campaign.platform_reported_orders || 0);
    const delta = actual - planned, currency = concert?.currency || 'PLN';
    const deltaLabel = delta === 0 ? 'по плану' : delta > 0 ? `+${money(delta, currency)} сверх плана` : `${money(Math.abs(delta), currency)} не использовано`;
    const latestImport = state.csvImports.find(item => item.campaign_id === campaign.id);
    const importNote = latestImport ? ` · выгрузка Meta: ${new Date(latestImport.applied_at).toLocaleDateString('ru-RU')} · проверено ${fmt(latestImport.rows_reviewed)} строк` : ' · выгрузка Meta ещё не применялась';
    const confirmed = state.campaignOrders.filter(order => order.campaign_id === campaign.id && order.status === 'PAID' && order.attribution_type === 'CONFIRMED');
    const confirmedTickets = confirmed.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0);
    const confirmedRevenue = confirmed.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0);
    const entries = Number(campaign.entries) || 0, impressions = Number(campaign.platform_impressions) || 0, reach = Number(campaign.platform_reach) || 0, linkClicks = Number(campaign.platform_link_clicks) || 0;
    const delivery = impressions || reach || linkClicks ? `<span>ОХВАТ: ${fmt(reach)} · ПОКАЗЫ: ${fmt(impressions)} · ПЕРЕХОДЫ: ${fmt(linkClicks)}${linkClicks && impressions ? ` · доля переходов ${ratio(linkClicks * 100, impressions, '%')}` : ''}</span>` : '';
    return `<article class="ops-concert"><div><small>${esc(label('campaignStatus', campaign.status))} · ${esc(label('attributionQuality', campaign.attribution_quality))} · ${esc(channel?.name || 'канал не указан')}</small><h3>${esc(campaign.campaign_name)}</h3><small>${esc(concert?.event_name || 'концерт не указан')} · план ${money(planned, currency)} · факт ${money(actual, currency)} · ${deltaLabel}${importNote}</small><div class="campaign-metrics">${delivery}<span>ПЛАТФОРМА: ${fmt(platformOrders)} заказов${platformOrders ? ` · ${money(actual / platformOrders, currency)} за заказ` : ''}</span><span>ПОДТВЕРЖДЕНО: ${fmt(confirmed.length)} заказов · ${fmt(confirmedTickets)} билетов · ${money(confirmedRevenue, currency)}</span><span>СТОИМОСТЬ: заказ ${ratio(actual, confirmed.length, ` ${currency}`)} · билет ${ratio(actual, confirmedTickets, ` ${currency}`)} · окупаемость ${ratio(confirmedRevenue, actual, '×')}</span>${entries ? `<span>КОНВЕРСИЯ ПЕРЕХОД → ЗАКАЗ: ${ratio(confirmed.length * 100, entries, '%')} · ${ratio(confirmedTickets, confirmed.length)} билета/заказ</span>` : ''}</div></div><button class="text-button" type="button" data-edit-campaign="${esc(campaign.id)}">ИЗМЕНИТЬ</button></article>`;
  }).join('') || '<div class="empty">Кампаний ещё нет.</div>';
  byId('tracking-link-list').innerHTML = state.trackingLinks.map(link => {
    const campaign = state.campaigns.find(item => item.id === link.campaign_id);
    const channel = state.channels.find(item => item.id === link.channel_id);
    return `<article class="expense-row"><div><small>${esc(label('linkStatus', link.status))} · ${esc(channel?.name || 'канал не указан')} · ${esc(campaign?.campaign_name || 'кампания не указана')}</small><h3>${esc(link.source_code)}</h3><small>${esc(link.destination_url || link.statistical_url || 'адрес не указан')}</small></div><strong class="expense-amount">${esc(link.utm_source || '—')} / ${esc(link.utm_medium || '—')}</strong><div class="expense-meta"><span>${esc(link.promo_code || 'без промокода')}</span><span>${link.utm_campaign ? `метка: ${esc(link.utm_campaign)}` : 'метка кампании не указана'}</span></div><button class="text-button" type="button" data-edit-link="${esc(link.id)}">ИЗМЕНИТЬ</button></article>`;
  }).join('') || '<div class="empty">Ссылок для учёта ещё нет.</div>';
  byId('c-active').textContent = state.campaigns.filter(campaign => ['TESTING', 'WORKING'].includes(campaign.status)).length;
  byId('c-spend').textContent = money(state.campaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0));
  byId('c-platform-orders').textContent = fmt(state.campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_orders) || 0), 0));
  byId('c-active-links').textContent = state.trackingLinks.filter(link => link.status === 'ACTIVE').length;
}

async function loadChannelsModule() {
  if (!state.session) {
    ['c-active', 'c-spend', 'c-platform-orders', 'c-active-links'].forEach(id => { byId(id).textContent = '—'; });
    byId('channel-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы загрузить каналы.</div>';
    byId('campaign-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы загрузить кампании.</div>';
    byId('tracking-link-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы загрузить ссылки.</div>';
    byId('channels-note').textContent = 'Данные скрыты правилами доступа; пустой ответ не означает отсутствия кампаний.';
    state.channels = []; state.campaigns = []; state.campaignOrders = []; state.trackingLinks = []; state.csvImports = [];
    return;
  }
  if (!state.concerts.length) await loadOperations();
  const [channelsResult, campaignsResult, linksResult, operatorsResult, importsResult, ordersResult] = await Promise.all([
    db.from('daria_sales_channels').select('*').order('name'),
    db.from('daria_campaigns').select('*').order('start_date', { ascending: false, nullsFirst: false }),
    db.from('daria_tracking_links').select('*').order('created_at', { ascending: false }),
    db.from('daria_ticketing_operators').select('id,name').order('name'),
    db.from('daria_csv_imports').select('campaign_id,rows_reviewed,applied_at').eq('import_kind', 'META_CSV').order('applied_at', { ascending: false }),
    db.from('daria_orders').select('campaign_id,ticket_count,gross_revenue,currency,status,attribution_type')
  ]);
  const errors = [channelsResult.error && `channels: ${channelsResult.error.message}`, campaignsResult.error && `campaigns: ${campaignsResult.error.message}`, linksResult.error && `links: ${linksResult.error.message}`, operatorsResult.error && `operators: ${operatorsResult.error.message}`, importsResult.error && `Meta imports: ${importsResult.error.message}`, ordersResult.error && `orders: ${ordersResult.error.message}`].filter(Boolean);
  if (errors.length) {
    byId('channels-note').classList.add('error');
    byId('channels-note').textContent = `Частину даних не завантажено: ${errors.join(' · ')}`;
    return;
  }
  state.channels = channelsResult.data || [];
  state.campaigns = campaignsResult.data || [];
  state.campaignOrders = ordersResult.data || [];
  state.trackingLinks = linksResult.data || [];
  state.operators = operatorsResult.data || state.operators;
  state.csvImports = importsResult.data || [];
  populateChannelOptions();
  renderChannels();
  byId('channels-note').classList.remove('error');
  byId('channels-note').textContent = 'Заказы по данным рекламной платформы не добавляются к подтверждённым продажам автоматически. Если применена выгрузка Meta, карточка кампании показывает дату и количество проверенных строк.';
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
  const fields = ['concert_id', 'channel_id', 'campaign_name', 'source_code', 'planned_budget', 'actual_spend', 'start_date', 'end_date', 'status', 'attribution_quality', 'entries', 'platform_impressions', 'platform_reach', 'platform_link_clicks', 'platform_reported_orders', 'platform_reported_value', 'notes'];
  if (campaign) fields.forEach(field => { form.elements[field].value = campaign[field] ?? ''; });
  else { form.elements.status.value = 'TESTING'; form.elements.attribution_quality.value = 'UNKNOWN'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openCampaignResultForm() {
  if (!requireEditor()) return;
  if (!state.campaigns.length) { setStatus('Сначала добавьте кампанию.', true); showView('channels'); return; }
  const form = byId('campaign-result-form'); form.reset(); form.hidden = false; byId('campaign-result-note').textContent = ''; byId('campaign-result-order').hidden = true;
  setSelectOptions('campaign-result-campaign', state.campaigns.map(campaign => `<option value="${esc(campaign.id)}">${esc(campaign.source_code)} · ${esc(campaign.campaign_name)}</option>`).join(''));
  const applyCampaign = () => { const campaign = state.campaigns.find(item => item.id === form.elements.campaign_id.value); if (!campaign) return; form.elements.actual_spend.value = campaign.actual_spend ?? 0; form.elements.entries.value = campaign.entries ?? ''; form.elements.platform_reported_orders.value = campaign.platform_reported_orders ?? ''; form.elements.platform_reported_value.value = campaign.platform_reported_value ?? ''; };
  form.elements.campaign_id.onchange = applyCampaign; applyCampaign(); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCampaignResult(event) {
  event.preventDefault(); if (!requireEditor()) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const payload = { actual_spend: Number(raw.actual_spend || 0), entries: numberOrNull(raw.entries), platform_landing_page_views: numberOrNull(raw.entries), platform_reported_orders: numberOrNull(raw.platform_reported_orders), platform_reported_value: numberOrNull(raw.platform_reported_value), updated_at: new Date().toISOString() };
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; byId('campaign-result-note').textContent = 'Сохранение…';
  const result = await db.from('daria_campaigns').update(payload).eq('id', raw.campaign_id); submit.disabled = false;
  if (result.error) { byId('campaign-result-note').textContent = `Ошибка: ${result.error.message}`; return; }
  byId('campaign-result-note').textContent = 'Показатели сохранены. Если есть подтверждённый заказ, внесите его отдельно.';
  byId('campaign-result-order').hidden = false;
  setStatus('Показатели кампании обновлены'); await Promise.all([loadChannelsModule(), loadReportsModule(), loadOperations()]);
}

async function openConfirmedOrderFromCampaignResult() {
  if (!requireEditor()) return;
  const campaignId = byId('campaign-result-form').elements.campaign_id.value;
  if (!campaignId) return;
  showView('sales');
  await loadSalesModule();
  const campaign = state.campaigns.find(item => item.id === campaignId);
  if (!campaign) { setStatus('Не удалось найти выбранную кампанию для заказа.', true); return; }
  openOrderForm();
  const form = byId('order-form');
  form.elements.campaign_id.value = campaign.id;
  form.elements.concert_id.value = campaign.concert_id;
  form.elements.source_code.value = campaign.source_code || '';
  form.elements.attribution_type.value = 'CONFIRMED';
  byId('order-form-note').textContent = 'Кампания и код источника подставлены. Внесите только подтверждённые данные заказа оператора.';
}

function sourceToken(value, fallback) {
  const translit = { А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'E',Ж:'ZH',З:'Z',И:'I',Й:'Y',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'H',Ц:'TS',Ч:'CH',Ш:'SH',Щ:'SCH',Ы:'Y',Э:'E',Ю:'YU',Я:'YA',І:'I',Ї:'YI',Є:'YE' };
  return String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split('').map(char => translit[char] || char).join('').replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || fallback;
}
function generateCampaignSourceCode() {
  const form = byId('campaign-form'), concert = state.concerts.find(item => item.id === form.elements.concert_id.value), channel = state.channels.find(item => item.id === form.elements.channel_id.value);
  if (!concert || !channel || !form.elements.campaign_name.value.trim()) return;
  const year = String(concert.event_date || '').slice(2, 4) || String(new Date().getFullYear()).slice(2);
  form.elements.source_code.value = `${sourceToken(concert.city, 'CITY').slice(0, 3)}${year}_${sourceToken(channel.code, 'CHANNEL')}_${sourceToken(form.elements.campaign_name.value, 'CAMPAIGN')}`;
}

async function saveCampaign(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти кампанію.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const code = raw.source_code.trim().toUpperCase();
  if (!/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(code)) { byId('campaign-form-note').textContent = 'Код источника должен состоять из латинских букв, цифр и подчёркиваний.'; return; }
  if (state.campaigns.some(item => item.source_code === code && item.id !== raw.id)) { byId('campaign-form-note').textContent = 'Такой код источника уже есть у другой кампании.'; return; }
  const id = raw.id, payload = { concert_id: raw.concert_id, channel_id: raw.channel_id, campaign_name: raw.campaign_name.trim(), source_code: code, planned_budget: Number(raw.planned_budget || 0), actual_spend: Number(raw.actual_spend || 0), start_date: raw.start_date || null, end_date: raw.end_date || null, status: raw.status, attribution_quality: raw.attribution_quality, entries: numberOrNull(raw.entries), platform_impressions: numberOrNull(raw.platform_impressions), platform_reach: numberOrNull(raw.platform_reach), platform_link_clicks: numberOrNull(raw.platform_link_clicks), platform_landing_page_views: numberOrNull(raw.entries), platform_reported_orders: numberOrNull(raw.platform_reported_orders), platform_reported_value: numberOrNull(raw.platform_reported_value), notes: raw.notes.trim(), updated_at: new Date().toISOString() };
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
  byId('tracking-form-mode').textContent = link ? 'РЕДАКТИРОВАНИЕ ССЫЛКИ' : 'НОВАЯ ССЫЛКА'; byId('tracking-form-title').textContent = link ? link.source_code : 'Добавить ссылку'; byId('tracking-form-note').textContent = ''; form.elements.id.value = link?.id || '';
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
  if (result.error) { byId('tracking-form-note').textContent = `Ошибка: ${result.error.message}`; return; }
  form.hidden = true; setStatus(id ? 'Ссылка обновлена' : 'Ссылка добавлена'); await loadChannelsModule();
}

function commission(value) { return value == null ? '—' : `${Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 4 })}%`; }

function known(value, formatter = value => value) { return value === null || value === undefined || value === '' ? 'НЕ ЗАФИКСИРОВАНО' : formatter(value); }
function capability(value) { return value === true ? 'ЕСТЬ' : 'НЕ ЗАФИКСИРОВАНО'; }
function operatorContact(operator) { return [operator.account_manager_name, operator.account_manager_email, operator.account_manager_phone].filter(Boolean).join(' · '); }
function renderOperators() {
  byId('operator-list').innerHTML = state.operators.map(operator => `<article class="operator-card"><p class="eyebrow">${esc(known(operator.legacy_recommendation))}</p><h2>${esc(operator.name)}</h2><p><b>Комиссия:</b> ${known(operator.marketplace_commission, commission)} / ${known(operator.own_sales_commission, commission)}</p><p><b>Учёт переходов:</b> пиксель ${capability(operator.supports_meta_pixel)} · серверная передача ${capability(operator.supports_capi)} · диспетчер тегов ${capability(operator.supports_gtm)}</p><p><b>Данные покупателей:</b> ${esc(known(operator.customer_data_access))}</p><p><b>Выплата:</b> ${esc(known(operator.payout_timing))}</p><p><b>Органическое распространение:</b> ${esc(known(operator.organic_distribution))}</p><p><b>Ответственный менеджер:</b> ${esc(known(operatorContact(operator)))}</p>${operator.last_offer_date ? `<p><b>Последнее предложение:</b> ${esc(dateLabel(operator.last_offer_date))}</p>` : ''}${operator.contract_notes ? `<p><b>Обоснование:</b> ${esc(operator.contract_notes)}</p>` : ''}<button class="text-button" type="button" data-edit-operator="${esc(operator.id)}">ИЗМЕНИТЬ</button></article>`).join('') || '<div class="empty">Операторов ещё нет.</div>';
  const rows = [
    ['Комиссия маркетплейса', operator => known(operator.marketplace_commission, commission)], ['Комиссия собственных продаж', operator => known(operator.own_sales_commission, commission)], ['Комиссия платежей', operator => known(operator.payment_provider_fee, commission)], ['Разовый запуск', operator => known(operator.setup_fee, value => money(value))], ['Ежемесячная плата', operator => known(operator.monthly_fee, value => money(value))], ['Пиксель рекламы', operator => capability(operator.supports_meta_pixel)], ['Серверная передача', operator => capability(operator.supports_capi)], ['Диспетчер тегов', operator => capability(operator.supports_gtm)], ['Маркетплейс', operator => capability(operator.has_marketplace)], ['Данные покупателей', operator => known(operator.customer_data_access)], ['Доступ к электронной почте', operator => known(operator.customer_email_access)], ['Доступ к телефонам', operator => known(operator.customer_phone_access)], ['Срок выплаты', operator => known(operator.payout_timing)], ['Статистические ссылки', operator => capability(operator.supports_statistical_links)], ['Промокоды', operator => capability(operator.supports_promo_codes)], ['Рассылки', operator => operator.sms_marketing_available || operator.email_marketing_available ? `${operator.sms_marketing_available ? 'СМС' : ''}${operator.sms_marketing_available && operator.email_marketing_available ? ' / ' : ''}${operator.email_marketing_available ? 'ПОЧТА' : ''}` : 'НЕ ЗАФИКСИРОВАНО'], ['Органическое распространение', operator => known(operator.organic_distribution)], ['Поддержка рекламы в Google', operator => known(operator.google_ads_support)], ['Поддержка рекламы в Meta', operator => known(operator.meta_ads_support)], ['Ответственный менеджер', operator => known(operatorContact(operator))], ['Последнее предложение', operator => known(operator.last_offer_date, dateLabel)], ['Эксклюзивность', operator => known(operator.exclusive_required)], ['Статус переговоров', operator => known(operator.negotiation_status)], ['Рекомендация Legacy', operator => known(operator.legacy_recommendation)]
  ];
  byId('operator-comparison').innerHTML = state.operators.length ? `<table><thead><tr><th>УСЛОВИЕ</th>${state.operators.map(operator => `<th>${esc(operator.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([title, value]) => `<tr><td>${title}</td>${state.operators.map(operator => `<td>${esc(value(operator))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty">Операторов ещё нет.</div>';
}

async function loadOperatorsModule() {
  if (!state.session) {
    byId('operator-list').innerHTML = '<div class="empty">Увійдіть у робочий акаунт, щоб завантажити операторів.</div>';
    byId('operator-comparison').innerHTML = '<div class="empty">Войдите, чтобы сравнить операторов.</div>';
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
  const fields = ['name', 'website', 'marketplace_commission', 'own_sales_commission', 'payment_provider_fee', 'setup_fee', 'monthly_fee', 'capi_fee', 'customer_data_access', 'customer_email_access', 'customer_phone_access', 'payout_timing', 'organic_distribution', 'google_ads_support', 'meta_ads_support', 'account_manager_name', 'account_manager_email', 'account_manager_phone', 'last_offer_date', 'exclusive_required', 'exclusive_terms', 'negotiation_status', 'legacy_recommendation', 'contract_notes', 'notes'];
  const flags = ['supports_meta_pixel', 'supports_capi', 'supports_gtm', 'supports_statistical_links', 'supports_promo_codes', 'has_marketplace', 'sms_marketing_available', 'email_marketing_available'];
  if (operator) { fields.forEach(field => { form.elements[field].value = operator[field] ?? ''; }); flags.forEach(flag => { form.elements[flag].checked = Boolean(operator[flag]); }); }
  else { form.elements.negotiation_status.value = 'TO_BE_CLARIFIED'; form.elements.legacy_recommendation.value = 'NEGOTIATING'; }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveOperator(event) {
  event.preventDefault(); if (!requireEditor('Увійдіть через робочу пошту, щоб зберегти оператора.')) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)), id = raw.id;
  const numberFields = ['marketplace_commission', 'own_sales_commission', 'payment_provider_fee', 'setup_fee', 'monthly_fee', 'capi_fee'];
  const textFields = ['website', 'customer_data_access', 'customer_email_access', 'customer_phone_access', 'payout_timing', 'organic_distribution', 'google_ads_support', 'meta_ads_support', 'account_manager_name', 'account_manager_email', 'account_manager_phone', 'exclusive_required', 'exclusive_terms', 'negotiation_status', 'legacy_recommendation', 'contract_notes', 'notes'];
  const flags = ['supports_meta_pixel', 'supports_capi', 'supports_gtm', 'supports_statistical_links', 'supports_promo_codes', 'has_marketplace', 'sms_marketing_available', 'email_marketing_available'];
  const payload = { name: raw.name.trim(), updated_at: new Date().toISOString() };
  numberFields.forEach(field => { payload[field] = numberOrNull(raw[field]); });
  textFields.forEach(field => { payload[field] = raw[field]?.trim() || (['contract_notes', 'notes'].includes(field) ? '' : null); });
  payload.last_offer_date = raw.last_offer_date || null;
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
  const currency = concert.currency || 'PLN';
  const paid = orders.filter(order => order.status === 'PAID');
  const paidTickets = paid.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0);
  const campaignOrders = paid.filter(order => order.campaign_id && order.attribution_type === 'CONFIRMED');
  const paidExpenses = expenses.filter(expense => expense.payment_status === 'PAID');
  const mandatory = expenses.filter(expense => expense.expense_type === 'MANDATORY_FUTURE' && expense.payment_status !== 'PAID');
  const spend = campaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0);
  const platformOrders = campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_orders) || 0), 0);
  const platformValue = campaigns.reduce((sum, campaign) => sum + (Number(campaign.platform_reported_value) || 0), 0);
  const confirmedGross = campaignOrders.reduce((sum, order) => sum + (Number(order.gross_revenue) || 0), 0);
  return `<article class="report-card"><p class="eyebrow">${esc(label('status', concert.status))} · ${esc(label('risk', concert.risk_status))}</p><h2>${esc(concert.event_name)}</h2><small>${esc(concert.city)} · ${esc(dateLabel(concert.event_date))} · ${esc(concert.venue || 'площадка не указана')}</small><div class="report-grid"><div class="report-item"><span>ОПЛАЧЕННЫЕ БИЛЕТЫ</span><strong>${fmt(paidTickets)}</strong></div><div class="report-item"><span>ВЫРУЧКА ПО ОПЛАЧЕННЫМ</span><strong>${currencyTotals(paid, 'gross_revenue')}</strong></div><div class="report-item"><span>ФАКТИЧЕСКИЕ РАСХОДЫ</span><strong>${money(spend, currency)}</strong></div><div class="report-item"><span>ОПЛАЧЕННЫЕ РАСХОДЫ</span><strong>${currencyTotals(paidExpenses)}</strong></div><div class="report-item"><span>ОБЯЗАТЕЛЬНО ОПЛАТИТЬ</span><strong>${currencyTotals(mandatory)}</strong></div><div class="report-item"><span>ОПЛАЧЕНО БЕЗ ИСТОЧНИКА</span><strong>${fmt(paid.filter(order => !order.campaign_id).reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0))}</strong></div><div class="report-item"><span>ЗАКАЗЫ ПО ДАННЫМ ПЛАТФОРМЫ</span><strong>${fmt(platformOrders)}</strong></div><div class="report-item"><span>КАМПАНИИ</span><strong>${campaigns.length}</strong></div></div><div class="report-meta"><div><b>СТОИМОСТЬ ЗАКАЗА ПО ПЛАТФОРМЕ</b>${ratio(spend, platformOrders, ` ${currency}`)}</div><div><b>СТОИМОСТЬ ПОДТВЕРЖДЁННОГО ЗАКАЗА</b>${ratio(spend, campaignOrders.length, ` ${currency}`)}</div><div><b>ОКУПАЕМОСТЬ ПО ПЛАТФОРМЕ</b>${ratio(platformValue, spend, '×')}</div></div></article>`;
}

function reportTable(headers, rows, emptyMessage) {
  if (!rows.length) return `<div class="empty">${esc(emptyMessage)}</div>`;
  return `<table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function renderChannelReport(metrics, concerts, concertIds, channelId) {
  const concertById = new Map(concerts.map(concert => [concert.id, concert]));
  const grouped = new Map();
  metrics.forEach(metric => {
    const concert = concertById.get(metric.concert_id);
    if (!concert || !concertIds.has(metric.concert_id) || (channelId !== 'ALL' && metric.channel_id !== channelId)) return;
    const currency = concert.currency || 'PLN';
    const key = `${metric.channel_id}:${currency}`;
    const row = grouped.get(key) || { name: metric.channel_name || 'Канал не указан', currency, campaigns: 0, spend: 0, platformOrders: 0, confirmedOrders: 0, confirmedTickets: 0, confirmedRevenue: 0 };
    row.campaigns += 1;
    row.spend += Number(metric.actual_spend) || 0;
    row.platformOrders += Number(metric.platform_reported_orders) || 0;
    row.confirmedOrders += Number(metric.confirmed_paid_orders) || 0;
    row.confirmedTickets += Number(metric.confirmed_paid_tickets) || 0;
    row.confirmedRevenue += Number(metric.confirmed_gross_revenue) || 0;
    grouped.set(key, row);
  });
  const rows = [...grouped.values()].sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name, 'ru')).map(row => `<tr><td><b>${esc(row.name)}</b><br><small>${row.campaigns} камп.</small></td><td>${money(row.spend, row.currency)}</td><td>${fmt(row.platformOrders)}<br><small>по данным платформы</small></td><td>${fmt(row.confirmedOrders)}</td><td>${fmt(row.confirmedTickets)}</td><td>${money(row.confirmedRevenue, row.currency)}</td><td>${ratio(row.spend, row.confirmedTickets, ` ${row.currency}`)}</td><td>${ratio(row.confirmedRevenue, row.spend, '×')}</td></tr>`);
  byId('channel-report-list').innerHTML = reportTable(['КАНАЛ', 'РАСХОДЫ', 'ЗАКАЗЫ ПЛАТФОРМЫ', 'ПОДТВЕРЖДЁННЫЕ ЗАКАЗЫ', 'БИЛЕТЫ', 'ВЫРУЧКА', 'СТОИМОСТЬ БИЛЕТА', 'ОКУПАЕМОСТЬ'], rows, 'Нет кампаний, подходящих под выбранный фильтр.');
}

function renderOperatorReport(orders, operators, concerts, concertIds) {
  const concertById = new Map(concerts.map(concert => [concert.id, concert]));
  const operatorById = new Map(operators.map(operator => [operator.id, operator.name]));
  const grouped = new Map();
  orders.filter(order => order.status === 'PAID' && order.operator_id).forEach(order => {
    const concert = concertById.get(order.concert_id);
    if (!concert || !concertIds.has(order.concert_id)) return;
    const currency = order.currency || concert.currency || 'PLN';
    const key = `${order.operator_id}:${currency}`;
    const row = grouped.get(key) || { name: operatorById.get(order.operator_id) || 'Оператор не указан', currency, orders: 0, tickets: 0, revenue: 0 };
    row.orders += 1;
    row.tickets += Number(order.ticket_count) || 0;
    row.revenue += Number(order.gross_revenue) || 0;
    grouped.set(key, row);
  });
  const rows = [...grouped.values()].sort((a, b) => b.tickets - a.tickets || a.name.localeCompare(b.name, 'ru')).map(row => `<tr><td><b>${esc(row.name)}</b></td><td>${fmt(row.orders)}</td><td>${fmt(row.tickets)}</td><td>${money(row.revenue, row.currency)}</td><td>${ratio(row.revenue, row.tickets, ` ${row.currency}`)}</td></tr>`);
  byId('operator-report-list').innerHTML = reportTable(['ОПЕРАТОР', 'ОПЛАЧЕННЫЕ ЗАКАЗЫ', 'БИЛЕТЫ', 'ВЫРУЧКА', 'СРЕДНЯЯ ЦЕНА БИЛЕТА'], rows, 'Нет оплаченных заказов операторов, подходящих под выбранный фильтр.');
}

function populateReportFilters(concerts, metrics) {
  const concertFilter = byId('report-concert-filter'), cityFilter = byId('report-city-filter'), channelFilter = byId('report-channel-filter');
  const selectedConcert = concertFilter.value || 'ALL', selectedCity = cityFilter.value || 'ALL', selectedChannel = channelFilter.value || 'ALL';
  concertFilter.innerHTML = `<option value="ALL">ВСЕ</option>${concerts.map(concert => `<option value="${esc(concert.id)}">${esc(concert.event_name)} · ${esc(concert.city)}</option>`).join('')}`;
  const cities = [...new Set(concerts.map(concert => concert.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  cityFilter.innerHTML = `<option value="ALL">ВСЕ</option>${cities.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}`;
  const channels = [...new Map(metrics.filter(metric => metric.channel_id && metric.channel_name).map(metric => [metric.channel_id, metric.channel_name])).entries()].sort((left, right) => left[1].localeCompare(right[1], 'ru'));
  channelFilter.innerHTML = `<option value="ALL">ВСЕ</option>${channels.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}`;
  concertFilter.value = [...concertFilter.options].some(option => option.value === selectedConcert) ? selectedConcert : 'ALL';
  cityFilter.value = [...cityFilter.options].some(option => option.value === selectedCity) ? selectedCity : 'ALL';
  channelFilter.value = [...channelFilter.options].some(option => option.value === selectedChannel) ? selectedChannel : 'ALL';
}

async function loadReportsModule() {
  if (!state.session) {
    ['r-concerts', 'r-paid-tickets', 'r-spend', 'r-unattributed'].forEach(id => { byId(id).textContent = '—'; });
    byId('report-list').innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы увидеть отчёты.</div>';
    byId('reports-note').textContent = 'Данные скрыты правилами доступа; пустой ответ не трактуется как ноль.';
    return;
  }
  const [concertsResult, ordersResult, expensesResult, campaignsResult, metricsResult, operatorsResult] = await Promise.all([
    db.from('daria_concerts').select('*').order('event_date', { ascending: true, nullsFirst: false }),
    db.from('daria_orders').select('concert_id,campaign_id,operator_id,ticket_count,gross_revenue,currency,status'),
    db.from('daria_expenses').select('concert_id,amount,currency,expense_type,payment_status'),
    db.from('daria_campaigns').select('id,concert_id,channel_id,actual_spend,platform_reported_orders,platform_reported_value'),
    db.rpc('daria_channel_metrics'),
    db.from('daria_ticketing_operators').select('id,name').order('name')
  ]);
  const errors = [concertsResult.error && `concerts: ${concertsResult.error.message}`, ordersResult.error && `orders: ${ordersResult.error.message}`, expensesResult.error && `expenses: ${expensesResult.error.message}`, campaignsResult.error && `campaigns: ${campaignsResult.error.message}`, metricsResult.error && `channel metrics: ${metricsResult.error.message}`, operatorsResult.error && `operators: ${operatorsResult.error.message}`].filter(Boolean);
  if (errors.length) { byId('report-list').innerHTML = `<div class="empty">Не удалось собрать отчёт: ${esc(errors.join(' · '))}</div>`; byId('reports-note').classList.add('error'); return; }
  const concerts = concertsResult.data || [], orders = ordersResult.data || [], expenses = expensesResult.data || [], campaigns = campaignsResult.data || [], metrics = metricsResult.data || [], operators = operatorsResult.data || [];
  populateReportFilters(concerts, metrics);
  const concertId = byId('report-concert-filter').value, city = byId('report-city-filter').value, channelId = byId('report-channel-filter').value, dateFrom = byId('report-date-from').value, dateTo = byId('report-date-to').value;
  const visibleConcerts = concerts.filter(concert => (concertId === 'ALL' || concert.id === concertId) && (city === 'ALL' || concert.city === city) && (!dateFrom || concert.event_date >= dateFrom) && (!dateTo || concert.event_date <= dateTo));
  const concertIds = new Set(visibleConcerts.map(concert => concert.id));
  const paid = orders.filter(order => order.status === 'PAID' && concertIds.has(order.concert_id));
  const visibleCampaigns = campaigns.filter(campaign => concertIds.has(campaign.concert_id) && (channelId === 'ALL' || campaign.channel_id === channelId));
  const visibleCampaignIds = new Set(visibleCampaigns.map(campaign => campaign.id));
  const visiblePaid = channelId === 'ALL' ? paid : paid.filter(order => visibleCampaignIds.has(order.campaign_id));
  const visibleMetrics = metrics.filter(metric => concertIds.has(metric.concert_id) && (channelId === 'ALL' || metric.channel_id === channelId));
  byId('r-concerts').textContent = visibleConcerts.length;
  byId('r-paid-tickets').textContent = fmt(visiblePaid.reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0));
  byId('r-spend').textContent = money(visibleCampaigns.reduce((sum, campaign) => sum + (Number(campaign.actual_spend) || 0), 0));
  byId('r-paid-tickets-note').textContent = channelId === 'ALL' ? 'подтверждённые заказы' : 'подтверждённые заказы выбранного канала';
  byId('r-spend-note').textContent = channelId === 'ALL' ? 'внесённые расходы кампаний' : 'расходы кампаний выбранного канала';
  byId('r-unattributed').textContent = channelId === 'ALL' ? fmt(paid.filter(order => !order.campaign_id).reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0)) : '—';
  byId('r-unattributed-note').textContent = channelId === 'ALL' ? 'без привязки к кампании' : 'не относится к выбранному каналу';
  byId('report-list').innerHTML = visibleConcerts.map(concert => reportCard(concert, (channelId === 'ALL' ? orders : visiblePaid).filter(order => order.concert_id === concert.id), expenses.filter(expense => expense.concert_id === concert.id), visibleCampaigns.filter(campaign => campaign.concert_id === concert.id))).join('') || '<div class="empty">Концертов, подходящих под выбранный фильтр, нет.</div>';
  renderChannelReport(metrics, concerts, concertIds, channelId);
  renderOperatorReport(orders, operators, concerts, concertIds);
  byId('reports-note').classList.remove('error');
  byId('reports-note').textContent = 'Стоимость привлечения и окупаемость показаны только как отношение внесённых данных. Показатели рекламной платформы и подтверждённые продажи намеренно не объединяются.';
}

function amountMap(items, field = 'amount') {
  const totals = new Map();
  items.forEach(item => totals.set(item.currency || 'PLN', (totals.get(item.currency || 'PLN') || 0) + (Number(item[field]) || 0)));
  return totals;
}

function currencyTotals(items, field = 'amount') {
  const totals = amountMap(items, field);
  return formatCurrencyMap(totals);
}

function formatCurrencyMap(totals) {
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
  document.querySelectorAll('.field input').forEach(input => input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); calculateBooking(); setStatus('Есть несохранённые изменения старой сводки.'); }));
  document.querySelectorAll('[data-clear-booking]').forEach(button => button.addEventListener('click', () => { bookingOperators.forEach(([operator]) => byId(`${button.dataset.clearBooking}-${operator}`).value = ''); calculateBooking(); setStatus('Есть несохранённые изменения старой сводки.'); }));
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
  if (error) { setStatus(`Старая сводка не загружена: ${error.message}`, true); return; }
  bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { byId(`${concert.id}-${operator}`).value = data[`${concert.id}_${operator}`] ?? ''; }));
  calculateBooking();
  loadBookingComparison();
  setStatus('Старая сводка синхронизирована с общей базой.');
}

async function loadBookingComparison() {
  const target = byId('booking-comparison');
  if (!state.session) { target.innerHTML = '<div class="empty">Войдите в рабочий аккаунт, чтобы сверить старую сводку с подтверждёнными заказами.</div>'; return; }
  const [concertsResult, operatorsResult, ordersResult] = await Promise.all([
    db.from('daria_concerts').select('id,event_date,city'),
    db.from('daria_ticketing_operators').select('id,name'),
    db.from('daria_orders').select('concert_id,operator_id,ticket_count,status')
  ]);
  const errors = [concertsResult.error, operatorsResult.error, ordersResult.error].filter(Boolean);
  if (errors.length) { target.innerHTML = '<div class="empty">Не удалось сверить старую сводку: данные не подменены нулями.</div>'; return; }
  const concerts = concertsResult.data || [], operators = operatorsResult.data || [], orders = ordersResult.data || [];
  const rows = bookingConcerts.flatMap(legacyConcert => {
    const concert = concerts.find(item => item.event_date === legacyConcert.eventDate && item.city === legacyConcert.city);
    return bookingOperators.map(([legacyId, operatorName]) => {
      const oldTickets = bookingValue(`${legacyConcert.id}-${legacyId}`);
      const operator = operators.find(item => item.name.trim().toLowerCase() === operatorName.toLowerCase());
      const confirmed = concert && operator ? orders.filter(order => order.status === 'PAID' && order.concert_id === concert.id && order.operator_id === operator.id).reduce((sum, order) => sum + (Number(order.ticket_count) || 0), 0) : null;
      const difference = confirmed == null ? '—' : fmt(oldTickets - confirmed);
      return `<tr><td>${esc(legacyConcert.city)} · ${esc(legacyConcert.date)}</td><td>${esc(operatorName)}</td><td>${fmt(oldTickets)}</td><td>${confirmed == null ? '—' : fmt(confirmed)}</td><td>${difference}</td></tr>`;
    });
  });
  target.innerHTML = reportTable(['КОНЦЕРТ', 'ОПЕРАТОР', 'СТАРАЯ СВОДКА', 'ПОДТВЕРЖДЁННЫЕ БИЛЕТЫ', 'РАЗНИЦА'], rows, 'Нет строк для сверки.');
}

async function saveBooking() {
  if (!requireEditor('Войдите через рабочую почту, чтобы сохранить старую сводку.')) return;
  const button = byId('save-booking');
  button.disabled = true;
  setStatus('Сохранение старой сводки…');
  const { error } = await db.from('booking_sales').update(bookingRow()).eq('id', 1);
  button.disabled = false;
  setStatus(error ? `Старая сводка не сохранена: ${error.message}` : 'Старая сводка сохранена для всей команды.', Boolean(error));
}

function ensureCampaignDeliveryFields() {
  const form = byId('campaign-form');
  if (form.elements.platform_impressions) return;
  const notes = form.elements.notes.closest('label');
  notes.insertAdjacentHTML('beforebegin', '<label>ПОКАЗЫ ПЛАТФОРМЫ<input name="platform_impressions" min="0" type="number"></label><label>ОХВАТ ПЛАТФОРМЫ<input name="platform_reach" min="0" type="number"></label><label>ПЕРЕХОДЫ ПО ССЫЛКЕ<input name="platform_link_clicks" min="0" type="number"></label>');
  form.elements.entries.closest('label').firstChild.textContent = 'ПЕРЕХОДЫ НА СТРАНИЦУ';
}

function ensureOperatorProfileFields() {
  const form = byId('operator-form');
  if (form.elements.organic_distribution) return;
  const contractNotes = form.elements.contract_notes.closest('label');
  contractNotes.insertAdjacentHTML('beforebegin', '<label class="full">ОРГАНИЧЕСКОЕ РАСПРОСТРАНЕНИЕ<textarea name="organic_distribution" rows="2" maxlength="1000" placeholder="Где оператор размещает концерт без оплаченной рекламы"></textarea></label><label>ПОДДЕРЖКА РЕКЛАМЫ В GOOGLE<input name="google_ads_support" maxlength="160" placeholder="Что оператор берёт на себя"></label><label>ПОДДЕРЖКА РЕКЛАМЫ В META<input name="meta_ads_support" maxlength="160" placeholder="Что оператор берёт на себя"></label><label>ОТВЕТСТВЕННЫЙ МЕНЕДЖЕР<input name="account_manager_name" maxlength="160"></label><label>ПОЧТА МЕНЕДЖЕРА<input name="account_manager_email" type="email" maxlength="160"></label><label>ТЕЛЕФОН МЕНЕДЖЕРА<input name="account_manager_phone" maxlength="80"></label><label>ДАТА ПОСЛЕДНЕГО ПРЕДЛОЖЕНИЯ<input name="last_offer_date" type="date"></label>');
}

function bindEvents() {
  ensureCampaignDeliveryFields();
  ensureOperatorProfileFields();
  document.querySelectorAll('.ops-nav button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
  byId('dashboard-period').addEventListener('change', () => { if (state.concerts.length) renderConcerts(); });
  document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', async () => {
    const target = button.dataset.quick;
    showView(target === 'concert' ? 'concerts' : target === 'expense' ? 'finance' : target === 'sale' || target === 'import' ? 'sales' : 'channels');
    if (target === 'concert') { openConcertForm(); return; }
    if (target === 'expense') { await loadFinance(); openExpenseForm(); }
    if (target === 'campaign') { await loadChannelsModule(); openCampaignForm(); }
    if (target === 'sale') { await loadChannelsModule(); openCampaignResultForm(); }
    if (target === 'tracking') { await loadChannelsModule(); openTrackingForm(); }
    if (target === 'import') { await Promise.all([loadOperations(), loadOperatorsModule()]); openOrderImport(); }
  }));
  byId('send-login').addEventListener('click', sendMagicLink);
  byId('add-concert').addEventListener('click', () => openConcertForm());
  byId('cancel-concert').addEventListener('click', () => { byId('concert-form').hidden = true; });
  byId('concert-form').addEventListener('submit', saveConcert);
  byId('cancel-snapshot').addEventListener('click', () => { byId('snapshot-form').hidden = true; });
  byId('snapshot-form').addEventListener('submit', saveSnapshot);
  byId('add-task').addEventListener('click', async () => { await loadOperations(); openTaskForm(); });
  byId('cancel-task').addEventListener('click', () => { byId('task-form').hidden = true; });
  byId('task-form').addEventListener('submit', saveTask);
  byId('task-status-filter').addEventListener('change', renderTasks);
  byId('task-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-task]');
    if (button) openTaskForm(state.tasks.find(task => task.id === button.dataset.editTask));
  });
  byId('concert-filter').addEventListener('change', renderConcerts);
  byId('concerts-list').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const concert = state.concerts.find(item => item.id === button.dataset.id);
    if (button.dataset.action === 'details') selectConcert(button.dataset.id);
    if (button.dataset.action === 'edit') openConcertForm(concert);
  });
  byId('dashboard-concerts').addEventListener('click', event => {
    const button = event.target.closest('[data-action="details"]');
    if (!button) return;
    showView('concerts');
    selectConcert(button.dataset.id);
  });
  byId('dashboard-attention').addEventListener('click', event => {
    const taskButton = event.target.closest('[data-attention-task]');
    if (taskButton) {
      const concert = state.concerts.find(item => item.id === taskButton.dataset.id);
      const kind = taskButton.dataset.attentionTask;
      showView('tasks');
      openTaskForm(null, concert, { title: attentionTaskTitle(kind), details: `Создано из проверки полноты данных: ${kind === 'source' ? 'нет файла-источника' : kind === 'snapshot' ? 'нет свежего среза продаж' : 'не указана вместимость площадки'}.`, priority: 'HIGH', task_status: 'OPEN', due_date: new Date().toISOString().slice(0, 10) });
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const concert = state.concerts.find(item => item.id === button.dataset.id);
    if (button.dataset.action === 'source') { showView('documents'); openDocumentForm(concert); return; }
    if (button.dataset.action === 'snapshot') { showView('concerts'); openSnapshotForm(concert); return; }
    if (button.dataset.action === 'edit') { showView('concerts'); openConcertForm(concert); return; }
    showView('concerts');
    selectConcert(button.dataset.id);
  });
  byId('add-order').addEventListener('click', () => openOrderForm());
  byId('add-campaign-result').addEventListener('click', async () => { showView('channels'); await loadChannelsModule(); openCampaignResultForm(); });
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
  ['concert_id', 'channel_id', 'campaign_name'].forEach(name => {
    const field = byId('campaign-form').elements[name];
    ['change', 'input'].forEach(eventName => field.addEventListener(eventName, () => { if (!byId('campaign-form').elements.source_code.value.trim()) generateCampaignSourceCode(); }));
  });
  byId('campaign-form').addEventListener('submit', saveCampaign);
  byId('cancel-campaign-result').addEventListener('click', () => { byId('campaign-result-form').hidden = true; });
  byId('campaign-result-form').addEventListener('submit', saveCampaignResult);
  byId('campaign-result-order').addEventListener('click', openConfirmedOrderFromCampaignResult);
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
  byId('add-document').addEventListener('click', async () => { await loadOperations(); openDocumentForm(); });
  byId('open-order-import').addEventListener('click', async () => { await Promise.all([loadOperations(), loadOperatorsModule()]); openOrderImport(); });
  byId('cancel-order-import').addEventListener('click', () => { byId('order-import-form').hidden = true; });
  byId('order-import-form').elements.file.addEventListener('change', readOrderImportFile);
  byId('order-import-form').querySelectorAll('.import-column').forEach(select => select.addEventListener('change', prepareOrderImport));
  byId('order-import-form').addEventListener('submit', saveOrderImport);
  byId('cancel-document').addEventListener('click', () => { byId('document-form').hidden = true; });
  byId('document-form').addEventListener('submit', saveDocument);
  byId('document-list').addEventListener('click', event => {
    const button = event.target.closest('[data-open-document]');
    if (button) openDocument(button.dataset.openDocument);
    const preview = event.target.closest('[data-preview-csv]');
    if (preview) previewCsvDocument(preview.dataset.previewCsv);
    const apply = event.target.closest('[data-apply-meta]');
    if (apply) openMetaApplyForm(apply.dataset.applyMeta);
  });
  byId('cancel-meta-apply').addEventListener('click', () => { byId('meta-apply-form').hidden = true; });
  byId('meta-source-row').addEventListener('change', applyMetaSourceRow);
  byId('meta-apply-form').addEventListener('submit', applyMetaCsv);
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
  byId('report-concert-filter').addEventListener('change', loadReportsModule);
  byId('report-city-filter').addEventListener('change', loadReportsModule);
  byId('report-channel-filter').addEventListener('change', loadReportsModule);
  byId('report-date-from').addEventListener('change', loadReportsModule);
  byId('report-date-to').addEventListener('change', loadReportsModule);
  byId('expense-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-expense]');
    if (!button) return;
    openExpenseForm(state.expenses.find(expense => expense.id === button.dataset.editExpense));
  });
  byId('save-booking').addEventListener('click', saveBooking);
  byId('open-confirmed-sales').addEventListener('click', async () => { showView('sales'); await loadSalesModule(); openOrderForm(); });
}

async function init() {
  localizeStaticInterface();
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
    if (document.querySelector('[data-panel="documents"]').classList.contains('active')) loadDocumentsModule();
    if (document.querySelector('[data-panel="tasks"]').classList.contains('active')) loadTasksModule();
    if (document.querySelector('[data-panel="operators"]').classList.contains('active')) loadOperatorsModule();
    if (document.querySelector('[data-panel="reports"]').classList.contains('active')) loadReportsModule();
    if (document.querySelector('[data-panel="finance"]').classList.contains('active')) loadFinance();
  });
  db.channel('booking-sales-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_sales', filter: 'id=eq.1' }, payload => {
    bookingConcerts.forEach(concert => bookingOperators.forEach(([operator]) => { byId(`${concert.id}-${operator}`).value = payload.new[`${concert.id}_${operator}`] ?? ''; }));
    calculateBooking();
    setStatus('Старая сводка обновлена командой.');
  }).subscribe();
  db.channel('legacy-confirmed-orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'daria_orders' }, () => {
    if (document.querySelector('[data-panel="booking"]').classList.contains('active')) loadBookingComparison();
  }).subscribe();
  await Promise.all([loadOperations(), loadBooking()]);
}

init().catch(error => { console.error(error); setStatus(`Помилка запуску: ${error.message}`, true); });
