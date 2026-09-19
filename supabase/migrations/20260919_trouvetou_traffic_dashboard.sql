create table if not exists public.trouvetou_traffic_daily (
  day date primary key,
  visits bigint not null default 0 check (visits >= 0),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trouvetou_traffic_daily enable row level security;

create or replace function public.set_trouvetou_traffic_daily_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trouvetou_traffic_daily_updated_at on public.trouvetou_traffic_daily;
create trigger set_trouvetou_traffic_daily_updated_at
before update on public.trouvetou_traffic_daily
for each row execute function public.set_trouvetou_traffic_daily_updated_at();

revoke all on public.trouvetou_traffic_daily from anon, authenticated;

comment on table public.trouvetou_traffic_daily is
  'Daily traffic aggregates for Trouvetou displayed only in Refontiq Control Center.';
