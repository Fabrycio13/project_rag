-- Apply manually AFTER 004, BEFORE exercising the versioned extraction flow.
-- Only the server holding the secret may submit evidence/hash outcomes. JWT reads remain RLS scoped.
begin;
-- Retire EVERY legacy overload, including installations with older failure writers.
-- No CASCADE: unexpected dependencies must stop deployment rather than silently remove protection.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname in ('claim_document_extraction','claim_document_extraction_run','finish_document_extraction') or p.proname ~ '^mark_document_extraction.*fail')
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature); end loop;
end $$;
-- Exact known signatures are removed so PostgREST exposes one actor-required version, without defaults.
drop function public.claim_document_extraction_run(uuid,uuid,boolean,text);
drop function public.finish_document_extraction(uuid,uuid,uuid,text,jsonb,text,text,text);
revoke insert,update,delete on public.agent_document_extractions,public.agent_document_extraction_runs from public,anon,authenticated;
create function public.claim_document_extraction_run(doc uuid, token uuid, reprocess boolean, extractor_hash text, actor text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents; prior public.agent_document_extractions; run_id uuid;
begin
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not exists(select 1 from public.organizations o join public.agents a on a.organization_id=o.id join public.platform_users p on p.clerk_user_id=actor where o.id=d.organization_id and a.id=d.agent_id and o.archived_at is null and o.owner_clerk_user_id=actor and p.status='active' and p.role in ('owner','admin')) then return null; end if;
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
create function public.finish_document_extraction(doc uuid, run uuid, token uuid, outcome text, payload jsonb, extractor_version text, source_hash text, error_code text, actor text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents; r public.agent_document_extraction_runs; n integer; o integer;
begin
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not exists(select 1 from public.organizations o join public.agents a on a.organization_id=o.id join public.platform_users p on p.clerk_user_id=actor where o.id=d.organization_id and a.id=d.agent_id and o.archived_at is null and o.owner_clerk_user_id=actor and p.status='active' and p.role in ('owner','admin')) then return false; end if;
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
revoke all on function public.claim_document_extraction_run(uuid,uuid,boolean,text,text) from public,anon,authenticated;
revoke all on function public.finish_document_extraction(uuid,uuid,uuid,text,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_document_extraction_run(uuid,uuid,boolean,text,text) to service_role;
grant execute on function public.finish_document_extraction(uuid,uuid,uuid,text,jsonb,text,text,text,text) to service_role;
-- Service-role readback in application still uses the JWT client; these grants support server-only SQL regression inspection.
grant select on public.agent_document_extractions,public.agent_document_extraction_runs to service_role;
notify pgrst, 'reload schema';
commit;
