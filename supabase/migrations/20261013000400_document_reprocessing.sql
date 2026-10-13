-- Apply manually after 003. Request-bound Node extraction, NOT a durable queue.
begin;
create table public.agent_document_extraction_runs (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.agent_documents(id) on delete cascade,
 version integer not null check(version > 0),
 state text not null check(state in ('processing','completed','review_required','failed')),
 claim_token uuid not null unique,
 lease_until timestamptz not null,
 extractor_version text,
 extractor_hash text check(extractor_hash ~ '^[a-f0-9]{64}$'),
 source_hash text check(source_hash ~ '^[a-f0-9]{64}$'),
 pages jsonb,
 page_count integer,
 ocr_page_count integer,
 error_code text check(error_code in ('processing_failed','processing_timeout','processing_busy','invalid_pdf','invalid_or_encrypted_pdf','page_limit','page_dimensions','text_limit','no_useful_text','storage_failed')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(document_id,version),
 check ((state in ('completed','review_required') and pages is not null and jsonb_typeof(pages)='array' and page_count between 1 and 30 and jsonb_array_length(pages)=page_count and ocr_page_count between 0 and page_count and error_code is null)
 or (state in ('processing','failed') and pages is null and page_count is null and ocr_page_count is null)),
 check(pages is null or octet_length(pages::text)<=4000000)
);
alter table public.agent_document_extraction_runs enable row level security;
revoke all on public.agent_document_extraction_runs from public,anon,authenticated;
grant select on public.agent_document_extraction_runs to authenticated;
create policy extraction_history_read on public.agent_document_extraction_runs for select to authenticated
using (exists(select 1 from public.agent_documents d where d.id=document_id and d.upload_state='stored' and public.can_access_agent_documents(d.organization_id,d.agent_id)));
alter table public.agent_document_extractions add column active_run_id uuid references public.agent_document_extraction_runs(id);
-- Preserve every existing extraction verbatim, including unknown legacy provenance.
insert into public.agent_document_extraction_runs(document_id,version,state,claim_token,lease_until,extractor_version,pages,page_count,ocr_page_count,error_code,created_at,finished_at)
select document_id,1,state,claim_token,lease_until,extractor_version,pages,page_count,ocr_page_count,error_code,updated_at,case when state <> 'processing' then updated_at end from public.agent_document_extractions;
update public.agent_document_extractions e set active_run_id=r.id from public.agent_document_extraction_runs r where r.document_id=e.document_id and r.state='completed';
-- No direct mutation or legacy unfenced writer may bypass version history.
revoke insert,update on public.agent_document_extractions from authenticated;
revoke all on function public.claim_document_extraction(uuid,uuid) from authenticated;
create function public.claim_document_extraction_run(doc uuid, token uuid, reprocess boolean, extractor_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents; prior public.agent_document_extractions; run_id uuid;
begin
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not public.can_access_agent_documents(d.organization_id,d.agent_id) then return null; end if;
 if reprocess is null or token is null or extractor_hash is null or extractor_hash !~ '^[a-f0-9]{64}$' then return null; end if;
 if exists(select 1 from public.agent_document_extraction_runs r where r.document_id=doc and r.state='processing' and r.lease_until > clock_timestamp()) then return null; end if;
 select * into prior from public.agent_document_extractions where document_id=doc;
 if prior.state='completed' and not reprocess then return null; end if;
 -- Token retry never resets a terminal run or extends its lease.
 if exists(select 1 from public.agent_document_extraction_runs r where r.claim_token=token) then return null; end if;
 update public.agent_document_extraction_runs set state='failed',error_code='processing_timeout',finished_at=clock_timestamp() where document_id=doc and state='processing';
 insert into public.agent_document_extraction_runs(document_id,version,state,claim_token,lease_until,extractor_hash)
 select doc,coalesce(max(r.version),0)+1,'processing',token,clock_timestamp()+interval '3 minutes',claim_document_extraction_run.extractor_hash from public.agent_document_extraction_runs r where r.document_id=doc returning id into run_id;
 -- Keep a completed snapshot visible while a candidate is processing.
 insert into public.agent_document_extractions(document_id,state,claim_token,lease_until)
 values(doc,'processing',token,clock_timestamp()+interval '3 minutes')
 on conflict(document_id) do update set state='processing',claim_token=token,lease_until=excluded.lease_until,pages=null,page_count=null,ocr_page_count=null,error_code=null,extractor_version=null
 where agent_document_extractions.active_run_id is null;
 return run_id;
end;
$$;
create function public.finish_document_extraction(doc uuid, run uuid, token uuid, outcome text, payload jsonb, extractor_version text, source_hash text, error_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents; r public.agent_document_extraction_runs; n integer; o integer;
begin
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not public.can_access_agent_documents(d.organization_id,d.agent_id) then return false; end if;
 select * into r from public.agent_document_extraction_runs where id=run and document_id=doc and claim_token=token and state='processing' and lease_until > clock_timestamp() for update;
 if not found then return false; end if;
 if outcome not in ('completed','review_required','failed') or outcome is null then return false; end if;
 if outcome in ('completed','review_required') then
  if payload is null or jsonb_typeof(payload)<>'array' or source_hash is null or source_hash !~ '^[a-f0-9]{64}$' or extractor_version is null then return false; end if;
  n:=jsonb_array_length(payload);
  select count(*) into o from jsonb_array_elements(payload) p where p->>'method'='ocr';
 else
  payload:=null; n:=null; o:=null;
  if error_code is null then return false; end if;
 end if;
 update public.agent_document_extraction_runs set state=outcome,pages=payload,page_count=n,ocr_page_count=o,extractor_version=finish_document_extraction.extractor_version,source_hash=finish_document_extraction.source_hash,error_code=case when outcome='failed' then finish_document_extraction.error_code end,finished_at=clock_timestamp() where id=run;
 -- pending review keeps the previous active result; failures do too.
 update public.agent_document_extractions e set state=outcome,pages=payload,page_count=n,ocr_page_count=o,extractor_version=finish_document_extraction.extractor_version,error_code=case when outcome='failed' then finish_document_extraction.error_code end,claim_token=token,lease_until=r.lease_until,updated_at=clock_timestamp(),active_run_id=case when outcome='completed' then run else e.active_run_id end
 where e.document_id=doc and (outcome='completed' or e.active_run_id is null);
 return true;
end;
$$;
revoke all on function public.claim_document_extraction_run(uuid,uuid,boolean,text) from public,anon;
revoke all on function public.finish_document_extraction(uuid,uuid,uuid,text,jsonb,text,text,text) from public,anon;
grant execute on function public.claim_document_extraction_run(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.finish_document_extraction(uuid,uuid,uuid,text,jsonb,text,text,text) to authenticated;
commit;
