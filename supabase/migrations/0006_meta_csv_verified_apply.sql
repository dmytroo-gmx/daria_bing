-- Legacy Brain: apply a verified Meta CSV snapshot to one campaign with provenance.
-- The function replaces campaign platform metrics only after an explicit human check.

create table if not exists public.daria_csv_imports (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.daria_source_documents(id) on delete restrict,
  campaign_id uuid not null references public.daria_campaigns(id) on delete restrict,
  import_kind text not null check (import_kind = 'META_CSV'),
  rows_reviewed integer not null default 0 check (rows_reviewed >= 0),
  metric_payload jsonb not null,
  application_mode text not null check (application_mode = 'REPLACE_CAMPAIGN_METRICS'),
  applied_by uuid references auth.users(id),
  applied_at timestamptz not null default now()
);

create index if not exists daria_csv_imports_source_idx on public.daria_csv_imports(source_document_id, applied_at desc);
create index if not exists daria_csv_imports_campaign_idx on public.daria_csv_imports(campaign_id, applied_at desc);
alter table public.daria_csv_imports enable row level security;

drop policy if exists daria_csv_imports_read on public.daria_csv_imports;
create policy daria_csv_imports_read on public.daria_csv_imports
for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));

create or replace function public.daria_apply_meta_csv_import(
  p_source_document_id uuid,
  p_campaign_id uuid,
  p_actual_spend numeric,
  p_platform_orders integer,
  p_platform_value numeric,
  p_rows_reviewed integer default 0
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  import_id uuid;
begin
  if not public.daria_has_role(array['ADMIN', 'MANAGER']) then
    raise exception 'MANAGER or ADMIN role required';
  end if;
  if coalesce(p_actual_spend, 0) < 0 or coalesce(p_platform_orders, 0) < 0 or coalesce(p_platform_value, 0) < 0 or coalesce(p_rows_reviewed, 0) < 0 then
    raise exception 'Imported values cannot be negative';
  end if;
  if not exists (select 1 from public.daria_source_documents where id = p_source_document_id and document_type = 'META_CSV') then
    raise exception 'Source document must be a META_CSV';
  end if;
  if not exists (select 1 from public.daria_campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found';
  end if;

  update public.daria_campaigns
  set actual_spend = coalesce(p_actual_spend, 0),
      platform_reported_orders = coalesce(p_platform_orders, 0),
      platform_reported_value = coalesce(p_platform_value, 0),
      updated_at = now()
  where id = p_campaign_id;

  insert into public.daria_csv_imports (
    source_document_id, campaign_id, import_kind, rows_reviewed, metric_payload,
    application_mode, applied_by
  ) values (
    p_source_document_id, p_campaign_id, 'META_CSV', coalesce(p_rows_reviewed, 0),
    jsonb_build_object('actual_spend', coalesce(p_actual_spend, 0), 'platform_orders', coalesce(p_platform_orders, 0), 'platform_value', coalesce(p_platform_value, 0)),
    'REPLACE_CAMPAIGN_METRICS', auth.uid()
  ) returning id into import_id;

  update public.daria_source_documents set import_status = 'APPLIED' where id = p_source_document_id;
  return import_id;
end;
$$;

drop trigger if exists daria_audit_source_documents on public.daria_source_documents;
drop trigger if exists daria_audit_csv_imports on public.daria_csv_imports;
create trigger daria_audit_source_documents after insert or update or delete on public.daria_source_documents for each row execute function public.daria_write_audit_log();
create trigger daria_audit_csv_imports after insert or update or delete on public.daria_csv_imports for each row execute function public.daria_write_audit_log();
