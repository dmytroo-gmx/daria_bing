-- Keep authority equal while preserving the real business titles.
-- Antonio is the founder/producer; Dmytro administers operations and digital work.

update public.daria_ops_users
set role = 'OWNER',
    updated_at = now()
where telegram_user_id = 707507251;

update public.daria_ops_users
set role = 'OPERATIONS_ADMIN',
    updated_at = now()
where telegram_user_id = 7803517817;
