'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {SignOutButton} from '@clerk/nextjs';
type Cell={row:number;column:number;text:string;confidence?:number;bbox?:number[];[key:string]:unknown};
type Page={page:number;text:string;method?:string;warnings?:string[];ocrConfidence?:number|null;ocrOrientation?:{rotation?:number};pageGeometry?:{rotation?:number};ocrTableCells?:Cell[];ocrTableStructure?:{state?:string;markdown?:string|null;reason?:string};[key:string]:unknown};
type Review={filename:string;runId:string;version:number;state:string;pageCount:number;page:Page;active:boolean;canApprove:boolean;humanApproved:boolean;machineCertified:boolean;indexingEligible:boolean;sourceHash:string;extractorHash:string;extractionHash:string;decision?:{actor:string;created_at:string}|null};
type Version={id:string;version:number;state:string;active?:boolean;review_decision_id?:string|null};
const reasons:Record<string,string>={layout_unverified:'Ordem e layout não certificados',orientation_review_required:'Rotação ambígua',table_cells_reading_order_unverified:'Ordem das células não certificada',numeric_ocr_disagreement:'Leituras numéricas discordam: confira sinais e valores',mixed_reading_order_unverified:'Ordem entre texto nativo e imagem não certificada',raster_text_unverified:'Cobertura do texto da imagem não certificada',raster_layout_review_required:'Layout OCR exige conferência visual'};
export function DocumentReview({organizationId,agentId,documentId,runId}:{organizationId:string;agentId:string;documentId:string;runId:string}){
 const [data,setData]=useState<Review|null>(null);
 const [page,setPage]=useState(1);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [attested,setAttested]=useState(false);
 const [saving,setSaving]=useState(false);
 const [versions,setVersions]=useState<Version[]>([]);
 const [imageLoaded,setImageLoaded]=useState<number|null>(null);
 const busy=useRef(false);
 const router=useRouter();
 const list=`/api/organizations/${organizationId}/agents/${agentId}/documents`;
 const endpoint=`${list}/${documentId}/review/${runId}`;
 const parent=`/organizations/${organizationId}/agents/${agentId}`;
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`${endpoint}?page=${page}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);return b;}).then(b=>{setData(b);setError('');setLoading(false);}).catch(c=>{if(!controller.signal.aborted){setData(null);setError(c instanceof Error?c.message:'Revisão indisponível.');setLoading(false);}});
  return ()=>controller.abort();
 },[endpoint,page]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(list,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(b=>{const doc=b.documents?.find((d:{id:string})=>d.id===documentId);setVersions((doc?.versions??[]).map((v:Version)=>({...v,active:v.id===doc?.extraction?.active_run_id})));}).catch(()=>{});
  return ()=>controller.abort();
 },[list,documentId]);
 function navigate(next:number){setLoading(true);setAttested(false);setImageLoaded(null);setPage(next);}
 async function approve(){
  if(!data||!attested||busy.current||!data.canApprove||imageLoaded!==page)return;
  if(!window.confirm(`Aprovar a versão ${data.version} após conferir TODAS as ${data.pageCount} páginas e todos os alertas? A decisão será imutável e ativará esta versão para futura indexação. Não corrige o OCR e não cria embeddings.`))return;
  busy.current=true;setSaving(true);setError('');
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attestation:'all_pages_and_flags_reviewed_v1',sourceHash:data.sourceHash,extractorHash:data.extractorHash,extractionHash:data.extractionHash})});const b=await r.json();if(!r.ok)throw Error(b.error);
   // Server has already read back decision and pointer. Refresh exact evidence/decision too.
   const refreshed=await fetch(`${endpoint}?page=${page}`,{cache:'no-store'});const result=await refreshed.json();if(!refreshed.ok)throw Error('Resultado não confirmado. Reabra a revisão antes de tentar novamente.');setData(result);setAttested(false);
  }catch(c){setError(c instanceof Error?c.message:'A aprovação não foi confirmada. Reabra a revisão.');setAttested(false);}
  finally{busy.current=false;setSaving(false);}
 }
 return <main className="mx-auto max-w-7xl space-y-5 p-6">
  <a href={parent} className="text-blue-600 underline">← Voltar aos documentos</a>
  <header><h1 className="text-2xl font-semibold">Revisão privada da extração</h1><p>Compare o original com a evidência literal. Nenhuma edição, geração ou indexação ocorre ao abrir esta tela.</p></header>
  <SignOutButton redirectUrl="/sign-in"><button className="text-sm underline">Sair e trocar de conta</button></SignOutButton>
  {error&&<div role="alert" className="rounded border border-red-500 p-3"><p>{error}</p><button disabled={saving} onClick={()=>window.location.reload()} className="underline">Reabrir revisão</button></div>}
  {loading?<p role="status">Carregando página privada…</p>:data&&<>
   <section className="space-y-2"><h2 className="break-words text-xl">{data.filename} · Versão {data.version} · {data.active?'ativa':'candidata / histórica'}</h2>
    <p>{data.humanApproved?'Aprovada por pessoa — não é certificação automática':data.machineCertified?'Concluída pelo extrator — não aprovada por pessoa':'Revisão humana pendente — não certificada pelo extrator'}. Ainda não indexada.</p>
    {data.decision&&<p>Aprovação: {data.decision.actor} · {new Date(data.decision.created_at).toLocaleString('pt-BR')}</p>}
    <label>Selecionar versão <select aria-label="Selecionar versão" value={runId} disabled={saving} onChange={e=>{router.push(`${parent}/documents/${documentId}/review/${e.target.value}`);}} className="rounded border p-2">{versions.length?versions.slice().sort((a,b)=>b.version-a.version).map(v=><option key={v.id} value={v.id} disabled={!['completed','review_required'].includes(v.state)}>Versão {v.version} · {v.active?'ativa':'candidata / histórica'} · {v.review_decision_id?'aprovada por pessoa':v.state==='completed'?'concluída pelo extrator':v.state==='review_required'?'aguarda revisão':'sem evidência terminal'} </option>):<option value={runId}>Versão {data.version}</option>}</select></label>
    <details><summary>Vínculos de integridade desta versão</summary><dl className="break-all text-xs"><dt>Original SHA-256</dt><dd>{data.sourceHash}</dd><dt>Extrator SHA-256</dt><dd>{data.extractorHash}</dd><dt>Evidência SHA-256</dt><dd>{data.extractionHash}</dd></dl></details>
   </section>
   <nav aria-label="Páginas" className="flex flex-wrap items-center gap-4"><button disabled={page===1||saving} onClick={()=>navigate(page-1)} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {data.pageCount}</span><button disabled={page===data.pageCount||saving} onClick={()=>navigate(page+1)} className="rounded border px-3 py-2 disabled:opacity-40">Próxima</button><a href={`${endpoint}?mode=source`} className="underline">Baixar original privado</a></nav>
   <section aria-label="Alertas da página" className="rounded border border-amber-600 bg-amber-50 p-3 text-amber-950"><h2 className="font-semibold">Motivos para conferência</h2>{data.page.method==='empty'?<p>Página vazia — preservada na contagem.</p>:<><p>Método: {data.page.method??'não registrado'} · Confiança OCR: {data.page.ocrConfidence??'não registrada'} · Rotação OCR: {data.page.ocrOrientation?.rotation??'não registrada'} · Rotação PDF: {data.page.pageGeometry?.rotation??'não registrada'}</p><ul>{data.page.warnings?.map(w=><li key={w}>{reasons[w]??w} <code>({w})</code></li>)}</ul></>}</section>
   <div className="grid items-start gap-5 lg:grid-cols-2"><section className="min-w-0"><h2 className="mb-2 font-semibold">Original · página {page}</h2>
    {/* Raster-only local PDF.js render; no PDF annotations, links, scripts or HTML. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={`${runId}:${page}`} src={`${endpoint}?mode=image&page=${page}`} alt={`Original do PDF, página ${page}`} className="h-auto w-full rounded border bg-white" onLoad={()=>setImageLoaded(page)} onError={()=>{setImageLoaded(null);setError('Não foi possível mostrar o original. Tente novamente antes de aprovar.');}}/>
   </section><section className="min-w-0 space-y-3"><h2 className="font-semibold">Texto bruto · somente leitura</h2><pre className="max-h-[650px] overflow-auto whitespace-pre-wrap break-words rounded border p-4 text-sm">{data.page.text||'Página vazia — sem texto extraído.'}</pre>
    <h3 className="font-semibold">Estrutura existente</h3>{data.page.ocrTableStructure?.state==='validated_rectangular'&&data.page.ocrTableStructure.markdown?<><p>Tabela retangular associada pelo extrator; confira os valores e alertas. Não certifica a página inteira.</p><pre className="overflow-auto whitespace-pre-wrap rounded border p-3 text-sm">{data.page.ocrTableStructure.markdown}</pre></>:<p>Estrutura requer revisão. Nenhum Markdown foi inventado para esta página.</p>}
    {!!data.page.ocrTableCells?.length&&<details><summary>Células e proveniência preservadas ({data.page.ocrTableCells.length})</summary>{data.page.ocrTableCells.map((cell,i)=><article key={i} className="my-2 rounded border p-2"><p>Linha {cell.row} · Coluna {cell.column} · Confiança {cell.confidence??'não registrada'}</p><pre className="whitespace-pre-wrap break-words text-sm">{cell.text}</pre><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(cell,null,2)}</pre></article>)}</details>}
    <details><summary>Proveniência completa da página (somente leitura)</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(data.page,null,2)}</pre></details>
   </section></div>
   <section className="space-y-3 rounded border p-4"><h2 className="font-semibold">Decisão humana explícita</h2><p>A aprovação mantém texto, alertas e estado do extrator intactos; ativa esta versão para futura indexação. Não envia texto a provedores e não cria embeddings. Sem concordar, deixe a candidata pendente e reprocese ou envie outro PDF.</p>
    {data.canApprove?<><label className="flex gap-2"><input type="checkbox" checked={attested} disabled={saving} onChange={e=>setAttested(e.target.checked)}/>Conferi todas as páginas, inclusive vazias, números, sinais, ordem, células e alertas com o original; atesto esta versão para futura indexação.</label><button disabled={!attested||saving||imageLoaded!==page} onClick={()=>void approve()} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{saving?'Confirmando…':'Confirmar aprovação desta versão'}</button></>:<p>{data.humanApproved?'Decisão imutável registrada.':'Esta versão não pode ser aprovada: selecione a candidata terminal mais recente com proveniência verificável.'}</p>}
   </section>
  </>}
 </main>;
}
