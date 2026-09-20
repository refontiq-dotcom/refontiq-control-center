alter table public.portfolio_metrics
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.portfolio_metrics.details is
  'Project-specific metrics supplied by the product. Values must be factual and current to the synchronization timestamp.';
