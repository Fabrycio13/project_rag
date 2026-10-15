-- Fix private upload finalization after migrations 001-005; apply separately.
-- BEFORE triggers cannot read NEW stored generated columns: storage_path has
-- not been computed yet. Derive the prospective key from its base columns.
-- No data rewrite, grants, RLS changes or service-role bypass.
begin;
create or replace function public.check_document_storage_state() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if old.upload_state <> 'pending' or new.upload_state not in ('stored','failed') then
  raise exception 'Invalid upload transition';
 end if;
 if new.upload_state = 'stored' and not exists (
  select 1 from storage.objects o where o.bucket_id='agent-documents'
   and o.name = new.organization_id::text || '/' || new.agent_id::text || '/' || new.id::text || '.pdf'
   and (o.metadata->>'size')::bigint = new.size_bytes
   and o.metadata->>'mimetype' = 'application/pdf'
 ) then raise exception 'Stored object missing or metadata mismatch'; end if;
 return new;
end;
$$;
revoke all on function public.check_document_storage_state() from public;
commit;
