-- Delivery log for daily Telegram reminders. Direct browser access remains
-- closed; the server function writes through the service key.

create table if not exists public.daria_ops_reminder_log (
  id uuid primary key default gen_random_uuid(),
  ops_user_id uuid not null references public.daria_ops_users(id) on delete cascade,
  entity_type text not null check (entity_type in ('TASK','MILESTONE')),
  entity_id uuid not null,
  reminder_date date not null,
  telegram_message_id bigint,
  sent_at timestamptz not null default now(),
  unique (ops_user_id, entity_type, entity_id, reminder_date)
);

create index if not exists daria_ops_reminder_log_date_idx
  on public.daria_ops_reminder_log (reminder_date desc, ops_user_id);

alter table public.daria_ops_reminder_log enable row level security;
