import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../src/app/organizations/[id]/agents/[agentId]/document-manager.tsx',import.meta.url),'utf8');
function render({processing=false,noActive=false,humanApproved=false}={}){
 const versions=[{id:'old',version:1,state:'completed',page_count:3,ocr_page_count:1,extractor_version:'previous',extractor_hash:null,source_hash:null},{id:'candidate',version:2,state:processing?'processing':'failed',lease_until:'2999-01-01T00:00:00Z',page_count:null,ocr_page_count:null,extractor_version:null,extractor_hash:null,source_hash:null}];
 if(humanApproved){versions[0].state='review_required';versions[0].review_decision_id='decision';versions[0].source_hash='source';versions[0].extractor_hash='extractor';}
 const state=[[{id:'doc',filename:'privado.pdf',size_bytes:8,upload_state:'stored',extraction:{active_run_id:noActive?null:'old',state:noActive?'failed':'completed',page_count:3,ocr_page_count:1,extractor_version:'previous'},versions}],true,false,'','',false];let index=0;
 const hooks={useState:()=>[state[index++],()=>{}],useRef:()=>({current:false}),useCallback:f=>f,useEffect:()=>{}};
 const mod=new Module('ui-contract');mod.require=id=>id==='react'?hooks:id==='@/lib/documents'?{DOCUMENT_MAX_BYTES:10485760}:require(id);
 mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,'ui-contract.js');
 const tree=mod.exports.DocumentManager({organizationId:'org',agentId:'agent'});
 const nodes=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(node&&typeof node==='object'){nodes.push(node);visit(node.props?.children);}}visit(tree);
 return {button:nodes.find(n=>n.type==='button'&&n.props.children==='Reprocessar documento'),html:require('react-dom/server').renderToStaticMarkup(tree)};
}
test('human-approved history stays distinct from machine certification and links exact version',()=>{const {html}=render({humanApproved:true});assert.match(html,/aprovada por pessoa/);assert.match(html,/\/organizations\/org\/agents\/agent\/documents\/doc\/review\/old/);});
test('rendered metadata history marks previous active and failed candidate honestly',()=>{
 const {html,button}=render();assert.ok(button);assert.match(html,/Versão ativa:/);assert.match(html,/Histórico de versões/);assert.match(html,/falhou — anterior preservada/);assert.match(html,/não compara o conteúdo textual/);assert.match(html,/3 página\(s\)/);
});
test('reprocessing requires confirmation and sends explicit action only after consent',async()=>{
 const previousWindow=globalThis.window,previousFetch=globalThis.fetch;const calls=[];
 try{
  globalThis.window={confirm:()=>false};globalThis.fetch=async(...args)=>{calls.push(args);return {ok:true,json:async()=>({state:'completed',pageCount:3,ocrPageCount:1,documents:[],processingAvailable:true})};};
  render().button.props.onClick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls.length,0);
  globalThis.window={confirm:message=>{assert.match(message,/O PDF não será reenviado/);assert.match(message,/falha ou revisão mantém a anterior/);return true;}};
  render().button.props.onClick();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls[0][0],'/api/organizations/org/agents/agent/documents/doc/process');assert.deepEqual(JSON.parse(calls[0][1].body),{action:'reprocess'});assert.equal(calls[1][1].cache,'no-store','reload history after outcome');
 }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});
test('initial failure does not claim a nonexistent active version was preserved',()=>{const {html}=render({noActive:true});assert.match(html,/falhou — sem versão ativa/);assert.ok(!html.includes('falhou — anterior preservada'));});
test('rendered reprocessing is disabled while a candidate has a live lease',()=>{assert.equal(render({processing:true}).button.props.disabled,true);});
