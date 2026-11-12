-- =============================================================================
-- BouwFlow — SaaS-basis: abonnementen, moduletoegang, platformbeheer,
-- uitnodigingen, ledenbeheer en audit trail.
-- Niet-destructief: voegt alleen toe; bestaande gegevens blijven ongewijzigd.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Platformbeheerders (beheerders van BouwFlow zelf, NIET van een organisatie).
-- Worden handmatig toegevoegd via SQL door de exploitant (zie docs).
-- Platformbeheerders zien GEEN bedrijfsgegevens van organisaties, alleen
-- organisatie- en abonnementsgegevens via aparte functies.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Abonnementen
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  code          text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name          text not null,
  description   text,
  -- Prijs is bewust leeg tot de exploitant die vaststelt (geen verzonnen prijzen).
  monthly_price numeric(12,2) check (monthly_price is null or monthly_price >= 0),
  currency_code char(3) not null default 'SRD',
  max_users     integer check (max_users is null or max_users > 0), -- null = onbeperkt
  modules       text[] not null default '{}',
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger subscription_plans_set_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- Alle modules die BouwFlow kent (gebruikt voor moduletoegang).
-- dashboard, klanten, projecten en instellingen zijn altijd beschikbaar.
insert into public.subscription_plans (code, name, description, max_users, modules, sort_order) values
  ('starter', 'Starter', 'Voor zelfstandigen en kleine bedrijven', 3,
   array['leveranciers','materialen','calculatie','offertes','facturatie','betalingen','documenten','klantportaal'], 1),
  ('professional', 'Professional', 'Voor groeiende bouw- en installatiebedrijven', 15,
   array['leveranciers','medewerkers','planning','materialen','voorraad','calculatie','inkoop','werkbonnen','uren',
         'offertes','facturatie','betalingen','nacalculatie','rapportages','documenten','klantportaal'], 2),
  ('enterprise', 'Enterprise', 'Voor grotere organisaties, onbeperkt aantal gebruikers', null,
   array['leveranciers','medewerkers','planning','materialen','voorraad','calculatie','inkoop','werkbonnen','uren',
         'offertes','facturatie','betalingen','nacalculatie','rapportages','documenten','klantportaal'], 3)
on conflict (code) do nothing;

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

create table public.organization_subscriptions (
  organization_id     uuid primary key references public.organizations (id) on delete cascade,
  plan_code           text not null references public.subscription_plans (code),
  status              public.subscription_status not null default 'trialing',
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  max_users_override  integer check (max_users_override is null or max_users_override > 0),
  -- Voorbereiding op een toekomstige betaalprovider; nu niet gekoppeld.
  billing_provider    text,
  billing_customer_ref text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger organization_subscriptions_set_updated_at before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();

-- Bestaande organisaties krijgen een proefabonnement (niet-destructief).
insert into public.organization_subscriptions (organization_id, plan_code, status, trial_ends_at)
select o.id, 'professional', 'trialing', now() + interval '30 days'
from public.organizations o
on conflict (organization_id) do nothing;

alter table public.subscription_plans enable row level security;
alter table public.organization_subscriptions enable row level security;

create policy subscription_plans_select on public.subscription_plans
  for select to authenticated using (is_active or public.is_platform_admin());
create policy subscription_plans_admin_update on public.subscription_plans
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy organization_subscriptions_select on public.organization_subscriptions
  for select to authenticated using (public.is_org_member(organization_id) or public.is_platform_admin());
-- Wijzigen alleen via platform_set_subscription().

revoke all on public.subscription_plans, public.organization_subscriptions from anon, authenticated;
grant select, update on public.subscription_plans to authenticated;
grant select on public.organization_subscriptions to authenticated;

/** Mag deze organisatie gegevens wijzigen? (actief abonnement of lopende proefperiode) */
create or replace function public.org_is_writable(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.status in ('active', 'past_due')
        or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
    from public.organization_subscriptions s
    where s.organization_id = org_id
  ), false);
$$;
revoke all on function public.org_is_writable(uuid) from public, anon;
grant execute on function public.org_is_writable(uuid) to authenticated;

create or replace function public.org_has_module(org_id uuid, module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select module in ('dashboard', 'klanten', 'projecten', 'instellingen')
      or exists (
        select 1 from public.organization_subscriptions s
        join public.subscription_plans p on p.code = s.plan_code
        where s.organization_id = org_id and module = any (p.modules)
      );
$$;
revoke all on function public.org_has_module(uuid, text) from public, anon;
grant execute on function public.org_has_module(uuid, text) to authenticated;

-- Schrijfrechten vereisen voortaan óók een geldig abonnement.
-- (Lezen blijft altijd mogelijk, zodat klanten nooit hun gegevens kwijt zijn.)
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
  ) and public.org_is_writable(org_id);
$$;

-- Rolcontrole zonder abonnementsvoorwaarde (alleen voor LEZEN van gevoelige gegevens).
create or replace function public.has_org_role_read(org_id uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.is_active and m.role = any (roles)
  );
$$;
revoke all on function public.has_org_role_read(uuid, public.org_role[]) from public, anon;
grant execute on function public.has_org_role_read(uuid, public.org_role[]) to authenticated;

-- Maximum aantal gebruikers volgens abonnement
create or replace function public.org_max_users(org_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(s.max_users_override, p.max_users)
  from public.organization_subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.organization_id = org_id;
$$;
revoke all on function public.org_max_users(uuid) from public, anon;

-- Nieuwe organisaties: proefabonnement van 30 dagen.
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
  if (select count(*) from public.organization_members where user_id = uid and role = 'owner') >= 5 then
    raise exception 'Maximaal aantal organisaties bereikt' using errcode = '54000';
  end if;

  insert into public.organizations (name, created_by) values (btrim(org_name), uid) returning id into new_org;
  insert into public.organization_members (organization_id, user_id, role) values (new_org, uid, 'owner');
  insert into public.organization_settings (organization_id, legal_name) values (new_org, btrim(org_name));
  insert into public.organization_subscriptions (organization_id, plan_code, status, trial_ends_at)
  values (new_org, 'professional', 'trialing', now() + interval '30 days');
  return new_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platformbeheer-functies
-- ---------------------------------------------------------------------------
create or replace function public.platform_list_organizations()
returns table (
  organization_id uuid, name text, created_at timestamptz, member_count bigint,
  plan_code text, status public.subscription_status, trial_ends_at timestamptz, max_users integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen voor platformbeheerders' using errcode = '42501';
  end if;
  return query
    select o.id, o.name, o.created_at,
           (select count(*) from public.organization_members m where m.organization_id = o.id and m.is_active),
           s.plan_code, s.status, s.trial_ends_at, public.org_max_users(o.id)
    from public.organizations o
    left join public.organization_subscriptions s on s.organization_id = o.id
    order by o.created_at desc;
end;
$$;
revoke all on function public.platform_list_organizations() from public, anon;
grant execute on function public.platform_list_organizations() to authenticated;

create or replace function public.platform_set_subscription(
  org_id uuid, new_plan text, new_status public.subscription_status, new_trial_ends_at timestamptz, new_max_users integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen voor platformbeheerders' using errcode = '42501';
  end if;
  update public.organization_subscriptions
     set plan_code = new_plan, status = new_status, trial_ends_at = new_trial_ends_at, max_users_override = new_max_users
   where organization_id = org_id;
  if not found then
    raise exception 'Organisatie niet gevonden' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.platform_set_subscription(uuid, text, public.subscription_status, timestamptz, integer) from public, anon;
grant execute on function public.platform_set_subscription(uuid, text, public.subscription_status, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Uitnodigingen en ledenbeheer
-- ---------------------------------------------------------------------------
create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            public.org_role not null check (role <> 'owner'),
  token_hash      text not null unique,
  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create unique index organization_invitations_open_idx
  on public.organization_invitations (organization_id, email) where accepted_at is null and revoked_at is null;

alter table public.organization_invitations enable row level security;
create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (public.has_org_role_read(organization_id, array['owner', 'admin']::public.org_role[]));
revoke all on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;

/** Maakt een uitnodiging en retourneert het (eenmalig zichtbare) token. */
create or replace function public.create_invitation(org_id uuid, invite_email text, invite_role public.org_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text;
  max_u integer;
  used integer;
begin
  if not public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'Geen rechten om gebruikers uit te nodigen' using errcode = '42501';
  end if;
  if invite_role = 'owner' then
    raise exception 'Eigenaarschap kan niet via een uitnodiging worden toegekend' using errcode = '42501';
  end if;
  max_u := public.org_max_users(org_id);
  select (select count(*) from public.organization_members where organization_id = org_id and is_active)
       + (select count(*) from public.organization_invitations
          where organization_id = org_id and accepted_at is null and revoked_at is null and expires_at > now())
    into used;
  if max_u is not null and used >= max_u then
    raise exception 'Gebruikerslimiet van het abonnement bereikt' using errcode = '54000';
  end if;
  if exists (
    select 1 from public.organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = org_id and lower(u.email) = lower(btrim(invite_email)) and m.is_active
  ) then
    raise exception 'Deze gebruiker is al lid' using errcode = '23505';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.organization_invitations (organization_id, email, role, token_hash, invited_by)
  values (org_id, lower(btrim(invite_email)), invite_role, encode(extensions.digest(raw_token, 'sha256'), 'hex'), auth.uid());
  return raw_token;
end;
$$;
revoke all on function public.create_invitation(uuid, text, public.org_role) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;

create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.organization_invitations where id = invitation_id;
  if org is null or not public.has_org_role(org, array['owner', 'admin']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  update public.organization_invitations set revoked_at = now() where id = invitation_id and accepted_at is null;
end;
$$;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

/** De ingelogde gebruiker accepteert een uitnodiging (e-mailadres moet overeenkomen). */
create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.organization_invitations;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;
  select * into inv from public.organization_invitations
   where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
     and accepted_at is null and revoked_at is null and expires_at > now();
  if inv.id is null then
    raise exception 'Uitnodiging is ongeldig of verlopen' using errcode = 'P0002';
  end if;
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email is distinct from inv.email then
    raise exception 'Deze uitnodiging is voor een ander e-mailadres' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, auth.uid(), inv.role)
  on conflict (organization_id, user_id) do update set is_active = true, role = excluded.role;
  update public.organization_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.organization_id;
end;
$$;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

/** Rol wijzigen of lid (de)activeren. Beschermt de laatste eigenaar. */
create or replace function public.update_member(member_id uuid, new_role public.org_role, new_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.organization_members;
  caller_role public.org_role;
begin
  select * into m from public.organization_members where id = member_id;
  if m.id is null then
    raise exception 'Lid niet gevonden' using errcode = 'P0002';
  end if;
  if not public.has_org_role(m.organization_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  select role into caller_role from public.organization_members
   where organization_id = m.organization_id and user_id = auth.uid();
  -- Alleen een eigenaar mag eigenaren beheren of iemand eigenaar maken.
  if (m.role = 'owner' or new_role = 'owner') and caller_role <> 'owner' then
    raise exception 'Alleen een eigenaar kan eigenaren beheren' using errcode = '42501';
  end if;
  if m.role = 'owner' and (new_role <> 'owner' or not new_active)
     and (select count(*) from public.organization_members
          where organization_id = m.organization_id and role = 'owner' and is_active) <= 1 then
    raise exception 'Een organisatie moet minimaal één actieve eigenaar hebben' using errcode = '23514';
  end if;
  update public.organization_members set role = new_role, is_active = new_active where id = member_id;
end;
$$;
revoke all on function public.update_member(uuid, public.org_role, boolean) from public, anon;
grant execute on function public.update_member(uuid, public.org_role, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail (technisch logboek van alle wijzigingen aan bedrijfsgegevens)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  table_name      text not null,
  record_id       uuid,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data        jsonb,
  new_data        jsonb,
  changed_by      uuid,
  changed_at      timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, changed_at desc);
create index audit_log_record_idx on public.audit_log (record_id);

alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.has_org_role_read(organization_id, array['owner', 'admin', 'finance']::public.org_role[]));
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (
    (rec ->> 'organization_id')::uuid,
    tg_table_name,
    nullif(rec ->> 'id', '')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

create trigger customers_audit after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function public.audit_row_change();
create trigger organization_settings_audit after insert or update on public.organization_settings
  for each row execute function public.audit_row_change();
create trigger tax_rates_audit after insert or update on public.tax_rates
  for each row execute function public.audit_row_change();
create trigger organization_members_audit after insert or update on public.organization_members
  for each row execute function public.audit_row_change();

-- Extra nummerreeksen voor nieuwe documentsoorten
alter table public.number_sequences drop constraint if exists number_sequences_kind_check;
alter table public.number_sequences add constraint number_sequences_kind_check
  check (kind in ('customer', 'project', 'quote', 'invoice', 'credit_note', 'supplier', 'employee',
                  'work_order', 'purchase_order', 'material'));

-- Generieke nummertoekenning: trigger-argumenten (kolom, soort, prefix, jaarlijks 'y'/'n', breedte)
-- Prefix 'settings:<kolom>' leest het voorvoegsel uit organization_settings.
create or replace function public.assign_document_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text := tg_argv[0];
  seq_kind text := tg_argv[1];
  prefix text := tg_argv[2];
  yearly boolean := tg_argv[3] = 'y';
  width integer := tg_argv[4]::integer;
  yr integer := extract(year from now() at time zone 'America/Paramaribo')::integer;
  current_value text := to_jsonb(new) ->> col;
  num text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) ->> col) is not null and current_value is distinct from (to_jsonb(old) ->> col) then
      raise exception 'Documentnummer kan niet worden gewijzigd' using errcode = '42501';
    end if;
    return new;
  end if;
  if prefix like 'settings:%' then
    execute format('select %I from public.organization_settings where organization_id = $1', substr(prefix, 10))
      into prefix using new.organization_id;
  end if;
  num := coalesce(prefix, '') || '-' || case when yearly then yr::text || '-' else '' end ||
         lpad(public.next_sequence_value(new.organization_id, seq_kind, case when yearly then yr else 0 end)::text, width, '0');
  new := jsonb_populate_record(new, jsonb_build_object(col, num));
  return new;
end;
$$;
