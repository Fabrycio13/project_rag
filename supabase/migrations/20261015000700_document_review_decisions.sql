-- MANUAL ONLY, after document migrations 001-006 (005 is mandatory service authority).
-- No approval/backfill of decisions, no indexing/provider side effects.
begin;
alter table public.agent_document_extraction_runs add column extraction_hash text;
create function public.hash_document_extraction() returns trigger language plpgsql set search_path='' as $$
begin
 new.extraction_hash:=case when new.pages is not null then encode(sha256(convert_to(new.pages::text,'UTF8')),'hex') end;
 return new;
end;$$;
revoke all on function public.hash_document_extraction() from public,anon,authenticated;
create trigger extraction_evidence_hash before insert or update on public.agent_document_extraction_runs for each row execute function public.hash_document_extraction();
update public.agent_document_extraction_runs set extraction_hash=encode(sha256(convert_to(pages::text,'UTF8')),'hex') where pages is not null;
-- Raw evidence stays server-only. Preserve metadata-only JWT history/list access.
revoke select on public.agent_document_extraction_runs from authenticated;
grant select(id,document_id,version,state,lease_until,page_count,ocr_page_count,extractor_version,extractor_hash,source_hash,extraction_hash,created_at,finished_at) on public.agent_document_extraction_runs to authenticated;
revoke select on public.agent_document_extractions from authenticated;
grant select(document_id,state,lease_until,page_count,ocr_page_count,extractor_version,active_run_id,updated_at) on public.agent_document_extractions to authenticated;
create table public.agent_document_review_decisions (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.agent_documents(id),
 run_id uuid not null unique references public.agent_document_extraction_runs(id),
 actor text not null,
 decision text not null default 'approved' check(decision='approved'),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 extractor_hash text not null check(extractor_hash ~ '^[a-f0-9]{64}$'),
 extraction_hash text not null check(extraction_hash ~ '^[a-f0-9]{64}$'),
 attestation text not null check(attestation='all_pages_and_flags_reviewed_v1'),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.agent_document_extraction_runs add column review_decision_id uuid references public.agent_document_review_decisions(id);
grant select(review_decision_id) on public.agent_document_extraction_runs to authenticated;
alter table public.agent_document_review_decisions enable row level security;
revoke all on public.agent_document_review_decisions from public,anon,authenticated,service_role;
grant select on public.agent_document_review_decisions to service_role;
create function public.immutable_document_review() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Review decision is immutable';end;$$;
revoke all on function public.immutable_document_review() from public,anon,authenticated;
create trigger immutable_review before update or delete on public.agent_document_review_decisions for each row execute function public.immutable_document_review();
create function public.approve_document_extraction(doc uuid,run uuid,actor text,source_hash text,extractor_hash text,extraction_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents;r public.agent_document_extraction_runs;
begin
 -- Same lock as claim/finish serializes new candidates against approval.
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not exists(select 1 from public.organizations o join public.agents a on a.organization_id=o.id join public.platform_users p on p.clerk_user_id=actor where o.id=d.organization_id and a.id=d.agent_id and o.archived_at is null and o.owner_clerk_user_id=actor and p.status='active' and p.role in ('owner','admin')) then return false;end if;
 select * into r from public.agent_document_extraction_runs where id=run and document_id=doc for update;
 if not found or r.state not in ('completed','review_required') or r.pages is null or r.source_hash is null or r.extractor_hash is null or r.extraction_hash is null or r.extractor_version is null then return false;end if;
 if source_hash is distinct from r.source_hash or extractor_hash is distinct from r.extractor_hash or extraction_hash is distinct from r.extraction_hash then return false;end if;
 if exists(select 1 from public.agent_document_extraction_runs x where x.document_id=doc and x.version>r.version) or exists(select 1 from public.agent_document_review_decisions x where x.run_id=run) then return false;end if;
 if not exists(select 1 from public.agent_document_extractions where document_id=doc) then return false;end if;
 insert into public.agent_document_review_decisions(document_id,run_id,actor,source_hash,extractor_hash,extraction_hash,attestation) values(doc,run,actor,r.source_hash,r.extractor_hash,r.extraction_hash,'all_pages_and_flags_reviewed_v1');
 update public.agent_document_extraction_runs set review_decision_id=(select x.id from public.agent_document_review_decisions x where x.run_id=run) where id=run;
 -- Keep machine state and warnings intact. Human activation is a separate decision.
 update public.agent_document_extractions set active_run_id=run,state=r.state,pages=r.pages,page_count=r.page_count,ocr_page_count=r.ocr_page_count,extractor_version=r.extractor_version,error_code=null,claim_token=r.claim_token,lease_until=r.lease_until,updated_at=clock_timestamp() where document_id=doc;
 return true;
end;$$;
revoke all on function public.approve_document_extraction(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.approve_document_extraction(uuid,uuid,text,text,text,text) to service_role;
-- Human-activated evidence requires the same explicit reprocess intent as machine completion.
create or replace function public.claim_document_extraction_run(doc uuid, token uuid, reprocess boolean, extractor_hash text, actor text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.agent_documents; prior public.agent_document_extractions; run_id uuid;
begin
 select * into d from public.agent_documents where id=doc for update;
 if not found or d.upload_state<>'stored' or not exists(select 1 from public.organizations o join public.agents a on a.organization_id=o.id join public.platform_users p on p.clerk_user_id=actor where o.id=d.organization_id and a.id=d.agent_id and o.archived_at is null and o.owner_clerk_user_id=actor and p.status='active' and p.role in ('owner','admin')) then return null; end if;
 if reprocess is null or token is null or extractor_hash is null or extractor_hash !~ '^[a-f0-9]{64}$' then return null; end if;
 if exists(select 1 from public.agent_document_extraction_runs r where r.document_id=doc and r.state='processing' and r.lease_until > clock_timestamp()) then return null; end if;
 select * into prior from public.agent_document_extractions where document_id=doc;
 if (prior.state='completed' or prior.active_run_id is not null) and not reprocess then return null; end if;
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
notify pgrst,'reload schema';
commit;
