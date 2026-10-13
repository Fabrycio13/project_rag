-- Explicit bounded local extraction, not a queue. Apply after agent_documents.
begin;
create table public.agent_document_extractions (
 document_id uuid primary key references public.agent_documents(id) on delete cascade,
 state text not null check(state in ('processing','completed','failed')),
 claim_token uuid not null,
 lease_until timestamptz not null,
 pages jsonb,
 page_count integer,
 ocr_page_count integer,
 error_code text check(error_code in ('processing_failed','processing_timeout','processing_busy','invalid_pdf','invalid_or_encrypted_pdf','page_limit','page_dimensions','text_limit','no_useful_text','storage_failed')),
 updated_at timestamptz not null default now(),
 check ((state='completed' and pages is not null and page_count is not null and ocr_page_count is not null and jsonb_typeof(pages)='array' and page_count between 1 and 30 and ocr_page_count between 0 and page_count and error_code is null) or (state<>'completed' and pages is null and page_count is null and ocr_page_count is null)),
 check(pages is null or octet_length(pages::text)<=4000000)
);
alter table public.agent_document_extractions enable row level security;
revoke all on public.agent_document_extractions from public,anon,authenticated;
grant select,insert,update on public.agent_document_extractions to authenticated;
create policy extraction_access on public.agent_document_extractions for all to authenticated
using (exists(select 1 from public.agent_documents d where d.id=document_id and d.upload_state='stored' and public.can_access_agent_documents(d.organization_id,d.agent_id)))
with check (exists(select 1 from public.agent_documents d where d.id=document_id and d.upload_state='stored' and public.can_access_agent_documents(d.organization_id,d.agent_id)));
create function public.claim_document_extraction(doc uuid, token uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
 -- RLS authorizes the source and results. Unique document_id serializes claims.
 if not exists(select 1 from public.agent_documents d where d.id=doc and d.upload_state='stored' and public.can_access_agent_documents(d.organization_id,d.agent_id)) then return null; end if;
 insert into public.agent_document_extractions(document_id,state,claim_token,lease_until)
 values(doc,'processing',token,now()+interval '3 minutes')
 on conflict(document_id) do update set state='processing',claim_token=token,lease_until=now()+interval '3 minutes',pages=null,page_count=null,ocr_page_count=null,error_code=null,updated_at=now()
 where agent_document_extractions.state='failed' or (agent_document_extractions.state='processing' and agent_document_extractions.lease_until<now())
 returning claim_token into claimed;
 return claimed;
end;
$$;
revoke all on function public.claim_document_extraction(uuid,uuid) from public;
grant execute on function public.claim_document_extraction(uuid,uuid) to authenticated;
commit;
