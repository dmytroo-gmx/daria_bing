-- Legacy Brain: optional future costs affect a forecast only when explicitly selected.
-- Existing expenses remain unchanged and are excluded until a manager opts in.

begin;

alter table public.daria_expenses
  add column if not exists include_in_projected_cost boolean not null default false;

comment on column public.daria_expenses.include_in_projected_cost is
  'For OPTIONAL_FUTURE expenses only: whether this cost is included in projected non-refundable cost and operational result.';

create or replace function public.daria_concert_metrics()
returns table (
  concert_id uuid, currency text, paid_tickets bigint, paid_orders bigint,
  gross_revenue numeric, net_revenue numeric, already_spent numeric,
  mandatory_future numeric, optional_future numeric, refundable_deposits numeric,
  marketing_spend numeric, projected_nonref_cost numeric, operational_result numeric
)
language sql stable set search_path = public as $$
  select concert.id, concert.currency,
    coalesce(sales.paid_tickets, 0)::bigint, coalesce(sales.paid_orders, 0)::bigint,
    coalesce(sales.gross_revenue, 0), coalesce(sales.net_revenue, 0),
    coalesce(expenses.already_spent, 0), coalesce(expenses.mandatory_future, 0),
    coalesce(expenses.optional_future, 0), coalesce(expenses.refundable_deposits, 0),
    coalesce(campaigns.marketing_spend, 0),
    coalesce(expenses.already_spent, 0) + coalesce(expenses.mandatory_future, 0) + coalesce(expenses.selected_optional_future, 0),
    coalesce(sales.gross_revenue, 0) - coalesce(expenses.already_spent, 0) - coalesce(expenses.mandatory_future, 0) - coalesce(expenses.selected_optional_future, 0) - coalesce(campaigns.marketing_spend, 0)
  from public.daria_concerts concert
  left join lateral (
    select
      coalesce(detail.paid_tickets, 0) + coalesce(reports.paid_tickets, 0) as paid_tickets,
      coalesce(detail.paid_orders, 0) + coalesce(reports.paid_orders, 0) as paid_orders,
      coalesce(detail.gross_revenue, 0) + coalesce(reports.gross_revenue, 0) as gross_revenue,
      coalesce(detail.net_revenue, 0) as net_revenue
    from lateral (
      select sum(ticket_count) as paid_tickets, count(*) as paid_orders,
        sum(gross_revenue) filter (where currency = concert.currency) as gross_revenue,
        sum(coalesce(net_revenue, 0)) filter (where currency = concert.currency) as net_revenue
      from public.daria_orders where concert_id = concert.id and status = 'PAID'
    ) detail
    cross join lateral (
      select sum(latest.confirmed_tickets) filter (where latest.currency = concert.currency) as paid_tickets,
        sum(latest.confirmed_orders) filter (where latest.currency = concert.currency) as paid_orders,
        sum(latest.confirmed_revenue) filter (where latest.currency = concert.currency) as gross_revenue
      from public.daria_campaigns campaign
      join lateral (
        select report.* from public.daria_campaign_confirmed_reports report
        where report.campaign_id = campaign.id order by report.reported_on desc, report.created_at desc limit 1
      ) latest on true
      where campaign.concert_id = concert.id
        and not exists (select 1 from public.daria_orders order_row where order_row.campaign_id = campaign.id and order_row.status = 'PAID')
    ) reports
  ) sales on true
  left join lateral (
    select
      sum(amount) filter (where expense_type = 'ALREADY_PAID' and payment_status = 'PAID' and currency = concert.currency) as already_spent,
      sum(amount) filter (where expense_type = 'MANDATORY_FUTURE' and payment_status not in ('PAID', 'REFUNDED') and currency = concert.currency) as mandatory_future,
      sum(amount) filter (where expense_type = 'OPTIONAL_FUTURE' and payment_status not in ('PAID', 'REFUNDED') and currency = concert.currency) as optional_future,
      sum(amount) filter (where expense_type = 'OPTIONAL_FUTURE' and include_in_projected_cost and payment_status not in ('PAID', 'REFUNDED') and currency = concert.currency) as selected_optional_future,
      sum(amount) filter (where expense_type = 'REFUNDABLE_DEPOSIT' and payment_status <> 'REFUNDED' and currency = concert.currency) as refundable_deposits
    from public.daria_expenses where concert_id = concert.id
  ) expenses on true
  left join lateral (select sum(actual_spend) as marketing_spend from public.daria_campaigns where concert_id = concert.id) campaigns on true;
$$;

commit;
