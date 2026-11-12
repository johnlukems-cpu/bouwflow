-- =============================================================================
-- BouwFlow — Leveranciers, medewerkers, materiaalbibliotheek, voorraad en het
-- centrale kostenregister (project_cost_entries).
--
-- Principe tegen dubbele telling: ELKE werkelijke projectkost staat precies
-- één keer in project_cost_entries, met een unieke verwijzing naar de bron
-- (urenregel, voorraaduitgifte, inkoopontvangst, werkbon-materiaal of handmatig).
-- =============================================================================

-- Hulpprocedure: standaard tenant-inrichting (triggers + RLS) voor een tabel.
create or replace function public._bf_setup_tenant_table(tbl text, write_roles text, with_updated_at boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if with_updated_at then
    execute format('create trigger %1$s_set_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', tbl);
  end if;
  execute format('create trigger %1$s_lock_org before update on public.%1$I for each row execute function public.prevent_organization_change()', tbl);
  execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()', tbl);
  execute format('alter table public.%I enable row level security', tbl);
  execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_org_member(organization_id))', tbl);
  if write_roles is not null then
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.has_org_role(organization_id, %2$L::public.org_role[]))', tbl, write_roles);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.has_org_role(organization_id, %2$L::public.org_role[])) with check (public.has_org_role(organization_id, %2$L::public.org_role[]))', tbl, write_roles);
  end if;
  execute format('revoke all on public.%I from anon, authenticated', tbl);
  execute format('grant select on public.%I to authenticated', tbl);
  if write_roles is not null then
    execute format('grant insert, update on public.%I to authenticated', tbl);
  end if;
end;
$$;
revoke all on function public._bf_setup_tenant_table(text, text, boolean) from public, anon, authenticated;

-- Rolgroepen
--   OPS     = owner, admin, manager            (projectuitvoering)
--   FIN     = owner, admin, finance            (financieel)
--   OPSFIN  = owner, admin, manager, finance   (inkoop, relaties, materialen)

-- ---------------------------------------------------------------------------
-- Leveranciers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  supplier_number   text not null,
  name              text not null check (char_length(btrim(name)) between 1 and 200),
  supplier_type     text not null default 'supplier' check (supplier_type in ('supplier', 'subcontractor', 'rental', 'other')),
  contact_person    text check (char_length(contact_person) <= 200),
  email             text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text check (char_length(phone) <= 50),
  address_line      text check (char_length(address_line) <= 200),
  city              text check (char_length(city) <= 100),
  country_code      char(2) not null default 'SR' check (country_code ~ '^[A-Z]{2}$'),
  vat_number        text check (char_length(vat_number) <= 50),
  payment_term_days integer check (payment_term_days between 0 and 365),
  notes             text check (char_length(notes) <= 5000),
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, supplier_number),
  unique (id, organization_id)
);
create index suppliers_org_idx on public.suppliers (organization_id, is_archived, name);
create trigger suppliers_number before insert or update on public.suppliers
  for each row execute function public.assign_document_number('supplier_number', 'supplier', 'L', 'n', '5');
select public._bf_setup_tenant_table('suppliers', '{owner,admin,manager,finance}');

-- ---------------------------------------------------------------------------
-- Medewerkers (personeel; optioneel gekoppeld aan een gebruikersaccount)
-- ---------------------------------------------------------------------------
create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_number  text not null,
  full_name        text not null check (char_length(btrim(full_name)) between 1 and 200),
  job_title        text check (char_length(job_title) <= 100),
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text check (char_length(phone) <= 50),
  member_id        uuid,
  -- Interne kostprijs per uur (voor na-calculatie) en verkooptarief per uur
  hourly_cost      numeric(12,2) not null default 0 check (hourly_cost >= 0),
  hourly_rate      numeric(12,2) not null default 0 check (hourly_rate >= 0),
  is_active        boolean not null default true,
  notes            text check (char_length(notes) <= 5000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, employee_number),
  unique (id, organization_id),
  unique (member_id),
  foreign key (member_id, organization_id) references public.organization_members (id, organization_id)
);
create trigger employees_number before insert or update on public.employees
  for each row execute function public.assign_document_number('employee_number', 'employee', 'M', 'n', '4');
select public._bf_setup_tenant_table('employees', '{owner,admin,manager}');

/** Medewerker-id van de ingelogde gebruiker binnen een organisatie (of null). */
create or replace function public.current_employee_id(org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.employees e
  join public.organization_members m on m.id = e.member_id
  where e.organization_id = org_id and m.user_id = auth.uid() and m.is_active and e.is_active
  limit 1;
$$;
revoke all on function public.current_employee_id(uuid) from public, anon;
grant execute on function public.current_employee_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Materiaalbibliotheek (per organisatie) met prijshistorie
-- ---------------------------------------------------------------------------
create table public.materials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  article_number  text not null check (char_length(btrim(article_number)) between 1 and 50),
  description     text not null check (char_length(btrim(description)) between 1 and 300),
  category        text not null default 'Overig' check (char_length(category) <= 60),
  unit            text not null default 'st' check (char_length(unit) between 1 and 20),
  cost_price      numeric(14,4) not null default 0 check (cost_price >= 0),
  sale_price      numeric(14,4) not null default 0 check (sale_price >= 0),
  waste_percent   numeric(5,2) not null default 0 check (waste_percent between 0 and 100),
  track_stock     boolean not null default false,
  min_stock       numeric(14,3) check (min_stock is null or min_stock >= 0),
  supplier_id     uuid,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, article_number),
  unique (id, organization_id),
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id)
);
create index materials_org_idx on public.materials (organization_id, is_archived, category, description);
select public._bf_setup_tenant_table('materials', '{owner,admin,manager,finance}');

create table public.material_price_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  material_id     uuid not null,
  cost_price      numeric(14,4) not null,
  sale_price      numeric(14,4) not null,
  valid_from      timestamptz not null default now(),
  changed_by      uuid,
  foreign key (material_id, organization_id) references public.materials (id, organization_id) on delete cascade
);
create index material_price_history_idx on public.material_price_history (material_id, valid_from desc);
alter table public.material_price_history enable row level security;
create policy material_price_history_select on public.material_price_history
  for select to authenticated using (public.is_org_member(organization_id));
revoke all on public.material_price_history from anon, authenticated;
grant select on public.material_price_history to authenticated;

create or replace function public.record_material_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.cost_price is distinct from old.cost_price or new.sale_price is distinct from old.sale_price then
    insert into public.material_price_history (organization_id, material_id, cost_price, sale_price, changed_by)
    values (new.organization_id, new.id, new.cost_price, new.sale_price, auth.uid());
  end if;
  return null;
end;
$$;
create trigger materials_price_history after insert or update on public.materials
  for each row execute function public.record_material_price();

-- ---------------------------------------------------------------------------
-- Kostenregister: de enige bron van werkelijke projectkosten
-- ---------------------------------------------------------------------------
create type public.cost_type as enum ('material', 'labor', 'equipment', 'transport', 'subcontractor', 'other');
create type public.cost_source as enum ('manual', 'time_entry', 'stock_movement', 'purchase_receipt', 'work_order_material');

create table public.project_cost_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null,
  cost_type       public.cost_type not null,
  description     text not null check (char_length(btrim(description)) between 1 and 300),
  quantity        numeric(14,3),
  unit            text,
  unit_cost       numeric(14,4),
  amount          numeric(14,2) not null,
  entry_date      date not null default (now() at time zone 'America/Paramaribo')::date,
  source_type     public.cost_source not null default 'manual',
  source_id       uuid,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  check ((source_type = 'manual') = (source_id is null))
);
-- Eén kostenregel per bron: maakt dubbele boekingen onmogelijk.
create unique index project_cost_entries_source_idx on public.project_cost_entries (source_type, source_id) where source_id is not null;
create index project_cost_entries_project_idx on public.project_cost_entries (project_id, cost_type);

create trigger project_cost_entries_lock_org before update on public.project_cost_entries
  for each row execute function public.prevent_organization_change();
create trigger project_cost_entries_audit after insert or update or delete on public.project_cost_entries
  for each row execute function public.audit_row_change();
alter table public.project_cost_entries enable row level security;
create policy project_cost_entries_select on public.project_cost_entries
  for select to authenticated using (public.is_org_member(organization_id));
-- Clients mogen alleen HANDMATIGE kosten boeken; overige regels ontstaan via
-- de workflowfuncties. Het register is onwijzigbaar: correcties gaan via een
-- tegenboeking (negatief bedrag).
create policy project_cost_entries_insert on public.project_cost_entries
  for insert to authenticated
  with check (source_type = 'manual' and source_id is null
              and public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));
revoke all on public.project_cost_entries from anon, authenticated;
grant select, insert on public.project_cost_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Voorraad: onwijzigbare mutaties; de stand is de som van de mutaties.
-- ---------------------------------------------------------------------------
create type public.stock_movement_type as enum ('receipt', 'issue', 'return', 'adjustment');

create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  material_id     uuid not null,
  movement_type   public.stock_movement_type not null,
  -- receipt/issue/return: positief; adjustment: positief of negatief
  quantity        numeric(14,3) not null check (quantity <> 0),
  unit_cost       numeric(14,4) not null default 0 check (unit_cost >= 0),
  project_id      uuid,
  source_type     text check (source_type in ('purchase_receipt', 'work_order_material')),
  source_id       uuid,
  occurred_on     date not null default (now() at time zone 'America/Paramaribo')::date,
  note            text check (char_length(note) <= 500),
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (material_id, organization_id) references public.materials (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  check (movement_type = 'adjustment' or quantity > 0),
  check ((movement_type in ('issue', 'return')) = (project_id is not null))
);
create unique index stock_movements_source_idx on public.stock_movements (source_type, source_id) where source_id is not null;
create index stock_movements_material_idx on public.stock_movements (material_id, occurred_on);

create or replace function public.stock_delta(t public.stock_movement_type, q numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case t when 'receipt' then q when 'return' then q when 'issue' then -q else q end;
$$;

create view public.material_stock with (security_invoker = true) as
  select m.organization_id, m.id as material_id, m.article_number, m.description, m.unit, m.category,
         m.min_stock, m.cost_price, m.track_stock,
         coalesce(sum(public.stock_delta(s.movement_type, s.quantity)), 0)::numeric(14,3) as on_hand
  from public.materials m
  left join public.stock_movements s on s.material_id = m.id
  group by m.id;
grant select on public.material_stock to authenticated;

create or replace function public.stock_movement_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mat public.materials;
  on_hand numeric;
  qty_sign integer;
begin
  select * into mat from public.materials where id = new.material_id;
  if not mat.track_stock then
    raise exception 'Voor dit materiaal wordt geen voorraad bijgehouden' using errcode = '23514';
  end if;
  if new.unit_cost = 0 and new.movement_type in ('issue', 'return') then
    new.unit_cost := mat.cost_price; -- kostprijs-momentopname
  end if;
  if new.movement_type = 'issue' or (new.movement_type = 'adjustment' and new.quantity < 0) then
    select coalesce(sum(public.stock_delta(movement_type, quantity)), 0) into on_hand
    from public.stock_movements where material_id = new.material_id;
    if on_hand + public.stock_delta(new.movement_type, new.quantity) < 0 then
      raise exception 'Onvoldoende voorraad voor % (beschikbaar: %)', mat.description, on_hand using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger stock_movements_effects before insert on public.stock_movements
  for each row execute function public.stock_movement_effects();

-- Uitgifte aan / retour van een project boekt de materiaalkosten in het register.
create or replace function public.stock_movement_to_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mat public.materials;
  sign integer;
begin
  if new.movement_type not in ('issue', 'return') then
    return null;
  end if;
  select * into mat from public.materials where id = new.material_id;
  sign := case when new.movement_type = 'issue' then 1 else -1 end;
  insert into public.project_cost_entries (organization_id, project_id, cost_type, description, quantity, unit, unit_cost, amount, entry_date, source_type, source_id, created_by)
  values (new.organization_id, new.project_id, 'material',
          case when sign = 1 then '' else 'Retour: ' end || mat.article_number || ' ' || mat.description,
          sign * new.quantity, mat.unit, new.unit_cost, round(sign * new.quantity * new.unit_cost, 2),
          new.occurred_on, 'stock_movement', new.id, new.created_by);
  return null;
end;
$$;
create trigger stock_movements_costs after insert on public.stock_movements
  for each row execute function public.stock_movement_to_costs();

create trigger stock_movements_audit after insert on public.stock_movements
  for each row execute function public.audit_row_change();
alter table public.stock_movements enable row level security;
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (public.is_org_member(organization_id));
-- Handmatige mutaties (geen bron) door magazijn-/projectbevoegden; onwijzigbaar.
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (source_type is null and source_id is null
              and public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));
revoke all on public.stock_movements from anon, authenticated;
grant select, insert on public.stock_movements to authenticated;
