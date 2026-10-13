import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {extractPdf} from '../../../../src/lib/pdf-extraction.mjs';
const root=new URL('./',import.meta.url);
const gold=JSON.parse(await readFile(new URL('gold.json',root)));const results=[];
for(const c of gold.cases){
 const start=performance.now();let extraction,error=null;
 try{extraction=await extractPdf(await readFile(new URL(c.file,root)));}catch(e){error=e.message;}
 if(extraction)await writeFile(new URL(c.id+'.raw.json',root),JSON.stringify(extraction,null,2)+'\n');
 const questions=c.questions.map(q=>{const text=extraction?.pages.find(p=>p.page===q.page)?.text??'';return {...q,evidencePresent:q.evidence.every(e=>text.includes(e)),missing:q.evidence.filter(e=>!text.includes(e))};});
 const allEvidence=questions.every(q=>q.evidencePresent);
 results.push({id:c.id,file:c.file,durationMs:Math.round(performance.now()-start),error,questions,allEvidence,status:error?'failure':!allEvidence?'evidence_gap':c.reviewReason?'review_required':'evidence_pass',reviewReason:c.reviewReason,pageMethods:extraction?.pages.map(p=>({page:p.page,method:p.method,confidence:p.ocrConfidence,warnings:p.warnings}))??[]});
 console.log(c.id,results.at(-1).status,error??'');
}
const counts=results.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
await writeFile(new URL('baseline.json',root),JSON.stringify({generatedAt:new Date().toISOString(),fixtureCount:results.length,counts,scope:'Exact page evidence only; not QA model accuracy, layout certification or training.',results},null,2)+'\n');
await writeFile(new URL('../../../evaluations/extended-pdf-baseline.md',root),'# Expanded PDF/OCR baseline\n\nEvaluation and regression, NOT training model weights. Local synthetic fixtures only.\n\n'+`Fixtures: ${results.length}. Status counts: ${JSON.stringify(counts)}.\n\n`+'| Fixture | Measured outcome | Time ms | Missing evidence / review |\n|---|---|---:|---|\n'+results.map(r=>`| ${r.file} | ${r.status} | ${r.durationMs} | ${r.error??r.questions.flatMap(q=>q.missing).join('; ')} ${r.reviewReason??''} |`).join('\n')+'\n\nEvidence matching is exact and case/accent sensitive; OCR variations are exposed, never silently normalized away. Tables require verified associations, not just token coverage. Multi-column sequence is unverified even when all tokens survive. Blank-page rejection is a document-level failure, not success. Extraction of injection text proves retention only, NOT downstream LLM injection resistance.\n\nReproduce: `node docs/fixtures/rag/extended/generate.mjs`; `node docs/fixtures/rag/extended/evaluate.mjs`; `node --test --test-concurrency=1 tests/*.test.mjs`. Gold is authored before extraction with page provenance, answers and evidence. Raw output and machine baseline live beside fixtures. No application code changed; gaps require separately authorized fixes. Edge/worker architecture deferred per user.\n');
console.log(JSON.stringify({fixtureCount:results.length,counts}));
