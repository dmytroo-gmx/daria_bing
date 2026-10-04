-- Human-defined control dates for sales targets, marketing starts and
-- decision gates. The system reports deviations but never decides whether
-- a concert should proceed, move or be cancelled.

create table if not exists public.daria_control_dates (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  milestone_type text not null check (milestone_type in ('SALES_TARGET','MARKETING_START','DECISION_GATE')),
  target_date date not null,
  title text not null check (length(trim(title)) between 1 and 200),
  target_tickets integer check (target_tickets is null or target_tickets > 0),
  status text not null default 'OPEN' check (status in ('OPEN','DONE','CANCELLED')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (milestone_type <> 'SALES_TARGET' or target_tickets is not null)
);

create index if not exists daria_control_dates_concert_date_idx
  on public.daria_control_dates (concert_id, target_date, status);

alter table public.daria_control_dates enable row level security;

drop policy if exists daria_control_dates_read on public.daria_control_dates;
drop policy if exists daria_control_dates_write on public.daria_control_dates;

create policy daria_control_dates_read on public.daria_control_dates
for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));

create policy daria_control_dates_write on public.daria_control_dates
for all using (public.daria_has_role(array['ADMIN','MANAGER']))
with check (public.daria_has_role(array['ADMIN','MANAGER']));
