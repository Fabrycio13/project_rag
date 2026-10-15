import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import path from 'node:path';
import {getOrganizationAccess} from '@/lib/organization-access';
import {findOrganization} from '@/lib/organization-data';
import {findAgent} from '@/lib/agent-data';
import {isUuid} from '@/lib/agents';
import {isSameOriginRequest} from '@/lib/same-origin-request';
import {DOCUMENT_BUCKET,DOCUMENT_MAX_BYTES} from '@/lib/documents';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service';
export const runtime='nodejs';
export const maxDuration=30;
type Context={params:Promise<{id:string;agentId:string;documentId:string;runId:string}>};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Authorization'};
const reply=(error:string,status:number)=>Response.json({error},{status,headers});
let rendering=false;
async function handle(request:Request,context:Context){
 try{
  if(request.method==='POST'&&!isSameOriginRequest(request.headers.get('origin'),request.headers.get('host'),request.headers.get('x-forwarded-host'),request.headers.get('x-forwarded-proto'),request.url))return reply('Ação não autorizada.',403);
  const access=await getOrganizationAccess();if('error' in access)return reply('Entre em uma conta com acesso para revisar este documento.',access.status??503);
  const {id,agentId,documentId,runId}=await context.params;
  if(![id,agentId,documentId,runId].every(isUuid))return reply('Documento não encontrado.',404);
  const org=await findOrganization(access.supabase,access.userId,id);if(org.error)return reply('Revisão indisponível. Tente novamente.',503);if(!org.data)return reply('Documento não encontrado.',404);
  const agent=await findAgent(access.supabase,id,agentId);if(agent.error)return reply('Revisão indisponível. Tente novamente.',503);if(!agent.data)return reply('Documento não encontrado.',404);
  const db=access.supabase;
  const docResult=await db.from('agent_documents').select('id,filename,storage_path,size_bytes,upload_state').eq('id',documentId).eq('organization_id',id).eq('agent_id',agentId).maybeSingle();
  if(docResult.error||!docResult.data||docResult.data.upload_state!=='stored')return reply('Documento não encontrado.',404);
  const doc=docResult.data;
  // JWT metadata lookup BEFORE constructing a bypass-RLS client. Never accept a storage path.
  const metadata=await db.from('agent_document_extraction_runs').select('id,document_id,state,page_count,source_hash,extractor_hash,extraction_hash,extractor_version,version').eq('id',runId).eq('document_id',documentId).maybeSingle();
  if(metadata.error||!metadata.data)return reply('Versão não encontrada ou revisão indisponível.',404);
  const r=metadata.data;
  if(!['completed','review_required'].includes(r.state)||!r.source_hash||!r.extractor_hash||!r.extraction_hash||!r.extractor_version)return reply('Esta versão não tem evidência verificável para revisão.',409);
  const params=new URL(request.url).searchParams,mode=params.get('mode')??'page',page=Number(params.get('page')??'1');
  if(!['page','image','source'].includes(mode)||!Number.isInteger(page)||page<1||page>r.page_count)return reply('Página inválida.',400);
  const storagePath=`${id.toLowerCase()}/${agentId.toLowerCase()}/${documentId.toLowerCase()}.pdf`;
  if(doc.storage_path!==storagePath||doc.size_bytes>DOCUMENT_MAX_BYTES||doc.size_bytes<8)return reply('Original indisponível.',409);
  const download=await db.storage.from(DOCUMENT_BUCKET).download(storagePath);
  if(download.error||!download.data||download.data.size!==doc.size_bytes||download.data.size>DOCUMENT_MAX_BYTES)return reply('Original indisponível. Tente novamente.',503);
  const bytes=new Uint8Array(await download.data.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==r.source_hash)return reply('O original não corresponde a esta versão. Não é possível aprovar.',409);
  if(request.method==='GET'&&mode==='source')return new Response(new Blob([bytes],{type:'application/pdf'}).stream(),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="original.pdf"','Content-Length':String(bytes.length),'Content-Security-Policy':"sandbox; default-src 'none'"}});
  if(request.method==='GET'&&mode==='image'){
   if(rendering)return reply('Outra página está sendo preparada. Tente novamente.',429);
   rendering=true;
   try{
    const png=await new Promise<Buffer>((resolve,reject)=>{const child=execFile(process.execPath,['--max-old-space-size=384',path.join(/* turbopackIgnore: true */ process.cwd(),'scripts/pdf-review-render.mjs'),String(page),String(r.page_count)],{timeout:20000,maxBuffer:8*1024*1024,encoding:'buffer',windowsHide:true},(error,stdout)=>error?reject(Error('render_failed')):resolve(stdout));child.stdin?.on('error',()=>{});child.stdin?.end(bytes);});
    return new Response(new Uint8Array(png),{headers:{...headers,'Content-Type':'image/png','Content-Length':String(png.length),'Content-Disposition':'inline; filename="page.png"'}});
   }finally{rendering=false;}
  }
  const service=createServiceRoleSupabaseClient();
  const evidence=await service.from('agent_document_extraction_runs').select('id,document_id,pages,extraction_hash,source_hash,extractor_hash').eq('id',runId).eq('document_id',documentId).maybeSingle();
  if(evidence.error||!evidence.data||evidence.data.extraction_hash!==r.extraction_hash||evidence.data.source_hash!==r.source_hash||evidence.data.extractor_hash!==r.extractor_hash||!Array.isArray(evidence.data.pages)||evidence.data.pages.length!==r.page_count)return reply('A evidência mudou. Reabra a revisão.',409);
  const latest=await db.from('agent_document_extraction_runs').select('id').eq('document_id',documentId).order('version',{ascending:false}).limit(1);
  const active=await db.from('agent_document_extractions').select('active_run_id').eq('document_id',documentId).maybeSingle();
  const decision=await service.from('agent_document_review_decisions').select('id,run_id,actor,source_hash,extractor_hash,extraction_hash,created_at,attestation').eq('document_id',documentId).eq('run_id',runId).maybeSingle();
  if(latest.error||active.error||decision.error)return reply('Revisão indisponível. Tente novamente.',503);
  const approved=!!decision.data&&decision.data.source_hash===r.source_hash&&decision.data.extractor_hash===r.extractor_hash&&decision.data.extraction_hash===r.extraction_hash;
  const canApprove=['completed','review_required'].includes(r.state)&&latest.data?.[0]?.id===runId&&!decision.data;
  if(request.method==='POST'){
   // Bound chunked requests too. No client role, actor, page content or permission boolean.
   let length=0;const chunks:Uint8Array[]=[];const reader=request.body?.getReader();if(!reader)return reply('Confirme a revisão de todas as páginas e alertas.',400);
   while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1024){await reader.cancel();return reply('Confirmação inválida.',400);}chunks.push(value);}
   const bodyBytes=new Uint8Array(length);let offset=0;for(const c of chunks){bodyBytes.set(c,offset);offset+=c.length;}
   let body;try{body=JSON.parse(new TextDecoder().decode(bodyBytes));}catch{return reply('Confirmação inválida.',400);}
   if(!body||Object.keys(body).sort().join(',')!=='attestation,extractionHash,extractorHash,sourceHash'||body.attestation!=='all_pages_and_flags_reviewed_v1')return reply('Confirme a revisão de todas as páginas e alertas.',400);
   if(!canApprove||body.sourceHash!==r.source_hash||body.extractorHash!==r.extractor_hash||body.extractionHash!==r.extraction_hash)return reply('A versão mudou ou já foi decidida. Reabra a revisão.',409);
   const saved=await service.rpc('approve_document_extraction',{doc:documentId,run:runId,actor:access.userId,source_hash:r.source_hash,extractor_hash:r.extractor_hash,extraction_hash:r.extraction_hash});
   if(saved.error||saved.data!==true)return reply('A aprovação não foi confirmada. Reabra a revisão antes de tentar novamente.',409);
   const confirmed=await service.from('agent_document_review_decisions').select('id,actor,source_hash,extractor_hash,extraction_hash').eq('document_id',documentId).eq('run_id',runId).maybeSingle();
   const pointer=await db.from('agent_document_extractions').select('active_run_id').eq('document_id',documentId).maybeSingle();
   if(confirmed.error||pointer.error||confirmed.data?.actor!==access.userId||confirmed.data?.source_hash!==r.source_hash||confirmed.data?.extractor_hash!==r.extractor_hash||confirmed.data?.extraction_hash!==r.extraction_hash||pointer.data?.active_run_id!==runId)return reply('Não foi possível confirmar o resultado. Reabra a revisão; não repita automaticamente.',503);
   return Response.json({approved:true,decisionId:confirmed.data.id,activeRunId:runId,indexingEligible:true,indexed:false},{headers});
  }
  return Response.json({filename:doc.filename,runId,version:r.version,state:r.state,pageCount:r.page_count,page:evidence.data.pages[page-1],sourceHash:r.source_hash,extractorHash:r.extractor_hash,extractionHash:r.extraction_hash,active:active.data?.active_run_id===runId,canApprove,humanApproved:approved,decision:decision.data,indexingEligible:approved&&active.data?.active_run_id===runId,machineCertified:r.state==='completed',indexed:false},{headers});
 }catch{return reply('Não foi possível abrir ou confirmar a revisão. Tente novamente ou entre com outra conta.',503);}
}
export const GET=handle;export const POST=handle;
