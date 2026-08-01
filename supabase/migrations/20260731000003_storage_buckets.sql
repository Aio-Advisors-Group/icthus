-- Private storage buckets for Icthus.
--
-- All three are private. Clients never read or write these paths directly with
-- a bare key — an Edge Function issues a short-lived signed URL scoped to the
-- requesting user, and the path convention below is what makes that safe:
--
--     <bucket>/<user_id>/<entry_id>/<asset_id>.<ext>
--
-- The policies check that the first path segment equals auth.uid(), so a
-- signed-in person can never reach another person's objects even if they guess
-- an object name.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('icthus-audio', 'icthus-audio', false, 26214400,
    array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']),
  ('icthus-images', 'icthus-images', false, 10485760,
    array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('icthus-exports', 'icthus-exports', false, 52428800,
    array['application/json', 'application/zip'])
on conflict (id) do nothing;

-- Helper: the owning user id encoded in the object path.
create or replace function public.storage_path_owner(object_name text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

do $$
declare
  bucket text;
  buckets text[] := array['icthus-audio', 'icthus-images', 'icthus-exports'];
begin
  foreach bucket in array buckets loop
    execute format('drop policy if exists %I on storage.objects', bucket || ' owner select');
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and public.storage_path_owner(name) = (select auth.uid()))',
      bucket || ' owner select', bucket);

    execute format('drop policy if exists %I on storage.objects', bucket || ' owner insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and public.storage_path_owner(name) = (select auth.uid()))',
      bucket || ' owner insert', bucket);

    execute format('drop policy if exists %I on storage.objects', bucket || ' owner update');
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and public.storage_path_owner(name) = (select auth.uid()))
         with check (bucket_id = %L and public.storage_path_owner(name) = (select auth.uid()))',
      bucket || ' owner update', bucket, bucket);

    execute format('drop policy if exists %I on storage.objects', bucket || ' owner delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and public.storage_path_owner(name) = (select auth.uid()))',
      bucket || ' owner delete', bucket);
  end loop;
end;
$$;
