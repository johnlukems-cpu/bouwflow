-- =============================================================================
-- Tests: geïntegreerde workflows A–F, financiële berekeningen, bescherming
-- tegen dubbele boekingen en organisatiescheiding voor alle modules.
-- Bouwt voort op de gebruikers/organisaties uit 10_rls_tenancy.sql.
-- =============================================================================
reset role;
create table tests.tokens (key text primary key, val text);
grant select on tests.tokens to anon, authenticated;

-- Hulpfunctie: waarde opslaan (als superuser)
create function tests.put(k text, v uuid) returns void language sql security definer as $$
  insert into tests.ids values (k, v) on conflict (key) do update set id = excluded.id;
$$;
create function tests.put_token(k text, v text) returns void language sql security definer as $$
  insert into tests.tokens values (k, v) on conflict (key) do update set val = excluded.val;
$$;
create function tests.id(k text) returns uuid language sql stable as $$ select id from tests.ids where key = k $$;
create function tests.token(k text) returns text language sql stable as $$ select val from tests.tokens where key = k $$;
grant execute on all functions in schema tests to anon, authenticated;

-- Project van organisatie A uit test 10
select tests.put('p1', (select id from public.projects where project_number like 'P-%-0001'
                        and organization_id = tests.id('org_a')));

-- =============================================================================
-- Inrichting door eigenaar A
-- =============================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;

-- Testtarief (geen bewering over werkelijke Surinaamse tarieven)
insert into public.tax_rates (organization_id, name, rate_percent, is_default)
values (tests.id('org_a'), 'Testtarief 10%', 10, true);
select tests.put('tax10', (select id from public.tax_rates where name = 'Testtarief 10%'));

insert into public.suppliers (organization_id, name, supplier_type) values (tests.id('org_a'), 'Bouwmaterialen Groothandel', 'supplier');
select tests.put('s1', (select id from public.suppliers limit 1));
select tests.ok((select supplier_number from public.suppliers) = 'L-00001', 'leveranciersnummer wordt toegekend');

insert into public.employees (organization_id, full_name, job_title, hourly_cost, hourly_rate)
values (tests.id('org_a'), 'Piet Timmerman', 'Timmerman', 50, 85);
select tests.put('e1', (select id from public.employees where full_name = 'Piet Timmerman'));

insert into public.materials (organization_id, article_number, description, category, unit, cost_price, sale_price, track_stock)
values (tests.id('org_a'), 'KAB-3X2.5', 'Installatiekabel 3x2,5 mm²', 'Kabels', 'm', 10, 14, true),
       (tests.id('org_a'), 'BEV-PLUG', 'Pluggen en schroeven', 'Bouwmaterialen', 'st', 3, 4.5, false);
select tests.put('m1', (select id from public.materials where article_number = 'KAB-3X2.5'));
select tests.put('m2', (select id from public.materials where article_number = 'BEV-PLUG'));

update public.materials set cost_price = 10.25 where id = tests.id('m1');
update public.materials set cost_price = 10 where id = tests.id('m1');
select tests.ok((select count(*) from public.material_price_history where material_id = tests.id('m1')) = 3,
  'prijswijzigingen worden historisch bewaard');

-- =============================================================================
-- Workflow A/B: calculatie → offerte → goedkeuring → facturen
-- =============================================================================
insert into public.project_estimate_lines (organization_id, project_id, cost_type, description, unit, quantity, unit_cost, unit_price, waste_percent, sort_order) values
  (tests.id('org_a'), tests.id('p1'), 'material', 'Installatiekabel 3x2,5 mm²', 'm', 100, 12.50, 16.25, 10, 1),
  (tests.id('org_a'), tests.id('p1'), 'labor', 'Montage', 'uur', 40, 75, 95, 0, 2),
  (tests.id('org_a'), tests.id('p1'), 'transport', 'Transport', 'post', 1, 500, 600, 0, 3);

select tests.ok((select cost_total from public.project_estimate_lines where cost_type = 'material') = 1375.00
            and (select sale_total from public.project_estimate_lines where cost_type = 'material') = 1787.50,
  'calculatie: materiaal met 10% snijverlies (110 m) correct berekend');
select tests.ok((select sum(cost_total) from public.project_estimate_lines) = 4875.00
            and (select sum(sale_total) from public.project_estimate_lines) = 6187.50,
  'calculatie: totalen kosten 4875,00 en verkoop 6187,50');

-- Concept-offerte voor dezelfde klant (mag NIET in het portaal verschijnen)
insert into public.quotes (organization_id, customer_id, title) values (tests.id('org_a'), tests.id('cust_a1'), 'Conceptofferte');

select tests.put('q1', public.create_quote_from_estimate(tests.id('p1'), 'type', 'Elektra nieuwbouw kantoor'));
select tests.ok((select subtotal from public.quotes where id = tests.id('q1')) = 6187.50
            and (select tax_total from public.quotes where id = tests.id('q1')) = 618.75
            and (select total from public.quotes where id = tests.id('q1')) = 6806.25,
  'offerte uit calculatie: subtotaal 6187,50, belasting 618,75, totaal 6806,25');
select tests.ok((select quote_number from public.quotes where id = tests.id('q1')) ~ '^OFF-\d{4}-\d{4}$', 'offertenummer OFF-JAAR-NNNN');
select tests.ok((select valid_until - quote_date from public.quotes where id = tests.id('q1')) = 30, 'geldigheid uit instellingen (30 dagen)');

-- Manipulatie: totalen of status rechtstreeks zetten
select tests.throws($$update public.quotes set total = 1 where id = tests.id('q1')$$, 'totalen kunnen niet handmatig worden gezet');
select tests.throws($$update public.quotes set status = 'accepted' where id = tests.id('q1')$$, 'status kan niet buiten de workflow om worden gezet');
insert into public.quotes (organization_id, customer_id, title, status, total) values (tests.id('org_a'), tests.id('cust_a1'), 'Nep', 'accepted', 999);
select tests.ok((select status = 'draft' and total = 0 from public.quotes where title = 'Nep'), 'nieuw document is altijd concept zonder bedragen');

select public.send_quote(tests.id('q1'));
select tests.ok((select status = 'sent' and snapshot is not null from public.quotes where id = tests.id('q1')), 'verzonden offerte heeft momentopname');
select tests.ok((select snapshot -> 'customer' ->> 'name' from public.quotes where id = tests.id('q1')) = 'Bouwmaatschappij Paramaribo N.V.',
  'momentopname bevat klantgegevens');
select tests.throws($$update public.quote_lines set unit_price = 1 where quote_id = tests.id('q1')$$, 'regels van verzonden offerte zijn vergrendeld');
select tests.throws($$update public.quotes set title = 'Gewijzigd' where id = tests.id('q1')$$, 'verzonden offerte is vergrendeld');

-- Wijziging klantgegevens verandert de historische offerte niet
update public.customers set name = 'Nieuwe Naam N.V.' where id = tests.id('cust_a1');
select tests.ok((select snapshot -> 'customer' ->> 'name' from public.quotes where id = tests.id('q1')) = 'Bouwmaatschappij Paramaribo N.V.',
  'latere wijziging van klant verandert definitief document niet');
update public.customers set name = 'Bouwmaatschappij Paramaribo N.V.' where id = tests.id('cust_a1');

select public.respond_quote(tests.id('q1'), true, 'M. Pengel');
select tests.ok((select status from public.quotes where id = tests.id('q1')) = 'accepted', 'offerte geaccepteerd');
select tests.ok((select contract_value from public.projects where id = tests.id('p1')) = 6187.50,
  'goedkeuring zet verkoopwaarde van het project (opdracht)');

-- Voorschotfactuur 30%
select tests.put('inv_adv', public.create_invoice_from_quote(tests.id('q1'), 'advance', 30));
select tests.ok((select subtotal from public.invoices where id = tests.id('inv_adv')) = 1856.25
            and (select tax_total from public.invoices where id = tests.id('inv_adv')) = 185.63
            and (select total from public.invoices where id = tests.id('inv_adv')) = 2041.88,
  'voorschot 30%: 1856,25 + 185,63 (half-up) = 2041,88');
select tests.ok((select invoice_number is null from public.invoices where id = tests.id('inv_adv')), 'conceptfactuur heeft nog geen nummer');
select tests.throws($$insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key)
  values (tests.id('org_a'), tests.id('inv_adv'), 10, current_date, 'pay-concept-1')$$, 'geen betaling op conceptfactuur');

select public.finalize_invoice(tests.id('inv_adv'));
select tests.ok((select invoice_number from public.invoices where id = tests.id('inv_adv')) ~ '^FAC-\d{4}-0001$', 'factuurnummer bij definitief maken');
select tests.ok((select due_date - invoice_date from public.invoices where id = tests.id('inv_adv')) = 30, 'vervaldatum volgens betalingstermijn');
select tests.throws($$update public.invoice_lines set unit_price = 1 where invoice_id = tests.id('inv_adv')$$, 'definitieve factuurregels vergrendeld');
select tests.throws($$update public.invoices set status = 'cancelled' where id = tests.id('inv_adv')$$, 'definitieve factuur kan niet worden geannuleerd');

-- Betalingen: deelbetaling, idempotentie, overbetaling
insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key, reference)
values (tests.id('org_a'), tests.id('inv_adv'), 1000, current_date, 'pay-adv-0001', 'Bank 1');
select tests.ok((select payment_status from public.invoice_balances where invoice_id = tests.id('inv_adv')) = 'partially_paid'
            and (select outstanding from public.invoice_balances where invoice_id = tests.id('inv_adv')) = 1041.88,
  'deelbetaling: openstaand 1041,88');
select tests.throws($$insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key)
  values (tests.id('org_a'), tests.id('inv_adv'), 1000, current_date, 'pay-adv-0001')$$, 'dubbele betaling (zelfde sleutel) wordt geweigerd');
select tests.throws($$insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key)
  values (tests.id('org_a'), tests.id('inv_adv'), 1041.89, current_date, 'pay-adv-0002')$$, 'overbetaling wordt geweigerd');
insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key)
values (tests.id('org_a'), tests.id('inv_adv'), 1041.88, current_date, 'pay-adv-0003');
select tests.ok((select payment_status from public.invoice_balances where invoice_id = tests.id('inv_adv')) = 'paid', 'factuur volledig betaald');
select tests.throws($$update public.payments set amount = 1$$, 'betalingen zijn onwijzigbaar');
select tests.throws($$delete from public.payments$$, 'betalingen kunnen niet worden verwijderd');

-- Eindfactuur: alle offerteregels minus voorschot
select tests.put('inv_final', public.create_invoice_from_quote(tests.id('q1'), 'final', null));
select tests.ok((select subtotal from public.invoices where id = tests.id('inv_final')) = 4331.25
            and (select total from public.invoices where id = tests.id('inv_final')) = 4764.38,
  'eindfactuur: 6187,50 − 1856,25 = 4331,25 excl.; 4764,38 incl.');
select public.finalize_invoice(tests.id('inv_final'));
select tests.ok((select invoice_number from public.invoices where id = tests.id('inv_final')) ~ '^FAC-\d{4}-0002$', 'doorlopende factuurnummering');

-- Creditnota
select tests.put('cn1', public.create_credit_note(tests.id('inv_final'), false));
insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit_price, tax_rate_id)
values (tests.id('org_a'), tests.id('cn1'), 'Korting opleverpunt', -1, 100, tests.id('tax10'));
select public.finalize_invoice(tests.id('cn1'));
select tests.ok((select invoice_number from public.invoices where id = tests.id('cn1')) ~ '^CR-\d{4}-0001$', 'creditnota met eigen nummerreeks');
select tests.ok((select outstanding from public.invoice_balances where invoice_id = tests.id('inv_final')) = 4654.38,
  'creditnota verlaagt het openstaande bedrag (4764,38 − 110,00)');
select tests.put('cn2', public.create_credit_note(tests.id('inv_final'), false));
insert into public.invoice_lines (organization_id, invoice_id, description, quantity, unit_price, tax_rate_id)
values (tests.id('org_a'), tests.id('cn2'), 'Te hoog', -1, 5000, tests.id('tax10'));
select tests.throws($$select public.finalize_invoice(tests.id('cn2'))$$, 'meer crediteren dan gefactureerd wordt geweigerd');

-- =============================================================================
-- Workflow E: inkoop → ontvangst → voorraad → projectkosten
-- =============================================================================
insert into public.purchase_orders (organization_id, supplier_id, project_id) values (tests.id('org_a'), tests.id('s1'), tests.id('p1'));
select tests.put('po1', (select id from public.purchase_orders limit 1));
select tests.ok((select purchase_order_number from public.purchase_orders) ~ '^IO-\d{4}-0001$', 'inkoopordernummer');
insert into public.purchase_order_lines (organization_id, purchase_order_id, material_id, description, unit, quantity, unit_cost, destination)
values (tests.id('org_a'), tests.id('po1'), tests.id('m1'), 'Installatiekabel', 'm', 50, 9.5, 'stock');
insert into public.purchase_order_lines (organization_id, purchase_order_id, description, unit, quantity, unit_cost, destination, cost_type)
values (tests.id('org_a'), tests.id('po1'), 'Huur steiger', 'week', 1, 750, 'project', 'equipment');
select tests.put('pol1', (select id from public.purchase_order_lines where destination = 'stock'));
select tests.put('pol2', (select id from public.purchase_order_lines where destination = 'project'));
select tests.throws($$select public.receive_purchase_line(tests.id('pol1'), 10, current_date, 'rcpt-draft-01')$$, 'concept-inkooporder kan niet worden ontvangen');
update public.purchase_orders set status = 'ordered' where id = tests.id('po1');
select tests.throws($$update public.purchase_order_lines set quantity = 99 where id = tests.id('pol1')$$, 'bestelde orderregels zijn vergrendeld');

select tests.put('r1', public.receive_purchase_line(tests.id('pol1'), 30, current_date, 'rcpt-0000001'));
select tests.ok(public.receive_purchase_line(tests.id('pol1'), 30, current_date, 'rcpt-0000001') = tests.id('r1'),
  'herhaalde ontvangst met dezelfde sleutel wordt niet dubbel geboekt');
select tests.ok((select on_hand from public.material_stock where material_id = tests.id('m1')) = 30, 'voorraad na ontvangst: 30');
select tests.throws($$select public.receive_purchase_line(tests.id('pol1'), 25, current_date, 'rcpt-0000002')$$, 'meer ontvangen dan besteld wordt geweigerd');
select public.receive_purchase_line(tests.id('pol2'), 1, current_date, 'rcpt-0000003');
select tests.ok((select status from public.purchase_orders where id = tests.id('po1')) = 'partially_received', 'status deels ontvangen');
select tests.ok((select amount from public.project_cost_entries where cost_type = 'equipment') = 750.00, 'directe projectlevering boekt machinekosten');

-- =============================================================================
-- Workflow C: uren, werkbonnen, materiaalverbruik → werkelijke kosten
-- =============================================================================
insert into public.time_entries (organization_id, project_id, employee_id, entry_date, start_time, end_time, description)
values (tests.id('org_a'), tests.id('p1'), tests.id('e1'), '2026-11-02', '08:00', '12:00', 'Leidingwerk');
select tests.put('t1', (select id from public.time_entries limit 1));
select tests.ok((select hours from public.time_entries where id = tests.id('t1')) = 4.00, 'uren berekend uit begin- en eindtijd');
select tests.throws($$insert into public.time_entries (organization_id, project_id, employee_id, entry_date, start_time, end_time)
  values (tests.id('org_a'), tests.id('p1'), tests.id('e1'), '2026-11-02', '11:00', '13:00')$$, 'overlappende uren worden geweigerd');
select tests.throws($$update public.time_entries set status = 'approved' where id = tests.id('t1')$$, 'uren kunnen niet buiten de goedkeuring om worden goedgekeurd');
select public.approve_time_entry(tests.id('t1'));
select public.approve_time_entry(tests.id('t1'));
select tests.ok((select count(*) from public.project_cost_entries where source_type = 'time_entry') = 1
            and (select amount from public.project_cost_entries where source_type = 'time_entry') = 200.00,
  'goedgekeurde uren: één kostenregel van 4 × 50,00 (ook bij dubbele goedkeuring)');
select tests.throws($$update public.time_entries set hours = 8 where id = tests.id('t1')$$, 'goedgekeurde uren zijn vergrendeld');

insert into public.work_orders (organization_id, project_id, employee_id, work_date, start_time, end_time, break_minutes, work_description)
values (tests.id('org_a'), tests.id('p1'), tests.id('e1'), '2026-11-03', '07:30', '16:00', 30, 'Kabels getrokken en aangesloten');
select tests.put('wo1', (select id from public.work_orders limit 1));
select tests.ok((select hours from public.work_orders where id = tests.id('wo1')) = 8.00, 'werkbon: 8,5 uur − 30 min pauze = 8,00 uur');
select tests.ok((select work_order_number from public.work_orders where id = tests.id('wo1')) ~ '^WB-\d{4}-0001$', 'werkbonnummer');
insert into public.work_order_materials (organization_id, work_order_id, material_id, description, unit, quantity)
values (tests.id('org_a'), tests.id('wo1'), tests.id('m1'), 'Installatiekabel', 'm', 5),
       (tests.id('org_a'), tests.id('wo1'), tests.id('m2'), 'Pluggen en schroeven', 'st', 10);
select public.approve_work_order(tests.id('wo1'));
select public.approve_work_order(tests.id('wo1'));
select tests.ok((select count(*) from public.time_entries where work_order_id = tests.id('wo1')) = 1, 'werkbon levert precies één urenregel');
select tests.ok((select amount from public.project_cost_entries where source_type = 'time_entry'
                 and source_id = (select id from public.time_entries where work_order_id = tests.id('wo1'))) = 400.00,
  'werkbon: arbeidskosten 8 × 50,00 = 400,00');
select tests.ok((select on_hand from public.material_stock where material_id = tests.id('m1')) = 25, 'werkbon: voorraad afgeboekt (30 − 5)');
select tests.ok((select sum(amount) from public.project_cost_entries where cost_type = 'material') = 80.00,
  'werkbon: materiaalkosten 5 × 10,00 + 10 × 3,00 = 80,00 (geen dubbele telling)');
select tests.throws($$update public.work_orders set notes = 'achteraf' where id = tests.id('wo1')$$, 'goedgekeurde werkbon is vergrendeld');
select tests.throws($$insert into public.stock_movements (organization_id, material_id, movement_type, quantity, project_id)
  values (tests.id('org_a'), tests.id('m1'), 'issue', 100, tests.id('p1'))$$, 'uitgifte boven voorraad wordt geweigerd');
select tests.throws($$insert into public.project_cost_entries (organization_id, project_id, cost_type, description, amount, source_type, source_id)
  values (tests.id('org_a'), tests.id('p1'), 'labor', 'nep', 1, 'time_entry', gen_random_uuid())$$, 'clients kunnen geen workflow-kostenregels vervalsen');
insert into public.project_cost_entries (organization_id, project_id, cost_type, description, amount)
values (tests.id('org_a'), tests.id('p1'), 'transport', 'Extra transport', 120);
select tests.throws($$update public.project_cost_entries set amount = 0$$, 'kostenregister is onwijzigbaar');

-- =============================================================================
-- Workflow D/F: na-calculatie en omzetbegrippen
-- =============================================================================
select tests.ok((select budget_cost_total from public.project_financials where project_id = tests.id('p1')) = 4875.00, 'begrote kosten 4875,00');
select tests.ok((select actual_labor from public.project_financials where project_id = tests.id('p1')) = 600.00
            and (select actual_material from public.project_financials where project_id = tests.id('p1')) = 80.00
            and (select actual_equipment from public.project_financials where project_id = tests.id('p1')) = 750.00
            and (select actual_transport from public.project_financials where project_id = tests.id('p1')) = 120.00
            and (select actual_cost_total from public.project_financials where project_id = tests.id('p1')) = 1550.00,
  'werkelijke kosten per soort en totaal 1550,00');
select tests.ok((select actual_labor_hours from public.project_financials where project_id = tests.id('p1')) = 12.00
            and (select budget_labor_hours from public.project_financials where project_id = tests.id('p1')) = 40.00,
  'uren begroot 40 vs werkelijk 12');
select tests.ok((select invoiced_excl_tax from public.project_financials where project_id = tests.id('p1')) = 6087.50,
  'gefactureerd excl. belasting: 1856,25 + 4331,25 − 100,00 = 6087,50');
select tests.ok((select received_incl_tax from public.project_financials where project_id = tests.id('p1')) = 2041.88
            and (select received_excl_tax from public.project_financials where project_id = tests.id('p1')) = 1856.25,
  'ontvangen: 2041,88 incl. = 1856,25 excl. (apart van gefactureerd)');

-- =============================================================================
-- Organisatiescheiding voor alle nieuwe modules
-- =============================================================================
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*) from public.quotes) = 0 and (select count(*) from public.invoices) = 0
            and (select count(*) from public.payments) = 0 and (select count(*) from public.project_cost_entries) = 0
            and (select count(*) from public.stock_movements) = 0 and (select count(*) from public.materials) = 0
            and (select count(*) from public.employees) = 0 and (select count(*) from public.work_orders) = 0
            and (select count(*) from public.time_entries) = 0 and (select count(*) from public.purchase_orders) = 0
            and (select count(*) from public.project_estimate_lines) = 0 and (select count(*) from public.suppliers) = 0
            and (select count(*) from public.invoice_balances) = 0 and (select count(*) from public.project_financials) = 0
            and (select count(*) from public.audit_log where organization_id = tests.id('org_a')) = 0 and (select count(*) from public.material_stock) = 0,
  'B ziet niets van de modules van A (incl. views)');
select tests.throws($$select public.approve_work_order(tests.id('wo1'))$$, 'B kan geen werkbon van A goedkeuren');
select tests.throws($$select public.create_invoice_from_quote(tests.id('q1'), 'standard', null)$$, 'B kan geen factuur maken uit offerte van A');
select tests.throws($$select public.finalize_invoice(tests.id('cn2'))$$, 'B kan geen factuur van A definitief maken');
select tests.throws($$insert into public.payments (organization_id, invoice_id, amount, paid_on, idempotency_key)
  values (tests.id('org_b'), tests.id('inv_final'), 1, current_date, 'pay-b-00001')$$, 'B kan geen betaling op factuur van A boeken');
select tests.throws($$insert into public.project_cost_entries (organization_id, project_id, cost_type, description, amount)
  values (tests.id('org_a'), tests.id('p1'), 'other', 'inbraak', 1)$$, 'B kan geen kosten op project van A boeken');
select tests.throws($$select public.receive_purchase_line(tests.id('pol1'), 1, current_date, 'rcpt-b-0001')$$, 'B kan geen ontvangst bij A boeken');
select tests.throws($$select public.create_portal_link(tests.id('cust_a1'))$$, 'B kan geen portaallink voor klant van A maken');

-- =============================================================================
-- Rollen: medewerker registreert eigen uren, keurt niets goed; kijker leest
-- =============================================================================
reset role;
update public.organization_members set role = 'employee'
 where user_id = '00000000-0000-0000-0000-00000000000c' and organization_id = tests.id('org_a');
insert into public.employees (organization_id, full_name, hourly_cost, member_id)
select tests.id('org_a'), 'Chris Monteur', 40, id from public.organization_members
 where user_id = '00000000-0000-0000-0000-00000000000c' and organization_id = tests.id('org_a');
select tests.put('e2', (select id from public.employees where full_name = 'Chris Monteur'));
select tests.login('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into public.time_entries (organization_id, project_id, employee_id, entry_date, hours, description)
values (tests.id('org_a'), tests.id('p1'), tests.id('e2'), '2026-11-04', 6, 'Eigen uren');
select tests.ok((select count(*) from public.time_entries where employee_id = tests.id('e2')) = 1, 'medewerker registreert eigen uren');
select tests.throws($$insert into public.time_entries (organization_id, project_id, employee_id, entry_date, hours)
  values (tests.id('org_a'), tests.id('p1'), tests.id('e1'), '2026-11-04', 6)$$, 'medewerker kan geen uren voor een collega registreren');
select tests.throws($$select public.approve_time_entry((select id from public.time_entries where employee_id = tests.id('e2')))$$,
  'medewerker kan eigen uren niet goedkeuren');
insert into public.work_orders (organization_id, project_id, employee_id, start_time, end_time, work_description)
values (tests.id('org_a'), tests.id('p1'), tests.id('e2'), '08:00', '10:00', 'Storing verholpen');
select tests.ok((select count(*) from public.work_orders where employee_id = tests.id('e2')) = 1, 'medewerker maakt eigen werkbon (mobiel)');
select tests.throws($$insert into public.invoices (organization_id, customer_id, title) values (tests.id('org_a'), tests.id('cust_a1'), 'x')$$,
  'medewerker kan geen facturen maken');
select tests.ok((select count(*) from public.audit_log where organization_id = tests.id('org_a')) = 0, 'medewerker ziet de audit trail niet');

-- =============================================================================
-- Klantportaal
-- =============================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.put_token('portal', public.create_portal_link(tests.id('cust_a1')));
reset role;
select tests.login(null);
set role anon;
select tests.ok((public.portal_overview(tests.token('portal')) -> 'customer' ->> 'name') = 'Bouwmaatschappij Paramaribo N.V.', 'portaal: klant ziet eigen gegevens');
select tests.ok(jsonb_array_length(public.portal_overview(tests.token('portal')) -> 'quotes') = 1, 'portaal: concepten zijn niet zichtbaar');
select tests.ok(jsonb_array_length(public.portal_overview(tests.token('portal')) -> 'invoices') = 3, 'portaal: alleen definitieve facturen');
select tests.throws($$select public.portal_overview(repeat('a', 64))$$, 'portaal: onbekende link geweigerd');
select tests.throws($$select public.portal_overview('../../etc')$$, 'portaal: ongeldig token geweigerd');
select tests.throws($$select * from public.quotes$$, 'portaal: anoniem geen directe tabeltoegang');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.revoke_portal_link((select id from public.customer_portal_links limit 1));
reset role;
set role anon;
select tests.throws($$select public.portal_overview(tests.token('portal'))$$, 'portaal: ingetrokken link werkt niet meer');
reset role;

-- =============================================================================
-- SaaS: uitnodigingen, gebruikerslimiet, laatste eigenaar, abonnementen, platform
-- =============================================================================
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'd@test.sr');
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.put_token('inv_d', public.create_invitation(tests.id('org_a'), 'D@Test.sr', 'manager'));
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.throws($$select public.accept_invitation(tests.token('inv_d'))$$, 'uitnodiging werkt niet voor een ander e-mailadres');
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.ok(public.accept_invitation(tests.token('inv_d')) = tests.id('org_a'), 'uitnodiging geaccepteerd door juiste gebruiker');
select tests.ok((select role from public.organization_members where user_id = '00000000-0000-0000-0000-00000000000d') = 'manager', 'rol uit uitnodiging');
select tests.throws($$select public.accept_invitation(tests.token('inv_d'))$$, 'uitnodiging is eenmalig');
select tests.throws($$select public.create_invitation(tests.id('org_a'), 'x@test.sr', 'viewer')$$, 'projectleider kan niemand uitnodigen');

reset role;
update public.organization_subscriptions set max_users_override = 3 where organization_id = tests.id('org_a');
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.throws($$select public.create_invitation(tests.id('org_a'), 'e@test.sr', 'viewer')$$, 'gebruikerslimiet van abonnement wordt afgedwongen');
select tests.throws($$select public.update_member((select id from public.organization_members where user_id = auth.uid() and organization_id = tests.id('org_a')), 'admin', true)$$,
  'laatste eigenaar kan niet worden gedegradeerd');

reset role;
update public.organization_subscriptions set status = 'trialing', trial_ends_at = now() - interval '1 day' where organization_id = tests.id('org_b');
select tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select tests.throws($$insert into public.customers (organization_id, name) values (tests.id('org_b'), 'Na proef')$$, 'verlopen proefperiode: schrijven geblokkeerd');
select tests.ok((select count(*) from public.organizations) = 1, 'verlopen proefperiode: lezen blijft mogelijk');
select tests.throws($$select * from public.platform_list_organizations()$$, 'gewone gebruiker heeft geen platformbeheer');
reset role;
update public.organization_subscriptions set status = 'active', trial_ends_at = null where organization_id = tests.id('org_b');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select tests.ok((select count(*) from public.platform_list_organizations()) = 2, 'platformbeheerder ziet alle organisaties');
select tests.ok((select count(*) from public.customers) = 0, 'platformbeheerder ziet GEEN bedrijfsgegevens van andere organisaties');
select tests.ok(not public.org_has_module(tests.id('org_b'), 'onbekend') and public.org_has_module(tests.id('org_b'), 'klanten'), 'moduletoegang volgens abonnement');

-- Audit trail
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*) from public.audit_log where table_name = 'invoices') > 0
            and (select count(*) from public.audit_log where table_name = 'payments') = 2,
  'audit trail registreert financiële mutaties');
reset role;
