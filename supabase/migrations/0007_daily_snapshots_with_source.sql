-- Legacy Brain: a daily sales snapshot must retain its source evidence.

alter table public.daria_daily_sales_snapshots
  add column if not exists source_document_id uuid references public.daria_source_documents(id) on delete set null,
  add column if not exists source_note text not null default '';

create index if not exists daria_daily_snapshots_source_idx
on public.daria_daily_sales_snapshots(source_document_id);

drop trigger if exists daria_audit_daily_sales_snapshots on public.daria_daily_sales_snapshots;
create trigger daria_audit_daily_sales_snapshots
after insert or update or delete on public.daria_daily_sales_snapshots
for each row execute function public.daria_write_audit_log();
