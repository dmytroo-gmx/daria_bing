import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, js, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8')
]);

test('the product is branded Legacy Brain', () => {
  assert.match(html, /<title>Legacy Brain/);
  assert.match(html, />LEGACY BRAIN</);
  assert.doesNotMatch(html, /DARIA BING/i);
});

test('every navigation item has a separate panel', () => {
  for (const view of ['dashboard', 'concerts', 'sales', 'channels', 'operators', 'finance', 'reports', 'booking']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(html, new RegExp(`data-panel="${view}"`));
  }
});

test('concerts support create, edit, detail, filters and all schema statuses', () => {
  assert.match(html, /id="concert-form"/);
  assert.match(html, /id="concert-detail"/);
  assert.match(html, /id="concert-filter"/);
  assert.match(js, /data-action="edit"/);
  assert.match(js, /async function updateConcertStatus/);
  for (const status of ['DRAFT', 'PLANNED', 'ON_SALE', 'ACTIVE', 'ON_HOLD', 'POSTPONED', 'CANCELLED', 'COMPLETED']) assert.match(html, new RegExp(status));
});

test('dashboard uses canonical sales and marketing fields', () => {
  assert.match(js, /ticket_count,gross_revenue,status/);
  assert.match(js, /daria_campaigns'\)\.select\('actual_spend'\)/);
  assert.doesNotMatch(js, /quantity,gross_amount/);
  assert.equal((js.match(/async function loadOperations/g) || []).length, 1);
});

test('sales keeps payment state and attribution evidence distinct', () => {
  assert.match(html, /id="order-form"/);
  assert.match(html, /CONFIRMED/);
  assert.match(html, /PLATFORM_ATTRIBUTED/);
  assert.match(html, /UNKNOWN/);
  assert.match(js, /order\.status === 'PAID'/);
  assert.match(js, /order\.status === 'REFUNDED'/);
  assert.match(js, /currencyTotals\(paid, 'gross_revenue'\)/);
  assert.match(js, /daria_orders'\)\.select\('\*'\)/);
});

test('unauthenticated empty RLS results are not presented as zero', () => {
  assert.match(js, /Порожня відповідь без авторизації не трактується як нуль/);
  assert.match(js, /if \(!state\.session\)/);
});

test('finance keeps expense classes and currencies separate', () => {
  assert.match(html, /id="expense-form"/);
  assert.match(html, /ALREADY_PAID/);
  assert.match(html, /MANDATORY_FUTURE/);
  assert.match(html, /OPTIONAL_FUTURE/);
  assert.match(html, /REFUNDABLE_DEPOSIT/);
  assert.match(js, /function currencyTotals/);
  assert.match(js, /daria_expenses'\)\.select\('\*'\)/);
  assert.match(js, /payment_status === 'PAID'/);
  assert.doesNotMatch(js, /reduce\([^\n]+currency[^\n]+amount/);
});

test('legacy booking remains available and the responsive stylesheet loads', () => {
  assert.match(js, /booking_sales/);
  assert.match(html, /id="save-booking"/);
  assert.match(css, /@media\(max-width:820px\)/);
});
