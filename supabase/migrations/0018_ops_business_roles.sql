-- Business titles stay separate from technical access levels.
-- Antonio remains the founder. Dmytro keeps full operational permissions
-- without being presented as a business owner. Daria can receive tasks now;
-- her Telegram identity can be attached later without duplicating the user.

update public.daria_ops_users
set name = 'Антонио', role = 'OWNER', active = true, updated_at = now()
where telegram_user_id = 707507251;

update public.daria_ops_users
set name = 'Дмитро', role = 'OPERATIONS_ADMIN', active = true, updated_at = now()
where telegram_user_id = 7803517817;

insert into public.daria_ops_users (name, role, telegram_user_id, active)
select 'Daria Bing', 'TEAM', null, true
where not exists (
  select 1
  from public.daria_ops_users
  where lower(trim(name)) in ('daria bing', 'дария бинг', 'даша')
);
