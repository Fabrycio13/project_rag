import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {extractPdf} from '../../../../src/lib/pdf-extraction.mjs';
const root=new URL('./',import.meta.url),out=new URL('after-corrections/',root);await mkdir(out,{recursive:true});
const gold=JSON.parse(await readFile(new URL('gold.json',root)));
const before=JSON.parse(await readFile(new URL('baseline.json',root)));
const results=[];
for(const c of gold.cases){
 const start=performance.now();let extraction,error=null;
 try{extraction=await extractPdf(await readFile(new URL(c.file,root)));}catch(e){error=e.message;}
 if(extraction)await writeFile(new URL(c.id+'.raw.json',out),JSON.stringify(extraction,null,2)+'\n');
 const evidence=c.questions.flatMap(q=>q.evidence.map(text=>({page:q.page,text,passed:extraction?.pages.find(p=>p.page===q.page)?.text.includes(text)??false})));
 const p=extraction?.pages[0];let ordering=null,association=null,emptyPage=null;
 if(c.id==='columns-blank'){const sequence=c.source.lines.map(s=>p?.text.indexOf(s)??-1);ordering=sequence.every((n,i)=>n>=0&&(i===0||n>sequence[i-1]));}
 if(c.id==='merged-multiline'){
  const header=p?.ocrTableCells.find(cell=>cell.row===0&&cell.column===0),detail=p?.ocrTableCells.find(cell=>cell.row===1&&cell.column===1),label=p?.ocrTableCells.find(cell=>cell.row===1&&cell.column===0);
  association=header?.columnSpan===2&&header.text.includes('categoria única')&&label?.text.includes('Saúde')&&detail?.text.includes('Reembolso de R$ 123,45')&&detail.text.includes('Não inclui dependentes')&&detail.text.includes('\n');
 }
 if(c.id==='blank-interspersed')emptyPage=extraction?.pages[1]?.evidenceState==='empty'&&extraction.pages[1].text==='';
 const previous=before.results.find(r=>r.id===c.id);
 results.push({id:c.id,error,durationMs:Math.round(performance.now()-start),before:{status:previous.status,allEvidence:previous.allEvidence,durationMs:previous.durationMs},evidence,allEvidence:evidence.every(e=>e.passed),ordering,association,emptyPage,reviewRequired:extraction?.reviewRequired??null,indexingEligible:extraction?.indexingEligible??false,remainingLimitations:c.kind==='borderless'?'Associação sem bordas não certificada':extraction?.reviewRequired?'Cobertura e layout raster não certificados; revisão obrigatória':null});
}
const checks=results.flatMap(r=>r.evidence);
const report={fixtureCount:results.length,evidenceChecks:checks.length,evidencePasses:checks.filter(e=>e.passed).length,evidenceFailures:checks.filter(e=>!e.passed).length,documentFailures:results.filter(r=>r.error).length,reviewRequiredCount:results.filter(r=>r.reviewRequired).length,orderingPasses:results.filter(r=>r.ordering===true).length,associationPasses:results.filter(r=>r.association===true).length,results};
await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.evidenceFailures||report.documentFailures||results.some(r=>r.ordering===false||r.association===false||r.emptyPage===false))process.exitCode=1;
