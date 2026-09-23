-- Legacy Brain: preserve operator totals with no measurable source separately.
-- These are cumulative report totals, not invented order rows. They increase
-- concert sales only and never attribute revenue or tickets to a channel.

begin;

create table if not exists public.daria_unattributed_operator_reports (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.daria_concerts(id) on delete cascade,
  operator_id uuid not null references public.daria_ticketing_operators(id) on delete restrict,
  reported_on date not null,
  confirmed_orders integer not null check (confirmed_orders >= 0),
  confirmed_tickets integer not null check (confirmed_tickets >= 0),
  confirmed_revenue numeric(12,2) not null check (confirmed_revenue >= 0),
  currency text not null default 'PLN',
  source_document_id uuid not null references public.daria_source_documents(id) on delete restrict,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(concert_id, operator_id, reported_on)
);

create index if not exists daria_unattributed_operator_reports_concert_operator_idx
  on public.daria_unattributed_operator_reports(concert_id, operator_id, reported_on desc);

alter table public.daria_unattributed_operator_reports enable row level security;

create policy daria_unattributed_operator_reports_read on public.daria_unattributed_operator_reports
  for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));
create policy daria_unattributed_operator_reports_write on public.daria_unattributed_operator_reports
  for all using (public.daria_has_role(array['ADMIN', 'MANAGER']))
  with check (public.daria_has_role(array['ADMIN', 'MANAGER']));

drop trigger if exists daria_audit_unattributed_operator_reports on public.daria_unattributed_operator_reports;
create trigger daria_audit_unattributed_operator_reports
  after insert or update or delete on public.daria_unattributed_operator_reports
  for each row execute function public.daria_write_audit_log();

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
      coalesce(detail.paid_tickets, 0) + coalesce(reports.paid_tickets, 0) + coalesce(unattributed.paid_tickets, 0) as paid_tickets,
      coalesce(detail.paid_orders, 0) + coalesce(reports.paid_orders, 0) + coalesce(unattributed.paid_orders, 0) as paid_orders,
      coalesce(detail.gross_revenue, 0) + coalesce(reports.gross_revenue, 0) + coalesce(unattributed.gross_revenue, 0) as gross_revenue,
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
    cross join lateral (
      select sum(latest.confirmed_tickets) filter (where latest.currency = concert.currency) as paid_tickets,
        sum(latest.confirmed_orders) filter (where latest.currency = concert.currency) as paid_orders,
        sum(latest.confirmed_revenue) filter (where latest.currency = concert.currency) as gross_revenue
      from (
        select distinct on (report.concert_id, report.operator_id) report.*
        from public.daria_unattributed_operator_reports report
        where report.concert_id = concert.id
          and not exists (
            select 1 from public.daria_orders order_row
            where order_row.concert_id = report.concert_id
              and order_row.operator_id = report.operator_id
              and order_row.status = 'PAID'
              and order_row.attribution_type = 'UNKNOWN'
          )
        order by report.concert_id, report.operator_id, report.reported_on desc, report.created_at desc
      ) latest
    ) unattributed
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

comment on table public.daria_unattributed_operator_reports is
  'Cumulative operator-report totals with no measurable source. Latest report per concert and operator is used only when no paid UNKNOWN order rows exist for that pair.';

commit;
