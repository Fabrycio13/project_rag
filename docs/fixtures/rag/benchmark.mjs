// Local only: exercises the existing bounded application wrapper without modification.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { extractPdf } from '../../../src/lib/pdf-extraction.mjs';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const gold=JSON.parse(await fs.readFile(path.join(dir,'gold.json'),'utf8'));
const outputDir=process.argv[2]?path.resolve(process.argv[2]):dir;
await fs.mkdir(outputDir,{recursive:true});
const report={extractor:'src/lib/pdf-extraction.mjs -> scripts/pdf-extract.mjs',node:process.version,remote_uploads:false,measurements:[],limitations:['Literal substring coverage is not semantic correctness.','No layout, table reconstruction, question answering or injection-resistance evaluation performed.','Peak RSS not measured.']};
const normalize=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
for(const name of ['facil','medio','dificil']){
 const file=name+'.pdf';const bytes=await fs.readFile(path.join(dir,file));const start=performance.now();
 try{
  const result=await extractPdf(bytes);
  await fs.writeFile(path.join(outputDir,`${name}.raw.json`),JSON.stringify(result,null,2)+'\n');
  const coverage=gold.expected_elements.filter(e=>e.file===file).map(e=>({source_id:e.source_id,page:e.page,exact_normalized_text_present:normalize(result.pages.find(p=>p.page===e.page)?.text||'').includes(normalize(e.text))}));
  report.measurements.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),status:'completed',elapsed_ms:Math.round(performance.now()-start),pages:result.pages.map(p=>({page:p.page,method:p.method,characters:p.text.length})),element_literal_coverage:coverage,matched_elements:coverage.filter(e=>e.exact_normalized_text_present).length,total_elements:coverage.length});
 }catch(error){report.measurements.push({file,status:'failed',elapsed_ms:Math.round(performance.now()-start),error:error.message});await fs.writeFile(path.join(outputDir,`${name}.raw.json`),JSON.stringify({error:error.message})+'\n');}
}
await fs.writeFile(path.join(outputDir,'baseline-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
