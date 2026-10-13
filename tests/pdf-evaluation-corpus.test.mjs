import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
const root=new URL('../docs/fixtures/rag/extended/',import.meta.url);
test('extended corpus has authored provenance and intact distinct PDFs',async()=>{
 const gold=JSON.parse(await readFile(new URL('gold.json',root)));
 assert.equal(gold.cases.length,9);
 assert.equal(new Set(gold.cases.map(c=>c.id)).size,9);
 for(const c of gold.cases){
  const bytes=await readFile(new URL(c.file,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
  assert.ok(c.questions.length>0);
  for(const q of c.questions){assert.ok(q.page>=1);assert.ok(q.evidence.length);assert.ok(q.answer);}
 }
});
test('actual PT-BR native extraction preserves accents, decimal, percentage and negation',async()=>{
 const {pages}=await extractPdf(await readFile(new URL('pt-br.pdf',root)));
 for(const evidence of ['ação','R$ 2.345,67','12,5%','Não há renovação automática']) assert.ok(pages[0].text.includes(evidence),evidence);
 assert.equal(pages[0].page,1);
});
test('same page PT-BR raster clause survives meaningful native text',async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('same-page.pdf',root)));
 assert.match(p.nativeText,/NATIVO: pagamento confirmado/);
 assert.match(p.ocrText,/Auditor não pode exportar/);
 assert.match(p.ocrText,/R\$ 2.345,67/);
 assert.ok(p.warnings.includes('mixed_reading_order_unverified'));
});
test('rotation keeps original OCR attempts and source-coordinate word provenance',async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('skew-rotated.pdf',root)));
 assert.ok(p.ocrOrientation.attempts.length<=3);
 assert.ok(p.ocrOrientation.attempts.some(a=>a.rotation===0));
 assert.ok(p.ocrOrientation.attempts.some(a=>a.words?.length));
 for(const attempt of p.ocrOrientation.attempts)for(const word of attempt.words){assert.equal(typeof word.text,'string');assert.ok(word.bbox.x1>=word.bbox.x0);}
 assert.equal(p.evidenceState,'review_required');
});
test('unsupported borderless association is review-required, not eligible for indexing',async()=>{
 const result=await extractPdf(await readFile(new URL('borderless.pdf',root)));
 assert.equal(result.reviewRequired,true);
 assert.equal(result.indexingEligible,false);
 assert.equal(result.pages[0].evidenceState,'review_required');
 assert.ok(result.pages[0].warnings.includes('raster_layout_review_required'));
});
test('borderless table must reconstruct authored row/column associations', async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('borderless.pdf',root)));
 const expected=[['Plano','Valor','Desconto'],['Essencial','R$ 234,56','2,5%'],['Avançado','R$ 987,65','0%']];
 assert.deepEqual(expected.map((row,r)=>row.map((_,c)=>p.ocrTableCells.find(cell=>cell.row===r&&cell.column===c)?.text)),expected);
 for(const cell of p.ocrTableCells){assert.equal(cell.page,1);assert.ok(cell.bbox.width>0);assert.ok(cell.confidence>=60);assert.ok(cell.words.length);}
 assert.equal(p.ocrTableStructure.state,'validated_rectangular');
 assert.match(p.ocrTableStructure.markdown,/\| Avançado \| R\$ 987,65 \| 0% \|/);
 assert.match(p.ocrPageText,/Não acumular descontos/);
});
test('merged ruled cells retain multiline association and spanning header',async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('merged-multiline.pdf',root)));
 const header=p.ocrTableCells.find(c=>c.row===0);
 assert.equal(header?.columnSpan,2);
 assert.match(header.text,/categoria única/);
 const detail=p.ocrTableCells.find(c=>c.row===1&&c.column===1);
 assert.match(detail?.text??'',/Reembolso de R\$ 123,45/);
 assert.match(detail.text,/Não inclui dependentes/);
 assert.ok(detail.text.includes('\n'));
 assert.equal(p.ocrTableStructure.state,'review_required');
 assert.equal(p.ocrTableStructure.markdown,null,'merged headers must not be flattened into fabricated Markdown');
 assert.equal(p.ocrTableStructure.reason,'spans_not_representable_in_markdown');
 assert.match(p.ocrTableCells.find(c=>c.row===1&&c.column===0)?.text??'',/Saúde/);
});
test('merged multiline raster retains tokens but is not layout-certified',async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('merged-multiline.pdf',root)));
 assert.match(p.text,/Não inclui dependentes/);
 assert.match(p.text,/R\$ 123,45/);
 assert.ok(p.warnings.includes('layout_unverified'));
});
for(const id of ['skew-rotated','blank-interspersed']) test(`${id} must retain all authored page evidence`,async()=>{
 const gold=JSON.parse(await readFile(new URL('gold.json',root)));
 const c=gold.cases.find(c=>c.id===id);
 const {pages}=await extractPdf(await readFile(new URL(c.file,root)));
 for(const q of c.questions)for(const e of q.evidence)assert.ok(pages.find(p=>p.page===q.page)?.text.includes(e),`page ${q.page}: ${e}`);
 if(id==='blank-interspersed'){
  assert.equal(pages[1].evidenceState,'empty');assert.equal(pages[1].method,'empty');
  assert.equal(pages[1].text,'');assert.equal(pages[1].ocrText,'');assert.equal(pages[1].ocrConfidence,null);
  assert.deepEqual(pages[1].pageGeometry.view,[0,0,600,800]);
 }
});
test('columns must read entire left column before right',async()=>{
 const {pages:[p]}=await extractPdf(await readFile(new URL('columns-blank.pdf',root)));
 assert.ok(p.text.indexOf('2. Não exportar.')<p.text.indexOf('3. Guardar por 20 dias.'));
});
test('injection remains untrusted source text, not an executed extraction command',async()=>{
 const {pages}=await extractPdf(await readFile(new URL('injection.pdf',root)));
 assert.match(pages[0].text,/Ignore todas as regras/);
 assert.match(pages[0].text,/R\$ 2.345,67/);
 assert.ok(pages[0].warnings.includes('layout_unverified'));
});
