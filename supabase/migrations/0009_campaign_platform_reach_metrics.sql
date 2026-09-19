-- Legacy Brain: platform delivery metrics remain distinct from confirmed orders.
-- Additive only: existing campaign data, policies and RPCs are unchanged.

begin;

alter table public.daria_campaigns
  add column if not exists platform_impressions bigint check (platform_impressions is null or platform_impressions >= 0),
  add column if not exists platform_reach bigint check (platform_reach is null or platform_reach >= 0),
  add column if not exists platform_link_clicks bigint check (platform_link_clicks is null or platform_link_clicks >= 0),
  add column if not exists platform_landing_page_views bigint check (platform_landing_page_views is null or platform_landing_page_views >= 0),
  add column if not exists platform_metrics_updated_at timestamptz;

comment on column public.daria_campaigns.platform_impressions is 'Platform-reported delivery metric; not confirmed sales.';
comment on column public.daria_campaigns.platform_reach is 'Platform-reported delivery metric; not confirmed sales.';
comment on column public.daria_campaigns.platform_link_clicks is 'Platform-reported delivery metric; not confirmed sales.';
comment on column public.daria_campaigns.platform_landing_page_views is 'Platform-reported delivery metric; not confirmed sales.';

commit;
