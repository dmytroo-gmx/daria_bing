import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const regulation = require('../shared/regulation.js');
const concert = { id: 'concert-1', event_date: '2099-12-31', capacity: 400, average_ticket_price: 150, planned_marketing_budget: 5000, currency: 'PLN', project_name: 'Программа А' };
const expense = amount => ({ concert_id: concert.id, expense_type: 'MANDATORY_FUTURE', amount, currency: 'PLN', due_date: '2099-01-01', payment_status: 'UNPAID' });
const plan = { concert_id: concert.id, expected_tickets: 200, allowable_cpa: 30, planned_budget: 5000, currency: 'PLN' };

test('all twelve dated rules have unique machine keys', () => {
  assert.equal(regulation.version, '2026-10-06');
  assert.equal(regulation.steps.length, 12);
  assert.deepEqual(regulation.steps.map(item => item.number), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(new Set(regulation.steps.map(item => item.code)).size, 12);
});

test('50 percent gate includes planned marketing but excludes refundable deposits', () => {
  const result = regulation.plannedEconomy(concert, [expense(20000), { ...expense(7000), expense_type: 'REFUNDABLE_DEPOSIT' }], [plan]);
  assert.equal(result.total, 25000);
  assert.equal(result.tickets, 167);
  assert.equal(result.share, 167 / 400);
  assert.equal(regulation.evaluate(concert, { expenses: [expense(20000)], channelPlans: [plan] }).signals.BREAK_EVEN.tone, 'ok');
});

test('expensive concert needs documented exception; a plain verified mark is rejected', () => {
  const evaluation = regulation.evaluate(concert, { expenses: [expense(35000)], channelPlans: [plan] });
  assert.equal(evaluation.signals.BREAK_EVEN.tone, 'warn');
  assert.match(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'VERIFIED', reviewer_name: 'Антонио', notes: 'Проверено' }, evaluation), /50%/);
  assert.match(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'EXCEPTION', reviewer_name: 'Антонио', notes: 'Отдельная проверка' }, evaluation), /специалист/);
  assert.match(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'EXCEPTION', reviewer_name: 'Антонио', professional_name: 'Профильный эксперт', notes: 'Отдельная проверка' }, evaluation), /документ/);
  assert.match(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'EXCEPTION', reviewer_name: 'Антонио', notes: 'Отдельная проверка', source_document_id: 'source-1' }, evaluation), /специалист/);
  assert.equal(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'EXCEPTION', reviewer_name: 'Антонио', professional_name: 'Профильный эксперт', notes: 'Отдельная проверка', source_document_id: 'source-1' }, evaluation), '');
});

test('mixed currencies cannot be presented as a verified 50 percent calculation', () => {
  const evaluation = regulation.evaluate(concert, { expenses: [expense(20000), { ...expense(500), currency: 'EUR' }], channelPlans: [plan] });
  assert.equal(evaluation.economy.mixedCurrency, true);
  assert.equal(evaluation.signals.BREAK_EVEN.tone, 'warn');
  assert.match(regulation.validateStep({ step_code: 'BREAK_EVEN', status: 'VERIFIED', reviewer_name: 'Дмитро', notes: 'Проверено' }, evaluation), /50%/);
});

test('channel plan checks tickets and allowable ticket cost', () => {
  const expenses = [expense(20000)];
  assert.equal(regulation.evaluate(concert, { expenses, channelPlans: [plan] }).signals.CHANNEL_PLAN.tone, 'ok');
  assert.equal(regulation.evaluate(concert, { expenses, channelPlans: [{ ...plan, planned_budget: 7000 }] }).signals.CHANNEL_PLAN.tone, 'warn');
  assert.equal(regulation.evaluate(concert, { expenses, channelPlans: [{ ...plan, expected_tickets: 100 }] }).signals.CHANNEL_PLAN.tone, 'warn');
});

test('confirmed funding is compared in concert currency and never changes bank balances', () => {
  const evaluation = regulation.evaluate(concert, { expenses: [expense(20000)], channelPlans: [plan], fundingSources: [{ concert_id: concert.id, status: 'CONFIRMED', amount: 25000, currency: 'PLN' }] });
  assert.equal(evaluation.confirmedFunding, 25000);
  assert.equal(evaluation.signals.FUNDING.tone, 'ok');
  assert.equal(regulation.evaluate(concert, { expenses: [expense(20000)], channelPlans: [plan], fundingSources: [{ concert_id: concert.id, status: 'PROPOSED', amount: 25000, currency: 'PLN' }] }).confirmedFunding, 0);
  assert.equal(regulation.evaluate(concert, { expenses: [expense(20000)], channelPlans: [plan], fundingSources: [{ concert_id: concert.id, status: 'CONFIRMED', amount: 25000, currency: 'PLN', available_on: '2099-02-01' }] }).signals.FUNDING.tone, 'warn');
});

test('a past decision gate below break-even remains a warning and requires a human decision', () => {
  const oldConcert = { ...concert, event_date: '2000-12-31' };
  const evaluation = regulation.evaluate(oldConcert, { expenses: [expense(20000)], channelPlans: [plan], milestones: [{ concert_id: oldConcert.id, milestone_type: 'DECISION_GATE', target_date: '2000-12-01' }], soldTickets: 10 });
  assert.equal(evaluation.signals.CHECKPOINTS.tone, 'warn');
  assert.match(regulation.validateStep({ step_code: 'CHECKPOINTS', status: 'VERIFIED', reviewer_name: 'Антонио', notes: 'Решение записано' }, evaluation), /решение/);
});

test('creative checks require video, static, human feedback and test limits', () => {
  const ready = Array.from({ length: 5 }, (_, index) => ({ concert_id: concert.id, status: 'READY', format: index ? 'VIDEO' : 'STATIC', real_people: index === 1 }));
  const evaluation = regulation.evaluate(concert, { creatives: ready });
  assert.equal(evaluation.signals.HOOK.tone, 'ok');
  assert.equal(evaluation.signals.AUDIENCE_CREATIVE.tone, 'ok');
  assert.equal(evaluation.signals.AD_TEST.tone, 'ok');
  assert.equal(regulation.evaluate(concert, { creatives: ready.slice(0, 4) }).signals.AD_TEST.tone, 'warn');
});

test('a completed program is not proof without a nonnegative recorded result and sold tickets', () => {
  const previous = { ...concert, id: 'concert-previous', status: 'COMPLETED' };
  const data = { concerts: [previous], metrics: [{ concert_id: previous.id, operational_result: -100, paid_tickets: 120 }] };
  let evaluation = regulation.evaluate(concert, data);
  assert.equal(evaluation.previousBreakEvenCount, 0);
  assert.match(regulation.validateStep({ step_code: 'PRODUCT_PROOF', status: 'VERIFIED', reviewer_name: 'Дмитро', notes: 'Проверено', source_document_id: 'source-1' }, evaluation), /неотрицательным/);
  evaluation = regulation.evaluate(concert, { ...data, metrics: [{ concert_id: previous.id, operational_result: 100, paid_tickets: 120 }] });
  assert.equal(evaluation.previousBreakEvenCount, 1);
  assert.equal(regulation.validateStep({ step_code: 'PRODUCT_PROOF', status: 'VERIFIED', reviewer_name: 'Дмитро', notes: 'Сверены все доходы и расходы', source_document_id: 'source-1' }, evaluation), '');
});

test('sales measurement cannot be confirmed without actual ticket evidence', () => {
  const data = { campaigns: [{ concert_id: concert.id, actual_spend: 100 }], links: [{ concert_id: concert.id }] };
  const evaluation = regulation.evaluate(concert, data);
  assert.equal(evaluation.signals.CHANNEL_MEASUREMENT.tone, 'warn');
  assert.match(regulation.validateStep({ step_code: 'CHANNEL_MEASUREMENT', status: 'VERIFIED', reviewer_name: 'Дмитро', notes: 'Проверено' }, evaluation), /подтверждённые продажи/);
});

test('the prelaunch counter is advisory and reopens a stale verification', () => {
  const evaluation = regulation.evaluate(concert, { expenses: [expense(35000)], channelPlans: [plan] });
  const rows = regulation.prelaunchCodes.map(step_code => ({ step_code, status: 'VERIFIED' }));
  assert.equal(regulation.openPrelaunchSteps(evaluation, rows).some(item => item.code === 'BREAK_EVEN'), true);
  assert.equal(regulation.openPrelaunchSteps(evaluation, rows).some(item => item.code === 'PRODUCT_PROOF'), false);
});

test('migration keeps new records role-protected and does not update old concerts', async () => {
  const sql = await readFile(new URL('../supabase/migrations/0023_new_era_regulation.sql', import.meta.url), 'utf8');
  for (const table of ['daria_regulation_steps', 'daria_channel_plans', 'daria_funding_sources', 'daria_creative_reviews']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(sql, /update public\.daria_concerts|delete from public\.daria_/i);
  assert.match(sql, /unique \(concert_id, step_code\)/);
});

test('both interfaces contain the controls used by the regulation workflow', async () => {
  for (const [scriptPath, htmlPath, pattern] of [
    ['../regulation-app.js', '../index.html', /byId\('([^']+)'\)/g],
    ['../ops/app.js', '../ops/index.html', /\$\('([^']+)'\)/g]
  ]) {
    const [script, html] = await Promise.all([readFile(new URL(scriptPath, import.meta.url), 'utf8'), readFile(new URL(htmlPath, import.meta.url), 'utf8')]);
    for (const match of script.matchAll(pattern)) assert.ok(html.includes(`id="${match[1]}"`), `${scriptPath}: missing ${match[1]}`);
  }
});
