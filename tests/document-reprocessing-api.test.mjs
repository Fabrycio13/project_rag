import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const file=new URL('../src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts',import.meta.url);
const source=readFileSync(file,'utf8');
const ids={id:'00000000-0000-4000-8000-000000000001',agentId:'00000000-0000-4000-8000-000000000002',documentId:'00000000-0000-4000-8000-000000000003'};
const run='00000000-0000-4000-8000-000000000004';
function harness({review=false,fail=false,busy=false,denied=false,missingSecret=false}={}){
 const calls=[];
 const db={
  from(table){const filters=[];let selected='';const query={select(s){selected=s;return query;},eq(k,v){filters.push([k,v]);return query;},async single(){calls.push({table,filters,selected});if(table==='agent_document_extractions')return {data:{active_run_id:review?'previous':run}};if(table==='agent_documents')return {data:{id:ids.documentId,storage_path:'private-source.pdf',size_bytes:8,upload_state:'stored'}};return {data:{id:run,state:fail?'failed':review?'review_required':'completed'}};}};return query;},
  async rpc(name,args){calls.push({name,args});return {data:name==='claim_document_extraction_run'?(busy?null:run):true};},
  storage:{from(){return {async download(){calls.push({download:true});return {data:new Blob(['%PDF-1.7'])};}};}}
 };
 const privileged={async rpc(name,args){calls.push({privileged:true,name,args});return {data:name==='claim_document_extraction_run'?(busy?null:run):true};}};
 const deps={
  '@/lib/supabase/service':{createServiceRoleSupabaseClient:()=>{if(missingSecret)throw Object.assign(Error('private exception must never be logged'),{reason:'missing_private_key'});return privileged;}},
  '@/lib/organization-access':{getOrganizationAccess:async()=>denied?{error:'denied',status:401}:{supabase:db,userId:'creator'}},
  '@/lib/organization-data':{findOrganization:async()=>({data:{id:ids.id}})},
  '@/lib/agent-data':{findAgent:async()=>({data:{id:ids.agentId}})},
  '@/lib/agents':{isUuid:v=>/^[a-f0-9-]{36}$/.test(v)},
  '@/lib/same-origin-request':{isSameOriginRequest:origin=>origin==='https://local.test'},
  '@/lib/documents':{DOCUMENT_BUCKET:'agent-documents',DOCUMENT_MAX_BYTES:10485760},
  '@/lib/pdf-extraction.mjs':{extractPdf:async()=>{if(fail)throw Error('private secret failure');return {pages:[{page:1,method:'text',text:'PRIVATE UNTRUSTED INSTRUCTIONS'}],extractorVersion:'fixture-v2',reviewRequired:review,indexingEligible:!review};}}
 };
 const mod=new Module(file.pathname);
 mod.require=id=>id in deps?deps[id]:require(id);
 mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file.pathname);
 return {calls,post:(body,origin='https://local.test')=>mod.exports.POST(new Request('https://local.test/api/documents/process',{method:'POST',headers:{Origin:origin,Host:'local.test','Content-Type':'application/json'},body}),{params:Promise.resolve(ids)})};
}
test('reprocess route contract authenticates, scopes, claims before download and returns candidate identity only',async()=>{
 const h=harness();const response=await h.post('{"action":"reprocess"}');assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.indexingEligible,false,'machine completion alone is not human approval');assert.equal(body.runId,run);assert.equal(body.promoted,true);assert.ok(!JSON.stringify(body).includes('PRIVATE'));
 const claim=h.calls.find(c=>c.name==='claim_document_extraction_run');assert.equal(claim.privileged,true);assert.equal(claim.args.actor,'creator');assert.equal(claim.args.reprocess,true);assert.match(claim.args.extractor_hash,/^[a-f0-9]{64}$/);
 assert.ok(h.calls.indexOf(claim)<h.calls.findIndex(c=>c.download));
 const lookup=h.calls.find(c=>c.table==='agent_documents');assert.deepEqual(lookup.filters,[['id',ids.documentId],['organization_id',ids.id],['agent_id',ids.agentId]]);
 const finish=h.calls.find(c=>c.name==='finish_document_extraction');assert.equal(finish.privileged,true);assert.equal(finish.args.actor,'creator');assert.equal(finish.args.doc,ids.documentId);assert.equal(finish.args.run,run);assert.match(finish.args.source_hash,/^[a-f0-9]{64}$/);
});
test('review candidate reports no promotion and failure reads back terminal attempt without leaking errors',async()=>{
 const review=harness({review:true});const r=await review.post('{"action":"reprocess"}');assert.equal(r.status,200);assert.equal((await r.json()).promoted,false);
 const failed=harness({fail:true});const f=await failed.post('{"action":"reprocess"}');assert.equal(f.status,422);assert.ok(!(await f.text()).includes('private secret'));
 assert.equal(failed.calls.find(c=>c.name==='finish_document_extraction').args.error_code,'processing_failed');
 assert.ok(failed.calls.some(c=>c.table==='agent_document_extraction_runs'),'failure terminal state must be read back');
});
test('denied, cross-origin, busy and oversized/client-role actions never download',async()=>{
 for(const [options,body,origin,status] of [[{denied:true},'{"action":"reprocess"}',undefined,401],[{},'{"action":"reprocess"}','https://evil.test',403],[{busy:true},'{"action":"reprocess"}',undefined,409],[{},'{"action":"reprocess","role":"owner"}',undefined,400],[{},'x'.repeat(129),undefined,400]]){
  const h=harness(options);const response=await h.post(body,origin);assert.equal(response.status,status);assert.ok(!h.calls.some(c=>c.download));
 }
});

test('missing server secret fails closed without claim or download',async()=>{const h=harness({missingSecret:true});const r=await h.post('{}');assert.equal(r.status,400);const h2=harness({missingSecret:true});const events=[];const previous=console.error;let r2;try{console.error=(...args)=>events.push(args);r2=await h2.post('{"action":"reprocess"}');}finally{console.error=previous;}assert.deepEqual(events,[['[document-extraction]',{stage:'service_client',reason:'missing_private_key'}]]);assert.equal(r2.status,503);assert.deepEqual(await r2.json(),{error:'A extração está temporariamente indisponível. Entre em contato com o administrador.'});assert.ok(!h2.calls.some(c=>c.name||c.download));});
