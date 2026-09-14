-- Legacy Brain: equal MANAGER access for the agreed Legacy work accounts.
-- Safe to rerun. Existing roles are updated, not duplicated.

create or replace function public.daria_assign_legacy_brain_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) in (
    'dudodomu@gmail.com',
    'decisiongreat1@gmail.com',
    'legacyimperialconcerts@gmail.com'
  ) then
    insert into public.daria_user_roles (user_id, role)
    values (new.id, 'MANAGER')
    on conflict (user_id) do update
      set role = excluded.role;
  end if;

  return new;
end;
$$;

drop trigger if exists daria_assign_legacy_brain_role_on_signup on auth.users;

create trigger daria_assign_legacy_brain_role_on_signup
after insert on auth.users
for each row
execute function public.daria_assign_legacy_brain_role();

insert into public.daria_user_roles (user_id, role)
select id, 'MANAGER'
from auth.users
where lower(email) in (
  'dudodomu@gmail.com',
  'decisiongreat1@gmail.com',
  'legacyimperialconcerts@gmail.com'
)
on conflict (user_id) do update
  set role = excluded.role;
