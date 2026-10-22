-- =============================================================================
-- BouwFlow — Beveiligde opslag voor documenten
-- =============================================================================
-- Bestanden worden opgeslagen onder het pad: <organization_id>/<...>
-- De bucket is privé; toegang verloopt uitsluitend via RLS op storage.objects
-- (en eventueel kortlevende signed URL's die de server aanmaakt).
-- =============================================================================

-- Veilige UUID-cast: ongeldige paden leveren NULL op (=> geen toegang)
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400) -- 25 MB
on conflict (id) do update set public = false;

create policy documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_org_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_org_role(public.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin', 'manager', 'finance']::public.org_role[])
  );

create policy documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.has_org_role(public.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin', 'manager', 'finance']::public.org_role[])
  )
  with check (
    bucket_id = 'documents'
    and public.has_org_role(public.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin', 'manager', 'finance']::public.org_role[])
  );

create policy documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.has_org_role(public.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.org_role[])
  );
