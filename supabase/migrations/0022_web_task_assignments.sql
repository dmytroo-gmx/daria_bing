-- Expose only the minimum team directory needed for task assignment.
-- The browser never receives Telegram IDs and cannot write to ops users.

drop policy if exists daria_ops_users_web_read on public.daria_ops_users;

create or replace function public.daria_list_ops_people()
returns table (id uuid, name text, role text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']) then
    raise exception 'insufficient_privilege';
  end if;

  return query
  select person.id, person.name, person.role
  from public.daria_ops_users person
  where person.active = true
  order by person.name;
end;
$$;

revoke all on function public.daria_list_ops_people() from public;
grant execute on function public.daria_list_ops_people() to authenticated;
