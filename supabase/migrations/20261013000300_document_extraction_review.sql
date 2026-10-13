-- Local artifact only: do not apply without the deployment migration gate.
-- Existing completed results are NOT reprocessed or relabeled by this migration.
begin;
alter table public.agent_document_extractions add column extractor_version text;
do $$
declare constraint_name text;
begin
 for constraint_name in select conname from pg_constraint
 where conrelid='public.agent_document_extractions'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%state%'
 loop execute format('alter table public.agent_document_extractions drop constraint %I',constraint_name); end loop;
end $$;
alter table public.agent_document_extractions
 add constraint extraction_state_v2 check(state in ('processing','completed','review_required','failed')),
 add constraint extraction_payload_v2 check (
  (state in ('completed','review_required') and pages is not null and page_count is not null and ocr_page_count is not null and jsonb_typeof(pages)='array' and page_count between 1 and 30 and ocr_page_count between 0 and page_count and error_code is null)
  or (state in ('processing','failed') and pages is null and page_count is null and ocr_page_count is null)
 );
create or replace function public.claim_document_extraction(doc uuid, token uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
 if not exists(select 1 from public.agent_documents d where d.id=doc and d.upload_state='stored' and public.can_access_agent_documents(d.organization_id,d.agent_id)) then return null; end if;
 insert into public.agent_document_extractions(document_id,state,claim_token,lease_until)
 values(doc,'processing',token,now()+interval '3 minutes')
 on conflict(document_id) do update set state='processing',claim_token=token,lease_until=now()+interval '3 minutes',pages=null,page_count=null,ocr_page_count=null,error_code=null,extractor_version=null,updated_at=now()
 where agent_document_extractions.state='failed' or agent_document_extractions.state='review_required' or (agent_document_extractions.state='processing' and agent_document_extractions.lease_until<now())
 returning claim_token into claimed;
 return claimed;
end;
$$;
revoke all on function public.claim_document_extraction(uuid,uuid) from public;
grant execute on function public.claim_document_extraction(uuid,uuid) to authenticated;
commit;
