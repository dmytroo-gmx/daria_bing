-- Legacy Brain: canonical operational metrics and an immutable change log.
-- Additive migration. Amounts are grouped by a concert's stored currency;
-- no automatic currency conversion is performed.

create or replace function public.daria_concert_metrics()
returns table (
  concert_id uuid,
  currency text,
  paid_tickets bigint,
  paid_orders bigint,
  gross_revenue numeric,
  net_revenue numeric,
  already_spent numeric,
  mandatory_future numeric,
  optional_future numeric,
  refundable_deposits numeric,
  marketing_spend numeric,
  projected_nonref_cost numeric,
  operational_result numeric
)
language sql
stable
set search_path = public
as $$
  select
    concert.id,
    concert.currency,
    coalesce(sales.paid_tickets, 0)::bigint,
    coalesce(sales.paid_orders, 0)::bigint,
    coalesce(sales.gross_revenue, 0),
    coalesce(sales.net_revenue, 0),
    coalesce(expenses.already_spent, 0),
    coalesce(expenses.mandatory_future, 0),
    coalesce(expenses.optional_future, 0),
    coalesce(expenses.refundable_deposits, 0),
    coalesce(campaigns.marketing_spend, 0),
    coalesce(expenses.already_spent, 0) + coalesce(expenses.mandatory_future, 0),
    coalesce(sales.gross_revenue, 0) - coalesce(expenses.already_spent, 0) - coalesce(expenses.mandatory_future, 0)
  from public.daria_concerts concert
  left join lateral (
    select
      sum(order_row.ticket_count) filter (where order_row.status = 'PAID') as paid_tickets,
      count(*) filter (where order_row.status = 'PAID') as paid_orders,
      sum(order_row.gross_revenue) filter (where order_row.status = 'PAID' and order_row.currency = concert.currency) as gross_revenue,
      sum(coalesce(order_row.net_revenue, 0)) filter (where order_row.status = 'PAID' and order_row.currency = concert.currency) as net_revenue
    from public.daria_orders order_row
    where order_row.concert_id = concert.id
  ) sales on true
  left join lateral (
    select
      sum(expense.amount) filter (where expense.expense_type = 'ALREADY_PAID' and expense.payment_status = 'PAID' and expense.currency = concert.currency) as already_spent,
      sum(expense.amount) filter (where expense.expense_type = 'MANDATORY_FUTURE' and expense.payment_status not in ('PAID', 'REFUNDED') and expense.currency = concert.currency) as mandatory_future,
      sum(expense.amount) filter (where expense.expense_type = 'OPTIONAL_FUTURE' and expense.payment_status not in ('PAID', 'REFUNDED') and expense.currency = concert.currency) as optional_future,
      sum(expense.amount) filter (where expense.expense_type = 'REFUNDABLE_DEPOSIT' and expense.payment_status <> 'REFUNDED' and expense.currency = concert.currency) as refundable_deposits
    from public.daria_expenses expense
    where expense.concert_id = concert.id
  ) expenses on true
  left join lateral (
    select sum(campaign.actual_spend) as marketing_spend
    from public.daria_campaigns campaign
    where campaign.concert_id = concert.id
  ) campaigns on true;
$$;

create or replace function public.daria_channel_metrics()
returns table (
  concert_id uuid,
  campaign_id uuid,
  channel_id uuid,
  channel_name text,
  source_code text,
  actual_spend numeric,
  platform_reported_orders integer,
  platform_reported_value numeric,
  confirmed_paid_orders bigint,
  confirmed_paid_tickets bigint,
  confirmed_gross_revenue numeric,
  cpa_per_ticket numeric,
  roas numeric
)
language sql
stable
set search_path = public
as $$
  select
    campaign.concert_id,
    campaign.id,
    channel.id,
    channel.name,
    campaign.source_code,
    campaign.actual_spend,
    campaign.platform_reported_orders,
    campaign.platform_reported_value,
    count(order_row.id) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED')::bigint,
    coalesce(sum(order_row.ticket_count) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED'), 0)::bigint,
    coalesce(sum(order_row.gross_revenue) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED'), 0),
    case when coalesce(sum(order_row.ticket_count) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED'), 0) > 0
      then campaign.actual_spend / sum(order_row.ticket_count) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED') end,
    case when campaign.actual_spend > 0
      then coalesce(sum(order_row.gross_revenue) filter (where order_row.status = 'PAID' and order_row.attribution_type = 'CONFIRMED'), 0) / campaign.actual_spend end
  from public.daria_campaigns campaign
  join public.daria_sales_channels channel on channel.id = campaign.channel_id
  left join public.daria_orders order_row on order_row.campaign_id = campaign.id
  group by campaign.concert_id, campaign.id, channel.id, channel.name, campaign.source_code, campaign.actual_spend, campaign.platform_reported_orders, campaign.platform_reported_value;
$$;

create or replace function public.daria_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.daria_audit_log (user_id, action, entity_type, entity_id)
  values (auth.uid(), tg_op, tg_table_name, case when tg_op = 'DELETE' then old.id else new.id end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists daria_audit_concerts on public.daria_concerts;
drop trigger if exists daria_audit_expenses on public.daria_expenses;
drop trigger if exists daria_audit_orders on public.daria_orders;
drop trigger if exists daria_audit_campaigns on public.daria_campaigns;
drop trigger if exists daria_audit_tracking_links on public.daria_tracking_links;
drop trigger if exists daria_audit_operators on public.daria_ticketing_operators;

create trigger daria_audit_concerts after insert or update or delete on public.daria_concerts for each row execute function public.daria_write_audit_log();
create trigger daria_audit_expenses after insert or update or delete on public.daria_expenses for each row execute function public.daria_write_audit_log();
create trigger daria_audit_orders after insert or update or delete on public.daria_orders for each row execute function public.daria_write_audit_log();
create trigger daria_audit_campaigns after insert or update or delete on public.daria_campaigns for each row execute function public.daria_write_audit_log();
create trigger daria_audit_tracking_links after insert or update or delete on public.daria_tracking_links for each row execute function public.daria_write_audit_log();
create trigger daria_audit_operators after insert or update or delete on public.daria_ticketing_operators for each row execute function public.daria_write_audit_log();
