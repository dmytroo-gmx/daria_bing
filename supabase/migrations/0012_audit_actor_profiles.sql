-- Legacy Brain: make the actor in the immutable audit log recognisable
-- inside the private operations interface. Existing audit rows stay unchanged.

create table if not exists public.daria_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.daria_user_profiles enable row level security;

drop policy if exists daria_profiles_read on public.daria_user_profiles;
create policy daria_profiles_read on public.daria_user_profiles
  for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));

drop policy if exists daria_profiles_admin_write on public.daria_user_profiles;
create policy daria_profiles_admin_write on public.daria_user_profiles
  for all using (public.daria_has_role(array['ADMIN']))
  with check (public.daria_has_role(array['ADMIN']));

insert into public.daria_user_profiles (user_id, display_name)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1))
from auth.users
where email is not null
on conflict (user_id) do nothing;
