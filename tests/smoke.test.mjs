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
  assert.match(html, />Legacy Brain</);
  assert.doesNotMatch(html, /Legacy Imperial Concerts/);
  assert.doesNotMatch(html, /DARIA BING/i);
});

test('static UI labels are localized for Russian operation', () => {
  assert.match(js, /function localizeStaticInterface/);
  assert.match(js, /'WEBSITE': 'САЙТ'/);
  assert.match(js, /'PDF REPORT': 'ОТЧЁТ В ДОКУМЕНТЕ'/);
  assert.match(js, /label\('status', status\)/);
  assert.match(html, /placeholder="реклама, площадка, артисты…"/);
});

test('concert workspace uses tabbed server-backed detail', () => {
  assert.match(js, /const detailTabs = \['OVERVIEW', 'CHECKLIST', 'TASKS', 'SALES', 'DAILY', 'SOURCES', 'CHANNELS', 'FINANCE', 'TRACKING', 'ORDERS', 'NOTES', 'HISTORY'\]/);
  assert.match(js, /db\.rpc\('daria_concert_metrics'\)/);
  assert.match(js, /const projectedResult = Number\(metric\.gross_revenue/);
  assert.match(js, /data-detail-tab/);
  assert.match(js, /daria_audit_log/);
  assert.match(html, /id="snapshot-form"/);
  assert.match(js, /function saveSnapshot/);
  assert.match(js, /function snapshotChanges/);
  assert.match(js, /function snapshotTimelines/);
  assert.match(js, /НЕОБЯЗАТЕЛЬНЫЕ РАСХОДЫ/);
  assert.match(js, /ПЛАНОВЫЕ НЕВОЗВРАТНЫЕ РАСХОДЫ/);
  assert.match(js, /БЛИЖАЙШИЙ ОБЯЗАТЕЛЬНЫЙ ПЛАТЁЖ/);
  assert.match(js, /Будущие обязательные расходы, которые ещё не оплачены/);
  assert.match(js, /Внесённые суммы, которые должны вернуться после выполнения условий/);
  assert.match(js, /data-open-detail-document/);
  assert.match(js, /function checklistItem/);
  assert.match(js, /data-detail-action/);
  assert.match(js, /function breakEvenTickets/);
  assert.match(js, /concert\.break_even_mode !== 'CALCULATED'/);
  assert.match(js, /data-add-detail-task/);
});

test('every navigation item has a separate panel', () => {
  for (const view of ['dashboard', 'concerts', 'tasks', 'sales', 'channels', 'documents', 'operators', 'finance', 'reports', 'booking']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(html, new RegExp(`data-panel="${view}"`));
  }
});

test('concerts support create, edit, detail, filters and all schema statuses', () => {
  assert.match(html, /id="concert-form"/);
  assert.match(html, /id="concert-detail"/);
  assert.match(html, /id="concert-filter"/);
  assert.match(js, /data-action="edit"/);
  assert.match(js, /dashboard-concerts'\)\.addEventListener\('click'/);
  assert.match(js, /async function updateConcertStatus/);
  for (const status of ['DRAFT', 'PLANNED', 'ON_SALE', 'ACTIVE', 'ON_HOLD', 'POSTPONED', 'CANCELLED', 'COMPLETED']) assert.match(html, new RegExp(status));
});

test('dashboard uses canonical sales and marketing fields', () => {
  assert.match(js, /ticket_count,gross_revenue,status/);
  assert.match(js, /daria_campaigns'\)\.select\('id,concert_id,actual_spend'\)/);
  assert.match(js, /campaignSpend\.forEach\(\(amount, currency\) => operationalResult\.set/);
  assert.match(js, /function formatCurrencyMap/);
  assert.match(js, /ОПЕРАЦИОННЫЙ ОСТАТОК: \$\{money\(projectedResult, currency\)\}/);
  assert.match(js, /concertFinance/);
  assert.match(js, /function dashboardPeriodConcerts/);
  assert.match(js, /const dashboardPaidOrders = paidOrders\.filter/);
  assert.match(js, /dashboard-period.*loadOperations/);
  assert.match(js, /Факт: оплаченные заказы, подтверждённые итоги операторов без номеров заказов/);
  assert.match(js, /БЛИЖАЙШИЙ ПЛАТЁЖ/);
  assert.doesNotMatch(js, /quantity,gross_amount/);
  assert.equal((js.match(/async function loadOperations/g) || []).length, 1);
  assert.match(html, /id="m-stale"/);
  assert.match(html, /id="dashboard-attention"/);
  assert.match(html, /id="dashboard-channel-answer"/);
  assert.match(html, /id="dashboard-operator-answer"/);
  assert.match(js, /daria_source_documents'\)\.select\('concert_id'\)/);
  assert.match(js, /daily snapshots/);
  assert.match(js, /function renderDashboardAttention/);
  assert.match(js, /function renderDashboardChannelAnswer/);
  assert.match(js, /function renderDashboardOperatorAnswer/);
  assert.match(js, /БОЛЬШЕ ВСЕГО БИЛЕТОВ/);
  assert.match(js, /НИЖЕ ВСЕГО СТОИМОСТЬ БИЛЕТА/);
  assert.match(js, /Система не делает рекомендацию без зафиксированных условий/);
  assert.match(js, /function attentionTaskTitle/);
  assert.match(js, /daria_operational_tasks'\)\.select\('concert_id,title,task_status'\)/);
  assert.match(js, /Не привязан файл-источник по концерту/);
  assert.match(js, /ДОБАВИТЬ ФАЙЛ/);
  assert.match(js, /ДОБАВИТЬ СРЕЗ/);
  assert.match(js, /УКАЗАТЬ МЕСТА/);
  assert.match(js, /СОЗДАТЬ ЗАДАЧУ/);
  assert.match(js, /data-attention-task/);
  assert.match(js, /button\.dataset\.action === 'source'/);
  assert.match(js, /button\.dataset\.action === 'snapshot'/);
  assert.match(js, /button\.dataset\.action === 'edit'/);
  assert.match(js, /а не отсутствие продаж/);
  for (const action of ['concert', 'expense', 'campaign', 'sale', 'tracking', 'import']) assert.match(html, new RegExp(`data-quick="${action}"`));
});

test('sales keeps payment state and attribution evidence distinct', () => {
  assert.match(html, /id="order-form"/);
  assert.match(html, /CONFIRMED/);
  assert.match(html, /PLATFORM_ATTRIBUTED/);
  assert.match(html, /UNKNOWN/);
  assert.match(js, /order\.status === 'PAID'/);
  assert.match(js, /order\.status === 'REFUNDED'/);
  assert.match(html, /id="campaign-result-form"/);
  assert.match(js, /async function saveCampaignResult/);
  assert.match(html, /Подтверждённые заказы, билеты и выручка вносятся отдельными заказами/);
  assert.match(js, /currencyTotals\(paid, 'gross_revenue'\)/);
  assert.match(js, /daria_orders'\)\.select\('\*'\)/);
});

test('operator CSV import previews rows and excludes existing orders before insertion', () => {
  assert.match(html, /id="order-import-form"/);
  assert.match(js, /function prepareOrderImport/);
  assert.match(js, /external_order_id', ids/);
  assert.match(js, /Пропущено повторов/);
});

test('unauthenticated empty RLS results are not presented as zero', () => {
  assert.match(js, /Пустой ответ без входа не трактуется как ноль/);
  assert.match(js, /if \(!state\.session\)/);
});

test('finance keeps expense classes and currencies separate', () => {
  assert.match(html, /id="expense-form"/);
  assert.match(html, /ALREADY_PAID/);
  assert.match(html, /MANDATORY_FUTURE/);
  assert.match(html, /OPTIONAL_FUTURE/);
  assert.match(html, /REFUNDABLE_DEPOSIT/);
  assert.match(html, /name="include_in_projected_cost"/);
  assert.match(js, /selectedOptional/);
  assert.match(js, /НЕОБЯЗАТЕЛЬНО, ВКЛЮЧЕНО В ПЛАН/);
  assert.match(js, /function currencyTotals/);
  assert.match(js, /daria_expenses'\)\.select\('\*'\)/);
  assert.match(js, /payment_status === 'PAID'/);
  assert.match(js, /label\('expenseType', expense\.expense_type\)/);
  assert.match(js, /label\('paymentStatus', expense\.payment_status\)/);
  assert.doesNotMatch(js, /reduce\([^\n]+currency[^\n]+amount/);
});

test('selected optional costs are opt-in at database level', async () => {
  const optionalCostMigration = await readFile(new URL('../supabase/migrations/0015_selected_optional_costs.sql', import.meta.url), 'utf8');
  assert.match(optionalCostMigration, /add column if not exists include_in_projected_cost boolean not null default false/);
  assert.match(optionalCostMigration, /expense_type = 'OPTIONAL_FUTURE' and include_in_projected_cost/);
  assert.match(optionalCostMigration, /projected_nonref_cost/);
});

test('channels preserve the separation of channels, campaigns and tracking links', () => {
  for (const id of ['channel-form', 'campaign-form', 'tracking-link-form']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(js, /daria_sales_channels'\)\.select\('\*'\)/);
  assert.match(js, /daria_campaigns'\)\.select\('\*'\)/);
  assert.match(js, /daria_tracking_links'\)\.select\('\*'\)/);
  assert.match(html, /Билетный оператор создаёт статистическую ссылку/);
  assert.match(js, /Заказы по данным рекламной платформы не добавляются/);
  assert.match(js, /\['change', 'input'\]/);
  assert.match(js, /план \$\{money\(planned, currency\)\}/);
  assert.match(js, /ПЛАТФОРМА:/);
  assert.match(js, /ПОДТВЕРЖДЕНО:/);
  assert.match(js, /КОНВЕРСИЯ ПЕРЕХОД → ЗАКАЗ/);
  assert.match(js, /ПЕРЕХОД → БИЛЕТ/);
  assert.match(js, /СРЕДНЕЕ ЧИСЛО БИЛЕТОВ В ЗАКАЗЕ/);
  assert.match(js, /campaignOrders/);
  assert.match(js, /выгрузка Meta ещё не применялась/);
  assert.match(js, /db\.from\('daria_csv_imports'\)/);
  assert.match(js, /function generateCampaignSourceCode/);
  assert.match(js, /Такой код источника уже есть/);
});

test('documents keep PDF evidence and CSV imports separate from operational facts', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0005_source_documents_pdf_first.sql', import.meta.url), 'utf8');
  assert.match(html, /id="document-form"/);
  assert.match(html, /Документ — первичный источник/);
  assert.match(js, /const documentBucket = 'legacy-brain-source-documents'/);
  assert.match(js, /createSignedUrl/);
  assert.match(js, /не змінює дані автоматично/);
  assert.match(js, /function parseCsv/);
  assert.match(js, /data-preview-csv/);
  assert.match(js, /daria_apply_meta_csv_import/);
  assert.match(html, /id="meta-apply-form"/);
  assert.match(html, /id="csv-preview"/);
  assert.match(css, /\.csv-table/);
  assert.match(migration, /create table if not exists public\.daria_source_documents/);
  assert.match(migration, /'application\/pdf'/);
  assert.match(migration, /file_size_limit/);
});

test('verified Meta CSV application keeps a source-to-campaign audit trail', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0006_meta_csv_verified_apply.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.daria_csv_imports/);
  assert.match(migration, /create or replace function public\.daria_apply_meta_csv_import/);
  assert.match(migration, /document_type = 'META_CSV'/);
  assert.match(migration, /application_mode = 'REPLACE_CAMPAIGN_METRICS'/);
  assert.match(migration, /jsonb_build_object/);
});

test('Meta export rows are parsed before a campaign metric is applied', () => {
  assert.match(js, /function metaRowsFromCsv/);
  assert.match(js, /потраченная сумма/);
  assert.match(js, /meta-source-row/);
  assert.match(js, /Проверьте кампанию перед применением/);
  for (const field of ['platform_impressions', 'platform_reach', 'platform_link_clicks', 'platform_landing_page_views']) assert.match(html, new RegExp(`name="${field}"`));
  assert.match(js, /просмотры целевой страницы/);
  assert.match(js, /platform_metrics_updated_at/);
  assert.match(js, /function ensureCampaignDeliveryFields/);
  assert.match(js, /ПЕРЕХОДЫ НА СТРАНИЦУ/);
});

test('daily sales snapshots retain a source document rather than becoming unsupported totals', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0007_daily_snapshots_with_source.sql', import.meta.url), 'utf8');
  assert.match(migration, /add column if not exists source_document_id/);
  assert.match(migration, /daria_audit_daily_sales_snapshots/);
  assert.match(js, /source_document_id: raw\.source_document_id/);
  assert.match(html, /Не додавай сюди загальні суми різних операторів/);
  assert.match(js, /Разных операторов здесь не складываем/);
  assert.match(css, /\.snapshot-bars/);
});

test('operational tasks are concert-linked, role-protected and audited', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0008_operational_tasks.sql', import.meta.url), 'utf8');
  assert.match(html, /id="task-form"/);
  assert.match(js, /async function loadTasksModule/);
  assert.match(js, /daria_operational_tasks/);
  assert.match(migration, /create table if not exists public\.daria_operational_tasks/);
  assert.match(migration, /daria_audit_operational_tasks/);
  assert.match(migration, /array\['ADMIN', 'MANAGER'\]/);
});

test('operators preserve contract capabilities and unknown fields', () => {
  assert.match(html, /id="operator-form"/);
  for (const field of ['supports_meta_pixel', 'supports_capi', 'supports_gtm', 'customer_data_access', 'payout_timing', 'legacy_recommendation']) assert.match(html, new RegExp(`name="${field}"`));
  assert.match(js, /daria_ticketing_operators'\)\.select\('\*'\)/);
  assert.match(js, /Порожнє поле означає «не зафіксовано»/);
  assert.match(html, /id="operator-comparison"/);
  assert.match(js, /function renderOperators/);
  assert.match(js, /function capability/);
  assert.match(js, /Серверная передача/);
  assert.match(js, /Доступ к электронной почте/);
  assert.match(js, /НЕ ЗАФИКСИРОВАНО/);
  assert.match(js, /operatorRecommendation: \{ RECOMMENDED: 'РЕКОМЕНДОВАН'/);
  assert.match(js, /known\(operator\.legacy_recommendation, value => label\('operatorRecommendation', value\)\)/);
});

test('verified starter records do not invent sales or overwrite entered operator facts', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0013_seed_verified_starter_records.sql', import.meta.url), 'utf8');
  for (const name of ['Wrocław', 'Bydgoszcz', 'Biletyna', 'Eventim', 'KupBilecik', 'Bilety24']) assert.match(migration, new RegExp(`'${name}'`));
  assert.match(migration, /on conflict \(name\) do update set/);
  assert.match(migration, /coalesce\(public\.daria_ticketing_operators\.marketplace_commission/);
  assert.doesNotMatch(migration, /gross_revenue|actual_spend|ticket_count/);
});

test('reports label platform and confirmed attribution separately', () => {
  assert.match(html, /id="report-list"/);
  assert.match(js, /СТОИМОСТЬ ПОДТВЕРЖДЁННОГО БИЛЕТА/);
  assert.match(js, /СТОИМОСТЬ ПОДТВЕРЖДЁННОГО ЗАКАЗА/);
  assert.match(js, /campaignOrders\.length/);
  assert.match(js, /order\.attribution_type === 'CONFIRMED'/);
  assert.match(js, /const currency = concert\.currency \|\| 'PLN'/);
  assert.match(js, /ОКУПАЕМОСТЬ ПОДТВЕРЖДЁННЫХ ПРОДАЖ/);
  assert.match(js, /async function loadReportsModule/);
  assert.match(js, /Показатели рекламной платформы и подтверждённые продажи намеренно не объединяются/);
  assert.match(js, /daria_channel_metrics/);
  assert.match(js, /function renderChannelReport/);
  assert.match(js, /function renderOperatorReport/);
  assert.match(html, /id="channel-report-list"/);
  assert.match(html, /id="operator-report-list"/);
  for (const filter of ['report-concert-filter', 'report-city-filter', 'report-channel-filter', 'report-date-from', 'report-date-to']) assert.match(html, new RegExp(`id="${filter}"`));
  assert.match(js, /function populateReportFilters\(concerts, metrics\)/);
  assert.match(js, /channelId !== 'ALL'/);
  assert.match(js, /function concertChannelPerformance/);
  assert.match(js, /Подтверждённые показатели основаны на оплаченных заказах с подтверждённым источником либо на последнем итоговом отчёте оператора/);
});

test('reports can be saved through the browser PDF workflow', () => {
  assert.match(html, /id="print-report"/);
  assert.match(html, /id="report-print-context"/);
  assert.match(css, /@media print/);
  assert.match(js, /report-print-context/);
  assert.match(js, /print-report.*window\.print/);
});

test('report channel filter scopes headline metrics and concert cards consistently', () => {
  assert.match(html, /id="r-paid-tickets-note"/);
  assert.match(html, /id="r-unattributed-note"/);
  assert.match(js, /const visibleCampaignIds = new Set\(visibleCampaigns\.map\(campaign => campaign\.id\)\)/);
  assert.match(js, /const visiblePaid = channelId === 'ALL' \? paid : paid\.filter\(order => visibleCampaignIds\.has\(order\.campaign_id\)\)/);
  assert.match(js, /renderOperatorReport\(visiblePaid, operators, concerts, concertIds\)/);
  assert.match(js, /не относится к выбранному каналу/);
});

test('campaign results lead to a separate prefilled confirmed order workflow', () => {
  assert.match(html, /id="campaign-result-order"/);
  assert.match(js, /async function openConfirmedOrderFromCampaignResult/);
  assert.match(js, /form\.elements\.campaign_id\.value = campaign\.id/);
  assert.match(js, /form\.elements\.attribution_type\.value = 'CONFIRMED'/);
  assert.match(html, /Подтверждённые заказы, билеты и выручка вносятся отдельными заказами/);
});

test('operator report totals stay source-backed and do not duplicate paid orders', async () => {
  const reportMigration = await readFile(new URL('../supabase/migrations/0014_campaign_confirmed_operator_reports.sql', import.meta.url), 'utf8');
  assert.match(html, /id="campaign-confirmed-report-form"/);
  assert.match(js, /async function saveCampaignConfirmedReport/);
  assert.match(js, /daria_campaign_confirmed_reports/);
  assert.match(reportMigration, /source_document_id uuid not null/);
  assert.match(reportMigration, /unique\(campaign_id, reported_on\)/);
  assert.match(reportMigration, /not exists \(select 1 from public\.daria_orders order_row where order_row\.campaign_id = campaign\.id and order_row\.status = 'PAID'\)/);
  assert.match(reportMigration, /create or replace function public\.daria_concert_metrics/);
  assert.match(reportMigration, /create or replace function public\.daria_channel_metrics/);
});

test('an authenticated user must have a verified manager role before editing', () => {
  assert.match(js, /daria_user_roles'\)\.select\('role'\)/);
  assert.match(js, /\['ADMIN', 'MANAGER'\]\.includes\(state\.role\)/);
  assert.match(js, /роль не назначена/);
});

test('server-side metrics and audit logging are present in the additive migration', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0003_concert_metrics_and_audit.sql', import.meta.url), 'utf8');
  assert.match(migration, /create or replace function public\.daria_concert_metrics/);
  assert.match(migration, /create or replace function public\.daria_channel_metrics/);
  assert.match(migration, /order_row\.status = 'PAID'/);
  assert.match(migration, /order_row\.attribution_type = 'CONFIRMED'/);
  assert.match(migration, /REFUNDABLE_DEPOSIT/);
  assert.match(migration, /create or replace function public\.daria_write_audit_log/);
  assert.match(migration, /daria_audit_campaigns/);
});

test('concert history shows the recorded audit actor', () => {
  assert.match(js, /const auditActorLabel/);
  assert.match(js, /entity_id,user_id,created_at/);
  assert.match(js, /daria_user_profiles/);
  assert.match(js, /auditError: auditResult\.error/);
  assert.match(js, /Полный идентификатор автора/);
});

test('audit profiles are role-protected and preserve existing audit entries', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0012_audit_actor_profiles.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.daria_user_profiles/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /daria_profiles_read/);
  assert.match(migration, /on conflict \(user_id\) do nothing/);
});

test('the current server metric subtracts campaign spend from the operational result', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0011_include_marketing_in_operational_result.sql', import.meta.url), 'utf8');
  assert.match(migration, /create or replace function public\.daria_concert_metrics/);
  assert.match(migration, /- coalesce\(campaigns\.marketing_spend, 0\)/);
});

test('campaign platform delivery metrics have an additive migration', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0009_campaign_platform_reach_metrics.sql', import.meta.url), 'utf8');
  for (const column of ['platform_impressions', 'platform_reach', 'platform_link_clicks', 'platform_landing_page_views']) assert.match(migration, new RegExp(`add column if not exists ${column}`));
  assert.match(migration, /not confirmed sales/i);
});

test('operator contacts and distribution fields have an additive migration', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0010_operator_contact_and_distribution_fields.sql', import.meta.url), 'utf8');
  for (const column of ['organic_distribution', 'google_ads_support', 'meta_ads_support', 'account_manager_name', 'account_manager_email', 'account_manager_phone', 'last_offer_date']) assert.match(migration, new RegExp(`add column if not exists ${column}`));
  for (const field of ['organic_distribution', 'google_ads_support', 'meta_ads_support', 'account_manager_name', 'account_manager_email', 'account_manager_phone', 'last_offer_date']) assert.match(js, new RegExp(`name=\\"${field}\\"`));
  assert.match(js, /function ensureOperatorProfileFields/);
  assert.match(js, /Органическое распространение/);
  assert.match(js, /Ответственный менеджер/);
});

test('managers can read but cannot directly edit the audit log', async () => {
  const migration = await readFile(new URL('../supabase/migrations/0004_manager_audit_read.sql', import.meta.url), 'utf8');
  assert.match(migration, /array\['ADMIN', 'MANAGER'\]/);
  assert.doesNotMatch(migration, /for (insert|update|delete|all)/i);
});

test('legacy booking remains available but is explicitly separated from confirmed sales', () => {
  assert.match(js, /booking_sales/);
  assert.match(html, /id="save-booking"/);
  assert.match(html, /id="open-confirmed-sales"/);
  assert.match(html, /id="booking-comparison"/);
  assert.match(html, /не являются подтверждёнными продажами/);
  assert.match(js, /open-confirmed-sales'\)\.addEventListener/);
  assert.match(js, /async function loadBookingComparison/);
  assert.match(js, /legacy-confirmed-orders-live/);
  assert.match(css, /@media\(max-width:820px\)/);
});
