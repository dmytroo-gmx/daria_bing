(function (root, factory) {
  const regulation = factory();
  if (typeof module === 'object' && module.exports) module.exports = regulation;
  if (root) root.LegacyRegulation = regulation;
})(typeof window !== 'undefined' ? window : null, function () {
  const version = '2026-10-06';
  const steps = [
    { code: 'EXPERT_REVIEW', number: 1, phase: 'Решение', title: 'Проверка профильным специалистом', instruction: 'Перед рискованным запуском, длительной рекламой, юридическим или налоговым решением запишите, кто проверил вопрос, вывод и документ.' },
    { code: 'BREAK_EVEN', number: 2, phase: 'Решение', title: 'Окупаемость не выше 50% мест', instruction: 'Сверьте полную невозвратную смету, план рекламы, цену билета и вместимость. Превышение 50% требует отдельного обоснования и профильной проверки.' },
    { code: 'CHANNEL_PLAN', number: 3, phase: 'Решение', title: 'План продаж по каналам', instruction: 'Укажите ожидаемые билеты, допустимую стоимость продажи билета, бюджет и основание для каждого канала.' },
    { code: 'FUNDING', number: 4, phase: 'Решение', title: 'Деньги до обязательств', instruction: 'Внесите платежи и сроки, затем закрепите подтверждённые источники покрытия. Продажи билетов не считаются деньгами на счёте.' },
    { code: 'CHECKPOINTS', number: 5, phase: 'Контроль', title: 'Контрольные даты и решение за месяц', instruction: 'Задайте контрольные точки и дату решения примерно за месяц до концерта. При отставании зафиксируйте человеческое решение и его основание.' },
    { code: 'PRODUCT_PROOF', number: 6, phase: 'Контроль', title: 'Программа проверена до расширения', instruction: 'Перед туровой цепочкой покажите минимум один завершённый безубыточный концерт этой программы с подтверждённой итоговой экономикой.' },
    { code: 'HOOK', number: 7, phase: 'Реклама', title: 'Понятное начало видеоролика', instruction: 'Проверьте, что в первые 1,2 секунды видны смысл предложения и читаемый текст. Длину ролика оценивайте после проверки начала.' },
    { code: 'AUDIENCE_CREATIVE', number: 8, phase: 'Реклама', title: 'Креатив для аудитории', instruction: 'Для аудитории 40+ проверьте спокойный монтаж, не больше одного появления лампы, реальных людей, статичные варианты, дозированное применение ИИ-визуалов и набранный вручную текст.' },
    { code: 'AD_TEST', number: 9, phase: 'Реклама', title: 'Отдельные тесты креативов', instruction: 'Подготовьте около пяти разных объявлений с лимитами теста, соберите отзывы реальных людей и сравните результаты. Не переписывайте активные объявления без причины.' },
    { code: 'SPONSOR_FACTS', number: 10, phase: 'Репутация', title: 'Факты для спонсоров и инвесторов', instruction: 'Покажите подтверждённые результаты, динамику в процентах, новую модель риска и честную историю исправлений. Материалы и узнаваемость развивайте через соцсети, блогеров, подкасты и профессиональную среду; партнёрства с украинскими и белорусскими бизнесами проверяйте отдельно.' },
    { code: 'SEASON_PRICE', number: 11, phase: 'Репутация', title: 'Сезон, цена и язык', instruction: 'До запуска проверьте сезон, цену и язык. Регламент считает декабрь дорогим для рекламы, январь–февраль рискованными, середину апреля предпочтительным весенним окном, а 3–4 весенних концерта рабочей гипотезой при прохождении экономики каждого. Тестируйте повышение цены, сообщение цены в евро и гипотезу около 80/20 по языкам без автоматического применения.' },
    { code: 'CHANNEL_MEASUREMENT', number: 12, phase: 'Репутация', title: 'Каналы измеряются по продажам', instruction: 'Проверьте Meta, Threads, собственную базу, почтовые и СМС-рассылки, партнёров и операторов. Сравните почту и СМС на фактических продажах; фиксируйте собственный магазин, пиксель, серверную передачу и диспетчер тегов как задачи измерения. Бюджет расширяйте по подтверждённым продажам и стоимости билета.' }
  ];
  const statuses = { OPEN: 'НЕ НАЧАТО', IN_PROGRESS: 'В РАБОТЕ', VERIFIED: 'ПОДТВЕРЖДЕНО', EXCEPTION: 'ИСКЛЮЧЕНИЕ' };
  const decisions = { CONTINUE: 'ПРОДОЛЖАТЬ', POSTPONE: 'ПЕРЕНЕСТИ', CANCEL: 'ОТМЕНИТЬ' };
  const prelaunchCodes = ['EXPERT_REVIEW', 'BREAK_EVEN', 'CHANNEL_PLAN', 'FUNDING', 'CHECKPOINTS', 'HOOK', 'AUDIENCE_CREATIVE', 'AD_TEST', 'SEASON_PRICE'];
  const count = value => Number(value) || 0;
  const currency = value => String(value || 'PLN').toUpperCase();
  const result = (tone, text, details = {}) => ({ tone, text, ...details });

  function plannedEconomy(concert, expenses = [], channelPlans = []) {
    const targetCurrency = currency(concert?.currency);
    const relevant = expenses.filter(row => row.concert_id === concert?.id && row.expense_type !== 'REFUNDABLE_DEPOSIT' && (row.expense_type !== 'OPTIONAL_FUTURE' || row.include_in_projected_cost));
    const mismatched = relevant.filter(row => currency(row.currency) !== targetCurrency);
    const nonRefundable = relevant.filter(row => currency(row.currency) === targetCurrency).reduce((sum, row) => sum + count(row.amount), 0);
    const plans = channelPlans.filter(row => row.concert_id === concert?.id);
    const foreignPlans = plans.filter(row => currency(row.currency) !== targetCurrency);
    const planBudget = plans.filter(row => currency(row.currency) === targetCurrency).reduce((sum, row) => sum + count(row.planned_budget), 0);
    const marketing = plans.length ? planBudget : count(concert?.planned_marketing_budget);
    const total = nonRefundable + marketing;
    const price = count(concert?.average_ticket_price), capacity = count(concert?.capacity);
    const tickets = price > 0 && total > 0 ? Math.ceil(total / price) : null;
    const share = tickets != null && capacity > 0 ? tickets / capacity : null;
    return { currency: targetCurrency, nonRefundable, marketing, total, tickets, share, mixedCurrency: Boolean(mismatched.length || foreignPlans.length), hasExpenseRows: relevant.length > 0, hasChannelPlan: plans.length > 0 };
  }

  function recentSalesPace(snapshots, concertId) {
    const groups = new Map();
    snapshots.filter(row => row.concert_id === concertId && row.operator_id && row.source_document_id).forEach(row => groups.set(row.operator_id, [...(groups.get(row.operator_id) || []), row]));
    let ticketsPerDay = 0, countedOperators = 0, corrected = false;
    groups.forEach(group => {
      const [latest, previous] = [...group].sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)));
      if (!previous || latest.snapshot_date === previous.snapshot_date) return;
      const days = Math.round((new Date(`${latest.snapshot_date}T12:00:00Z`) - new Date(`${previous.snapshot_date}T12:00:00Z`)) / 86400000);
      if (days <= 0) return;
      const delta = count(latest.tickets_sold_total) - count(previous.tickets_sold_total);
      if (delta < 0) corrected = true;
      ticketsPerDay += Math.max(0, delta) / days;
      countedOperators++;
    });
    return { ticketsPerDay, countedOperators, corrected };
  }

  function evaluate(concert, data = {}) {
    const expenses = data.expenses || [], plans = data.channelPlans || [], funding = data.fundingSources || [];
    const creatives = data.creatives || [], milestones = data.milestones || [], campaigns = data.campaigns || [], links = data.links || [];
    const documents = data.documents || [], concerts = data.concerts || [], metrics = data.metrics || [], snapshots = data.snapshots || [], channelMetrics = data.channelMetrics || [];
    const economy = plannedEconomy(concert, expenses, plans);
    const ownPlans = plans.filter(row => row.concert_id === concert.id);
    const ownFunding = funding.filter(row => row.concert_id === concert.id);
    const ownCreatives = creatives.filter(row => row.concert_id === concert.id);
    const ownMilestones = milestones.filter(row => row.concert_id === concert.id);
    const ownCampaigns = campaigns.filter(row => row.concert_id === concert.id);
    const ownLinks = links.filter(row => row.concert_id === concert.id);
    const ownDocuments = documents.filter(row => row.concert_id === concert.id);
    const confirmedFunding = ownFunding.filter(row => row.status === 'CONFIRMED' && currency(row.currency) === economy.currency).reduce((sum, row) => sum + count(row.amount), 0);
    const otherFundingCurrency = ownFunding.some(row => row.status === 'CONFIRMED' && currency(row.currency) !== economy.currency);
    const mandatoryFuture = expenses.filter(row => row.concert_id === concert.id && row.expense_type === 'MANDATORY_FUTURE' && !['PAID', 'REFUNDED'].includes(row.payment_status));
    const undatedMandatory = mandatoryFuture.some(row => !row.due_date);
    const earliestDue = mandatoryFuture.map(row => row.due_date).filter(Boolean).sort()[0] || null;
    const firstDueAmount = earliestDue ? mandatoryFuture.filter(row => row.due_date === earliestDue && currency(row.currency) === economy.currency).reduce((sum, row) => sum + count(row.amount), 0) : 0;
    const availableByFirstDue = earliestDue ? ownFunding.filter(row => row.status === 'CONFIRMED' && currency(row.currency) === economy.currency && (!row.available_on || row.available_on <= earliestDue)).reduce((sum, row) => sum + count(row.amount), 0) : 0;
    const fundingTimingIssue = undatedMandatory || earliestDue && availableByFirstDue < firstDueAmount;
    const expected = ownPlans.reduce((sum, row) => sum + count(row.expected_tickets), 0);
    const overBudget = ownPlans.filter(row => count(row.planned_budget) > count(row.expected_tickets) * count(row.allowable_cpa) && count(row.planned_budget) > 0);
    const readyCreatives = ownCreatives.filter(row => row.status === 'READY');
    const readyVideo = readyCreatives.filter(row => row.format === 'VIDEO');
    const readyStatic = readyCreatives.filter(row => row.format === 'STATIC');
    const readyWithPeople = readyCreatives.filter(row => row.real_people);
    const date = concert.event_date ? new Date(`${concert.event_date}T12:00:00Z`) : null;
    const gateDate = date ? new Date(date.getTime() - 30 * 86400000).toISOString().slice(0, 10) : null;
    const gate = ownMilestones.find(row => row.milestone_type === 'DECISION_GATE' && row.target_date <= (gateDate || ''));
    const sold = count(data.soldTickets);
    const pace = recentSalesPace(snapshots, concert.id);
    const today = new Date().toISOString().slice(0, 10);
    const daysToEvent = concert.event_date ? Math.max(0, Math.ceil((new Date(`${concert.event_date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000)) : 0;
    const projectedTickets = pace.countedOperators && daysToEvent ? Math.min(count(concert.capacity) || Infinity, Math.round(sold + pace.ticketsPerDay * daysToEvent)) : null;
    const projectedResult = projectedTickets != null && count(concert.average_ticket_price) > 0 && !economy.mixedCurrency ? projectedTickets * count(concert.average_ticket_price) - economy.total : null;
    const campaignSpend = ownCampaigns.reduce((sum, row) => sum + count(row.actual_spend), 0);
    const tracked = channelMetrics.filter(row => row.concert_id === concert.id);
    const confirmedChannelTickets = tracked.reduce((sum, row) => sum + count(row.confirmed_paid_tickets), 0);
    const trackedSpend = tracked.reduce((sum, row) => sum + count(row.actual_spend), 0);
    const actualCpa = confirmedChannelTickets > 0 ? trackedSpend / confirmedChannelTickets : null;
    const checkpointDetails = `Расход рекламы ${campaignSpend.toFixed(2)} ${economy.currency}; остаток плана ${(economy.marketing - campaignSpend).toFixed(2)} ${economy.currency}; стоимость подтверждённого билета ${actualCpa == null ? 'не рассчитана' : `${actualCpa.toFixed(2)} ${economy.currency}`}; ${projectedResult == null ? 'прогноз итога не рассчитан без двух подтверждённых срезов одного оператора' : `расчётный итог ${projectedResult.toFixed(2)} ${economy.currency}`} (по средней цене и текущему темпу).`;
    const previous = concerts.filter(row => row.id !== concert.id && row.project_name && concert.project_name && row.project_name.trim().toLowerCase() === concert.project_name.trim().toLowerCase() && row.status === 'COMPLETED');
    const previousMetrics = previous.map(row => ({ concert: row, metric: metrics.find(item => item.concert_id === row.id) })).filter(item => item.metric);
    const previousBreakEvenCount = previousMetrics.filter(item => item.metric.operational_result != null && Number(item.metric.operational_result) >= 0 && Number(item.metric.paid_tickets) > 0).length;
    const measured = ownCampaigns.filter(row => count(row.actual_spend) > 0);
    const signals = {
      EXPERT_REVIEW: result('unknown', 'Требуется заключение специалиста и основание решения.'),
      BREAK_EVEN: !economy.hasExpenseRows ? result('unknown', 'Полная смета не внесена. Расчёт доли мест пока нельзя подтвердить.', { economy })
        : economy.mixedCurrency ? result('warn', 'Есть расходы или планы в другой валюте. Долю окупаемости нельзя подтвердить без пересчёта.', { economy })
        : economy.share == null ? result('unknown', 'Нужны полная смета, цена билета и вместимость.', { economy })
        : result(economy.share <= .5 ? 'ok' : 'warn', `По внесённой смете: ${economy.tickets} билетов, ${(economy.share * 100).toFixed(1)}% зала; лимит регламента 50%.`, { economy }),
      CHANNEL_PLAN: !ownPlans.length ? result('unknown', 'План каналов не заполнен.') : result(overBudget.length || (economy.tickets != null && expected < economy.tickets) ? 'warn' : 'ok', `Запланировано ${expected} билетов в ${ownPlans.length} каналах; строк сверх допустимой стоимости: ${overBudget.length}.${economy.tickets == null ? ' Точка окупаемости ещё не рассчитана.' : ` До окупаемости по смете нужно ${economy.tickets}.`}`),
      FUNDING: !ownFunding.length || !economy.hasExpenseRows ? result('unknown', 'Нужны полная смета и подтверждённые источники покрытия.') : result(otherFundingCurrency || fundingTimingIssue || (economy.total > 0 && confirmedFunding < economy.total) ? 'warn' : 'ok', `Подтверждено ${confirmedFunding.toFixed(2)} ${economy.currency} из внесённой сметы ${economy.total.toFixed(2)} ${economy.currency}.${earliestDue ? ` Первый обязательный платёж ${firstDueAmount.toFixed(2)} ${economy.currency} до ${earliestDue}; доступно к этой дате по указанным источникам ${availableByFirstDue.toFixed(2)}.` : ''}${undatedMandatory ? ' Есть обязательные платежи без даты.' : ''} Остаток на счёте сверяйте отдельно.`),
      CHECKPOINTS: !gateDate ? result('unknown', 'Дата концерта не указана.') : !gate ? result('warn', `Добавьте точку решения не позднее ${gateDate}. ${checkpointDetails}`) : result(gate.target_date <= today && economy.tickets != null && sold < economy.tickets || projectedResult != null && projectedResult < 0 ? 'warn' : 'ok', `Точка решения ${gate.target_date}. Подтверждено ${sold} билетов${economy.tickets == null ? '; точка окупаемости неизвестна.' : `; до окупаемости ${economy.tickets}.`} ${checkpointDetails}${pace.corrected ? ' В срезах была отрицательная корректировка, она не считается продажами.' : ''}`),
      PRODUCT_PROOF: !concert.project_name ? result('unknown', 'Укажите название программы в карточке концерта.') : !previous.length ? result('warn', 'Завершённых концертов этой программы не найдено; расширение требует отдельного решения.') : result(previousBreakEvenCount ? 'unknown' : 'warn', `Завершённых концертов программы: ${previous.length}; с неотрицательным расчётным итогом и подтверждёнными билетами: ${previousBreakEvenCount}. Проверьте полноту доходов и расходов по документу перед выводом о безубыточности.`),
      HOOK: !readyVideo.length ? result('unknown', 'Нет проверенного видеокреатива с текстом в начале.') : result('ok', `Проверено видеокреативов: ${readyVideo.length}.`),
      AUDIENCE_CREATIVE: !readyVideo.length || !readyStatic.length || !readyWithPeople.length ? result('warn', `Готово видео: ${readyVideo.length}; статичных вариантов: ${readyStatic.length}; с реальными людьми: ${readyWithPeople.length}. Нужны оба формата и вариант с людьми.`) : result('ok', `Готово видео: ${readyVideo.length}; статичных вариантов: ${readyStatic.length}; с реальными людьми: ${readyWithPeople.length}.`),
      AD_TEST: readyCreatives.length < 5 ? result('warn', `Готово ${readyCreatives.length} из ориентировочно 5 разных креативов; тестовые лимиты указываются в карточке.`) : result('ok', `Готово ${readyCreatives.length} креативов для отдельных тестов.`),
      SPONSOR_FACTS: !ownDocuments.length ? result('unknown', 'Нет документа-источника для материалов спонсорам.') : result('unknown', `Документов концерта: ${ownDocuments.length}. Выберите подтверждённые цифры и зафиксируйте проверку.`),
      SEASON_PRICE: !concert.event_date || !count(concert.average_ticket_price) ? result('unknown', 'Укажите дату и среднюю цену билета.') : result('unknown', `Дата ${concert.event_date}, средняя цена ${count(concert.average_ticket_price).toFixed(2)} ${economy.currency}. Сезон, язык и новую цену проверяет команда.`),
      CHANNEL_MEASUREMENT: !ownCampaigns.length ? result('unknown', 'Нет кампаний для проверки каналов.') : result(!ownLinks.length || !measured.length || !confirmedChannelTickets ? 'warn' : 'ok', `Кампаний: ${ownCampaigns.length}; с расходами: ${measured.length}; ссылок учёта: ${ownLinks.length}; подтверждённых билетов: ${confirmedChannelTickets}; стоимость билета: ${actualCpa == null ? 'не рассчитана' : `${actualCpa.toFixed(2)} ${economy.currency}`}. Только по этим данным решайте, расширять ли бюджет.`)
    };
    return { economy, signals, gateDate, expectedTickets: expected, confirmedFunding, readyCreativeCount: readyCreatives.length, previousConcertCount: previous.length, previousBreakEvenCount, campaignCount: ownCampaigns.length, trackingCount: ownLinks.length, confirmedChannelTickets, pace, projectedTickets, projectedResult, actualCpa };
  }

  function validateStep(input, evaluation) {
    const status = input.status, code = input.step_code, signal = evaluation.signals[code];
    if (!steps.some(item => item.code === code)) return 'Неизвестный шаг регламента.';
    if (!Object.hasOwn(statuses, status)) return 'Неизвестное состояние проверки.';
    if (!['VERIFIED', 'EXCEPTION'].includes(status)) return '';
    if (!String(input.reviewer_name || '').trim() || !String(input.notes || '').trim()) return 'Для подтверждения или исключения нужны имя проверяющего и обоснование.';
    if (code === 'EXPERT_REVIEW' && !String(input.professional_name || '').trim()) return 'Укажите профильного специалиста и его специализацию.';
    if (code === 'BREAK_EVEN' && status === 'EXCEPTION' && !String(input.professional_name || '').trim()) return 'Для исключения из предела 50% укажите профильного специалиста.';
    if (['EXPERT_REVIEW', 'PRODUCT_PROOF', 'SPONSOR_FACTS'].includes(code) && !input.source_document_id) return 'Для этого шага нужен документ-источник.';
    if (status === 'EXCEPTION' && !input.source_document_id) return 'Для исключения нужен документ с основанием.';
    if (code === 'BREAK_EVEN' && status === 'VERIFIED' && (signal.tone !== 'ok' || !evaluation.economy.hasExpenseRows)) return 'Проверьте полную смету и предел 50%. При превышении оформите исключение с документом.';
    if (code === 'CHANNEL_PLAN' && status === 'VERIFIED' && (signal.tone !== 'ok' || !evaluation.economy.hasExpenseRows || evaluation.economy.mixedCurrency)) return 'План каналов должен покрывать точку окупаемости и допустимые расходы.';
    if (code === 'FUNDING' && status === 'VERIFIED' && (signal.tone !== 'ok' || evaluation.economy.total <= 0 || !evaluation.economy.hasExpenseRows)) return 'Подтвердите документами покрытие полной внесённой сметы в валюте концерта.';
    if (code === 'CHECKPOINTS' && !input.decision) return 'Запишите решение человека по контрольной дате.';
    if (code === 'CHECKPOINTS' && status === 'VERIFIED' && signal.tone !== 'ok') return 'Сначала задайте контрольную дату и проверьте её сигнал. При отступлении оформите исключение с документом.';
    if (code === 'PRODUCT_PROOF' && status === 'VERIFIED' && !evaluation.previousBreakEvenCount) return 'Для расширения программы нужен завершённый концерт этой программы с неотрицательным расчётным итогом и подтверждёнными билетами.';
    if (['HOOK', 'AUDIENCE_CREATIVE', 'AD_TEST'].includes(code) && status === 'VERIFIED' && signal.tone !== 'ok') return 'Проверьте креативы и тестовые лимиты или оформите обоснованное исключение.';
    if (code === 'SEASON_PRICE' && status === 'VERIFIED' && signal.text.startsWith('Укажите')) return 'Укажите дату и среднюю цену билета.';
    if (code === 'CHANNEL_MEASUREMENT' && status === 'VERIFIED' && signal.tone !== 'ok') return 'Для подтверждения нужны кампания, ссылка учёта, расходы и подтверждённые продажи; до этого бюджет не расширяйте.';
    return '';
  }

  function openPrelaunchSteps(evaluation, rows = []) {
    return steps.filter(item => {
      if (!prelaunchCodes.includes(item.code)) return false;
      const saved = rows.find(row => row.step_code === item.code);
      return !saved || !['VERIFIED', 'EXCEPTION'].includes(saved.status) || saved.status === 'VERIFIED' && evaluation.signals[item.code].tone === 'warn';
    });
  }

  return { version, steps, statuses, decisions, prelaunchCodes, plannedEconomy, evaluate, validateStep, openPrelaunchSteps };
});
