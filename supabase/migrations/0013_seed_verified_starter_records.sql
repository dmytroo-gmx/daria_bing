-- Legacy Brain: verified starter records quoted in the approved technical brief.
-- This migration never overwrites an already entered value. Financial figures
-- not fixed by a source are intentionally left empty.

insert into public.daria_concerts (
  event_name, project_name, city, venue, event_date, capacity, status,
  currency, notes
)
select
  'Vivaldi vs. Piazzolla: Osiem Pór Roku',
  'Vivaldi vs. Piazzolla',
  'Wrocław',
  'Radio Wrocław',
  date '2026-09-29',
  500,
  'ON_SALE',
  'PLN',
  'Вместимость указана как ориентировочная в техническом задании. Продажи, выручка и расходы не заполнены без первичного источника.'
where not exists (
  select 1 from public.daria_concerts
  where city = 'Wrocław' and event_date = date '2026-09-29'
);

insert into public.daria_concerts (
  event_name, project_name, city, venue, event_date, capacity, status,
  currency, notes
)
select
  'Vivaldi vs. Piazzolla: Osiem Pór Roku',
  'Vivaldi vs. Piazzolla',
  'Bydgoszcz',
  'Adria Teatr',
  date '2026-11-06',
  444,
  'ON_HOLD',
  'PLN',
  'Дата запланирована и может быть перенесена. Концерт не был выведен в продажу; продажи, выручка и расходы не заполнены без первичного источника.'
where not exists (
  select 1 from public.daria_concerts
  where city = 'Bydgoszcz' and event_date = date '2026-11-06'
);

insert into public.daria_ticketing_operators (
  name, marketplace_commission, capi_fee, supports_meta_pixel, supports_capi,
  supports_statistical_links, supports_promo_codes, has_marketplace,
  sms_marketing_available, email_marketing_available, customer_data_access,
  negotiation_status, legacy_recommendation, contract_notes, notes
)
values
  (
    'Biletyna', 5, 50, null, true, null, null, true, null, null,
    'Доступ к данным покупателей возможен в модели собственных продаж; для обычного маркетплейса не подтверждён.',
    'NEGOTIATING', 'NEGOTIATING',
    'Требуют подтверждения точный процент комиссии и эксклюзивность.',
    'По техническому заданию: обсуждалась расширенная система; разовая и ежемесячная стоимость указаны диапазонами и поэтому не внесены как точные суммы. Стоимость серверной передачи — 50 PLN в месяц; маркетплейс — 5%.'
  ),
  (
    'Eventim', null, null, true, true, null, null, null, null, null,
    null,
    'NEGOTIATING', 'NEGOTIATING',
    'Комиссия и эксклюзивность не зафиксированы.',
    'Подтверждены пиксель и серверная передача; при корректной настройке поддерживается устранение дублей. Остальные условия требуют подтверждения предложением.'
  ),
  (
    'KupBilecik', null, null, null, null, true, null, true, true, true,
    null,
    'ACTIVE_CURRENT_PARTNER', 'NEGOTIATING',
    'Текущий партнёр; рекомендация не назначена автоматически.',
    'Подтверждены маркетплейс, статистические ссылки, СМС- и почтовые рассылки. Серверная передача в наш набор данных не подтверждена.'
  ),
  (
    'Bilety24', null, null, true, null, null, null, null, null, null,
    null,
    'SHOP_NOT_AVAILABLE_TO_LEGACY', 'PAUSED',
    'Временная пауза: отсутствие магазина не трактуется как окончательный отказ.',
    'Тестовый магазин подтвердил передачу события покупки и данных транзакции; производственный магазин для Legacy сейчас недоступен.'
  )
on conflict (name) do update set
  marketplace_commission = coalesce(public.daria_ticketing_operators.marketplace_commission, excluded.marketplace_commission),
  capi_fee = coalesce(public.daria_ticketing_operators.capi_fee, excluded.capi_fee),
  supports_meta_pixel = coalesce(public.daria_ticketing_operators.supports_meta_pixel, excluded.supports_meta_pixel),
  supports_capi = coalesce(public.daria_ticketing_operators.supports_capi, excluded.supports_capi),
  supports_statistical_links = coalesce(public.daria_ticketing_operators.supports_statistical_links, excluded.supports_statistical_links),
  supports_promo_codes = coalesce(public.daria_ticketing_operators.supports_promo_codes, excluded.supports_promo_codes),
  has_marketplace = coalesce(public.daria_ticketing_operators.has_marketplace, excluded.has_marketplace),
  sms_marketing_available = coalesce(public.daria_ticketing_operators.sms_marketing_available, excluded.sms_marketing_available),
  email_marketing_available = coalesce(public.daria_ticketing_operators.email_marketing_available, excluded.email_marketing_available),
  customer_data_access = coalesce(nullif(public.daria_ticketing_operators.customer_data_access, ''), excluded.customer_data_access),
  negotiation_status = coalesce(nullif(public.daria_ticketing_operators.negotiation_status, ''), excluded.negotiation_status),
  contract_notes = coalesce(nullif(public.daria_ticketing_operators.contract_notes, ''), excluded.contract_notes),
  notes = coalesce(nullif(public.daria_ticketing_operators.notes, ''), excluded.notes),
  updated_at = now();
