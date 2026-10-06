-- New Era regulation, revision 2026-10-06. Additive operational records.
-- No historical concert, task, sales, campaign or document row is changed.

create table if not exists public.daria_regulation_steps (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete restrict,
  step_code text not null check (step_code in (
    'EXPERT_REVIEW','BREAK_EVEN','CHANNEL_PLAN','FUNDING','CHECKPOINTS','PRODUCT_PROOF',
    'HOOK','AUDIENCE_CREATIVE','AD_TEST','SPONSOR_FACTS','SEASON_PRICE','CHANNEL_MEASUREMENT'
  )),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','VERIFIED','EXCEPTION')),
  reviewer_name text not null default '',
  professional_name text not null default '',
  notes text not null default '',
  source_document_id uuid references public.daria_source_documents(id) on delete set null,
  decision text check (decision in ('CONTINUE','POSTPONE','CANCEL')),
  reviewed_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id),
  updated_by_ops_user_id uuid references public.daria_ops_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (concert_id, step_code),
  check (status not in ('VERIFIED','EXCEPTION') or (length(trim(notes)) > 0 and length(trim(reviewer_name)) > 0)),
  check (status <> 'EXCEPTION' or source_document_id is not null),
  check (step_code <> 'EXPERT_REVIEW' or status not in ('VERIFIED','EXCEPTION') or (length(trim(professional_name)) > 0 and source_document_id is not null)),
  check (step_code <> 'BREAK_EVEN' or status <> 'EXCEPTION' or length(trim(professional_name)) > 0),
  check (decision is null or step_code = 'CHECKPOINTS'),
  check (decision is null or status in ('VERIFIED','EXCEPTION'))
);

create table if not exists public.daria_channel_plans (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete restrict,
  channel_id uuid not null references public.daria_sales_channels(id) on delete restrict,
  expected_tickets integer not null check (expected_tickets >= 0),
  allowable_cpa numeric(12,2) not null check (allowable_cpa >= 0),
  planned_budget numeric(12,2) not null check (planned_budget >= 0),
  currency text not null default 'PLN' check (length(currency) = 3),
  assumptions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (concert_id, channel_id)
);

create table if not exists public.daria_funding_sources (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete restrict,
  source_name text not null check (length(trim(source_name)) between 1 and 160),
  source_type text not null check (source_type in ('RESERVE','SPONSOR','OTHER')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PLN' check (length(currency) = 3),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','CONFIRMED','RELEASED')),
  available_on date,
  source_document_id uuid references public.daria_source_documents(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'CONFIRMED' or source_document_id is not null)
);

create table if not exists public.daria_creative_reviews (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete restrict,
  campaign_id uuid references public.daria_campaigns(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  format text not null check (format in ('VIDEO','STATIC')),
  hook_text text not null default '',
  hook_visible_first_1_2 boolean not null default false,
  calm_edit boolean not null default false,
  lamp_appearances integer not null default 0 check (lamp_appearances >= 0),
  real_people boolean not null default false,
  ai_visual_used boolean not null default false,
  text_checked_manually boolean not null default false,
  feedback_notes text not null default '',
  test_budget_cap numeric(12,2) not null default 0 check (test_budget_cap >= 0),
  currency text not null default 'PLN' check (length(currency) = 3),
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','STOPPED')),
  source_document_id uuid references public.daria_source_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'READY' or (length(trim(hook_text)) > 0 and calm_edit and text_checked_manually and lamp_appearances <= 1 and length(trim(feedback_notes)) > 0 and test_budget_cap > 0)),
  check (status <> 'READY' or format <> 'VIDEO' or hook_visible_first_1_2)
);

create index if not exists daria_regulation_steps_concert_idx on public.daria_regulation_steps(concert_id, status);
create index if not exists daria_channel_plans_concert_idx on public.daria_channel_plans(concert_id);
create index if not exists daria_funding_sources_concert_idx on public.daria_funding_sources(concert_id, status);
create index if not exists daria_creative_reviews_concert_idx on public.daria_creative_reviews(concert_id, status);

alter table public.daria_regulation_steps enable row level security;
alter table public.daria_channel_plans enable row level security;
alter table public.daria_funding_sources enable row level security;
alter table public.daria_creative_reviews enable row level security;

drop policy if exists daria_regulation_steps_read on public.daria_regulation_steps;
drop policy if exists daria_regulation_steps_write on public.daria_regulation_steps;
create policy daria_regulation_steps_read on public.daria_regulation_steps for select
  using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_regulation_steps_write on public.daria_regulation_steps for all
  using (public.daria_has_role(array['ADMIN','MANAGER']))
  with check (
    public.daria_has_role(array['ADMIN','MANAGER'])
    and updated_by_auth_user_id = auth.uid()
    and (status not in ('VERIFIED','EXCEPTION') or reviewer_name = coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists daria_channel_plans_read on public.daria_channel_plans;
drop policy if exists daria_channel_plans_write on public.daria_channel_plans;
create policy daria_channel_plans_read on public.daria_channel_plans for select
  using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_channel_plans_write on public.daria_channel_plans for all
  using (public.daria_has_role(array['ADMIN','MANAGER']))
  with check (public.daria_has_role(array['ADMIN','MANAGER']));

drop policy if exists daria_funding_sources_read on public.daria_funding_sources;
drop policy if exists daria_funding_sources_write on public.daria_funding_sources;
create policy daria_funding_sources_read on public.daria_funding_sources for select
  using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_funding_sources_write on public.daria_funding_sources for all
  using (public.daria_has_role(array['ADMIN','MANAGER']))
  with check (public.daria_has_role(array['ADMIN','MANAGER']));

drop policy if exists daria_creative_reviews_read on public.daria_creative_reviews;
drop policy if exists daria_creative_reviews_write on public.daria_creative_reviews;
create policy daria_creative_reviews_read on public.daria_creative_reviews for select
  using (public.daria_has_role(array['ADMIN','MANAGER','VIEWER']));
create policy daria_creative_reviews_write on public.daria_creative_reviews for all
  using (public.daria_has_role(array['ADMIN','MANAGER']))
  with check (public.daria_has_role(array['ADMIN','MANAGER']));

drop trigger if exists daria_audit_regulation_steps on public.daria_regulation_steps;
drop trigger if exists daria_audit_channel_plans on public.daria_channel_plans;
drop trigger if exists daria_audit_funding_sources on public.daria_funding_sources;
drop trigger if exists daria_audit_creative_reviews on public.daria_creative_reviews;
create trigger daria_audit_regulation_steps after insert or update or delete on public.daria_regulation_steps
  for each row execute function public.daria_write_audit_log();
create trigger daria_audit_channel_plans after insert or update or delete on public.daria_channel_plans
  for each row execute function public.daria_write_audit_log();
create trigger daria_audit_funding_sources after insert or update or delete on public.daria_funding_sources
  for each row execute function public.daria_write_audit_log();
create trigger daria_audit_creative_reviews after insert or update or delete on public.daria_creative_reviews
  for each row execute function public.daria_write_audit_log();
