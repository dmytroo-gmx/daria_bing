const reg = window.LegacyRegulation;
const regulationState = { concertId: null, steps: [], channelPlans: [], fundingSources: [], creatives: [], expenses: [], milestones: [], campaigns: [], links: [], documents: [], channels: [], metrics: [], ready: false, requestId: 0 };
const regConcert = () => state.concerts.find(item => item.id === regulationState.concertId);
const regRows = name => regulationState[name] || [];
const regStep = code => regulationState.steps.find(item => item.step_code === code);
const regDocument = id => regulationState.documents.find(item => item.id === id)?.source_name || 'документ не найден';
const regChannel = id => regulationState.channels.find(item => item.id === id)?.name || 'канал не найден';

function regulationSelectConcert(id) {
  regulationState.concertId = id;
  if (byId('reg-concert')) byId('reg-concert').value = id;
}
window.regulationSelectConcert = regulationSelectConcert;

function regSelectOptions(items, valueKey, textKey, emptyText) {
  return `<option value="">${esc(emptyText)}</option>${items.map(item => `<option value="${esc(item[valueKey])}">${esc(item[textKey])}</option>`).join('')}`;
}

function regFillOptions(concert) {
  const previous = byId('reg-concert').value;
  byId('reg-concert').innerHTML = state.concerts.map(item => `<option value="${esc(item.id)}">${esc(item.event_name)} · ${esc(item.city)} · ${esc(dateLabel(item.event_date))}</option>`).join('');
  regulationState.concertId = regulationState.concertId || previous || state.concerts[0]?.id || null;
  byId('reg-concert').value = regulationState.concertId || '';
  const documents = regulationState.documents.filter(item => !item.concert_id || item.concert_id === concert.id);
  const documentOptions = regSelectOptions(documents, 'id', 'source_name', 'НЕ ПРИВЯЗАН');
  for (const formId of ['reg-step-form', 'reg-funding-form', 'reg-creative-form']) byId(formId).elements.source_document_id.innerHTML = documentOptions;
  byId('reg-channel-form').elements.channel_id.innerHTML = regulationState.channels.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  const campaigns = regulationState.campaigns.filter(item => item.concert_id === concert.id);
  byId('reg-creative-form').elements.campaign_id.innerHTML = regSelectOptions(campaigns, 'id', 'campaign_name', 'НЕ ПРИВЯЗАНА');
}

async function loadRegulationWorkspace() {
  const requestId = ++regulationState.requestId;
  if (!state.session) { regulationState.ready = false; byId('reg-note').textContent = 'Войдите через рабочую почту, чтобы открыть маршрут запуска.'; return; }
  if (!state.concerts.length) await loadOperations();
  if (requestId !== regulationState.requestId) return;
  if (!state.concerts.length) { byId('reg-note').textContent = 'Сначала добавьте концерт в реестр.'; return; }
  regulationState.concertId = state.concerts.some(item => item.id === regulationState.concertId) ? regulationState.concertId : state.concerts[0].id;
  const concert = regConcert();
  byId('reg-note').textContent = 'Загрузка проверок и исходных данных…';
  const queries = [
    ['steps', db.from('daria_regulation_steps').select('*').eq('concert_id', concert.id)],
    ['channelPlans', db.from('daria_channel_plans').select('*').eq('concert_id', concert.id)],
    ['fundingSources', db.from('daria_funding_sources').select('*').eq('concert_id', concert.id)],
    ['creatives', db.from('daria_creative_reviews').select('*').eq('concert_id', concert.id)],
    ['expenses', db.from('daria_expenses').select('*').eq('concert_id', concert.id)],
    ['milestones', db.from('daria_control_dates').select('*').eq('concert_id', concert.id)],
    ['campaigns', db.from('daria_campaigns').select('*').eq('concert_id', concert.id)],
    ['links', db.from('daria_tracking_links').select('*').eq('concert_id', concert.id)],
    ['documents', db.from('daria_source_documents').select('id,concert_id,source_name,source_date,document_type')],
    ['channels', db.from('daria_sales_channels').select('id,name,code').order('name')],
    ['metrics', db.rpc('daria_concert_metrics')],
    ['snapshots', db.from('daria_daily_sales_snapshots').select('concert_id,operator_id,snapshot_date,tickets_sold_total,source_document_id').eq('concert_id', concert.id)],
    ['channelMetrics', db.rpc('daria_channel_metrics')]
  ];
  const results = await Promise.all(queries.map(([, query]) => query));
  if (requestId !== regulationState.requestId) return;
  const errors = results.map((result, index) => result.error && `${queries[index][0]}: ${result.error.message}`).filter(Boolean);
  if (errors.length) {
    regulationState.ready = false;
    byId('reg-note').classList.add('error');
    byId('reg-note').textContent = `Маршрут запуска пока недоступен: ${errors.join(' · ')}. Проверьте, что миграция 0023 применена.`;
    return;
  }
  results.forEach((result, index) => { regulationState[queries[index][0]] = result.data || []; });
  regulationState.ready = true;
  byId('reg-note').classList.remove('error');
  regFillOptions(concert);
  renderRegulationWorkspace();
}
window.loadRegulationWorkspace = loadRegulationWorkspace;

function regulationEvaluation() {
  const concert = regConcert();
  return reg.evaluate(concert, { ...regulationState, concerts: state.concerts, soldTickets: state.totals.get(concert.id)?.tickets || 0 });
}

function relatedView(code) {
  return ({ EXPERT_REVIEW: 'documents', BREAK_EVEN: 'finance', CHANNEL_PLAN: 'channels', FUNDING: 'finance', CHECKPOINTS: 'concerts', PRODUCT_PROOF: 'concerts', HOOK: 'channels', AUDIENCE_CREATIVE: 'channels', AD_TEST: 'channels', SPONSOR_FACTS: 'documents', SEASON_PRICE: 'concerts', CHANNEL_MEASUREMENT: 'channels' })[code] || 'concerts';
}

function renderRegulationWorkspace() {
  if (!regulationState.ready || !regConcert()) return;
  const concert = regConcert(), evaluation = regulationEvaluation();
  const verified = reg.steps.filter(item => regStep(item.code)?.status === 'VERIFIED').length;
  const exceptions = reg.steps.filter(item => regStep(item.code)?.status === 'EXCEPTION').length;
  const recheck = reg.steps.filter(item => regStep(item.code)?.status === 'VERIFIED' && evaluation.signals[item.code].tone === 'warn').length;
  const openBeforeStart = reg.openPrelaunchSteps(evaluation, regulationState.steps);
  const next = openBeforeStart[0] || reg.steps.find(item => !['VERIFIED', 'EXCEPTION'].includes(regStep(item.code)?.status) || regStep(item.code)?.status === 'VERIFIED' && evaluation.signals[item.code].tone === 'warn');
  byId('reg-completed').textContent = `${verified}/12`;
  byId('reg-completed').nextElementSibling.textContent = `из 12 правил · исключений: ${exceptions}${recheck ? ` · перепроверить: ${recheck}` : ''}`;
  byId('reg-break-even').textContent = evaluation.economy.share == null || evaluation.economy.mixedCurrency ? '—' : `${(evaluation.economy.share * 100).toFixed(1)}%`;
  byId('reg-planned-sales').textContent = regulationState.channelPlans.length ? fmt(evaluation.expectedTickets) : '—';
  byId('reg-funding').textContent = regulationState.fundingSources.length ? money(evaluation.confirmedFunding, concert.currency) : '—';
  byId('reg-note').textContent = `Перед запуском рекламы открыто проверок: ${openBeforeStart.length} из ${reg.prelaunchCodes.length}. Следующий шаг: ${next ? `${next.number}. ${next.title}` : 'пересмотреть исходные данные'}. Регламент от ${reg.version}. Это подсказка команде, не автоматическое разрешение на запуск или оплату.`;
  byId('reg-step-list').innerHTML = reg.steps.map(item => {
    const row = regStep(item.code), signal = evaluation.signals[item.code];
    return `<article class="reg-step"><div class="reg-step-head"><div><small>${item.number}/12 · ${esc(item.phase)}</small><h3>${esc(item.title)}</h3></div><small>${esc(reg.statuses[row?.status || 'OPEN'])}${row?.status === 'VERIFIED' && signal.tone === 'warn' ? ' · ПЕРЕПРОВЕРИТЬ' : ''}</small></div><p>${esc(item.instruction)}</p><p class="reg-signal ${esc(signal.tone)}">${esc(signal.text)}</p>${row?.notes ? `<p>Проверка: ${esc(row.notes)}</p>` : ''}${row?.reviewer_name ? `<p>Проверил: ${esc(row.reviewer_name)}${row.professional_name ? ` · специалист: ${esc(row.professional_name)}` : ''}${row.reviewed_at ? ` · ${esc(new Date(row.reviewed_at).toLocaleDateString('ru-RU'))}` : ''}${row.decision ? ` · решение: ${esc(reg.decisions[row.decision])}` : ''}</p>` : ''}${row?.source_document_id ? `<p>Источник: ${esc(regDocument(row.source_document_id))}</p>` : ''}<div class="reg-actions"><button class="text-button" type="button" data-reg-step="${esc(item.code)}">${row ? 'ИЗМЕНИТЬ ПРОВЕРКУ' : 'ЗАПИСАТЬ ПРОВЕРКУ'}</button><button class="text-button" type="button" data-reg-related="${esc(item.code)}">ОТКРЫТЬ ДАННЫЕ</button></div></article>`;
  }).join('');
  byId('reg-channel-list').innerHTML = regulationState.channelPlans.map(row => `<article class="reg-record"><div><small>${esc(regChannel(row.channel_id))}</small><h3>${fmt(row.expected_tickets)} билетов · ${money(row.planned_budget, row.currency)}</h3><p>Допустимая стоимость билета: ${money(row.allowable_cpa, row.currency)}. ${esc(row.assumptions || 'Основание прогноза не записано.')}</p></div><div class="document-actions"><button class="text-button" type="button" data-reg-edit="channelPlans:${esc(row.id)}">ИЗМЕНИТЬ</button><button class="text-button danger" type="button" data-reg-delete="channelPlans:${esc(row.id)}">УДАЛИТЬ</button></div></article>`).join('') || '<div class="empty">План продаж по каналам не заполнен.</div>';
  byId('reg-funding-list').innerHTML = regulationState.fundingSources.map(row => `<article class="reg-record"><div><small>${row.status === 'CONFIRMED' ? 'ПОДТВЕРЖДЁН' : row.status === 'RELEASED' ? 'СНЯТ' : 'ПРЕДЛОЖЕН'}</small><h3>${esc(row.source_name)} · ${money(row.amount, row.currency)}</h3><p>${row.available_on ? `Доступен с ${esc(dateLabel(row.available_on))}. ` : ''}${row.source_document_id ? `Источник: ${esc(regDocument(row.source_document_id))}. ` : ''}${esc(row.notes || '')}</p></div><div class="document-actions"><button class="text-button" type="button" data-reg-edit="fundingSources:${esc(row.id)}">ИЗМЕНИТЬ</button><button class="text-button danger" type="button" data-reg-delete="fundingSources:${esc(row.id)}">УДАЛИТЬ</button></div></article>`).join('') || '<div class="empty">Источники покрытия ещё не внесены.</div>';
  byId('reg-creative-list').innerHTML = regulationState.creatives.map(row => `<article class="reg-record"><div><small>${row.format === 'VIDEO' ? 'ВИДЕО' : 'СТАТИКА'} · ${row.status === 'READY' ? 'ГОТОВ К ТЕСТУ' : row.status === 'STOPPED' ? 'ОСТАНОВЛЕН' : 'ЧЕРНОВИК'}</small><h3>${esc(row.title)}</h3><p>Первый экран: ${esc(row.hook_text || 'не указан')}. Лимит: ${money(row.test_budget_cap, row.currency)}. Отзывы: ${esc(row.feedback_notes || 'не записаны')}</p></div><div class="document-actions"><button class="text-button" type="button" data-reg-edit="creatives:${esc(row.id)}">ИЗМЕНИТЬ</button><button class="text-button danger" type="button" data-reg-delete="creatives:${esc(row.id)}">УДАЛИТЬ</button></div></article>`).join('') || '<div class="empty">Креативы ещё не внесены.</div>';
}

function closeRegulationForms() { document.querySelectorAll('#view-regulation .editor').forEach(form => { form.hidden = true; }); }
function openRegulationStep(code) {
  if (!requireEditor('Войдите через рабочую почту, чтобы записать проверку.')) return;
  const form = byId('reg-step-form'), row = regStep(code), spec = reg.steps.find(item => item.code === code);
  closeRegulationForms(); form.reset(); form.hidden = false;
  form.elements.source_document_id.innerHTML = regSelectOptions(regulationState.documents.filter(item => !item.concert_id || item.concert_id === regulationState.concertId), 'id', 'source_name', 'НЕ ПРИВЯЗАН');
  if (code === 'PRODUCT_PROOF') {
    const concert = regConcert();
    const previousIds = new Set(state.concerts.filter(item => item.id !== concert.id && item.status === 'COMPLETED' && concert.project_name && item.project_name?.trim().toLowerCase() === concert.project_name.trim().toLowerCase()).map(item => item.id));
    form.elements.source_document_id.innerHTML = regSelectOptions(regulationState.documents.filter(item => !item.concert_id || item.concert_id === concert.id || previousIds.has(item.concert_id)), 'id', 'source_name', 'НЕ ПРИВЯЗАН');
  }
  form.elements.id.value = row?.id || ''; form.elements.step_code.value = code;
  form.elements.status.value = row?.status || 'OPEN'; form.elements.reviewer_name.value = state.session.user.email || ''; form.elements.professional_name.value = row?.professional_name || '';
  form.elements.notes.value = row?.notes || ''; form.elements.source_document_id.value = row?.source_document_id || '';
  form.elements.decision.value = row?.decision || ''; byId('reg-decision-label').hidden = code !== 'CHECKPOINTS';
  byId('reg-step-title').textContent = `${spec.number}. ${spec.title}`;
  byId('reg-delete-step').hidden = !row; byId('reg-step-form-note').textContent = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function regValidateStep(raw) {
  return reg.validateStep(raw, regulationEvaluation());
}

async function saveRegulationStep(event) {
  event.preventDefault(); if (!requireEditor()) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form)); raw.reviewer_name = state.session.user.email || ''; const error = regValidateStep(raw);
  if (error) { byId('reg-step-form-note').textContent = error; return; }
  const payload = { concert_id: regulationState.concertId, step_code: raw.step_code, status: raw.status, reviewer_name: raw.reviewer_name.trim(), professional_name: raw.professional_name.trim(), notes: raw.notes.trim(), source_document_id: raw.source_document_id || null, decision: raw.step_code === 'CHECKPOINTS' && ['VERIFIED','EXCEPTION'].includes(raw.status) ? raw.decision || null : null, reviewed_at: ['VERIFIED','EXCEPTION'].includes(raw.status) ? new Date().toISOString() : null, updated_by_auth_user_id: state.session.user.id, updated_by_ops_user_id: null, updated_at: new Date().toISOString() };
  const button = form.querySelector('[type="submit"]'); button.disabled = true;
  const response = raw.id ? await db.from('daria_regulation_steps').update(payload).eq('id', raw.id) : await db.from('daria_regulation_steps').insert(payload);
  button.disabled = false;
  if (response.error) { byId('reg-step-form-note').textContent = `Не удалось сохранить: ${response.error.message}`; return; }
  form.hidden = true; await loadRegulationWorkspace();
}

function openRegulationRecord(kind, row = null) {
  if (!requireEditor('Войдите через рабочую почту, чтобы изменить план.')) return;
  const id = ({ channelPlans: 'reg-channel-form', fundingSources: 'reg-funding-form', creatives: 'reg-creative-form' })[kind];
  const form = byId(id), concert = regConcert(); closeRegulationForms(); form.reset(); form.hidden = false;
  form.elements.id.value = row?.id || '';
  form.elements.currency.value = row?.currency || concert.currency || 'PLN';
  if (row) Object.entries(row).forEach(([key, value]) => {
    const input = form.elements[key]; if (!input) return;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (input.type !== 'hidden' || key === 'id') input.value = value ?? '';
  });
  byId(`${id}-note`).textContent = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveRegulationRecord(event, kind) {
  event.preventDefault(); if (!requireEditor()) return;
  const form = event.currentTarget, raw = Object.fromEntries(new FormData(form));
  const table = ({ channelPlans: 'daria_channel_plans', fundingSources: 'daria_funding_sources', creatives: 'daria_creative_reviews' })[kind];
  let payload = { concert_id: regulationState.concertId, updated_at: new Date().toISOString() };
  if (kind === 'channelPlans') {
    payload = { ...payload, channel_id: raw.channel_id, expected_tickets: Number(raw.expected_tickets), allowable_cpa: Number(raw.allowable_cpa), planned_budget: Number(raw.planned_budget), currency: raw.currency.trim().toUpperCase(), assumptions: raw.assumptions.trim() };
    if (regulationState.channelPlans.some(item => item.channel_id === payload.channel_id && item.id !== raw.id)) { byId('reg-channel-form-note').textContent = 'План для этого канала уже есть. Измените существующую строку.'; return; }
  } else if (kind === 'fundingSources') {
    payload = { ...payload, source_name: raw.source_name.trim(), source_type: raw.source_type, amount: Number(raw.amount), currency: raw.currency.trim().toUpperCase(), status: raw.status, available_on: raw.available_on || null, source_document_id: raw.source_document_id || null, notes: raw.notes.trim() };
    if (payload.status === 'CONFIRMED' && !payload.source_document_id) { byId('reg-funding-form-note').textContent = 'Подтверждённому источнику нужен документ.'; return; }
  } else {
    payload = { ...payload, title: raw.title.trim(), format: raw.format, status: raw.status, hook_text: raw.hook_text.trim(), hook_visible_first_1_2: Boolean(raw.hook_visible_first_1_2), calm_edit: Boolean(raw.calm_edit), lamp_appearances: Number(raw.lamp_appearances || 0), real_people: Boolean(raw.real_people), ai_visual_used: Boolean(raw.ai_visual_used), text_checked_manually: Boolean(raw.text_checked_manually), feedback_notes: raw.feedback_notes.trim(), test_budget_cap: Number(raw.test_budget_cap || 0), currency: raw.currency.trim().toUpperCase(), campaign_id: raw.campaign_id || null, source_document_id: raw.source_document_id || null };
    if (payload.status === 'READY' && (!payload.hook_text || !payload.calm_edit || !payload.text_checked_manually || payload.lamp_appearances > 1 || !payload.feedback_notes || payload.test_budget_cap <= 0 || (payload.format === 'VIDEO' && !payload.hook_visible_first_1_2))) { byId('reg-creative-form-note').textContent = 'Для готовности проверьте начало, спокойный монтаж, текст, лампу, отзывы и лимит теста.'; return; }
  }
  const note = byId(form.id + '-note'), button = form.querySelector('[type="submit"]'); button.disabled = true;
  const response = raw.id ? await db.from(table).update(payload).eq('id', raw.id) : await db.from(table).insert(payload);
  button.disabled = false;
  if (response.error) { note.textContent = `Не удалось сохранить: ${response.error.message}`; return; }
  form.hidden = true; await loadRegulationWorkspace();
}

function bindRegulation() {
  byId('reg-concert').addEventListener('change', event => { regulationSelectConcert(event.target.value); loadRegulationWorkspace(); });
  byId('reg-step-list').addEventListener('click', event => {
    const edit = event.target.closest('[data-reg-step]'); if (edit) { openRegulationStep(edit.dataset.regStep); return; }
    const related = event.target.closest('[data-reg-related]'); if (!related) return;
    const target = relatedView(related.dataset.regRelated); showView(target);
    if (target === 'concerts') selectConcert(regulationState.concertId);
  });
  byId('reg-step-form').addEventListener('submit', saveRegulationStep);
  byId('reg-delete-step').addEventListener('click', async () => {
    const row = regStep(byId('reg-step-form').elements.step_code.value);
    if (row) await deleteRecord({ table: 'daria_regulation_steps', id: row.id, label: 'отметка регламента', refresh: loadRegulationWorkspace });
    byId('reg-step-form').hidden = true;
  });
  for (const [kind, buttonId, listId, formId] of [
    ['channelPlans', 'reg-add-channel', 'reg-channel-list', 'reg-channel-form'],
    ['fundingSources', 'reg-add-funding', 'reg-funding-list', 'reg-funding-form'],
    ['creatives', 'reg-add-creative', 'reg-creative-list', 'reg-creative-form']
  ]) {
    byId(buttonId).addEventListener('click', () => openRegulationRecord(kind));
    byId(formId).addEventListener('submit', event => saveRegulationRecord(event, kind));
    byId(listId).addEventListener('click', event => {
      const edit = event.target.closest('[data-reg-edit]'); if (edit) { const id = edit.dataset.regEdit.split(':')[1]; openRegulationRecord(kind, regRows(kind).find(item => item.id === id)); return; }
      const remove = event.target.closest('[data-reg-delete]'); if (!remove) return;
      const id = remove.dataset.regDelete.split(':')[1], row = regRows(kind).find(item => item.id === id);
      const table = ({ channelPlans: 'daria_channel_plans', fundingSources: 'daria_funding_sources', creatives: 'daria_creative_reviews' })[kind];
      if (row) deleteRecord({ table, id, label: row.title || row.source_name || regChannel(row.channel_id), refresh: loadRegulationWorkspace });
    });
  }
  document.querySelectorAll('[data-close-reg-form]').forEach(button => button.addEventListener('click', closeRegulationForms));
  if (location.hash === '#regulation') loadRegulationWorkspace();
}
bindRegulation();
