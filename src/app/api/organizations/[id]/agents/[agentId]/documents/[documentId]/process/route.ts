import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {getOrganizationAccess} from '@/lib/organization-access';
import {findOrganization} from '@/lib/organization-data';
import {findAgent} from '@/lib/agent-data';
import {isUuid} from '@/lib/agents';
import {isSameOriginRequest} from '@/lib/same-origin-request';
import {DOCUMENT_BUCKET,DOCUMENT_MAX_BYTES} from '@/lib/documents';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service';
import {extractPdf} from '@/lib/pdf-extraction.mjs';
export const runtime='nodejs';
export const maxDuration=150;
type Context={params:Promise<{id:string;agentId:string;documentId:string}>};
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const failure='Não foi possível extrair o texto. A versão ativa anterior, se existente, permanece disponível. Atualize a lista e tente novamente. PDFs protegidos, ilegíveis ou acima dos limites podem precisar de uma nova versão.';
export async function POST(request:Request,context:Context){
 try{
  if(!isSameOriginRequest(request.headers.get('origin'),request.headers.get('host'),request.headers.get('x-forwarded-host'),request.headers.get('x-forwarded-proto'),request.url))return reply('Ação não autorizada.',403);
  const access=await getOrganizationAccess();
  if('error' in access)return reply('Você não tem acesso a estes documentos.',access.status??503);
  const {id,agentId,documentId}=await context.params;
  if(!isUuid(id)||!isUuid(agentId)||!isUuid(documentId))return reply('Documento não encontrado.',404);
  const org=await findOrganization(access.supabase,access.userId,id);
  if(org.error)return reply(failure,503);if(!org.data)return reply('Documento não encontrado.',404);
  const agent=await findAgent(access.supabase,id,agentId);
  if(agent.error)return reply(failure,503);if(!agent.data)return reply('Documento não encontrado.',404);
  const db=access.supabase;
  const {data:doc,error}=await db.from('agent_documents').select('id,storage_path,size_bytes,upload_state').eq('id',documentId).eq('organization_id',id).eq('agent_id',agentId).single();
  if(error||!doc)return reply('Documento não encontrado.',404);
  if(doc.upload_state!=='stored')return reply('Aguarde a conclusão do envio.',409);
  // Empty body remains the baseline extraction action; completed docs require explicit intent.
  const reader=request.body?.getReader();
  const decoder=new TextDecoder();let body='';let length=0;
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>128){await reader.cancel();return reply('Ação inválida.',400);}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}
  let action='extract';
  if(body){try{const parsed=JSON.parse(body);if(Object.keys(parsed).length!==1||!['extract','reprocess'].includes(parsed.action))return reply('Ação inválida.',400);action=parsed.action;}catch{return reply('Ação inválida.',400);}}
  // Clerk-derived identity only. RLS authorization above precedes privileged mutation.
  let privileged:ReturnType<typeof createServiceRoleSupabaseClient>;
  try{privileged=createServiceRoleSupabaseClient();}catch(cause){
   const allowed=['missing_url','invalid_url','missing_private_key','invalid_private_key','client_initialization_failed'];
   const candidate=cause&&typeof cause==='object'&&'reason' in cause?cause.reason:null;
   const reason=typeof candidate==='string'&&allowed.includes(candidate)?candidate:'client_initialization_failed';
   console.error('[document-extraction]',{stage:'service_client',reason});
   return reply('A extração está temporariamente indisponível. Entre em contato com o administrador.',503);
  }
  const hash=createHash('sha256');
  for(const file of ['package-lock.json','src/lib/pdf-extraction.mjs','scripts/pdf-extract.mjs','scripts/pdf-native-layout.mjs','scripts/ocr-table-cells.mjs','scripts/ocr-borderless-table.mjs','scripts/ocr-borderless-numeric.mjs','scripts/ocr-orientation.mjs']){
   hash.update(file+'\0');hash.update(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(),file)));hash.update('\0');
  }
  hash.update(process.version);
  const token=randomUUID();
  const claim=await privileged.rpc('claim_document_extraction_run',{actor:access.userId,doc:documentId,token,reprocess:action==='reprocess',extractor_hash:hash.digest('hex')});
  if(claim.error)return reply(failure,503);
  if(typeof claim.data!=='string')return reply('Extração já concluída ou em andamento. Atualize a lista; se foi interrompida, tente novamente após três minutos.',409);
  const run=claim.data;
  const save=async(values:Record<string,unknown>)=>privileged.rpc('finish_document_extraction',{actor:access.userId,doc:documentId,run,token,outcome:values.state,payload:values.pages,extractor_version:values.extractor_version??null,source_hash:values.source_hash??null,error_code:values.error_code??null});
  try{
   const downloaded=await db.storage.from(DOCUMENT_BUCKET).download(doc.storage_path);
   if(downloaded.error||!downloaded.data||downloaded.data.size!==doc.size_bytes||downloaded.data.size>DOCUMENT_MAX_BYTES)throw Error('storage_failed');
   const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
   const source_hash=createHash('sha256').update(bytes).digest('hex');
   const result=await extractPdf(bytes);
   const state=result.reviewRequired?'review_required':'completed';
   const saved=await save({state,source_hash,extractor_version:result.extractorVersion,pages:result.pages,page_count:result.pages.length,ocr_page_count:result.pages.filter(p=>p.method==='ocr').length,error_code:null});
   if(saved.error||saved.data!==true)return reply(failure,503);
   // Read back exact candidate metadata; never return raw pages or document instructions.
   const confirmed=await db.from('agent_document_extraction_runs').select('id,state').eq('id',run).eq('document_id',documentId).single();
   if(confirmed.error||confirmed.data?.state!==state)return reply(failure,503);
   const active=await db.from('agent_document_extractions').select('active_run_id').eq('document_id',documentId).single();
   if(active.error||(state==='completed'&&active.data?.active_run_id!==run))return reply(failure,503);
   return Response.json({runId:run,promoted:active.data?.active_run_id===run,state,reviewRequired:result.reviewRequired,indexingEligible:false,pageCount:result.pages.length,ocrPageCount:result.pages.filter(p=>p.method==='ocr').length},{headers:{'Cache-Control':'no-store'}});
  }catch(cause){
   const codes=['processing_failed','processing_timeout','processing_busy','invalid_pdf','invalid_or_encrypted_pdf','page_limit','page_dimensions','text_limit','no_useful_text','storage_failed'];
   const code=cause instanceof Error&&codes.includes(cause.message)?cause.message:'processing_failed';
   const saved=await save({state:'failed',error_code:code,pages:null,page_count:null,ocr_page_count:null});
   if(saved.error||saved.data!==true){console.error('document_extraction_state_write_failed');return reply(failure,503);}
   const confirmed=await db.from('agent_document_extraction_runs').select('id,state').eq('id',run).eq('document_id',documentId).single();
   if(confirmed.error||confirmed.data?.state!=='failed')return reply(failure,503);
   return reply(failure,422);
  }
 }catch{return reply(failure,503);}
}
