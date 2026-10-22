-- =============================================================================
-- BouwFlow — Kern: organisaties, leden, rollen, instellingen, BTW-tarieven
-- =============================================================================
-- Principes:
--  * Iedere tenant-tabel heeft organization_id en wordt beveiligd met RLS.
--  * Lidmaatschap wordt nooit rechtstreeks door clients aangemaakt; dat gebeurt
--    via SECURITY DEFINER-functies die de rechten zelf controleren.
--  * Helperfuncties hebben een leeg search_path om search_path-aanvallen te
--    voorkomen.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Generieke helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Voorkomt dat een record naar een andere organisatie wordt verplaatst.
create or replace function public.prevent_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id kan niet worden gewijzigd'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollen (uitbreidbaar: nieuwe waarden kunnen later met ALTER TYPE worden
-- toegevoegd).
-- ---------------------------------------------------------------------------
create type public.org_role as enum (
  'owner',     -- eigenaar: alles, inclusief abonnement en leden
  'admin',     -- beheerder: alles behalve eigendom overdragen
  'manager',   -- projectleider: klanten, projecten, calculaties
  'finance',   -- financiële administratie: klanten, offertes, facturen
  'employee',  -- medewerker: lezen, eigen werkbonnen (later)
  'viewer'     -- alleen-lezen
);

-- ---------------------------------------------------------------------------
-- Profielen (1-op-1 met auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 200),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 200), ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organisaties
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 200),
  slug        text unique,
  is_archived boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'viewer',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id),
  -- maakt samengestelde foreign keys (id, organization_id) mogelijk
  unique (id, organization_id)
);

create index organization_members_user_idx on public.organization_members (user_id) where is_active;

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

create trigger organization_members_lock_org
  before update on public.organization_members
  for each row execute function public.prevent_organization_change();

-- ---------------------------------------------------------------------------
-- Autorisatie-helpers (SECURITY DEFINER zodat RLS-policies op
-- organization_members niet recursief worden geëvalueerd).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.is_active
  );
$$;

create or replace function public.has_org_role(org_id uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.is_active
      and m.role = any (roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.org_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Organisatie-instellingen (valuta, taal, bedrijfsgegevens, nummering)
-- ---------------------------------------------------------------------------
create type public.revenue_basis as enum (
  'contract_value',  -- verkoopwaarde / opdrachtsom
  'invoiced',        -- gefactureerde omzet
  'received'         -- ontvangen betalingen
);

create table public.organization_settings (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  legal_name             text check (char_length(legal_name) <= 200),
  chamber_of_commerce_no text check (char_length(chamber_of_commerce_no) <= 50),
  vat_number             text check (char_length(vat_number) <= 50),
  address_line           text check (char_length(address_line) <= 200),
  postal_code            text check (char_length(postal_code) <= 20),
  city                   text check (char_length(city) <= 100),
  country_code           char(2) not null default 'SR' check (country_code ~ '^[A-Z]{2}$'),
  phone                  text check (char_length(phone) <= 50),
  email                  text check (char_length(email) <= 200),
  website                text check (char_length(website) <= 200),
  iban                   text check (char_length(iban) <= 50),
  currency_code          char(3) not null default 'SRD' check (currency_code ~ '^[A-Z]{3}$'),
  locale                 text not null default 'nl-SR' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone               text not null default 'America/Paramaribo',
  prices_include_vat     boolean not null default false,
  payment_term_days      integer not null default 30 check (payment_term_days between 0 and 365),
  quote_validity_days    integer not null default 30 check (quote_validity_days between 0 and 365),
  budget_warning_percent numeric(5,2) not null default 90 check (budget_warning_percent between 0 and 1000),
  revenue_basis          public.revenue_basis not null default 'invoiced',
  customer_number_prefix text not null default 'K' check (char_length(customer_number_prefix) <= 10),
  project_number_prefix  text not null default 'P' check (char_length(project_number_prefix) <= 10),
  quote_number_prefix    text not null default 'OFF' check (char_length(quote_number_prefix) <= 10),
  invoice_number_prefix  text not null default 'FAC' check (char_length(invoice_number_prefix) <= 10),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

create trigger organization_settings_lock_org
  before update on public.organization_settings
  for each row execute function public.prevent_organization_change();

-- ---------------------------------------------------------------------------
-- BTW-/belastingtarieven per organisatie. Er worden bewust GEEN tarieven
-- vooraf ingevuld: de organisatie stelt zelf de geldende tarieven in.
-- ---------------------------------------------------------------------------
create table public.tax_rates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  rate_percent    numeric(6,3) not null check (rate_percent >= 0 and rate_percent <= 100),
  description     text check (char_length(description) <= 500),
  is_default      boolean not null default false,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id)
);

create index tax_rates_org_idx on public.tax_rates (organization_id);
create unique index tax_rates_one_default_idx
  on public.tax_rates (organization_id) where is_default and not is_archived;

create trigger tax_rates_set_updated_at
  before update on public.tax_rates
  for each row execute function public.set_updated_at();

create trigger tax_rates_lock_org
  before update on public.tax_rates
  for each row execute function public.prevent_organization_change();

-- ---------------------------------------------------------------------------
-- Documentnummering per organisatie (klanten, projecten, offertes, facturen).
-- Gebruikt een rij-lock zodat gelijktijdige inserts geen dubbele nummers geven.
-- ---------------------------------------------------------------------------
create table public.number_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            text not null check (kind in ('customer', 'project', 'quote', 'invoice')),
  period          integer not null default 0, -- 0 = doorlopend, anders jaartal
  next_value      bigint not null default 1 check (next_value > 0),
  primary key (organization_id, kind, period)
);

create or replace function public.next_sequence_value(org_id uuid, seq_kind text, seq_period integer default 0)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.number_sequences (organization_id, kind, period, next_value)
  values (org_id, seq_kind, seq_period, 2)
  on conflict (organization_id, kind, period)
  do update set next_value = public.number_sequences.next_value + 1
  returning next_value - 1 into v;
  return v;
end;
$$;

revoke all on function public.next_sequence_value(uuid, text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activiteitenlog (alleen via triggers gevuld; niet door clients te wijzigen)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid references auth.users (id) on delete set null,
  entity_type     text not null,
  entity_id       uuid,
  action          text not null check (action in ('created', 'updated', 'archived', 'restored', 'status_changed')),
  summary         text not null,
  created_at      timestamptz not null default now()
);

create index activity_log_org_created_idx on public.activity_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_settings enable row level security;
alter table public.tax_rates             enable row level security;
alter table public.number_sequences      enable row level security;
alter table public.activity_log          enable row level security;

-- Profielen: eigen profiel, of profielen van collega's binnen een gedeelde organisatie.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid() and mine.is_active
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Organisaties: leden lezen; eigenaar/beheerder wijzigt. Aanmaken via RPC.
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));

-- Leden: leden zien collega's. Wijzigingen uitsluitend via toekomstige RPC's
-- (uitnodigen, rol wijzigen), zodat niemand zichzelf rechten kan geven.
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Instellingen
create policy organization_settings_select on public.organization_settings
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy organization_settings_update on public.organization_settings
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

-- BTW-tarieven
create policy tax_rates_select on public.tax_rates
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy tax_rates_insert on public.tax_rates
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.org_role[]));

create policy tax_rates_update on public.tax_rates
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.org_role[]));

-- number_sequences: geen policies => geen directe toegang voor clients.

-- Activiteitenlog: alleen lezen.
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Organisatie aanmaken (onboarding). De aanroeper wordt eigenaar.
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_org uuid;
begin
  if uid is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  if org_name is null or char_length(btrim(org_name)) < 2 then
    raise exception 'Organisatienaam is te kort' using errcode = '22023';
  end if;

  -- Beperk misbruik: maximaal 5 organisaties per gebruiker als eigenaar.
  if (select count(*) from public.organization_members
      where user_id = uid and role = 'owner') >= 5 then
    raise exception 'Maximaal aantal organisaties bereikt' using errcode = '54000';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(org_name), uid)
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org, uid, 'owner');

  insert into public.organization_settings (organization_id, legal_name)
  values (new_org, btrim(org_name));

  return new_org;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rechten op tabelniveau (RLS bepaalt vervolgens welke rijen).
-- ---------------------------------------------------------------------------
-- Supabase kent standaard ALL toe aan anon/authenticated; dat trekken we in
-- en kennen alleen de benodigde rechten opnieuw toe.
revoke all on public.profiles, public.organizations, public.organization_members,
  public.organization_settings, public.tax_rates, public.number_sequences,
  public.activity_log
  from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, update on public.organization_settings to authenticated;
grant select, insert, update on public.tax_rates to authenticated;
grant select on public.activity_log to authenticated;
