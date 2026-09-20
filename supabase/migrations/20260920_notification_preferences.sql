create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_notifications boolean not null default true,
  sound_enabled boolean not null default true,
  critical_alerts boolean not null default true,
  warning_alerts boolean not null default true,
  info_alerts boolean not null default false,
  payment_alerts boolean not null default true,
  sync_alerts boolean not null default true,
  traffic_alerts boolean not null default true,
  system_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
