-- =============================================================================
-- Tests: multi-tenant isolatie, rollen en bedrijfsregels
-- =============================================================================
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'TEST MISLUKT: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Voert een statement uit en verwacht dat het faalt.
create function tests.throws(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'TEST MISLUKT (geen fout): %', msg;
end $$;

-- Retourneert het aantal geraakte rijen van een statement.
create function tests.affected(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt; get diagnostics n = row_count; return n;
end $$;

create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

create table tests.ids (key text primary key, id uuid);
grant select on tests.ids to anon, authenticated;

-- Testgebruikers (aangemaakt als superuser, zoals Supabase Auth zou doen)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.sr', '{"full_name":"Anna Eigenaar"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.sr', '{"full_name":"Bram Concurrent"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.sr', '{"full_name":"Chris Kijker"}');

select tests.ok((select count(*) from public.profiles) = 3, 'profielen worden automatisch aangemaakt');

-- ---------------------------------------------------------------------------
-- Organisaties aanmaken via RPC
-- ---------------------------------------------------------------------------
insert into tests.ids values ('org_a', null);

select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.throws($$select public.create_organization('X')$$, 'te korte organisatienaam wordt geweigerd');

reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
create temp table _tmp as select public.create_organization('Aannemersbedrijf Alfa') as id;
reset role; update tests.ids set id = (select id from _tmp) where key = 'org_a'; drop table _tmp;

select tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
create temp table _tmp as select public.create_organization('Installatiebedrijf Beta') as id;
reset role; insert into tests.ids values ('org_b', (select id from _tmp)); drop table _tmp;

-- C wordt door de beheerder (hier: superuser) als kijker aan Alfa toegevoegd
insert into public.organization_members (organization_id, user_id, role)
values ((select id from tests.ids where key = 'org_a'), '00000000-0000-0000-0000-00000000000c', 'viewer');

select tests.ok(
  (select role from public.organization_members
   where user_id = '00000000-0000-0000-0000-00000000000a') = 'owner',
  'maker van de organisatie wordt eigenaar');
select tests.ok(
  (select currency_code from public.organization_settings
   where organization_id = (select id from tests.ids where key = 'org_a')) = 'SRD',
  'standaardvaluta is SRD');
select tests.ok((select count(*) from public.tax_rates) = 0, 'er worden geen belastingtarieven aangenomen');

-- ---------------------------------------------------------------------------
-- Klanten: aanmaken en nummering
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;

insert into public.customers (organization_id, customer_type, name, email, customer_number)
select id, 'business', 'Bouwmaatschappij Paramaribo N.V.', 'info@bmp.sr', 'HACK-1' from tests.ids where key = 'org_a';
insert into public.customers (organization_id, customer_type, name)
select id, 'private', 'Familie Doe' from tests.ids where key = 'org_a';

select tests.ok(
  (select array_agg(customer_number order by customer_number) from public.customers) = array['K-00001', 'K-00002'],
  'klantnummers worden door de server opeenvolgend toegekend (client-waarde genegeerd)');

select tests.ok(
  (select created_by from public.customers where customer_number = 'K-00001') = '00000000-0000-0000-0000-00000000000a',
  'created_by wordt door de server ingevuld');

select tests.throws(
  $$update public.customers set customer_number = 'K-99999' where customer_number = 'K-00001'$$,
  'klantnummer kan niet worden gewijzigd');

select tests.throws(
  $$insert into public.customers (organization_id, name, email) select id, 'Fout', 'geen-email' from tests.ids where key = 'org_a'$$,
  'ongeldig e-mailadres wordt door de database geweigerd');

-- ---------------------------------------------------------------------------
-- Isolatie tussen organisaties
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000b');

select tests.ok((select count(*) from public.customers) = 0, 'B ziet geen klanten van A');
select tests.ok((select count(*) from public.organizations) = 1, 'B ziet alleen de eigen organisatie');
select tests.ok((select count(*) from public.organization_members) = 1, 'B ziet geen leden van A');
select tests.ok((select count(*) from public.activity_log) = 0, 'B ziet geen activiteiten van A');
select tests.ok((select count(*) from public.profiles) = 1, 'B ziet alleen het eigen profiel');

select tests.throws(
  $$insert into public.customers (organization_id, name) select id, 'Indringer' from tests.ids where key = 'org_a'$$,
  'B kan geen klant aanmaken in organisatie A');

select tests.ok(
  tests.affected($$update public.customers set name = 'Gehackt'$$) = 0,
  'B kan klanten van A niet wijzigen');

select tests.throws(
  $$insert into public.organization_members (organization_id, user_id, role)
    select id, '00000000-0000-0000-0000-00000000000b', 'owner' from tests.ids where key = 'org_a'$$,
  'B kan zichzelf niet toevoegen aan organisatie A');

select tests.ok(
  tests.affected($$update public.organization_settings set currency_code = 'USD'
    where organization_id = (select id from tests.ids where key = 'org_a')$$) = 0,
  'B kan instellingen van A niet wijzigen');

select tests.throws($$select * from public.number_sequences$$, 'nummerreeksen zijn niet direct toegankelijk');
select tests.throws(
  $$select public.next_sequence_value((select id from tests.ids where key = 'org_a'), 'customer', 0)$$,
  'nummerreeks-functie is niet aanroepbaar door clients');

-- B probeert een project in de eigen organisatie te koppelen aan een klant van A
reset role;
insert into tests.ids values ('cust_a1', (select id from public.customers where customer_number = 'K-00001'));
set role authenticated;

select tests.throws(
  $$insert into public.projects (organization_id, name, customer_id)
    select (select id from tests.ids where key = 'org_b'), 'Gestolen klant',
           (select id from tests.ids where key = 'cust_a1')$$,
  'project kan niet verwijzen naar een klant van een andere organisatie');

-- ---------------------------------------------------------------------------
-- Projecten
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');

insert into public.projects (organization_id, name, customer_id, status, budget_amount, contract_value, start_date, expected_end_date)
select (select id from tests.ids where key = 'org_a'), 'Nieuwbouw kantoor',
       (select id from tests.ids where key = 'cust_a1'), 'planned', 125000.50, 160000, '2026-11-01', '2027-03-01';

select tests.ok(
  (select project_number from public.projects) ~ '^P-\d{4}-0001$',
  'projectnummer heeft formaat P-JAAR-0001');

select tests.throws(
  $$insert into public.projects (organization_id, name, customer_id, start_date, expected_end_date)
    select (select id from tests.ids where key = 'org_a'), 'Fout', (select id from tests.ids where key = 'cust_a1'), '2027-01-01', '2026-01-01'$$,
  'einddatum voor startdatum wordt geweigerd');

select tests.throws(
  $$insert into public.projects (organization_id, name, customer_id, budget_amount)
    select (select id from tests.ids where key = 'org_a'), 'Fout', (select id from tests.ids where key = 'cust_a1'), -1$$,
  'negatief budget wordt geweigerd');

select tests.throws(
  $$update public.projects set organization_id = (select id from tests.ids where key = 'org_b')$$,
  'A kan een project niet naar organisatie B verplaatsen');

update public.projects set status = 'in_progress';
update public.customers set is_archived = true where customer_number = 'K-00002';

select tests.ok(
  (select archived_at is not null from public.customers where customer_number = 'K-00002'),
  'archiveren zet archived_at');

select tests.throws($$delete from public.customers$$, 'klanten kunnen niet worden verwijderd (alleen archiveren)');

select tests.ok(
  (select count(*) from public.activity_log where action = 'status_changed') = 1
  and (select count(*) from public.activity_log where action = 'archived') = 1,
  'activiteiten worden gelogd');

select tests.throws(
  $$insert into public.activity_log (organization_id, entity_type, action, summary)
    select id, 'customer', 'created', 'nep' from tests.ids where key = 'org_a'$$,
  'activiteitenlog kan niet door clients worden beschreven');

-- ---------------------------------------------------------------------------
-- Rollen: kijker mag lezen maar niet schrijven
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');

select tests.ok((select count(*) from public.customers) = 2, 'kijker ziet klanten van de eigen organisatie');
select tests.ok((select count(*) from public.profiles) = 2, 'kijker ziet profielen van collega''s');

select tests.throws(
  $$insert into public.customers (organization_id, name) select id, 'Niet toegestaan' from tests.ids where key = 'org_a'$$,
  'kijker kan geen klant aanmaken');

select tests.ok(
  tests.affected($$update public.projects set name = 'Gewijzigd door kijker'$$) = 0,
  'kijker kan projecten niet wijzigen');

select tests.throws(
  $$update public.organization_members set role = 'owner'
    where user_id = '00000000-0000-0000-0000-00000000000c'$$,
  'leden kunnen rollen niet rechtstreeks wijzigen');
select tests.ok(
  (select role from public.organization_members where user_id = '00000000-0000-0000-0000-00000000000c') = 'viewer',
  'kijker kan de eigen rol niet verhogen');

-- ---------------------------------------------------------------------------
-- Opslag (documenten)
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');

insert into storage.objects (bucket_id, name)
select 'documents', id::text || '/projecten/tekening.pdf' from tests.ids where key = 'org_a';
select tests.ok((select count(*) from storage.objects) = 1, 'A kan uploaden in de eigen organisatiemap');

select tests.throws(
  $$insert into storage.objects (bucket_id, name)
    select 'documents', id::text || '/inbraak.pdf' from tests.ids where key = 'org_b'$$,
  'A kan niet uploaden in de map van organisatie B');

select tests.throws(
  $$insert into storage.objects (bucket_id, name) values ('documents', 'geen-uuid/bestand.pdf')$$,
  'upload buiten een organisatiemap wordt geweigerd');

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*) from storage.objects) = 0, 'B ziet geen documenten van A');

-- ---------------------------------------------------------------------------
-- Anonieme gebruikers
-- ---------------------------------------------------------------------------
reset role;
select tests.login(null);
set role anon;
select tests.throws($$select * from public.customers$$, 'anoniem: geen toegang tot klanten');
select tests.throws($$select * from public.projects$$, 'anoniem: geen toegang tot projecten');
select tests.throws($$select public.create_organization('Anoniem BV')$$, 'anoniem: kan geen organisatie aanmaken');
reset role;
