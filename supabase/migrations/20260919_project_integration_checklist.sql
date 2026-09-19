create table if not exists public.project_integration_checklist_items (
  id uuid primary key default gen_random_uuid(),
  projet text not null,
  item_key text not null,
  section text not null,
  label text not null,
  required boolean not null default true,
  checked boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  unique (projet, item_key)
);

create table if not exists public.project_integration_status (
  projet text primary key,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'validated', 'blocked')),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.project_integration_checklist_items enable row level security;
alter table public.project_integration_status enable row level security;

revoke all on public.project_integration_checklist_items from anon, authenticated;
revoke all on public.project_integration_status from anon, authenticated;

create or replace function public.set_project_integration_checklist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_integration_checklist_items_updated_at
on public.project_integration_checklist_items;

create trigger project_integration_checklist_items_updated_at
before update on public.project_integration_checklist_items
for each row execute function public.set_project_integration_checklist_updated_at();

drop trigger if exists project_integration_status_updated_at
on public.project_integration_status;

create trigger project_integration_status_updated_at
before update on public.project_integration_status
for each row execute function public.set_project_integration_checklist_updated_at();

comment on table public.project_integration_checklist_items is
  'Per-project Refontiq integration checklist. Managed only by the central Super Admin.';

comment on table public.project_integration_status is
  'Per-project Refontiq integration validation status. Managed only by the central Super Admin.';
