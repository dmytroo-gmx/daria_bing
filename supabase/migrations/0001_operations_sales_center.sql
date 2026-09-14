create table public.daria_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'MANAGER', 'VIEWER')),
  created_at timestamptz not null default now()
);

create table public.daria_concerts (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  project_name text,
  city text not null,
  venue text,
  event_date date,
  capacity integer check (capacity is null or capacity >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','PLANNED','ON_SALE','ACTIVE','ON_HOLD','POSTPONED','CANCELLED','COMPLETED')),
  ticket_sales_start_date date,
  average_ticket_price numeric(12,2) check (average_ticket_price is null or average_ticket_price >= 0),
  break_even_mode text not null default 'MANUAL' check (break_even_mode in ('MANUAL','CALCULATED')),
  break_even_tickets integer check (break_even_tickets is null or break_even_tickets >= 0),
  planned_marketing_budget numeric(12,2) not null default 0 check (planned_marketing_budget >= 0),
  currency text not null default 'PLN', notes text not null default '',
  risk_status text not null default 'GRAY' check (risk_status in ('GREEN','YELLOW','RED','GRAY')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.daria_ticketing_operators (
  id uuid primary key default gen_random_uuid(), name text not null unique, website text,
  marketplace_commission numeric(8,4), own_sales_commission numeric(8,4), payment_provider_fee numeric(8,4),
  setup_fee numeric(12,2), monthly_fee numeric(12,2), capi_fee numeric(12,2),
  supports_meta_pixel boolean, supports_capi boolean, supports_gtm boolean, supports_statistical_links boolean, supports_promo_codes boolean,
  customer_data_access text, customer_email_access text, customer_phone_access text, payout_timing text,
  has_marketplace boolean, sms_marketing_available boolean, email_marketing_available boolean,
  exclusive_required text, exclusive_terms text, negotiation_status text not null default 'TO_BE_CLARIFIED',
  legacy_recommendation text not null default 'NEGOTIATING' check (legacy_recommendation in ('RECOMMENDED','BACKUP','NEGOTIATING','NOT_SUITABLE','PAUSED')),
  contract_notes text not null default '', notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.daria_sales_channels (
  id uuid primary key default gen_random_uuid(), name text not null unique, code text not null unique, is_active boolean not null default true, created_at timestamptz not null default now()
);

create table public.daria_expenses (
  id uuid primary key default gen_random_uuid(), concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  category text not null, description text not null default '', amount numeric(12,2) not null check (amount >= 0), currency text not null default 'PLN',
  expense_type text not null check (expense_type in ('ALREADY_PAID','MANDATORY_FUTURE','OPTIONAL_FUTURE','REFUNDABLE_DEPOSIT')),
  due_date date, payment_status text not null default 'UNPAID' check (payment_status in ('PAID','UNPAID','PARTIALLY_PAID','REFUNDED')),
  supplier text, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.daria_campaigns (
  id uuid primary key default gen_random_uuid(), concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  channel_id uuid not null references public.daria_sales_channels(id), campaign_name text not null, source_code text not null unique,
  planned_budget numeric(12,2) not null default 0 check (planned_budget >= 0), actual_spend numeric(12,2) not null default 0 check (actual_spend >= 0),
  start_date date, end_date date, status text not null default 'TESTING' check (status in ('TESTING','WORKING','WEAK','STOPPED')),
  attribution_quality text not null default 'UNKNOWN' check (attribution_quality in ('HIGH','MEDIUM','LOW','UNKNOWN')),
  entries integer check (entries is null or entries >= 0), platform_reported_orders integer check (platform_reported_orders is null or platform_reported_orders >= 0), platform_reported_value numeric(12,2), notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.daria_tracking_links (
  id uuid primary key default gen_random_uuid(), concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  campaign_id uuid references public.daria_campaigns(id) on delete set null, operator_id uuid references public.daria_ticketing_operators(id) on delete set null,
  channel_id uuid references public.daria_sales_channels(id) on delete set null, source_code text not null unique, statistical_url text, destination_url text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, promo_code text, status text not null default 'ACTIVE', notes text not null default '', created_at timestamptz not null default now()
);

create table public.daria_orders (
  id uuid primary key default gen_random_uuid(), concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  operator_id uuid references public.daria_ticketing_operators(id) on delete set null, campaign_id uuid references public.daria_campaigns(id) on delete set null,
  external_order_id text not null, order_date timestamptz, ticket_count integer not null check (ticket_count > 0), gross_revenue numeric(12,2) not null default 0 check (gross_revenue >= 0), net_revenue numeric(12,2), currency text not null default 'PLN', source_code text, attribution_type text not null default 'UNKNOWN' check (attribution_type in ('CONFIRMED','PLATFORM_ATTRIBUTED','UNKNOWN')), promo_code text, status text not null default 'PAID' check (status in ('PAID','PENDING','REFUNDED','CANCELLED')), notes text not null default '', created_at timestamptz not null default now(), unique(operator_id, external_order_id)
);

create table public.daria_daily_sales_snapshots (
  id uuid primary key default gen_random_uuid(), concert_id uuid not null references public.daria_concerts(id) on delete cascade, operator_id uuid references public.daria_ticketing_operators(id) on delete set null, snapshot_date date not null, tickets_sold_total integer not null check (tickets_sold_total >= 0), revenue_total numeric(12,2) not null default 0 check (revenue_total >= 0), currency text not null default 'PLN', unique(concert_id, operator_id, snapshot_date)
);

create table public.daria_audit_log (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, created_at timestamptz not null default now()
);

create index daria_orders_concert_paid_idx on public.daria_orders(concert_id, status);
create index daria_expenses_concert_idx on public.daria_expenses(concert_id, expense_type, payment_status);
create index daria_campaigns_concert_idx on public.daria_campaigns(concert_id, channel_id);

alter table public.daria_user_roles enable row level security;
alter table public.daria_concerts enable row level security;
alter table public.daria_ticketing_operators enable row level security;
alter table public.daria_sales_channels enable row level security;
alter table public.daria_expenses enable row level security;
alter table public.daria_campaigns enable row level security;
alter table public.daria_tracking_links enable row level security;
alter table public.daria_orders enable row level security;
alter table public.daria_daily_sales_snapshots enable row level security;
alter table public.daria_audit_log enable row level security;

create function public.daria_has_role(allowed_roles text[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.daria_user_roles where user_id = auth.uid() and role = any(allowed_roles));
$$;

create policy daria_roles_self_read on public.daria_user_roles for select using (user_id = auth.uid());

create policy daria_concerts_read on public.daria_concerts for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_concerts_write on public.daria_concerts for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_operators_read on public.daria_ticketing_operators for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_operators_write on public.daria_ticketing_operators for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_channels_read on public.daria_sales_channels for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_channels_write on public.daria_sales_channels for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_expenses_read on public.daria_expenses for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_expenses_write on public.daria_expenses for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_campaigns_read on public.daria_campaigns for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_campaigns_write on public.daria_campaigns for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_links_read on public.daria_tracking_links for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_links_write on public.daria_tracking_links for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_orders_read on public.daria_orders for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_orders_write on public.daria_orders for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_snapshots_read on public.daria_daily_sales_snapshots for select using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_snapshots_write on public.daria_daily_sales_snapshots for all using (public.daria_has_role(array['ADMIN','MANAGER'])) with check (public.daria_has_role(array['ADMIN','MANAGER']));
create policy daria_audit_read on public.daria_audit_log for select using (public.daria_has_role(array['ADMIN']));

-- Equal workspace access for the three Legacy accounts. If an account has not
-- yet used its magic link, sign in once and run this final statement again.
insert into public.daria_user_roles (user_id, role)
select id, 'MANAGER'
from auth.users
where lower(email) in ('dudodomu@gmail.com', 'decisiongreat1@gmail.com', 'legacyimperialconcerts@gmail.com')
on conflict (user_id) do update set role = excluded.role;
