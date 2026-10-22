-- =============================================================================
-- BouwFlow — Klanten en projecten
-- =============================================================================

create type public.customer_type as enum ('private', 'business');

create type public.project_status as enum (
  'concept', 'planned', 'in_progress', 'paused', 'completed', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Klanten
-- ---------------------------------------------------------------------------
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_number text not null,
  customer_type   public.customer_type not null default 'business',
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  contact_person  text check (char_length(contact_person) <= 200),
  email           text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone           text check (char_length(phone) <= 50),
  address_line    text check (char_length(address_line) <= 200),
  postal_code     text check (char_length(postal_code) <= 20),
  city            text check (char_length(city) <= 100),
  country_code    char(2) not null default 'SR' check (country_code ~ '^[A-Z]{2}$'),
  vat_number      text check (char_length(vat_number) <= 50),
  notes           text check (char_length(notes) <= 5000),
  is_archived     boolean not null default false,
  archived_at     timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, customer_number),
  unique (id, organization_id)
);

create index customers_org_active_name_idx on public.customers (organization_id, is_archived, name);

-- ---------------------------------------------------------------------------
-- Projecten
-- ---------------------------------------------------------------------------
create table public.projects (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  project_number            text not null,
  name                      text not null check (char_length(btrim(name)) between 1 and 200),
  customer_id               uuid not null,
  location_address          text check (char_length(location_address) <= 200),
  location_city             text check (char_length(location_city) <= 100),
  description               text check (char_length(description) <= 10000),
  start_date                date,
  expected_end_date         date,
  project_manager_member_id uuid,
  status                    public.project_status not null default 'concept',
  budget_amount             numeric(14,2) not null default 0 check (budget_amount >= 0),
  contract_value            numeric(14,2) not null default 0 check (contract_value >= 0),
  currency_code             char(3) not null default 'SRD' check (currency_code ~ '^[A-Z]{3}$'),
  is_archived               boolean not null default false,
  archived_at               timestamptz,
  created_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, project_number),
  unique (id, organization_id),
  check (expected_end_date is null or start_date is null or expected_end_date >= start_date),
  -- Samengestelde FK's: een project kan alleen verwijzen naar een klant/
  -- projectleider binnen DEZELFDE organisatie, ook als iemand een ID wijzigt.
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id),
  foreign key (project_manager_member_id, organization_id)
    references public.organization_members (id, organization_id)
);

create index projects_org_status_idx on public.projects (organization_id, is_archived, status);
create index projects_customer_idx on public.projects (customer_id);
create index projects_manager_idx on public.projects (project_manager_member_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, organisatie-lock, nummering, archivering, logging
-- ---------------------------------------------------------------------------
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger customers_lock_org before update on public.customers
  for each row execute function public.prevent_organization_change();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger projects_lock_org before update on public.projects
  for each row execute function public.prevent_organization_change();

create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text;
begin
  if tg_op = 'INSERT' then
    select coalesce(s.customer_number_prefix, 'K') into prefix
    from public.organization_settings s where s.organization_id = new.organization_id;
    new.customer_number := coalesce(prefix, 'K') || '-' ||
      lpad(public.next_sequence_value(new.organization_id, 'customer', 0)::text, 5, '0');
    new.created_by := auth.uid();
  elsif new.customer_number is distinct from old.customer_number then
    raise exception 'Klantnummer kan niet worden gewijzigd' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;

  new.archived_at := case when new.is_archived then coalesce(new.archived_at, now()) else null end;
  return new;
end;
$$;

create trigger customers_assign_number
  before insert or update on public.customers
  for each row execute function public.assign_customer_number();

create or replace function public.assign_project_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text;
  yr integer := extract(year from now())::integer;
begin
  if tg_op = 'INSERT' then
    select coalesce(s.project_number_prefix, 'P') into prefix
    from public.organization_settings s where s.organization_id = new.organization_id;
    new.project_number := coalesce(prefix, 'P') || '-' || yr::text || '-' ||
      lpad(public.next_sequence_value(new.organization_id, 'project', yr)::text, 4, '0');
    new.created_by := auth.uid();
  elsif new.project_number is distinct from old.project_number then
    raise exception 'Projectnummer kan niet worden gewijzigd' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;

  new.archived_at := case when new.is_archived then coalesce(new.archived_at, now()) else null end;
  return new;
end;
$$;

create trigger projects_assign_number
  before insert or update on public.projects
  for each row execute function public.assign_project_number();

create or replace function public.log_entity_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  label text;
  entity text := tg_argv[0];
  noun text := tg_argv[1];
  act text;
  msg text;
begin
  if entity = 'customer' then
    label := new.customer_number || ' ' || new.name;
  else
    label := new.project_number || ' ' || new.name;
  end if;

  if tg_op = 'INSERT' then
    act := 'created';  msg := noun || ' ' || label || ' aangemaakt';
  elsif new.is_archived and not old.is_archived then
    act := 'archived'; msg := noun || ' ' || label || ' gearchiveerd';
  elsif old.is_archived and not new.is_archived then
    act := 'restored'; msg := noun || ' ' || label || ' hersteld';
  elsif entity = 'project' and (to_jsonb(new) ->> 'status') is distinct from (to_jsonb(old) ->> 'status') then
    act := 'status_changed';
    msg := noun || ' ' || label || ': status gewijzigd naar ' || (to_jsonb(new) ->> 'status');
  else
    act := 'updated';  msg := noun || ' ' || label || ' gewijzigd';
  end if;

  insert into public.activity_log (organization_id, actor_id, entity_type, entity_id, action, summary)
  values (new.organization_id, auth.uid(), entity, new.id, act, msg);
  return null;
end;
$$;

create trigger customers_log_activity
  after insert or update on public.customers
  for each row execute function public.log_entity_activity('customer', 'Klant');

create trigger projects_log_activity
  after insert or update on public.projects
  for each row execute function public.log_entity_activity('project', 'Project');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.projects  enable row level security;

create policy customers_select on public.customers
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));

create policy customers_update on public.customers
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));

-- Geen delete-policy: klanten worden gearchiveerd, niet verwijderd.

create policy projects_select on public.projects
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[]));

create policy projects_update on public.projects
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[]));

revoke all on public.customers, public.projects from anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.projects to authenticated;
