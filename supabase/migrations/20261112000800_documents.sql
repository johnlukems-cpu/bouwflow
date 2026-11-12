-- =============================================================================
-- BouwFlow — Documentbeheer (metadata; bestanden staan in Supabase Storage,
-- bucket 'documents', pad <organization_id>/<...>, beveiligd met RLS).
-- =============================================================================

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid,
  customer_id     uuid,
  work_order_id   uuid,
  name            text not null check (char_length(btrim(name)) between 1 and 255),
  category        text not null default 'overig' check (category in ('tekening', 'vergunning', 'foto', 'contract', 'offerte', 'factuur', 'werkbon', 'overig')),
  storage_path    text not null unique,
  mime_type       text not null check (char_length(mime_type) <= 100),
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by     uuid default auth.uid(),
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Het opslagpad MOET in de map van de eigen organisatie liggen
  check (storage_path like (organization_id::text || '/%')),
  check (storage_path !~ '\.\.'),
  foreign key (project_id, organization_id) references public.projects (id, organization_id),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id),
  foreign key (work_order_id, organization_id) references public.work_orders (id, organization_id)
);
create index documents_project_idx on public.documents (project_id, created_at desc);
create index documents_org_idx on public.documents (organization_id, is_archived, created_at desc);
select public._bf_setup_tenant_table('documents', '{owner,admin,manager,finance}');

-- Medewerkers mogen foto's bij hun eigen werkbonnen toevoegen.
create policy documents_insert_employee on public.documents
  for insert to authenticated
  with check (category = 'foto' and work_order_id is not null
              and public.has_org_role(organization_id, array['employee']::public.org_role[])
              and exists (select 1 from public.work_orders w where w.id = work_order_id
                          and w.employee_id = public.current_employee_id(organization_id)));

create policy documents_employee_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['employee']::public.org_role[])
    and (storage.foldername(name))[2] = 'werkbonnen'
  );
