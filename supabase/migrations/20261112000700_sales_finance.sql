-- =============================================================================
-- BouwFlow — Offertes, facturen (incl. voorschot-, termijn-, eind- en
-- creditfacturen), betalingen, projectfinanciën en klantportaal.
--
-- Financiële regels:
--  * Bedragen: numeric, afronding op centen (half away from zero, gelijk aan
--    decimal.js ROUND_HALF_UP in de applicatie).
--  * Regelbedrag = round(aantal × prijs × (100 − korting%) / 100, 2)
--  * Belasting per tarief gegroepeerd en per groep afgerond.
--  * Definitieve documenten zijn onwijzigbaar en bevatten een momentopname
--    van bedrijfs-, klant-, regel- en belastinggegevens.
--  * Factuurnummers worden pas bij definitief maken toegekend (doorlopend).
-- =============================================================================

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'superseded', 'cancelled');
create type public.invoice_type as enum ('standard', 'advance', 'installment', 'final', 'credit');
create type public.invoice_status as enum ('draft', 'final', 'cancelled');
create type public.payment_method as enum ('bank_transfer', 'cash', 'card', 'cheque', 'other');

-- ---------------------------------------------------------------------------
-- Offertes
-- ---------------------------------------------------------------------------
create table public.quotes (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  quote_number       text not null,
  version            integer not null default 1 check (version >= 1),
  previous_quote_id  uuid,
  customer_id        uuid not null,
  project_id         uuid,
  status             public.quote_status not null default 'draft',
  title              text not null check (char_length(btrim(title)) between 1 and 200),
  introduction       text check (char_length(introduction) <= 5000),
  terms              text check (char_length(terms) <= 10000),
  quote_date         date not null default (now() at time zone 'America/Paramaribo')::date,
  valid_until        date,
  prices_include_tax boolean not null default false,
  currency_code      char(3) not null default 'SRD' check (currency_code ~ '^[A-Z]{3}$'),
  subtotal           numeric(14,2) not null default 0,
  tax_total          numeric(14,2) not null default 0,
  total              numeric(14,2) not null default 0,
  tax_breakdown      jsonb not null default '[]'::jsonb,
  snapshot           jsonb,
  sent_at            timestamptz,
  responded_at       timestamptz,
  responded_by_name  text check (char_length(responded_by_name) <= 200),
  responded_via      text check (responded_via in ('internal', 'portal')),
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, quote_number, version),
  unique (id, organization_id),
  check (valid_until is null or valid_until >= quote_date),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  foreign key (previous_quote_id, organization_id) references public.quotes (id, organization_id)
);
create index quotes_org_status_idx on public.quotes (organization_id, status, quote_date desc);
create index quotes_project_idx on public.quotes (project_id);
create index quotes_customer_idx on public.quotes (customer_id);

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text;
  yr integer := extract(year from now() at time zone 'America/Paramaribo')::integer;
begin
  if tg_op = 'INSERT' then
    if new.previous_quote_id is not null then
      -- Nieuwe versie behoudt het offertenummer
      select q.quote_number, q.version + 1 into new.quote_number, new.version
      from public.quotes q where q.id = new.previous_quote_id and q.organization_id = new.organization_id;
    else
      select coalesce(s.quote_number_prefix, 'OFF') into prefix from public.organization_settings s where s.organization_id = new.organization_id;
      new.quote_number := coalesce(prefix, 'OFF') || '-' || yr || '-' ||
        lpad(public.next_sequence_value(new.organization_id, 'quote', yr)::text, 4, '0');
      new.version := 1;
    end if;
    if new.valid_until is null then
      select new.quote_date + s.quote_validity_days into new.valid_until
      from public.organization_settings s where s.organization_id = new.organization_id;
    end if;
    new.created_by := auth.uid();
  elsif new.quote_number is distinct from old.quote_number or new.version is distinct from old.version then
    raise exception 'Offertenummer kan niet worden gewijzigd' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger quotes_number before insert or update on public.quotes
  for each row execute function public.assign_quote_number();
select public._bf_setup_tenant_table('quotes', '{owner,admin,manager,finance}');

create table public.quote_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  quote_id         uuid not null,
  description      text not null check (char_length(btrim(description)) between 1 and 1000),
  quantity         numeric(14,3) not null check (quantity <> 0),
  unit             text not null default 'st' check (char_length(unit) between 1 and 20),
  unit_price       numeric(14,4) not null,
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_id      uuid,
  tax_rate_percent numeric(6,3) check (tax_rate_percent is null or tax_rate_percent between 0 and 100),
  line_amount      numeric(14,2) generated always as (round(quantity * unit_price * (100 - discount_percent) / 100, 2)) stored,
  cost_type        public.cost_type,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (quote_id, organization_id) references public.quotes (id, organization_id) on delete cascade,
  foreign key (tax_rate_id, organization_id) references public.tax_rates (id, organization_id)
);
create index quote_lines_quote_idx on public.quote_lines (quote_id, sort_order);
select public._bf_setup_tenant_table('quote_lines', '{owner,admin,manager,finance}');
create policy quote_lines_delete on public.quote_lines
  for delete to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]));
grant delete on public.quote_lines to authenticated;

-- ---------------------------------------------------------------------------
-- Facturen
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  invoice_number      text, -- toegekend bij definitief maken
  invoice_type        public.invoice_type not null default 'standard',
  customer_id         uuid not null,
  project_id          uuid,
  quote_id            uuid,
  credited_invoice_id uuid,
  status              public.invoice_status not null default 'draft',
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  invoice_date        date not null default (now() at time zone 'America/Paramaribo')::date,
  due_date            date,
  payment_terms       text check (char_length(payment_terms) <= 2000),
  notes               text check (char_length(notes) <= 5000),
  prices_include_tax  boolean not null default false,
  currency_code       char(3) not null default 'SRD' check (currency_code ~ '^[A-Z]{3}$'),
  subtotal            numeric(14,2) not null default 0,
  tax_total           numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  tax_breakdown       jsonb not null default '[]'::jsonb,
  snapshot            jsonb,
  finalized_at        timestamptz,
  finalized_by        uuid,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, invoice_number),
  unique (id, organization_id),
  check ((invoice_type = 'credit') = (credited_invoice_id is not null)),
  check (status <> 'final' or invoice_number is not null),
  check (due_date is null or due_date >= invoice_date),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  foreign key (quote_id, organization_id) references public.quotes (id, organization_id),
  foreign key (credited_invoice_id, organization_id) references public.invoices (id, organization_id)
);
create index invoices_org_status_idx on public.invoices (organization_id, status, invoice_date desc);
create index invoices_project_idx on public.invoices (project_id);
create index invoices_customer_idx on public.invoices (customer_id);
select public._bf_setup_tenant_table('invoices', '{owner,admin,finance}');

create table public.invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  invoice_id       uuid not null,
  description      text not null check (char_length(btrim(description)) between 1 and 1000),
  quantity         numeric(14,3) not null check (quantity <> 0),
  unit             text not null default 'st' check (char_length(unit) between 1 and 20),
  unit_price       numeric(14,4) not null,
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_id      uuid,
  tax_rate_percent numeric(6,3) check (tax_rate_percent is null or tax_rate_percent between 0 and 100),
  line_amount      numeric(14,2) generated always as (round(quantity * unit_price * (100 - discount_percent) / 100, 2)) stored,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (invoice_id, organization_id) references public.invoices (id, organization_id) on delete cascade,
  foreign key (tax_rate_id, organization_id) references public.tax_rates (id, organization_id)
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort_order);
select public._bf_setup_tenant_table('invoice_lines', '{owner,admin,finance}');
create policy invoice_lines_delete on public.invoice_lines
  for delete to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.org_role[]));
grant delete on public.invoice_lines to authenticated;

-- ---------------------------------------------------------------------------
-- Totalen (één implementatie voor offertes en facturen)
-- ---------------------------------------------------------------------------
create or replace function public.compute_document_totals(lines jsonb, include_tax boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  gross numeric := 0;
  tax numeric := 0;
  groups jsonb := '[]'::jsonb;
  g record;
  taxable numeric;
  group_tax numeric;
begin
  select coalesce(sum((l ->> 'line_amount')::numeric), 0) into gross from jsonb_array_elements(lines) l;
  for g in
    select (l ->> 'tax_rate_percent')::numeric as rate, sum((l ->> 'line_amount')::numeric) as amount
    from jsonb_array_elements(lines) l
    where l ->> 'tax_rate_percent' is not null
    group by 1 order by 1
  loop
    if include_tax then
      taxable := round(g.amount * 100 / (100 + g.rate), 2);
      group_tax := g.amount - taxable;
    else
      taxable := g.amount;
      group_tax := round(g.amount * g.rate / 100, 2);
    end if;
    tax := tax + group_tax;
    groups := groups || jsonb_build_object('rate_percent', g.rate, 'taxable_amount', taxable, 'tax_amount', group_tax);
  end loop;
  return jsonb_build_object(
    'subtotal', case when include_tax then gross - tax else gross end,
    'tax_total', tax,
    'total', case when include_tax then gross else gross + tax end,
    'tax_breakdown', groups
  );
end;
$$;

create or replace function public.recalc_document(kind text, doc_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lines jsonb;
  inc boolean;
  t jsonb;
begin
  if kind = 'quote' then
    select prices_include_tax into inc from public.quotes where id = doc_id;
    select coalesce(jsonb_agg(jsonb_build_object('line_amount', line_amount, 'tax_rate_percent', tax_rate_percent)), '[]') into lines
    from public.quote_lines where quote_id = doc_id;
  else
    select prices_include_tax into inc from public.invoices where id = doc_id;
    select coalesce(jsonb_agg(jsonb_build_object('line_amount', line_amount, 'tax_rate_percent', tax_rate_percent)), '[]') into lines
    from public.invoice_lines where invoice_id = doc_id;
  end if;
  if inc is null then
    return; -- document verwijderd
  end if;
  t := public.compute_document_totals(lines, inc);
  perform set_config('bouwflow.recalc', 'on', true);
  if kind = 'quote' then
    update public.quotes set subtotal = (t ->> 'subtotal')::numeric, tax_total = (t ->> 'tax_total')::numeric,
           total = (t ->> 'total')::numeric, tax_breakdown = t -> 'tax_breakdown' where id = doc_id;
  else
    update public.invoices set subtotal = (t ->> 'subtotal')::numeric, tax_total = (t ->> 'tax_total')::numeric,
           total = (t ->> 'total')::numeric, tax_breakdown = t -> 'tax_breakdown' where id = doc_id;
  end if;
  perform set_config('bouwflow.recalc', 'off', true);
end;
$$;
revoke all on function public.recalc_document(text, uuid) from public, anon, authenticated;

-- Regels: tarief-momentopname, vergrendeling en herberekening
create or replace function public.document_line_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_status text;
  kind text := tg_argv[0];
begin
  if kind = 'quote' then
    select status::text into parent_status from public.quotes where id = coalesce(new.quote_id, old.quote_id);
  else
    select status::text into parent_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  end if;
  if parent_status is not null and parent_status <> 'draft' then
    raise exception 'Regels van een definitief document kunnen niet worden gewijzigd' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    if new.tax_rate_id is not null and (tg_op = 'INSERT' or new.tax_rate_id is distinct from old.tax_rate_id) then
      select rate_percent into new.tax_rate_percent from public.tax_rates
      where id = new.tax_rate_id and organization_id = new.organization_id;
    elsif new.tax_rate_id is null and tg_op = 'UPDATE' and old.tax_rate_id is not null then
      new.tax_rate_percent := null;
    end if;
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.document_line_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_argv[0] = 'quote' then
    perform public.recalc_document('quote', coalesce(new.quote_id, old.quote_id));
  else
    perform public.recalc_document('invoice', coalesce(new.invoice_id, old.invoice_id));
  end if;
  return null;
end;
$$;

create trigger quote_lines_before before insert or update or delete on public.quote_lines
  for each row execute function public.document_line_before('quote');
create trigger quote_lines_after after insert or update or delete on public.quote_lines
  for each row execute function public.document_line_after('quote');
create trigger invoice_lines_before before insert or update or delete on public.invoice_lines
  for each row execute function public.document_line_before('invoice');
create trigger invoice_lines_after after insert or update or delete on public.invoice_lines
  for each row execute function public.document_line_after('invoice');

-- Kopteksten: bedragen nooit rechtstreeks door clients; definitieve documenten vergrendeld.
create or replace function public.document_header_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed text[];
  o jsonb;
  n jsonb;
  k text;
begin
  if current_setting('bouwflow.recalc', true) = 'on' or current_setting('bouwflow.workflow', true) = 'on' then
    return new;
  end if;
  -- Totalen worden altijd door de database berekend
  if new.subtotal is distinct from old.subtotal or new.tax_total is distinct from old.tax_total
     or new.total is distinct from old.total or new.tax_breakdown is distinct from old.tax_breakdown
     or new.snapshot is distinct from old.snapshot then
    raise exception 'Totalen en momentopnames worden door het systeem bepaald' using errcode = '42501';
  end if;
  if old.status::text <> 'draft' then
    raise exception 'Een definitief document kan niet worden gewijzigd; gebruik de daarvoor bestemde actie' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status::text <> 'cancelled' then
    raise exception 'Statuswijzigingen verlopen via de documentacties' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger quotes_header_guard before update on public.quotes
  for each row execute function public.document_header_guard();
create trigger invoices_header_guard before update on public.invoices
  for each row execute function public.document_header_guard();

-- Nieuwe documenten beginnen altijd als concept zonder bedragen of momentopname.
create or replace function public.document_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('bouwflow.workflow', true) = 'on' then
    return new;
  end if;
  new.status := 'draft';
  new.subtotal := 0;
  new.tax_total := 0;
  new.total := 0;
  new.tax_breakdown := '[]'::jsonb;
  new.snapshot := null;
  if tg_table_name = 'invoices' then
    new.invoice_number := null;
    new.finalized_at := null;
    new.finalized_by := null;
  else
    new.sent_at := null;
    new.responded_at := null;
    new.responded_by_name := null;
    new.responded_via := null;
  end if;
  return new;
end;
$$;
create trigger quotes_insert_guard before insert on public.quotes
  for each row execute function public.document_insert_guard();
create trigger invoices_insert_guard before insert on public.invoices
  for each row execute function public.document_insert_guard();

-- Wijziging van "prijzen incl. belasting" in concept: totalen opnieuw berekenen
create or replace function public.document_header_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.prices_include_tax is distinct from old.prices_include_tax then
    perform public.recalc_document(tg_argv[0], new.id);
  end if;
  return null;
end;
$$;
create trigger quotes_header_recalc after update on public.quotes
  for each row execute function public.document_header_recalc('quote');
create trigger invoices_header_recalc after update on public.invoices
  for each row execute function public.document_header_recalc('invoice');

-- ---------------------------------------------------------------------------
-- Momentopname voor definitieve documenten
-- ---------------------------------------------------------------------------
create or replace function public.document_snapshot(kind text, doc_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  cust_id uuid;
  proj_id uuid;
  lines jsonb;
begin
  if kind = 'quote' then
    select organization_id, customer_id, project_id into org_id, cust_id, proj_id from public.quotes where id = doc_id;
    select coalesce(jsonb_agg(to_jsonb(l) - 'organization_id' - 'created_at' - 'updated_at' order by l.sort_order, l.created_at), '[]')
      into lines from public.quote_lines l where l.quote_id = doc_id;
  else
    select organization_id, customer_id, project_id into org_id, cust_id, proj_id from public.invoices where id = doc_id;
    select coalesce(jsonb_agg(to_jsonb(l) - 'organization_id' - 'created_at' - 'updated_at' order by l.sort_order, l.created_at), '[]')
      into lines from public.invoice_lines l where l.invoice_id = doc_id;
  end if;
  return jsonb_build_object(
    'taken_at', now(),
    'organization', (select to_jsonb(s) - 'organization_id' - 'created_at' - 'updated_at' || jsonb_build_object('name', o.name)
                     from public.organization_settings s join public.organizations o on o.id = s.organization_id
                     where s.organization_id = org_id),
    'customer', (select to_jsonb(c) - 'organization_id' - 'created_at' - 'updated_at' - 'notes' from public.customers c where c.id = cust_id),
    'project', (select jsonb_build_object('project_number', p.project_number, 'name', p.name,
                                          'location', concat_ws(', ', p.location_address, p.location_city))
                from public.projects p where p.id = proj_id),
    'lines', lines
  );
end;
$$;
revoke all on function public.document_snapshot(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Offerte-acties
-- ---------------------------------------------------------------------------
create or replace function public.send_quote(q_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
begin
  select * into q from public.quotes where id = q_id for update;
  if q.id is null or not public.has_org_role(q.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if q.status <> 'draft' then
    raise exception 'Alleen een conceptofferte kan definitief worden gemaakt' using errcode = '23514';
  end if;
  if not exists (select 1 from public.quote_lines where quote_id = q_id) then
    raise exception 'Een offerte zonder regels kan niet worden verzonden' using errcode = '23514';
  end if;
  perform set_config('bouwflow.workflow', 'on', true);
  update public.quotes set status = 'sent', sent_at = now(), snapshot = public.document_snapshot('quote', q_id) where id = q_id;
  perform set_config('bouwflow.workflow', 'off', true);
end;
$$;

create or replace function public.respond_quote_internal(q public.quotes, accept boolean, by_name text, via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if q.status <> 'sent' then
    raise exception 'Alleen een verzonden offerte kan worden geaccepteerd of afgewezen' using errcode = '23514';
  end if;
  if accept and q.valid_until is not null and q.valid_until < (now() at time zone 'America/Paramaribo')::date then
    raise exception 'Deze offerte is verlopen' using errcode = '23514';
  end if;
  perform set_config('bouwflow.workflow', 'on', true);
  update public.quotes
     set status = case when accept then 'accepted'::public.quote_status else 'rejected'::public.quote_status end,
         responded_at = now(), responded_by_name = left(by_name, 200), responded_via = via
   where id = q.id;
  -- Workflow: geaccepteerde offerte = opdracht → projectwaarde en status bijwerken
  if accept and q.project_id is not null then
    update public.projects
       set contract_value = q.subtotal,
           status = case when status = 'concept' then 'planned'::public.project_status else status end
     where id = q.project_id;
  end if;
  perform set_config('bouwflow.workflow', 'off', true);
end;
$$;
revoke all on function public.respond_quote_internal(public.quotes, boolean, text, text) from public, anon, authenticated;

create or replace function public.respond_quote(q_id uuid, accept boolean, by_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
begin
  select * into q from public.quotes where id = q_id for update;
  if q.id is null or not public.has_org_role(q.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  perform public.respond_quote_internal(q, accept, coalesce(nullif(btrim(by_name), ''), 'Intern geregistreerd'), 'internal');
end;
$$;

/** Nieuwe conceptversie van een verzonden/afgewezen offerte; de oude wordt 'superseded'. */
create or replace function public.revise_quote(q_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
  new_id uuid;
begin
  select * into q from public.quotes where id = q_id for update;
  if q.id is null or not public.has_org_role(q.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if q.status not in ('sent', 'rejected') then
    raise exception 'Alleen verzonden of afgewezen offertes kunnen worden herzien' using errcode = '23514';
  end if;
  insert into public.quotes (organization_id, previous_quote_id, customer_id, project_id, title, introduction, terms,
                             prices_include_tax, currency_code, quote_number)
  values (q.organization_id, q.id, q.customer_id, q.project_id, q.title, q.introduction, q.terms, q.prices_include_tax, q.currency_code, 'tmp')
  returning id into new_id;
  insert into public.quote_lines (organization_id, quote_id, description, quantity, unit, unit_price, discount_percent, tax_rate_id, tax_rate_percent, cost_type, sort_order)
  select organization_id, new_id, description, quantity, unit, unit_price, discount_percent, tax_rate_id, tax_rate_percent, cost_type, sort_order
  from public.quote_lines where quote_id = q.id;
  perform set_config('bouwflow.workflow', 'on', true);
  update public.quotes set status = 'superseded' where id = q.id;
  perform set_config('bouwflow.workflow', 'off', true);
  return new_id;
end;
$$;

/** Conceptofferte vanuit de voorcalculatie. group_mode: 'line' (per regel) of 'type' (per kostensoort). */
create or replace function public.create_quote_from_estimate(p_id uuid, group_mode text, quote_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  q_id uuid;
  default_tax uuid;
  inc boolean;
begin
  select * into p from public.projects where id = p_id;
  if p.id is null or not public.has_org_role(p.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if not exists (select 1 from public.project_estimate_lines where project_id = p_id) then
    raise exception 'Dit project heeft nog geen calculatieregels' using errcode = '23514';
  end if;
  select id into default_tax from public.tax_rates where organization_id = p.organization_id and is_default and not is_archived;
  select prices_include_vat into inc from public.organization_settings where organization_id = p.organization_id;
  insert into public.quotes (organization_id, customer_id, project_id, title, currency_code, prices_include_tax, quote_number)
  values (p.organization_id, p.customer_id, p.id, coalesce(nullif(btrim(quote_title), ''), p.name), p.currency_code, coalesce(inc, false), 'tmp')
  returning id into q_id;

  if group_mode = 'type' then
    insert into public.quote_lines (organization_id, quote_id, description, quantity, unit, unit_price, tax_rate_id, cost_type, sort_order)
    select p.organization_id, q_id,
           case e.cost_type when 'material' then 'Materialen' when 'labor' then 'Arbeid' when 'equipment' then 'Machines en materieel'
                            when 'transport' then 'Transport' when 'subcontractor' then 'Onderaanneming' else 'Overige kosten' end,
           1, 'post', sum(e.sale_total), default_tax, e.cost_type,
           array_position(array['material','labor','equipment','transport','subcontractor','other'], e.cost_type::text)
    from public.project_estimate_lines e where e.project_id = p_id
    group by e.cost_type having sum(e.sale_total) <> 0;
  else
    insert into public.quote_lines (organization_id, quote_id, description, quantity, unit, unit_price, tax_rate_id, cost_type, sort_order)
    select p.organization_id, q_id, e.description, round(e.effective_quantity, 3), e.unit, e.unit_price, default_tax, e.cost_type, e.sort_order
    from public.project_estimate_lines e where e.project_id = p_id and e.quantity > 0 and e.unit_price > 0;
  end if;
  return q_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Factuur-acties
-- ---------------------------------------------------------------------------
create or replace function public.finalize_invoice(inv_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  s public.organization_settings;
  yr integer;
  num text;
  original public.invoices;
  already_credited numeric;
begin
  select * into inv from public.invoices where id = inv_id for update;
  if inv.id is null or not public.has_org_role(inv.organization_id, array['owner', 'admin', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if inv.status <> 'draft' then
    raise exception 'Alleen een conceptfactuur kan definitief worden gemaakt' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv_id) then
    raise exception 'Een factuur zonder regels kan niet definitief worden' using errcode = '23514';
  end if;
  if inv.invoice_type = 'credit' then
    if inv.total >= 0 then
      raise exception 'Een creditnota moet een negatief totaal hebben' using errcode = '23514';
    end if;
    select * into original from public.invoices where id = inv.credited_invoice_id;
    if original.status <> 'final' or original.invoice_type = 'credit' then
      raise exception 'Alleen een definitieve factuur kan worden gecrediteerd' using errcode = '23514';
    end if;
    select coalesce(sum(-total), 0) into already_credited from public.invoices
     where credited_invoice_id = original.id and status = 'final';
    if already_credited + (-inv.total) > original.total then
      raise exception 'Het creditbedrag is hoger dan het nog niet gecrediteerde factuurbedrag' using errcode = '23514';
    end if;
  elsif inv.total < 0 then
    raise exception 'Het factuurtotaal mag niet negatief zijn; gebruik een creditnota' using errcode = '23514';
  end if;

  select * into s from public.organization_settings where organization_id = inv.organization_id;
  yr := extract(year from inv.invoice_date)::integer;
  if inv.invoice_type = 'credit' then
    num := 'CR-' || yr || '-' || lpad(public.next_sequence_value(inv.organization_id, 'credit_note', yr)::text, 4, '0');
  else
    num := coalesce(s.invoice_number_prefix, 'FAC') || '-' || yr || '-' ||
           lpad(public.next_sequence_value(inv.organization_id, 'invoice', yr)::text, 4, '0');
  end if;

  perform set_config('bouwflow.workflow', 'on', true);
  update public.invoices
     set status = 'final', invoice_number = num, finalized_at = now(), finalized_by = auth.uid(),
         due_date = coalesce(due_date, invoice_date + s.payment_term_days),
         payment_terms = coalesce(payment_terms, 'Betaling binnen ' || s.payment_term_days || ' dagen na factuurdatum.'),
         snapshot = public.document_snapshot('invoice', inv_id)
   where id = inv_id;
  perform set_config('bouwflow.workflow', 'off', true);
  return num;
end;
$$;

/**
 * Conceptfactuur vanuit een geaccepteerde offerte.
 *  standard    : alle offerteregels
 *  advance /
 *  installment : percentage van de offerte, per belastingtarief één regel
 *  final       : alle offerteregels minus eerder gefactureerde termijnen/voorschotten
 */
create or replace function public.create_invoice_from_quote(q_id uuid, inv_type public.invoice_type, pct numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
  inv_id uuid;
  label text;
begin
  select * into q from public.quotes where id = q_id;
  if q.id is null or not public.has_org_role(q.organization_id, array['owner', 'admin', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if q.status <> 'accepted' then
    raise exception 'Alleen een geaccepteerde offerte kan worden gefactureerd' using errcode = '23514';
  end if;
  if inv_type = 'credit' then
    raise exception 'Gebruik create_credit_note voor creditnota''s' using errcode = '23514';
  end if;
  if inv_type in ('advance', 'installment') and (pct is null or pct <= 0 or pct > 100) then
    raise exception 'Percentage moet tussen 0 en 100 liggen' using errcode = '23514';
  end if;

  label := case inv_type when 'advance' then 'Voorschotfactuur' when 'installment' then 'Termijnfactuur'
                         when 'final' then 'Eindfactuur' else 'Factuur' end;
  insert into public.invoices (organization_id, invoice_type, customer_id, project_id, quote_id, title, prices_include_tax, currency_code)
  values (q.organization_id, inv_type, q.customer_id, q.project_id, q.id, label || ' — ' || q.title, q.prices_include_tax, q.currency_code)
  returning id into inv_id;

  if inv_type in ('standard', 'final') then
    insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit, unit_price, discount_percent, tax_rate_id, tax_rate_percent, sort_order)
    select organization_id, inv_id, description, quantity, unit, unit_price, discount_percent, tax_rate_id, tax_rate_percent, sort_order
    from public.quote_lines where quote_id = q_id;
  end if;

  if inv_type in ('advance', 'installment') then
    -- per belastingtarief: percentage van het regeltotaal (zelfde belastingbehandeling als de offerte)
    insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit, unit_price, tax_rate_percent, sort_order)
    select q.organization_id, inv_id,
           label || ' ' || trim(to_char(pct, 'FM990.99')) || '% van offerte ' || q.quote_number ||
             case when tax_rate_percent is null then '' else ' (tarief ' || trim(to_char(tax_rate_percent, 'FM990.###')) || '%)' end,
           1, 'post', round(sum(line_amount) * pct / 100, 2), tax_rate_percent, 1
    from public.quote_lines where quote_id = q_id
    group by tax_rate_percent;
  end if;

  if inv_type = 'final' then
    -- eerder definitief gefactureerde voorschotten/termijnen op deze offerte aftrekken
    insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit, unit_price, tax_rate_percent, sort_order)
    select q.organization_id, inv_id, 'Reeds gefactureerd: ' || string_agg(distinct i.invoice_number, ', '),
           -1, 'post', sum(l.line_amount), l.tax_rate_percent, 10000
    from public.invoices i join public.invoice_lines l on l.invoice_id = i.id
    where i.quote_id = q_id and i.status = 'final' and i.invoice_type in ('advance', 'installment')
    group by l.tax_rate_percent
    having sum(l.line_amount) <> 0;
  end if;
  return inv_id;
end;
$$;

/** Creditnota (concept) voor een definitieve factuur: volledig of met eigen regels. */
create or replace function public.create_credit_note(inv_id uuid, full_credit boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  cn_id uuid;
begin
  select * into inv from public.invoices where id = inv_id;
  if inv.id is null or not public.has_org_role(inv.organization_id, array['owner', 'admin', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  if inv.status <> 'final' or inv.invoice_type = 'credit' then
    raise exception 'Alleen een definitieve factuur kan worden gecrediteerd' using errcode = '23514';
  end if;
  insert into public.invoices (organization_id, invoice_type, customer_id, project_id, quote_id, credited_invoice_id, title, prices_include_tax, currency_code)
  values (inv.organization_id, 'credit', inv.customer_id, inv.project_id, inv.quote_id, inv.id,
          'Creditnota bij ' || inv.invoice_number, inv.prices_include_tax, inv.currency_code)
  returning id into cn_id;
  if full_credit then
    insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit, unit_price, discount_percent, tax_rate_percent, sort_order)
    select organization_id, cn_id, description, -quantity, unit, unit_price, discount_percent, tax_rate_percent, sort_order
    from public.invoice_lines where invoice_id = inv_id;
  end if;
  return cn_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Betalingen
-- ---------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  invoice_id          uuid not null,
  amount              numeric(14,2) not null check (amount <> 0),
  paid_on             date not null,
  method              public.payment_method not null default 'bank_transfer',
  reference           text check (char_length(reference) <= 200),
  notes               text check (char_length(notes) <= 2000),
  reversed_payment_id uuid unique,
  idempotency_key     text not null check (char_length(idempotency_key) between 8 and 100),
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  check ((reversed_payment_id is null) = (amount > 0)),
  foreign key (invoice_id, organization_id) references public.invoices (id, organization_id),
  foreign key (reversed_payment_id, organization_id) references public.payments (id, organization_id)
);
create index payments_invoice_idx on public.payments (invoice_id);

create or replace function public.payment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  paid numeric;
  credited numeric;
  rev public.payments;
begin
  select * into inv from public.invoices where id = new.invoice_id for update;
  if inv.status <> 'final' then
    raise exception 'Betalingen kunnen alleen op definitieve facturen worden geboekt' using errcode = '23514';
  end if;
  if inv.invoice_type = 'credit' then
    raise exception 'Boek betalingen op de oorspronkelijke factuur, niet op de creditnota' using errcode = '23514';
  end if;
  if new.reversed_payment_id is not null then
    select * into rev from public.payments where id = new.reversed_payment_id;
    if rev.invoice_id <> new.invoice_id or rev.amount <> -new.amount then
      raise exception 'Een tegenboeking moet exact de oorspronkelijke betaling terugdraaien' using errcode = '23514';
    end if;
    return new;
  end if;
  select coalesce(sum(amount), 0) into paid from public.payments where invoice_id = new.invoice_id;
  select coalesce(sum(-total), 0) into credited from public.invoices where credited_invoice_id = new.invoice_id and status = 'final';
  if paid + new.amount > inv.total - credited then
    raise exception 'Betaling is hoger dan het openstaande bedrag (%)', inv.total - credited - paid using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger payments_guard before insert on public.payments
  for each row execute function public.payment_guard();
create trigger payments_audit after insert on public.payments
  for each row execute function public.audit_row_change();
alter table public.payments enable row level security;
create policy payments_select on public.payments
  for select to authenticated using (public.is_org_member(organization_id));
create policy payments_insert on public.payments
  for insert to authenticated with check (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.org_role[]));
-- Geen update/delete: betalingen zijn onwijzigbaar (correctie via tegenboeking).
revoke all on public.payments from anon, authenticated;
grant select, insert on public.payments to authenticated;

-- Facturen kunnen niet worden geannuleerd als ze definitief zijn (gebruik een creditnota).
create or replace function public.invoice_cancel_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status = 'final' then
    raise exception 'Een definitieve factuur kan niet worden geannuleerd; maak een creditnota' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger invoices_cancel_guard before update on public.invoices
  for each row execute function public.invoice_cancel_guard();

-- Saldo per factuur
create view public.invoice_balances with (security_invoker = true) as
select i.id as invoice_id, i.organization_id, i.invoice_type, i.status, i.total, i.due_date,
       coalesce(p.paid, 0)::numeric(14,2) as paid,
       coalesce(c.credited, 0)::numeric(14,2) as credited,
       case when i.invoice_type = 'credit' or i.status <> 'final' then 0
            else (i.total - coalesce(c.credited, 0) - coalesce(p.paid, 0)) end::numeric(14,2) as outstanding,
       case when i.status <> 'final' then i.status::text
            when i.invoice_type = 'credit' then 'credit'
            when i.total - coalesce(c.credited, 0) - coalesce(p.paid, 0) <= 0 then 'paid'
            when i.due_date < (now() at time zone 'America/Paramaribo')::date then 'overdue'
            when coalesce(p.paid, 0) > 0 then 'partially_paid'
            else 'open' end as payment_status
from public.invoices i
left join (select invoice_id, sum(amount) as paid from public.payments group by invoice_id) p on p.invoice_id = i.id
left join (select credited_invoice_id, sum(-total) as credited from public.invoices where status = 'final' and invoice_type = 'credit'
           group by credited_invoice_id) c on c.credited_invoice_id = i.id;
grant select on public.invoice_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Projectfinanciën: begroot vs. werkelijk, en drie aparte omzetbegrippen
-- ---------------------------------------------------------------------------
create view public.project_financials with (security_invoker = true) as
select p.id as project_id, p.organization_id, p.currency_code, p.contract_value, p.budget_amount,
  -- begroting uit de voorcalculatie
  coalesce(e.material, 0)::numeric(14,2) as budget_material,
  coalesce(e.labor, 0)::numeric(14,2) as budget_labor,
  coalesce(e.equipment, 0)::numeric(14,2) as budget_equipment,
  coalesce(e.transport, 0)::numeric(14,2) as budget_transport,
  coalesce(e.subcontractor, 0)::numeric(14,2) as budget_subcontractor,
  coalesce(e.other, 0)::numeric(14,2) as budget_other,
  coalesce(e.cost_total, 0)::numeric(14,2) as budget_cost_total,
  coalesce(e.sale_total, 0)::numeric(14,2) as budget_sale_total,
  coalesce(e.labor_hours, 0)::numeric(14,2) as budget_labor_hours,
  coalesce(e.line_count, 0) as estimate_line_count,
  -- werkelijke kosten uit het kostenregister
  coalesce(a.material, 0)::numeric(14,2) as actual_material,
  coalesce(a.labor, 0)::numeric(14,2) as actual_labor,
  coalesce(a.equipment, 0)::numeric(14,2) as actual_equipment,
  coalesce(a.transport, 0)::numeric(14,2) as actual_transport,
  coalesce(a.subcontractor, 0)::numeric(14,2) as actual_subcontractor,
  coalesce(a.other, 0)::numeric(14,2) as actual_other,
  coalesce(a.total, 0)::numeric(14,2) as actual_cost_total,
  coalesce(h.hours, 0)::numeric(14,2) as actual_labor_hours,
  -- omzet: gefactureerd (excl. belasting, incl. creditnota's), ontvangen (incl. belasting)
  -- en ontvangen omgerekend naar excl. belasting (naar verhouding per factuur)
  coalesce(f.invoiced_excl, 0)::numeric(14,2) as invoiced_excl_tax,
  coalesce(f.invoiced_incl, 0)::numeric(14,2) as invoiced_incl_tax,
  coalesce(f.received_incl, 0)::numeric(14,2) as received_incl_tax,
  coalesce(f.received_excl, 0)::numeric(14,2) as received_excl_tax
from public.projects p
left join (
  select project_id,
    sum(cost_total) filter (where cost_type = 'material') as material,
    sum(cost_total) filter (where cost_type = 'labor') as labor,
    sum(cost_total) filter (where cost_type = 'equipment') as equipment,
    sum(cost_total) filter (where cost_type = 'transport') as transport,
    sum(cost_total) filter (where cost_type = 'subcontractor') as subcontractor,
    sum(cost_total) filter (where cost_type = 'other') as other,
    sum(cost_total) as cost_total, sum(sale_total) as sale_total,
    sum(effective_quantity) filter (where cost_type = 'labor') as labor_hours,
    count(*) as line_count
  from public.project_estimate_lines group by project_id
) e on e.project_id = p.id
left join (
  select project_id,
    sum(amount) filter (where cost_type = 'material') as material,
    sum(amount) filter (where cost_type = 'labor') as labor,
    sum(amount) filter (where cost_type = 'equipment') as equipment,
    sum(amount) filter (where cost_type = 'transport') as transport,
    sum(amount) filter (where cost_type = 'subcontractor') as subcontractor,
    sum(amount) filter (where cost_type = 'other') as other,
    sum(amount) as total
  from public.project_cost_entries group by project_id
) a on a.project_id = p.id
left join (
  select project_id, sum(hours) as hours from public.time_entries where status = 'approved' group by project_id
) h on h.project_id = p.id
left join (
  select i.project_id,
    sum(i.subtotal) as invoiced_excl,
    sum(i.total) as invoiced_incl,
    sum(coalesce(pp.paid, 0)) as received_incl,
    sum(case when i.total <> 0 then round(coalesce(pp.paid, 0) * i.subtotal / i.total, 2) else 0 end) as received_excl
  from public.invoices i
  left join (select invoice_id, sum(amount) as paid from public.payments group by invoice_id) pp on pp.invoice_id = i.id
  where i.status = 'final' and i.project_id is not null
  group by i.project_id
) f on f.project_id = p.id;
grant select on public.project_financials to authenticated;

-- ---------------------------------------------------------------------------
-- Klantportaal (toegang via geheime link; geen account nodig)
-- ---------------------------------------------------------------------------
create table public.customer_portal_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id     uuid not null,
  token_hash      text not null unique,
  created_by      uuid default auth.uid(),
  expires_at      timestamptz not null default now() + interval '90 days',
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now(),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id)
);
alter table public.customer_portal_links enable row level security;
create policy customer_portal_links_select on public.customer_portal_links
  for select to authenticated using (public.is_org_member(organization_id));
revoke all on public.customer_portal_links from anon, authenticated;
grant select on public.customer_portal_links to authenticated;

create or replace function public.create_portal_link(cust_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.customers;
  raw_token text;
begin
  select * into c from public.customers where id = cust_id;
  if c.id is null or not public.has_org_role(c.organization_id, array['owner', 'admin', 'manager', 'finance']::public.org_role[])
     or not public.org_has_module(c.organization_id, 'klantportaal') then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.customer_portal_links (organization_id, customer_id, token_hash)
  values (c.organization_id, c.id, encode(extensions.digest(raw_token, 'sha256'), 'hex'));
  return raw_token;
end;
$$;

create or replace function public.revoke_portal_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.customer_portal_links where id = link_id;
  if org is null or not public.has_org_role(org, array['owner', 'admin', 'manager', 'finance']::public.org_role[]) then
    raise exception 'Geen rechten' using errcode = '42501';
  end if;
  update public.customer_portal_links set revoked_at = now() where id = link_id;
end;
$$;

create or replace function public.portal_resolve(raw_token text)
returns public.customer_portal_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.customer_portal_links;
begin
  if raw_token is null or raw_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldige link' using errcode = '42501';
  end if;
  select * into l from public.customer_portal_links
   where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
     and revoked_at is null and expires_at > now();
  if l.id is null then
    raise exception 'Deze link is ongeldig of verlopen' using errcode = '42501';
  end if;
  update public.customer_portal_links set last_used_at = now() where id = l.id;
  return l;
end;
$$;
revoke all on function public.portal_resolve(text) from public, anon, authenticated;

/** Alles wat de klant mag zien: alleen niet-concept offertes en definitieve facturen. */
create or replace function public.portal_overview(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.customer_portal_links;
begin
  l := public.portal_resolve(raw_token);
  return jsonb_build_object(
    'organization', (select jsonb_build_object('name', o.name, 'legal_name', s.legal_name, 'email', s.email, 'phone', s.phone,
                                               'address_line', s.address_line, 'city', s.city, 'currency_code', s.currency_code)
                     from public.organizations o join public.organization_settings s on s.organization_id = o.id
                     where o.id = l.organization_id),
    'customer', (select jsonb_build_object('name', c.name, 'customer_number', c.customer_number) from public.customers c where c.id = l.customer_id),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('project_number', p.project_number, 'name', p.name, 'status', p.status,
                                                               'start_date', p.start_date, 'expected_end_date', p.expected_end_date) order by p.created_at desc), '[]')
                 from public.projects p where p.customer_id = l.customer_id and not p.is_archived),
    'quotes', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'version', q.version, 'title', q.title,
                                                             'status', q.status, 'quote_date', q.quote_date, 'valid_until', q.valid_until,
                                                             'subtotal', q.subtotal, 'tax_total', q.tax_total, 'total', q.total,
                                                             'currency_code', q.currency_code, 'lines', q.snapshot -> 'lines') order by q.quote_date desc), '[]')
               from public.quotes q where q.customer_id = l.customer_id and q.status in ('sent', 'accepted', 'rejected')),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'invoice_number', i.invoice_number, 'invoice_type', i.invoice_type,
                                                               'title', i.title, 'invoice_date', i.invoice_date, 'due_date', i.due_date,
                                                               'total', i.total, 'currency_code', i.currency_code,
                                                               'outstanding', b.outstanding, 'payment_status', b.payment_status) order by i.invoice_date desc), '[]')
                 from public.invoices i join public.invoice_balances b on b.invoice_id = i.id
                 where i.customer_id = l.customer_id and i.status = 'final')
  );
end;
$$;

create or replace function public.portal_respond_quote(raw_token text, q_id uuid, accept boolean, by_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.customer_portal_links;
  q public.quotes;
begin
  l := public.portal_resolve(raw_token);
  if by_name is null or char_length(btrim(by_name)) < 2 then
    raise exception 'Vul uw naam in' using errcode = '22023';
  end if;
  select * into q from public.quotes where id = q_id and customer_id = l.customer_id and organization_id = l.organization_id for update;
  if q.id is null then
    raise exception 'Offerte niet gevonden' using errcode = 'P0002';
  end if;
  perform public.respond_quote_internal(q, accept, btrim(by_name), 'portal');
end;
$$;

-- Rechten op functies
do $$
declare f text;
begin
  foreach f in array array[
    'send_quote(uuid)', 'respond_quote(uuid, boolean, text)', 'revise_quote(uuid)',
    'create_quote_from_estimate(uuid, text, text)', 'finalize_invoice(uuid)',
    'create_invoice_from_quote(uuid, public.invoice_type, numeric)', 'create_credit_note(uuid, boolean)',
    'create_portal_link(uuid)', 'revoke_portal_link(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['portal_overview(text)', 'portal_respond_quote(text, uuid, boolean, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
