import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const file=new URL('../src/lib/supabase/service.ts',import.meta.url);
function harness(env){
 const calls=[];
 const mod=new Module(file.pathname);
 mod.require=id=>id==='server-only'?{}:id==='@supabase/supabase-js'?{createClient:(...args)=>{calls.push(args);return {privileged:true};}}:require(id);
 const source=readFileSync(file,'utf8').replaceAll('process.env','testEnv');
 mod._compile('const testEnv='+JSON.stringify(env)+';\n'+ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file.pathname);
 return {...mod.exports,calls};
}
const url='https://project.supabase.co';
test('configuration failures have safe reason codes without secret values',()=>{
 for(const [env,reason] of [[{},'missing_url'],[{NEXT_PUBLIC_SUPABASE_URL:'not a URL'},'invalid_url'],[{NEXT_PUBLIC_SUPABASE_URL:url},'missing_private_key'],[{NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SECRET_KEY:'sb_publishable_private-fixture'},'invalid_private_key']]){
  const h=harness(env);
  assert.throws(()=>h.createServiceRoleSupabaseClient(),error=>error.reason===reason&&!error.message.includes('private-fixture'));
  assert.equal(h.calls.length,0);
 }
});
test('empty preferred key does not mask configured server role key',()=>{
 const h=harness({NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SECRET_KEY:' ',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture'});
 assert.deepEqual(h.createServiceRoleSupabaseClient(),{privileged:true});
 assert.equal(h.calls[0][1],'sb_secret_fixture');
 assert.deepEqual(h.calls[0][2].auth,{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false});
});
test('public credentials never substitute a missing private credential',()=>{
 const h=harness({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fixture'});
 assert.throws(()=>h.createServiceRoleSupabaseClient(),error=>error.reason==='missing_private_key');
 assert.equal(h.calls.length,0);
});
