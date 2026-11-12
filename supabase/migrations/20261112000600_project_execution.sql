-- =============================================================================
-- BouwFlow — Voorcalculatie, planning (taken), urenregistratie, werkbonnen en
-- inkoop. Alle werkelijke kosten lopen via project_cost_entries.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Voorcalculatie (begroting per project)
-- ---------------------------------------------------------------------------
create table public.project_estimate_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null,
  cost_type       public.cost_type not null default 'material',
  material_id     uuid,
  article_number  text check (char_length(article_number) <= 50),
  description     text not null check (char_length(btrim(description)) between 1 and 300),
  category        text check (char_length(category) <= 60),
  unit            text not null default 'st' check (char_length(unit) between 1 and 20),
  quantity        numeric(14,3) not null default 0 check (quantity >= 0),
  unit_cost       numeric(14,4) not null default 0 check (unit_cost >= 0),
  unit_price      numeric(14,4) not null default 0 check (unit_price >= 0),
  waste_percent   numeric(5,2) not null default 0 check (waste_percent between 0 and 100),
  -- Exacte, controleerbare berekening in de database (numeric, afronding op centen)
  effective_quantity numeric(18,6) generated always as (quantity * (1 + waste_percent / 100)) stored,
  cost_total      numeric(14,2) generated always as (round(quantity * (1 + waste_percent / 100) * unit_cost, 2)) stored,
  sale_total      numeric(14,2) generated always as (round(quantity * (1 + waste_percent / 100) * unit_price, 2)) stored,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (material_id, organization_id) references public.materials (id, organization_id)
);
create index project_estimate_lines_project_idx on public.project_estimate_lines (project_id, sort_order);
select public._bf_setup_tenant_table('project_estimate_lines', '{owner,admin,manager}');
create policy project_estimate_lines_delete on public.project_estimate_lines
  for delete to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[]));
grant delete on public.project_estimate_lines to authenticated;

-- ---------------------------------------------------------------------------
-- Planning: projecttaken
-- ---------------------------------------------------------------------------
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');

create table public.project_tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null,
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  description     text check (char_length(description) <= 5000),
  employee_id     uuid,
  start_date      date,
  end_date        date,
  planned_hours   numeric(8,2) check (planned_hours is null or planned_hours >= 0),
  status          public.task_status not null default 'todo',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id) references public.employees (id, organization_id)
);
create index project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create index project_tasks_employee_idx on public.project_tasks (employee_id, start_date);
select public._bf_setup_tenant_table('project_tasks', '{owner,admin,manager}');

-- ---------------------------------------------------------------------------
-- Werkbonnen (mobiel) — worden na goedkeuring omgezet in uren en materiaalkosten
-- ---------------------------------------------------------------------------
create type public.approval_status as enum ('draft', 'submitted', 'approved', 'rejected');

create table public.work_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  work_order_number text not null,
  project_id        uuid not null,
  employee_id       uuid not null,
  task_id           uuid,
  work_date         date not null default (now() at time zone 'America/Paramaribo')::date,
  start_time        time not null,
  end_time          time not null,
  break_minutes     integer not null default 0 check (break_minutes between 0 and 600),
  hours             numeric(6,2) generated always as (
                      round((extract(epoch from (end_time - start_time)) / 60 - break_minutes) / 60.0, 2)) stored,
  work_description  text not null check (char_length(btrim(work_description)) between 1 and 5000),
  notes             text check (char_length(notes) <= 5000),
  status            public.approval_status not null default 'draft',
  approved_by       uuid,
  approved_at       timestamptz,
  rejection_reason  text,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, work_order_number),
  unique (id, organization_id),
  check (end_time > start_time),
  check (extract(epoch from (end_time - start_time)) / 60 > break_minutes),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  foreign key (employee_id, organization_id) references public.employees (id, organization_id),
  foreign key (task_id, organization_id) references public.project_tasks (id, organization_id)
);
create index work_orders_project_idx on public.work_orders (project_id, work_date desc);
create index work_orders_employee_idx on public.work_orders (employee_id, work_date desc);
create trigger work_orders_number before insert or update on public.work_orders
  for each row execute function public.assign_document_number('work_order_number', 'work_order', 'WB', 'y', '4');
select public._bf_setup_tenant_table('work_orders', null);

-- Medewerkers mogen hun EIGEN werkbonnen aanmaken en bewerken zolang ze concept zijn;
-- projectleiders/beheerders mogen alle werkbonnen beheren.
create policy work_orders_insert on public.work_orders
  for insert to authenticated
  with check (status in ('draft', 'submitted') and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
    or (public.has_org_role(organization_id, array['employee']::public.org_role[])
        and employee_id = public.current_employee_id(organization_id))));
create policy work_orders_update on public.work_orders
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
         or (public.has_org_role(organization_id, array['employee']::public.org_role[])
             and employee_id = public.current_employee_id(organization_id) and status in ('draft', 'rejected')))
  with check (status in ('draft', 'submitted', 'rejected')
              and (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
                   or employee_id = public.current_employee_id(organization_id)));
grant insert, update on public.work_orders to authenticated;

create table public.work_order_materials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id   uuid not null,
  material_id     uuid,
  description     text not null check (char_length(btrim(description)) between 1 and 300),
  unit            text not null default 'st',
  quantity        numeric(14,3) not null check (quantity > 0),
  unit_cost       numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  created_at      timestamptz not null default now(),
  foreign key (work_order_id, organization_id) references public.work_orders (id, organization_id) on delete cascade,
  foreign key (material_id, organization_id) references public.materials (id, organization_id)
);
create index work_order_materials_wo_idx on public.work_order_materials (work_order_id);
create trigger work_order_materials_lock_org before update on public.work_order_materials
  for each row execute function public.prevent_organization_change();
create trigger work_order_materials_audit after insert or update or delete on public.work_order_materials
  for each row execute function public.audit_row_change();
alter table public.work_order_materials enable row level security;
create policy work_order_materials_select on public.work_order_materials
  for select to authenticated using (public.is_org_member(organization_id));
create policy work_order_materials_write on public.work_order_materials
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and w.status in ('draft', 'rejected')
                 and (public.has_org_role(w.organization_id, array['owner', 'admin', 'manager']::public.org_role[])
                      or w.employee_id = public.current_employee_id(w.organization_id))))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and w.organization_id = work_order_materials.organization_id
                      and w.status in ('draft', 'rejected')
                      and (public.has_org_role(w.organization_id, array['owner', 'admin', 'manager']::public.org_role[])
                           or (public.has_org_role(w.organization_id, array['employee']::public.org_role[])
                               and w.employee_id = public.current_employee_id(w.organization_id)))));
revoke all on public.work_order_materials from anon, authenticated;
grant select, insert, update, delete on public.work_order_materials to authenticated;

-- Een goedgekeurde werkbon is definitief.
create or replace function public.work_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'approved' then
    raise exception 'Een goedgekeurde werkbon kan niet meer worden gewijzigd' using errcode = '42501';
  end if;
  if new.status = 'approved' and current_setting('bouwflow.approving', true) is distinct from 'on' then
    raise exception 'Goedkeuren kan alleen via de goedkeuringsfunctie' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger work_orders_guard before update on public.work_orders
  for each row execute function public.work_order_guard();

-- ---------------------------------------------------------------------------
-- Urenregistratie
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null,
  employee_id     uuid not null,
  task_id         uuid,
  work_order_id   uuid unique, -- een werkbon levert maximaal één urenregel op
  entry_date      date not null,
  start_time      time,
  end_time        time,
  break_minutes   integer not null default 0 check (break_minutes between 0 and 600),
  hours           numeric(6,2) not null check (hours > 0 and hours <= 24),
  description     text check (char_length(description) <= 2000),
  status          public.approval_status not null default 'draft',
  hourly_cost     numeric(12,2), -- momentopname bij goedkeuring
  approved_by     uuid,
  approved_at     timestamptz,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  foreign key (employee_id, organization_id) references public.employees (id, organization_id),
  foreign key (task_id, organization_id) references public.project_tasks (id, organization_id),
  foreign key (work_order_id, organization_id) references public.work_orders (id, organization_id)
);
create index time_entries_employee_idx on public.time_entries (employee_id, entry_date);
create index time_entries_project_idx on public.time_entries (project_id, entry_date);
select public._bf_setup_tenant_table('time_entries', null);

create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (status in ('draft', 'submitted') and work_order_id is null and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
    or (public.has_org_role(organization_id, array['employee']::public.org_role[])
        and employee_id = public.current_employee_id(organization_id))));
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
         or (public.has_org_role(organization_id, array['employee']::public.org_role[])
             and employee_id = public.current_employee_id(organization_id) and status in ('draft', 'rejected')))
  with check (status in ('draft', 'submitted', 'rejected')
              and (public.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.org_role[])
                   or employee_id = public.current_employee_id(organization_id)));
grant insert, update on public.time_entries to authenticated;

create or replace function public.time_entry_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'Goedgekeurde uren kunnen niet meer worden gewijzigd' using errcode = '42501';
  end if;
  if new.status = 'approved' and current_setting('bouwflow.approving', true) is distinct from 'on' then
    raise exception 'Goedkeuren kan alleen via de goedkeuringsfunctie' using errcode = '42501';
  end if;
  -- Uren uit begin-/eindtijd berekenen
  if new.start_time is not null then
    new.hours := round((extract(epoch from (new.end_time - new.start_time)) / 60 - new.break_minutes) / 60.0, 2);
  end if;
  -- Geen overlappende tijden voor dezelfde medewerker (voorkomt dubbele uren)
  if new.start_time is not null and exists (
    select 1 from public.time_entries t
    where t.employee_id = new.employee_id and t.entry_date = new.entry_date and t.id <> new.id
      and t.status <> 'rejected' and t.start_time is not null
      and t.start_time < new.end_time and new.start_time < t.end_time
  ) then
    raise exception 'Deze uren overlappen met een andere registratie van dezelfde medewerker' using errcode = '23P01';
  end if;
  return new;
end;
$$;
create trigger time_entries_guard before insert or update on public.time_entries
  for each row execute function public.time_entry_guard();

/** Keurt uren goed en boekt de arbeidskosten (exact één keer). */
create or replace function public.approve_time_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.time_entries;
  emp public.employees;
begin
  select * into t from public.time_entries where id = entry_id for update;
  if t.id is null or not public.has_org_role(t.organization_id, array['owner', 'admin', 'manager']::public.org_role[]) then
    raise exception 'Geen rechten om uren goed te keuren' using errcode = '42501';
  end if;
  if t.status = 'approved' then
    return; -- idempotent
  end if;
  select * into emp from public.employees where id = t.employee_id;
  perform set_config('bouwflow.approving', 'on', true);
  update public.time_entries
     set status = 'approved', hourly_cost = emp.hourly_cost, approved_by = auth.uid(), approved_at = now()
   where id = entry_id;
  perform set_config('bouwflow.approving', 'off', true);
  insert into public.project_cost_entries (organization_id, project_id, cost_type, description, quantity, unit, unit_cost, amount, entry_date, source_type, source_id, created_by)
  values (t.organization_id, t.project_id, 'labor', 'Uren ' || emp.full_name || coalesce(': ' || left(t.description, 200), ''),
          t.hours, 'uur', emp.hourly_cost, round(t.hours * emp.hourly_cost, 2), t.entry_date, 'time_entry', t.id, auth.uid())
  on conflict (source_type, source_id) where source_id is not null do nothing;
end;
$$;
revoke all on function public.approve_time_entry(uuid) from public, anon;
grant execute on function public.approve_time_entry(uuid) to authenticated;

/**
 * Keurt een werkbon goed:
 *  - maakt één goedgekeurde urenregel (→ arbeidskosten)
 *  - materialen met voorraadbeheer → voorraaduitgifte (→ materiaalkosten)
 *  - overige materialen → directe materiaalkosten
 * Idempotent en beschermd tegen dubbele boekingen door unieke bronverwijzingen.
 */
create or replace function public.approve_work_order(wo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_orders;
  m record;
  te_id uuid;
begin
  select * into w from public.work_orders where id = wo_id for update;
  if w.id is null or not public.has_org_role(w.organization_id, array['owner', 'admin', 'manager']::public.org_role[]) then
    raise exception 'Geen rechten om werkbonnen goed te keuren' using errcode = '42501';
  end if;
  if w.status = 'approved' then
    return;
  end if;

  perform set_config('bouwflow.approving', 'on', true);
  update public.work_orders set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = wo_id;
  perform set_config('bouwflow.approving', 'off', true);

  insert into public.time_entries (organization_id, project_id, employee_id, task_id, work_order_id, entry_date, start_time, end_time, break_minutes, hours, description, status)
  values (w.organization_id, w.project_id, w.employee_id, w.task_id, w.id, w.work_date, w.start_time, w.end_time, w.break_minutes, w.hours,
          'Werkbon ' || w.work_order_number, 'submitted')
  on conflict (work_order_id) do nothing
  returning id into te_id;
  if te_id is not null then
    perform public.approve_time_entry(te_id);
  end if;

  for m in
    select wm.*, mat.track_stock, mat.cost_price, mat.article_number
    from public.work_order_materials wm
    left join public.materials mat on mat.id = wm.material_id
    where wm.work_order_id = wo_id
  loop
    if m.track_stock then
      insert into public.stock_movements (organization_id, material_id, movement_type, quantity, unit_cost, project_id, source_type, source_id, occurred_on, note, created_by)
      values (w.organization_id, m.material_id, 'issue', m.quantity, coalesce(m.unit_cost, m.cost_price), w.project_id,
              'work_order_material', m.id, w.work_date, 'Werkbon ' || w.work_order_number, auth.uid())
      on conflict (source_type, source_id) where source_id is not null do nothing;
    else
      insert into public.project_cost_entries (organization_id, project_id, cost_type, description, quantity, unit, unit_cost, amount, entry_date, source_type, source_id, created_by)
      values (w.organization_id, w.project_id, 'material', 'Werkbon ' || w.work_order_number || ': ' || m.description,
              m.quantity, m.unit, coalesce(m.unit_cost, m.cost_price, 0), round(m.quantity * coalesce(m.unit_cost, m.cost_price, 0), 2),
              w.work_date, 'work_order_material', m.id, auth.uid())
      on conflict (source_type, source_id) where source_id is not null do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.approve_work_order(uuid) from public, anon;
grant execute on function public.approve_work_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inkoop
-- ---------------------------------------------------------------------------
create type public.purchase_order_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

create table public.purchase_orders (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  purchase_order_number text not null,
  supplier_id           uuid not null,
  project_id            uuid,
  status                public.purchase_order_status not null default 'draft',
  order_date            date not null default (now() at time zone 'America/Paramaribo')::date,
  expected_date         date,
  currency_code         char(3) not null default 'SRD',
  notes                 text check (char_length(notes) <= 5000),
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, purchase_order_number),
  unique (id, organization_id),
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
);
create trigger purchase_orders_number before insert or update on public.purchase_orders
  for each row execute function public.assign_document_number('purchase_order_number', 'purchase_order', 'IO', 'y', '4');
select public._bf_setup_tenant_table('purchase_orders', '{owner,admin,manager,finance}');

create table public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id uuid not null,
  material_id       uuid,
  description       text not null check (char_length(btrim(description)) between 1 and 300),
  unit              text not null default 'st',
  quantity          numeric(14,3) not null check (quantity > 0),
  unit_cost         numeric(14,4) not null check (unit_cost >= 0),
  line_total        numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  -- 'stock' = naar magazijn (voorraad), 'project' = direct naar project (kosten)
  destination       text not null default 'project' check (destination in ('stock', 'project')),
  project_id        uuid,
  cost_type         public.cost_type not null default 'material',
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  check (quantity_received <= quantity),
  foreign key (purchase_order_id, organization_id) references public.purchase_orders (id, organization_id) on delete cascade,
  foreign key (material_id, organization_id) references public.materials (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
);
create index purchase_order_lines_po_idx on public.purchase_order_lines (purchase_order_id, sort_order);
select public._bf_setup_tenant_table('purchase_order_lines', '{owner,admin,manager,finance}');
create policy purchase_order_lines_delete on public.purchase_order_lines
  for delete to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));
grant delete on public.purchase_order_lines to authenticated;

-- Regels alleen wijzigen zolang de order concept is (ontvangst loopt via receive_purchase_line).
create or replace function public.purchase_line_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st public.purchase_order_status;
begin
  select status into st from public.purchase_orders where id = coalesce(new.purchase_order_id, old.purchase_order_id);
  if st <> 'draft' and current_setting('bouwflow.receiving', true) is distinct from 'on' then
    raise exception 'Inkooporderregels kunnen alleen in concept worden gewijzigd' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' and new.destination = 'stock' and not exists (
    select 1 from public.materials m where m.id = new.material_id and m.track_stock
  ) then
    raise exception 'Levering naar voorraad vereist een materiaal met voorraadbeheer' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' and new.destination = 'project' and new.project_id is null then
    select project_id into new.project_id from public.purchase_orders where id = new.purchase_order_id;
    if new.project_id is null then
      raise exception 'Kies een project voor deze inkoopregel' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger purchase_order_lines_guard before insert or update or delete on public.purchase_order_lines
  for each row execute function public.purchase_line_guard();

create table public.purchase_receipts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  purchase_order_line_id uuid not null,
  quantity               numeric(14,3) not null check (quantity > 0),
  received_on            date not null default (now() at time zone 'America/Paramaribo')::date,
  idempotency_key        text not null check (char_length(idempotency_key) between 8 and 100),
  received_by            uuid default auth.uid(),
  created_at             timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (purchase_order_line_id, organization_id) references public.purchase_order_lines (id, organization_id)
);
alter table public.purchase_receipts enable row level security;
create policy purchase_receipts_select on public.purchase_receipts
  for select to authenticated using (public.is_org_member(organization_id));
create trigger purchase_receipts_audit after insert on public.purchase_receipts
  for each row execute function public.audit_row_change();
revoke all on public.purchase_receipts from anon, authenticated;
grant select on public.purchase_receipts to authenticated;

/**
 * Registreert een (deel)ontvangst. idempotency_key voorkomt dat een dubbele
 * klik of herhaald verzoek de ontvangst twee keer boekt.
 */
create or replace function public.receive_purchase_line(line_id uuid, qty numeric, received date, idem_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.purchase_order_lines;
  po public.purchase_orders;
  rid uuid;
  remaining numeric;
begin
  select * into l from public.purchase_order_lines where id = line_id for update;
  if l.id is null or not public.has_org_role(l.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten om ontvangsten te boeken' using errcode = '42501';
  end if;
  select id into rid from public.purchase_receipts where organization_id = l.organization_id and idempotency_key = idem_key;
  if rid is not null then
    return rid; -- al verwerkt
  end if;
  select * into po from public.purchase_orders where id = l.purchase_order_id;
  if po.status not in ('ordered', 'partially_received') then
    raise exception 'Alleen bestelde inkooporders kunnen worden ontvangen' using errcode = '23514';
  end if;
  remaining := l.quantity - l.quantity_received;
  if qty <= 0 or qty > remaining then
    raise exception 'Ontvangen hoeveelheid moet tussen 0 en % liggen', remaining using errcode = '23514';
  end if;

  insert into public.purchase_receipts (organization_id, purchase_order_line_id, quantity, received_on, idempotency_key)
  values (l.organization_id, l.id, qty, coalesce(received, (now() at time zone 'America/Paramaribo')::date), idem_key)
  returning id into rid;

  perform set_config('bouwflow.receiving', 'on', true);
  update public.purchase_order_lines set quantity_received = quantity_received + qty where id = l.id;
  perform set_config('bouwflow.receiving', 'off', true);

  if l.destination = 'stock' then
    insert into public.stock_movements (organization_id, material_id, movement_type, quantity, unit_cost, source_type, source_id, occurred_on, note, created_by)
    values (l.organization_id, l.material_id, 'receipt', qty, l.unit_cost, 'purchase_receipt', rid, coalesce(received, current_date),
            'Inkooporder ' || po.purchase_order_number, auth.uid());
  else
    insert into public.project_cost_entries (organization_id, project_id, cost_type, description, quantity, unit, unit_cost, amount, entry_date, source_type, source_id, created_by)
    values (l.organization_id, l.project_id, l.cost_type, 'Inkoop ' || po.purchase_order_number || ': ' || l.description,
            qty, l.unit, l.unit_cost, round(qty * l.unit_cost, 2), coalesce(received, current_date), 'purchase_receipt', rid, auth.uid());
  end if;

  update public.purchase_orders
     set status = case when not exists (
                    select 1 from public.purchase_order_lines x where x.purchase_order_id = po.id and x.quantity_received < x.quantity)
                  then 'received'::public.purchase_order_status else 'partially_received'::public.purchase_order_status end
   where id = po.id;
  return rid;
end;
$$;
revoke all on function public.receive_purchase_line(uuid, numeric, date, text) from public, anon;
grant execute on function public.receive_purchase_line(uuid, numeric, date, text) to authenticated;

create or replace function public.purchase_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('received', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Deze inkooporder is afgesloten' using errcode = '42501';
  end if;
  if new.status in ('partially_received', 'received') and old.status not in ('ordered', 'partially_received') then
    raise exception 'Ongeldige statusovergang' using errcode = '23514';
  end if;
  if new.status = 'ordered' and old.status = 'draft'
     and not exists (select 1 from public.purchase_order_lines where purchase_order_id = new.id) then
    raise exception 'Een inkooporder zonder regels kan niet worden besteld' using errcode = '23514';
  end if;
  if new.status = 'cancelled' and exists (select 1 from public.purchase_order_lines where purchase_order_id = new.id and quantity_received > 0) then
    raise exception 'Een (deels) ontvangen inkooporder kan niet worden geannuleerd' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger purchase_orders_guard before update on public.purchase_orders
  for each row execute function public.purchase_order_guard();
