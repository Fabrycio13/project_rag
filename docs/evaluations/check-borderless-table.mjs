import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extractPdf} from '../../src/lib/pdf-extraction.mjs';
const base=new URL('../fixtures/rag/',import.meta.url),out=new URL(process.argv[2]??'./borderless-table-after/',import.meta.url);await mkdir(out,{recursive:true});
const gold=JSON.parse(await readFile(new URL('extended/gold.json',base))),extra=JSON.parse(await readFile(new URL('borderless-extra/gold.json',base)));
const expected=[['Plano','Valor','Desconto'],['Essencial','R$ 234,56','2,5%'],['Avançado','R$ 987,65','0%']];
const results=[];
for(const c of [...gold.cases.map(c=>({...c,prefix:'extended/'})),...extra.cases.map(c=>({...c,prefix:'borderless-extra/'}))]){
 const result=await extractPdf(await readFile(new URL(c.prefix+(c.file??c.id+'.pdf'),base)));
 await writeFile(new URL(c.id+'.raw.json',out),JSON.stringify(result,null,2)+'\n');
 const checks=(c.questions??[]).flatMap(q=>q.evidence.map(text=>({page:q.page,text,passed:result.pages.find(p=>p.page===q.page)?.text.includes(text)??false})));
 const rows=c.id==='borderless'?expected:c.rows;
 const association=rows&&c.id!=='prose-columns'?rows.flatMap((row,r)=>row.map((text,column)=>({row:r,column,expected:text,actual:result.pages[0].ocrTableCells.find(cell=>cell.row===r&&cell.column===column)?.text??null}))).map(v=>({...v,passed:v.actual===v.expected})):null;
 let before=null;if(c.id==='borderless'){const previous=JSON.parse(await readFile(new URL('extended/after-corrections/borderless.raw.json',base)));before={cells:previous.pages[0].ocrTableCells.length,associationPasses:expected.flat().filter((text,index)=>previous.pages[0].ocrTableCells.some(cell=>cell.row===Math.floor(index/3)&&cell.column===index%3&&cell.text===text)).length,associationChecks:expected.flat().length};}
 results.push({id:c.id,evidence:checks,association,before,tableStructure:result.pages[0].ocrTableStructure,reviewRequired:result.reviewRequired,indexingEligible:result.indexingEligible});
}
const checks=results.flatMap(r=>r.evidence),report={fixtureCount:results.length,evidenceChecks:checks.length,evidencePasses:checks.filter(c=>c.passed).length,results};
await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fixtureCount:report.fixtureCount,evidencePasses:report.evidencePasses,evidenceChecks:report.evidenceChecks,association:results.filter(r=>r.association).map(r=>({id:r.id,passes:r.association.filter(c=>c.passed).length,total:r.association.length,before:r.before,state:r.tableStructure.state}))},null,2));
if(checks.some(c=>!c.passed)||results.filter(r=>['borderless','inventory'].includes(r.id)).some(r=>r.association.some(c=>!c.passed)))process.exitCode=1;
