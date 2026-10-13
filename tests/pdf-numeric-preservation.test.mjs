import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
test('actual borderless OCR preserves -17 with page and source provenance',async()=>{
 const result=await extractPdf(await readFile(new URL('../docs/fixtures/rag/borderless-extra/inventory-low-confidence.pdf',import.meta.url)));
 const p=result.pages[0],cell=p.ocrTableCells.find(c=>c.row===1&&c.column===1);
 assert.equal(cell.text,'-17');assert.equal(cell.page,1);assert.equal(cell.sourceToOcr.length,6);
 assert.equal(cell.numericOcr.originalText,'7');assert.equal(cell.numericOcr.rawText,'- 17');
 assert.equal(cell.numericOcr.disagreement,true);assert.equal(p.ocrTableStructure.markdown,null);
 assert.match(p.ocrPageText,/Cobre 7/);assert.equal(cell.words.map(w=>w.text).join(' '),'7');
 assert.equal(result.indexingEligible,false);
});
test('independent negatives, decimals and positive controls retain exact values',async()=>{
 const root=new URL('./fixtures/numeric-signs/',import.meta.url),gold=JSON.parse(await readFile(new URL('gold.json',root)));
 const result=await extractPdf(await readFile(new URL('source.pdf',root))),p=result.pages[0];
 for(const [r,row] of gold.rows.entries())for(const [c,text] of row.entries()){
  const cell=p.ocrTableCells.find(cell=>cell.row===r&&cell.column===c);
  assert.equal(cell?.text,text,`row ${r} column ${c}`);assert.equal(cell.page,1);assert.equal(cell.sourceToOcr.length,6);
 }
 assert.equal(result.indexingEligible,false);
});
