-- Legacy Brain: keep the database metric aligned with the interface.
-- Campaign actual_spend is recorded in the concert's operating currency.
-- No currency conversion is performed here.

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
    coalesce(sales.gross_revenue, 0) - coalesce(expenses.already_spent, 0) - coalesce(expenses.mandatory_future, 0) - coalesce(campaigns.marketing_spend, 0)
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
