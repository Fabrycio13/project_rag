import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Disposable PostgreSQL only: no environment files, provider calls or real uploads.
test('authenticated PDF reservation, Storage insert and finalization preserve the private upload contract', {skip:!process.env.PGLITE_MODULE}, async()=>{
 const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
 const db=new PGlite(); await db.waitReady;
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
   create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('sub',current_setting('test.sub',true))$$;
   create table organizations(id uuid primary key, archived_at timestamptz, owner_clerk_user_id text);
   create table agents(id uuid primary key, organization_id uuid references organizations);
   create table platform_users(clerk_user_id text, role text, status text);
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text,metadata jsonb);
   alter table storage.objects enable row level security;
   grant usage on schema public,auth,storage to authenticated;
   grant select on organizations,agents,platform_users to authenticated;
   grant select,insert,delete on storage.objects to authenticated;`);
  for (const name of ['20261013000100_agent_documents.sql','20261013000200_document_extraction.sql','20261013000300_document_extraction_review.sql','20261013000400_document_reprocessing.sql','20261013000500_extraction_server_authority.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  // Read-only trigger observation in the disposable DB isolates the actual cause.
  await db.exec(`create function public.observe_generated_path() returns trigger language plpgsql as $$begin perform set_config('test.new_storage_path',coalesce(new.storage_path,'<NULL>'),false);return new;end;$$;
   create trigger aaa_observe_generated_path before update on agent_documents for each row execute function public.observe_generated_path();`);
  const fix=new URL('../supabase/migrations/20261015000600_document_upload_finalization.sql',import.meta.url);
  if(existsSync(fix) && !process.env.UPLOAD_DB_RED) await db.exec(readFileSync(fix,'utf8'));
  const org='00000000-0000-4000-8000-000000000001',agent='00000000-0000-4000-8000-000000000002';
  await db.query('insert into organizations values($1,null,$2)',[org,'creator']);
  await db.query('insert into agents values($1,$2)',[agent,org]);
  await db.exec("insert into platform_users values('creator','owner','active'),('other','admin','active');set role authenticated;select set_config('test.sub','creator',false)");
  let seq=10;
  const reserve=async(size=1234)=>{
   const id=`00000000-0000-4000-8000-${String(seq++).padStart(12,'0')}`;
   await db.query('insert into agent_documents(id,organization_id,agent_id,filename,size_bytes)values($1,$2,$3,$4,$5)',[id,org,agent,'medio.pdf',size]);
   return {id,path:`${org}/${agent}/${id}.pdf`,size};
  };
  const upload=async(doc,metadata={size:doc.size,mimetype:'application/pdf'})=>db.query('insert into storage.objects values($1,$2,$3)', ['agent-documents',doc.path,JSON.stringify(metadata)]);
  const finalize=doc=>db.query("update agent_documents set upload_state='stored' where id=$1 and upload_state='pending' returning upload_state,size_bytes",[doc.id]);
  const doc=await reserve(); await upload(doc);
  // Exactly the route's finalize operation, as authenticated, after a real SQL Storage INSERT.
  const stored=await finalize(doc);
  assert.equal(stored.rows[0]?.upload_state,'stored');
  assert.equal((await db.query("select current_setting('test.new_storage_path') as path")).rows[0].path,'<NULL>','BEFORE UPDATE sees NEW generated storage_path as NULL, not the matching key');
  assert.equal(Number(stored.rows[0]?.size_bytes),1234);
  assert.equal((Number(stored.rows[0]?.size_bytes)/1048576).toLocaleString('pt-BR',{maximumFractionDigits:2}),'0','the UI rounds a nonzero PDF to 0 MiB');
  await assert.rejects(reserve(0),/check constraint/);
  await assert.rejects(db.query("update agent_documents set filename='changed.pdf' where id=$1",[doc.id]),/permission denied/);
  const absent=await reserve(); await assert.rejects(finalize(absent),/Stored object missing or metadata mismatch/);
  const wrongSize=await reserve();await upload(wrongSize,{size:12344,mimetype:'application/pdf'});await assert.rejects(finalize(wrongSize),/Stored object missing or metadata mismatch/);
  const wrongType=await reserve();await upload(wrongType,{size:1234,mimetype:'text/plain'});await assert.rejects(finalize(wrongType),/Stored object missing or metadata mismatch/);
  const stringSize=await reserve();await upload(stringSize,{size:'1234',mimetype:'application/pdf'});assert.equal((await finalize(stringSize)).rows[0]?.upload_state,'stored');
  const failed=await reserve();await upload(failed);await db.query('delete from storage.objects where name=$1',[failed.path]);await db.query("update agent_documents set upload_state='failed' where id=$1",[failed.id]);
  await db.exec("select set_config('test.sub','other',false)");
  assert.equal((await db.query('select * from agent_documents')).rows.length,0);
  await assert.rejects(reserve(),/row-level security/);
  await assert.rejects(upload(doc),/row-level security/);
  assert.equal((await db.query("update agent_documents set upload_state='failed' where id=$1 returning id",[absent.id])).rows.length,0);
 } finally {await db.exec('rollback');await db.close();}
});
