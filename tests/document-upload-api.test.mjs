import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {coordinateUpload} from '../src/lib/document-upload.ts';
import {observeUploadStep} from '../src/lib/document-upload-diagnostics.ts';
import * as documents from '../src/lib/documents.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const file=new URL('../src/app/api/organizations/[id]/agents/[agentId]/documents/route.ts',import.meta.url);
const ids={id:'00000000-0000-4000-8000-000000000001',agentId:'00000000-0000-4000-8000-000000000002'};
function harness(failure){
 const calls=[];let row;
 const db={
  from(table){let update;const filters=[];const query={
   insert(value){row={...value,upload_state:'pending'};calls.push('reserve');return query;},
   update(value){update=value;return query;},eq(key,value){filters.push([key,value]);return query;},select(){return query;},
   async single(){
    if(update){calls.push(update.upload_state==='stored'?'finalize':'fail');assert.equal(table,'agent_documents');assert.deepEqual(filters,[['id',row.id],['organization_id',ids.id],['agent_id',ids.agentId],['upload_state','pending']]);
     if(update.upload_state==='stored'&&failure==='finalize')return {data:null,error:{code:'P0001',message:'Stored object missing or metadata mismatch; PRIVATE',details:'PRIVATE'}};
     row={...row,...update};
    }
    return {data:row,error:null};
   }
  };return query;},
  storage:{from(bucket){assert.equal(bucket,'agent-documents');return {
   async upload(path,bytes,options){calls.push('upload');assert.equal(path,`${ids.id}/${ids.agentId}/${row.id}.pdf`);assert.equal(bytes.byteLength,row.size_bytes);assert.deepEqual(options,{contentType:'application/pdf',upsert:false});return failure==='upload'?{error:{status:400,statusCode:'400',error:'DatabaseError',message:'PRIVATE'}}:{error:null};},
   async remove(paths){calls.push('remove');assert.deepEqual(paths,[`${ids.id}/${ids.agentId}/${row.id}.pdf`]);return {error:null};}
  };}}
 };
 const dependencies={
  '@/lib/organization-access':{getOrganizationAccess:async()=>({supabase:db,userId:'creator'})},
  '@/lib/organization-data':{findOrganization:async()=>({data:{id:ids.id}})},
  '@/lib/agent-data':{findAgent:async()=>({data:{id:ids.agentId}})},
  '@/lib/agents':{isUuid:()=>true},
  '@/lib/same-origin-request':{isSameOriginRequest:()=>true},
  '@/lib/documents':documents,'@/lib/document-upload':{coordinateUpload},'@/lib/document-upload-diagnostics':{observeUploadStep},
 };
 const mod=new Module(file.pathname);mod.require=id=>id in dependencies?dependencies[id]:require(id);
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file.pathname);
 return {calls,get row(){return row;},async post(){const body=new FormData();body.set('file',new File(['%PDF-1.7\nsynthetic content'], 'medio.pdf',{type:'application/pdf'}));return mod.exports.POST(new Request('https://local.test/api/documents',{method:'POST',body}),{params:Promise.resolve(ids)});}};
}
test('upload route compensates real-shaped PostgREST and Storage errors without exposing provider text',async()=>{
 const events=[],previous=console.error;console.error=(...args)=>events.push(args);
 try {
  for(const failure of ['finalize','upload']){
   const h=harness(failure),response=await h.post();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:documents.DOCUMENT_ERROR});
   assert.deepEqual(h.calls,failure==='finalize'?['reserve','upload','finalize','remove','fail']:['reserve','upload','remove','fail']);assert.equal(h.row.upload_state,'failed');
  }
 }finally{console.error=previous;}
 assert.deepEqual(events,[['[document-upload]',{stage:'finalize',providerCode:'P0001',httpStatus:null}],['[document-upload]',{stage:'upload',providerCode:'DatabaseError',httpStatus:400}]]);
});
test('upload route returns 201 only after scoped stored-state readback',async()=>{
 const h=harness(),response=await h.post();assert.equal(response.status,201);assert.deepEqual(await response.json(),{id:h.row.id});assert.equal(h.row.upload_state,'stored');assert.deepEqual(h.calls,['reserve','upload','finalize']);
});
