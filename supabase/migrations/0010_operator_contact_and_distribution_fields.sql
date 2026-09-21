-- Legacy Brain: additive operator profile details from verified offers and contracts.

begin;

alter table public.daria_ticketing_operators
  add column if not exists organic_distribution text,
  add column if not exists google_ads_support text,
  add column if not exists meta_ads_support text,
  add column if not exists account_manager_name text,
  add column if not exists account_manager_email text,
  add column if not exists account_manager_phone text,
  add column if not exists last_offer_date date;

commit;
