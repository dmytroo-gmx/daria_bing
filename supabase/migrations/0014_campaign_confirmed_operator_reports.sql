-- Legacy Brain: a ticket operator may confirm a campaign total in a report
-- without providing order-level identifiers. Keep that evidence separate from
-- individual orders, and use it only as a non-duplicating fallback.

begin;

create table if not exists public.daria_campaign_confirmed_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.daria_campaigns(id) on delete cascade,
  reported_on date not null,
  confirmed_orders integer not null check (confirmed_orders >= 0),
  confirmed_tickets integer not null check (confirmed_tickets >= 0),
  confirmed_revenue numeric(12,2) not null check (confirmed_revenue >= 0),
  currency text not null default 'PLN',
  source_document_id uuid not null references public.daria_source_documents(id) on delete restrict,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, reported_on)
);

alter table public.daria_campaign_confirmed_reports enable row level security;

create policy daria_campaign_confirmed_reports_read on public.daria_campaign_confirmed_reports
  for select using (public.daria_has_role(array['ADMIN', 'MANAGER', 'VIEWER']));
create policy daria_campaign_confirmed_reports_write on public.daria_campaign_confirmed_reports
  for all using (public.daria_has_role(array['ADMIN', 'MANAGER']))
  with check (public.daria_has_role(array['ADMIN', 'MANAGER']));

drop trigger if exists daria_audit_campaign_confirmed_reports on public.daria_campaign_confirmed_reports;
create trigger daria_audit_campaign_confirmed_reports
  after insert or update or delete on public.daria_campaign_confirmed_reports
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
    coalesce(expenses.already_spent, 0) + coalesce(expenses.mandatory_future, 0),
    coalesce(sales.gross_revenue, 0) - coalesce(expenses.already_spent, 0) - coalesce(expenses.mandatory_future, 0) - coalesce(campaigns.marketing_spend, 0)
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
    select sum(amount) filter (where expense_type = 'ALREADY_PAID' and payment_status = 'PAID' and currency = concert.currency) as already_spent,
      sum(amount) filter (where expense_type = 'MANDATORY_FUTURE' and payment_status not in ('PAID', 'REFUNDED') and currency = concert.currency) as mandatory_future,
      sum(amount) filter (where expense_type = 'OPTIONAL_FUTURE' and payment_status not in ('PAID', 'REFUNDED') and currency = concert.currency) as optional_future,
      sum(amount) filter (where expense_type = 'REFUNDABLE_DEPOSIT' and payment_status <> 'REFUNDED' and currency = concert.currency) as refundable_deposits
    from public.daria_expenses where concert_id = concert.id
  ) expenses on true
  left join lateral (select sum(actual_spend) as marketing_spend from public.daria_campaigns where concert_id = concert.id) campaigns on true;
$$;

create or replace function public.daria_channel_metrics()
returns table (
  concert_id uuid, campaign_id uuid, channel_id uuid, channel_name text, source_code text,
  actual_spend numeric, platform_reported_orders integer, platform_reported_value numeric,
  confirmed_paid_orders bigint, confirmed_paid_tickets bigint, confirmed_gross_revenue numeric,
  cpa_per_ticket numeric, roas numeric
)
language sql stable set search_path = public as $$
  select campaign.concert_id, campaign.id, channel.id, channel.name, campaign.source_code,
    campaign.actual_spend, campaign.platform_reported_orders, campaign.platform_reported_value,
    coalesce(detail.confirmed_orders, latest.confirmed_orders, 0)::bigint,
    coalesce(detail.confirmed_tickets, latest.confirmed_tickets, 0)::bigint,
    coalesce(detail.confirmed_revenue, latest.confirmed_revenue, 0),
    case when coalesce(detail.confirmed_tickets, latest.confirmed_tickets, 0) > 0 then campaign.actual_spend / coalesce(detail.confirmed_tickets, latest.confirmed_tickets) end,
    case when campaign.actual_spend > 0 then coalesce(detail.confirmed_revenue, latest.confirmed_revenue, 0) / campaign.actual_spend end
  from public.daria_campaigns campaign
  join public.daria_sales_channels channel on channel.id = campaign.channel_id
  left join lateral (
    select count(*)::bigint as confirmed_orders, sum(ticket_count)::bigint as confirmed_tickets, sum(gross_revenue) as confirmed_revenue
    from public.daria_orders where campaign_id = campaign.id and status = 'PAID' and attribution_type = 'CONFIRMED'
  ) detail on true
  left join lateral (
    select report.confirmed_orders, report.confirmed_tickets, report.confirmed_revenue
    from public.daria_campaign_confirmed_reports report
    where report.campaign_id = campaign.id
      and not exists (select 1 from public.daria_orders order_row where order_row.campaign_id = campaign.id and order_row.status = 'PAID')
    order by report.reported_on desc, report.created_at desc limit 1
  ) latest on true;
$$;

comment on table public.daria_campaign_confirmed_reports is 'Cumulative operator-report totals. Latest report is used only when a campaign has no paid order rows.';

commit;
