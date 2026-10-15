import test from 'node:test';
import assert from 'node:assert/strict';

// Realistic PostgREST/Storage error shapes; no provider calls or credentials.
test('upload diagnostics retain only stage, provider code and HTTP status and never interrupt compensation',async()=>{
 const {observeUploadStep}=await import('../src/lib/document-upload-diagnostics.ts');
 const events=[]; const previous=console.error;
 console.error=(...args)=>events.push(args);
 try {
  assert.equal(await observeUploadStep('finalize',async()=>({success:false,error:{code:'P0001',message:'private SQL error with token',details:'private detail',hint:'private hint',status:400}})),false);
  assert.equal(await observeUploadStep('upload',async()=>({success:false,error:{name:'StorageApiError',status:400,statusCode:'400',error:'DatabaseError',message:'private provider message'}})),false);
  assert.equal(await observeUploadStep('remove',async()=>{throw {code:'sensitive-token',statusCode:'503',message:'private exception'};}),false);
  assert.equal(await observeUploadStep('fail',async()=>({success:false})),false);
  assert.equal(await observeUploadStep('reserve',async()=>({success:true})),true);
 } finally {console.error=previous;}
 assert.deepEqual(events,[
  ['[document-upload]',{stage:'finalize',providerCode:'P0001',httpStatus:400}],
  ['[document-upload]',{stage:'upload',providerCode:'DatabaseError',httpStatus:400}],
  ['[document-upload]',{stage:'remove',providerCode:null,httpStatus:503}],
  ['[document-upload]',{stage:'fail',providerCode:null,httpStatus:null}],
 ]);
 assert.doesNotMatch(JSON.stringify(events),/private|sensitive-token/);
});
