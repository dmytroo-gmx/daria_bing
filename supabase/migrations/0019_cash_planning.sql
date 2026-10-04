-- Current cash balances for the conservative 30/60-day payment calendar.
-- Ticket revenue is intentionally not treated as cash until a balance is
-- entered from a bank account or cash register.

create table if not exists public.daria_cash_balances (
  id uuid primary key default gen_random_uuid(),
  account_name text not null check (length(trim(account_name)) between 1 and 160),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'PLN' check (length(currency) = 3),
  as_of_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_name, currency)
);

create index if not exists daria_cash_balances_date_idx
  on public.daria_cash_balances (as_of_date desc, account_name);

alter table public.daria_cash_balances enable row level security;

drop policy if exists daria_cash_balances_read on public.daria_cash_balances;
drop policy if exists daria_cash_balances_write on public.daria_cash_balances;

create policy daria_cash_balances_read on public.daria_cash_balances
for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));

create policy daria_cash_balances_write on public.daria_cash_balances
for all using (public.daria_has_role(array['ADMIN','MANAGER']))
with check (public.daria_has_role(array['ADMIN','MANAGER']));
