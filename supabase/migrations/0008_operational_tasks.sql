-- Legacy Brain: operational work belongs to the concert record and audit trail.

create table if not exists public.daria_operational_tasks (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid references public.daria_concerts(id) on delete set null,
  title text not null check (length(title) between 1 and 240),
  details text not null default '',
  task_status text not null default 'OPEN' check (task_status in ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  due_date date,
  created_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daria_operational_tasks_concert_idx on public.daria_operational_tasks(concert_id, task_status, due_date);
alter table public.daria_operational_tasks enable row level security;

drop policy if exists daria_operational_tasks_read on public.daria_operational_tasks;
drop policy if exists daria_operational_tasks_write on public.daria_operational_tasks;
create policy daria_operational_tasks_read on public.daria_operational_tasks
for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));
create policy daria_operational_tasks_write on public.daria_operational_tasks
for all using (public.daria_has_role(array['ADMIN', 'MANAGER']))
with check (public.daria_has_role(array['ADMIN', 'MANAGER']));

drop trigger if exists daria_audit_operational_tasks on public.daria_operational_tasks;
create trigger daria_audit_operational_tasks
after insert or update or delete on public.daria_operational_tasks
for each row execute function public.daria_write_audit_log();
