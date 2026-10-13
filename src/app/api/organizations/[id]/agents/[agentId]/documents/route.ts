import { randomUUID } from 'node:crypto';
import { getOrganizationAccess } from '@/lib/organization-access';
import { findOrganization } from '@/lib/organization-data';
import { findAgent } from '@/lib/agent-data';
import { isUuid } from '@/lib/agents';
import { isSameOriginRequest } from '@/lib/same-origin-request';
import { DOCUMENT_BUCKET, DOCUMENT_ERROR, DOCUMENT_MAX_BYTES, validatePdf } from '@/lib/documents';
import { coordinateUpload } from '@/lib/document-upload';

type Context = { params: Promise<{ id: string; agentId: string }> };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(request: Request, context: Context) {
 try {
  if (request.method === 'POST' && !isSameOriginRequest(request.headers.get('origin'),request.headers.get('host'),request.headers.get('x-forwarded-host'),request.headers.get('x-forwarded-proto'),request.url)) return reply('Envio não autorizado.',403);
  const access = await getOrganizationAccess();
  if ('error' in access) return reply(access.status===401?'Entre na sua conta para continuar.':'Você não tem acesso a estes documentos.',access.status ?? 503);
  const { id, agentId } = await context.params;
  if (!isUuid(id) || !isUuid(agentId)) return reply('Agente não encontrado.',404);
  const org = await findOrganization(access.supabase,access.userId,id);
  if (org.error) return reply('A lista de documentos está indisponível. Tente novamente.',503);
  if (!org.data) return reply('Agente não encontrado.',404);
  const agent = await findAgent(access.supabase,id,agentId);
  if (agent.error) return reply('A lista de documentos está indisponível. Tente novamente.',503);
  if (!agent.data) return reply('Agente não encontrado.',404);
  const db = access.supabase;
  if (request.method === 'GET') {
   const { data,error } = await db.from('agent_documents').select('id, filename, size_bytes, upload_state, created_at, extraction:agent_document_extractions(state, lease_until, page_count, ocr_page_count, extractor_version, active_run_id), versions:agent_document_extraction_runs!document_id(id, version, state, lease_until, page_count, ocr_page_count, extractor_version, extractor_hash, source_hash, created_at)').eq('organization_id',id).eq('agent_id',agentId).order('created_at',{ascending:false});
   if(error){
    // Keep private upload/list usable while the separate extraction migration is pending.
    const fallback=await db.from('agent_documents').select('id, filename, size_bytes, upload_state, created_at').eq('organization_id',id).eq('agent_id',agentId).order('created_at',{ascending:false});
    return fallback.error?reply('A lista de documentos está indisponível. Tente novamente.',503):Response.json({documents:fallback.data,processingAvailable:false},{headers:{'Cache-Control':'no-store'}});
   }
   return Response.json({documents:data,processingAvailable:true},{headers:{'Cache-Control':'no-store'}});
  }
  const length = Number(request.headers.get('content-length'));
  if (length > DOCUMENT_MAX_BYTES + 65536) return reply('Envie um PDF de até 10 MiB.',413);
  // Bound chunked bodies too: content-length is not an authorization/size boundary.
  if (!request.body) return reply('Selecione um arquivo PDF.',400);
  const reader=request.body.getReader();
  const chunks: Uint8Array[]=[];
  let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>DOCUMENT_MAX_BYTES+65536){await reader.cancel();return reply('Envie um PDF de até 10 MiB.',413);}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const form = await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();
  const files = form.getAll('file');
  if (files.length!==1 || !(files[0] instanceof File)) return reply('Selecione um arquivo PDF.',400);
  const file = files[0];
  const metadata = await validatePdf(file);
  if (!metadata) return reply('Envie um PDF válido, com nome simples e até 10 MiB.',400);
  const documentId = randomUUID();
  const path = `${id.toLowerCase()}/${agentId.toLowerCase()}/${documentId}.pdf`;
  const storage = db.storage.from(DOCUMENT_BUCKET);
  const update = async (state:string) => {
   const {data,error} = await db.from('agent_documents').update({upload_state:state}).eq('id',documentId).eq('organization_id',id).eq('agent_id',agentId).eq('upload_state','pending').select('id, upload_state').single();
   return !error && data?.upload_state===state;
  };
  const success = await coordinateUpload({
   reserve:async()=>{const {data,error}=await db.from('agent_documents').insert({id:documentId,organization_id:id,agent_id:agentId,filename:metadata.name,size_bytes:metadata.size}).select('id').single();return !error && data?.id===documentId;},
   upload:async()=>{const {error}=await storage.upload(path,await file.arrayBuffer(),{contentType:'application/pdf',upsert:false});return !error;},
   finalize:()=>update('stored'),
   remove:async()=>{const {error}=await storage.remove([path]);return !error;},
   fail:()=>update('failed'),
  });
  return success ? Response.json({id:documentId},{status:201}) : reply(DOCUMENT_ERROR,503);
 } catch { return reply(DOCUMENT_ERROR,503); }
}
export const GET = handle;
export const POST = handle;
