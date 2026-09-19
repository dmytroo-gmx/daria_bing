-- Legacy Brain: source documents are evidence. PDFs are the primary format;
-- CSV is retained for structured imports such as Meta exports.

create table if not exists public.daria_source_documents (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid references public.daria_concerts(id) on delete set null,
  document_type text not null check (document_type in ('PDF_REPORT', 'META_CSV', 'OPERATOR_CSV', 'OTHER_CSV')),
  source_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  source_date date,
  import_status text not null default 'NEW' check (import_status in ('NEW', 'REVIEWED', 'APPLIED', 'REJECTED')),
  notes text not null default '',
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists daria_source_documents_concert_idx on public.daria_source_documents(concert_id, source_date desc);
alter table public.daria_source_documents enable row level security;

drop policy if exists daria_source_documents_read on public.daria_source_documents;
drop policy if exists daria_source_documents_write on public.daria_source_documents;
create policy daria_source_documents_read on public.daria_source_documents
for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));
create policy daria_source_documents_write on public.daria_source_documents
for all using (public.daria_has_role(array['ADMIN', 'MANAGER']))
with check (public.daria_has_role(array['ADMIN', 'MANAGER']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legacy-brain-source-documents', 'legacy-brain-source-documents', false, 20971520, array['application/pdf', 'text/csv', 'application/csv'])
on conflict (id) do nothing;

drop policy if exists legacy_brain_document_read on storage.objects;
drop policy if exists legacy_brain_document_write on storage.objects;
drop policy if exists legacy_brain_document_update on storage.objects;
drop policy if exists legacy_brain_document_delete on storage.objects;
create policy legacy_brain_document_read on storage.objects
for select using (bucket_id = 'legacy-brain-source-documents' and public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));
create policy legacy_brain_document_write on storage.objects
for insert with check (bucket_id = 'legacy-brain-source-documents' and public.daria_has_role(array['ADMIN', 'MANAGER']));
create policy legacy_brain_document_update on storage.objects
for update using (bucket_id = 'legacy-brain-source-documents' and public.daria_has_role(array['ADMIN', 'MANAGER']))
with check (bucket_id = 'legacy-brain-source-documents' and public.daria_has_role(array['ADMIN', 'MANAGER']));
create policy legacy_brain_document_delete on storage.objects
for delete using (bucket_id = 'legacy-brain-source-documents' and public.daria_has_role(array['ADMIN', 'MANAGER']));
