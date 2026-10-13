'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DOCUMENT_MAX_BYTES } from '@/lib/documents';
type Version={id:string;version:number;state:'processing'|'completed'|'review_required'|'failed';lease_until:string;page_count:number|null;ocr_page_count:number|null;extractor_version:string|null;extractor_hash:string|null;source_hash:string|null};
type Extraction={active_run_id:string|null;state:'processing'|'completed'|'review_required'|'failed';extractor_version:string|null;lease_until:string;page_count:number|null;ocr_page_count:number|null};
type Document = {id:string;filename:string;size_bytes:number;upload_state:'pending'|'stored'|'failed';extraction:Extraction|null;versions?:Version[]};
export function DocumentManager({organizationId,agentId}:{organizationId:string;agentId:string}) {
 const [documents,setDocuments]=useState<Document[]>([]);
 const [processingAvailable,setProcessingAvailable]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [pending,setPending]=useState(false);
 const busy=useRef(false);
 const endpoint=`/api/organizations/${organizationId}/agents/${agentId}/documents`;
 const load=useCallback(async()=>{
  try { const response=await fetch(endpoint,{cache:'no-store'}); const result=await response.json(); if(!response.ok) throw new Error(result.error); setDocuments(result.documents);setProcessingAvailable(result.processingAvailable===true); }
  catch { setError('Não foi possível atualizar a lista. Tente novamente.'); }
  finally {setLoading(false);}
 },[endpoint]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const result=await response.json();if(!response.ok)throw new Error();return result as {documents:Document[];processingAvailable:boolean};
  }).then(result=>{setDocuments(result.documents);setProcessingAvailable(result.processingAvailable===true);setLoading(false);}).catch(()=>{
   if(!controller.signal.aborted){setError('Não foi possível atualizar a lista. Tente novamente.');setLoading(false);}
  });
  return ()=>controller.abort();
 },[endpoint]);
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); if(busy.current)return;
  const form=event.currentTarget;
  const body=new FormData(form);
  const file=body.get('file');
  setError('');setMessage('');
  if(!(file instanceof File)||!file.size||file.size>DOCUMENT_MAX_BYTES){setError('Selecione um PDF de até 10 MiB.');return;}
  busy.current=true;setPending(true);
  try {const response=await fetch(endpoint,{method:'POST',body});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage('PDF armazenado de forma privada.');form.reset();}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível enviar o PDF. Tente novamente.');}
  finally {setLoading(true);await load();busy.current=false;setPending(false);}
 }
 async function processDocument(documentId:string,reprocess=false){
  if(busy.current)return;
  if(reprocess&&!window.confirm('Reprocessar documento com o extrator atual? O PDF não será reenviado. A versão anterior e suas páginas serão preservadas. Somente um resultado concluído sem revisão substituirá a versão ativa; falha ou revisão mantém a anterior.'))return;busy.current=true;setPending(true);setError('');setMessage('Extraindo texto localmente; páginas sem texto usam OCR. Aguarde…');
  try{const response=await fetch(`${endpoint}/${documentId}/process`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:reprocess?'reprocess':'extract'})});const result=await response.json();if(!response.ok)throw Error(result.error);setMessage(result.reviewRequired?'Nova versão aguardando revisão: texto e coordenadas preservados, mas layout ou cobertura não certificados. A versão ativa anterior, se existente, permanece disponível. Não elegível para indexação.':`Texto extraído: ${result.pageCount} página(s), ${result.ocrPageCount} com OCR. Ainda não indexado para busca.`);}
  catch(cause){setMessage('');setError(cause instanceof Error?cause.message:'Não foi possível extrair o texto. A versão ativa anterior permanece disponível.');}
  finally{setLoading(true);await load();busy.current=false;setPending(false);}
 }
 const states={stored:'Armazenado',pending:'Envio pendente — pode ter sido interrompido',failed:'Envio não concluído — requer conferência'};
 return <section className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
  <h2 className="text-lg font-semibold">Documentos privados</h2>
  <p className="text-sm text-zinc-600 dark:text-zinc-400">Somente PDF, até 10 MiB e 30 páginas. Após o envio, use Extrair texto. OCR local em português nas páginas sem texto útil; nenhum documento é enviado a um provedor de IA. A extração pode levar até dois minutos e não continua automaticamente se o servidor parar. Texto extraído ainda não fica disponível na busca.</p>
  <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
   <label className="text-sm">Arquivo PDF <input name="file" type="file" accept=".pdf,application/pdf" required disabled={pending} className="block mt-2 max-w-full" /></label>
   <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{pending?'Enviando…':'Enviar PDF'}</button>
  </form>
  {!processingAvailable&&!loading&&<p className="text-sm">Extração indisponível no momento. O envio e a lista continuam disponíveis.</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  <button type="button" disabled={loading||pending} onClick={()=>{setError('');setLoading(true);void load();}} className="text-sm text-blue-600 disabled:opacity-50">Atualizar lista</button>
  {loading?<p role="status">Carregando documentos…</p>:documents.length===0?<p className="text-sm">Nenhum documento listado.</p>:<ul className="space-y-3">{documents.map(document=><li key={document.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800"><p className="break-words font-medium">{document.filename}</p><p className="text-sm text-zinc-600 dark:text-zinc-400">{(document.size_bytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:2})} MiB · {states[document.upload_state]}</p>{document.upload_state==='stored'&&<div className="mt-2 text-sm"><p>{document.extraction?.state==='review_required'?'Revisão necessária — associações, ordem ou cobertura não certificadas; não elegível para indexação':document.extraction?.state==='completed'?(document.extraction.extractor_version?`Texto extraído · ${document.extraction.page_count} página(s) · ${document.extraction.ocr_page_count} com OCR · ainda não indexado`:'Extração anterior — fidelidade não reavaliada; use Reprocessar documento para reavaliar; não indexar'):document.extraction?.state==='processing'?'Extração em andamento ou interrompida — nova tentativa liberada após três minutos':document.extraction?.state==='failed'?'Extração não concluída — tente novamente ou envie uma versão legível':'Texto ainda não extraído'}</p>{document.extraction?.active_run_id&&<p>Versão ativa: {document.versions?.find(v=>v.id===document.extraction?.active_run_id)?.version??'anterior'} — preservada até conclusão de nova versão sem revisão.</p>}{document.versions&&document.versions.length>0&&<details className="mt-2"><summary>Histórico de versões — comparação de metadados</summary><p>Páginas completas preservadas de forma privada no servidor; esta tela não compara o conteúdo textual.</p><ul>{[...document.versions].sort((a,b)=>b.version-a.version).map(v=><li key={v.id}>Versão {v.version} · {v.id===document.extraction?.active_run_id?'ativa · ':''}{v.state==='completed'?'concluída':v.state==='review_required'?'aguarda revisão — não promovida':v.state==='failed'?(document.extraction?.active_run_id?'falhou — anterior preservada':'falhou — sem versão ativa'):'em andamento ou interrompida; nova tentativa após três minutos'} · {v.page_count??'—'} página(s) · {v.ocr_page_count??'—'} com OCR · {v.extractor_version??'extrator anterior não identificado'}<br/>Identidade do extrator: {v.extractor_hash?.slice(0,12)??'não registrada'} · PDF: {v.source_hash?.slice(0,12)??'não registrado'}</li>)}</ul></details>}{processingAvailable&&document.extraction?.state==='completed'&&<button type="button" disabled={pending||document.versions?.some(v=>v.state==='processing'&&Date.parse(v.lease_until)>Date.now())} onClick={()=>void processDocument(document.id,true)} className="mt-2 text-blue-600 disabled:opacity-50">Reprocessar documento</button>}{processingAvailable&&document.extraction?.state!=='completed'&&<button type="button" disabled={pending} onClick={()=>void processDocument(document.id)} className="mt-2 text-blue-600 disabled:opacity-50">Extrair texto</button>}</div>}</li>)}</ul>}
 </section>;
}
