-- Legacy Imperial "Всё под рукой": Telegram identities and task assignments.
-- Additive only. Existing Legacy Brain records are not deleted or overwritten.

create table if not exists public.daria_ops_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  role text not null default 'TEAM' check (role in ('OWNER', 'OPERATIONS_ADMIN', 'TEAM')),
  telegram_user_id bigint unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daria_ops_access_requests (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_name text not null default '',
  telegram_username text,
  decision text check (decision in ('APPROVED', 'REJECTED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.daria_ops_users(id)
);

alter table public.daria_operational_tasks
  add column if not exists assignee_ops_user_id uuid references public.daria_ops_users(id) on delete set null,
  add column if not exists blocked_by_ops_user_id uuid references public.daria_ops_users(id) on delete set null,
  add column if not exists created_by_ops_user_id uuid references public.daria_ops_users(id) on delete set null;

alter table public.daria_operational_tasks
  drop constraint if exists daria_operational_tasks_task_status_check;

alter table public.daria_operational_tasks
  add constraint daria_operational_tasks_task_status_check
  check (task_status in ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_DECISION', 'DONE', 'CANCELLED'));

create index if not exists daria_operational_tasks_assignee_idx
  on public.daria_operational_tasks (assignee_ops_user_id, task_status, due_date);

create index if not exists daria_operational_tasks_blocked_idx
  on public.daria_operational_tasks (blocked_by_ops_user_id, task_status);

alter table public.daria_ops_users enable row level security;
alter table public.daria_ops_access_requests enable row level security;

-- Direct browser access stays closed. Telegram requests are validated by
-- Vercel server functions before the service key is used.

insert into public.daria_ops_users (name, role, telegram_user_id, active)
values
  ('Дмитро', 'OWNER', 7803517817, true),
  ('Антонио', 'OWNER', 707507251, true)
on conflict (telegram_user_id) do update
set name = excluded.name,
    role = excluded.role,
    active = true,
    updated_at = now();

