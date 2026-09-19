-- Legacy Brain: managers need read-only visibility of the operational audit log.
-- Writes remain trigger-only; this does not grant direct audit-log edits.

drop policy if exists daria_audit_read on public.daria_audit_log;

create policy daria_audit_read on public.daria_audit_log
for select
using (public.daria_has_role(array['ADMIN', 'MANAGER']));
