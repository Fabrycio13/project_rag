import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
import {borderlessTable} from '../scripts/ocr-borderless-table.mjs';
const root=new URL('../docs/fixtures/rag/borderless-extra/',import.meta.url);
test('independently authored inventory preserves every association and negations',async()=>{
 const gold=JSON.parse(await readFile(new URL('gold.json',root))).cases[0];
 const result=await extractPdf(await readFile(new URL('inventory.pdf',root))),p=result.pages[0];
 assert.equal(p.ocrTableStructure.state,'validated_rectangular');
 assert.equal(p.ocrTableCells.length,gold.rows.flat().length);
 for(const [r,row] of gold.rows.entries())for(const [c,text] of row.entries()){
  const cell=p.ocrTableCells.find(cell=>cell.row===r&&cell.column===c);
  assert.equal(cell?.text,text);assert.equal(cell.headerText,gold.rows[0][c]);assert.equal(cell.page,1);assert.equal(cell.sourceToOcr.length,6);
 }
 assert.equal(result.indexingEligible,false);
});
test('scanned two-column prose is not promoted to a table',async()=>{
 const result=await extractPdf(await readFile(new URL('prose-columns.pdf',root)));
 assert.equal(result.pages[0].ocrTableCells.length,0);assert.equal(result.pages[0].ocrTableStructure.markdown,null);assert.equal(result.indexingEligible,false);
});
test('negative sign OCR ambiguity is not promoted to validated Markdown',async()=>{
 const result=await extractPdf(await readFile(new URL('inventory-low-confidence.pdf',root)));
 const p=result.pages[0];assert.equal(p.ocrTableStructure.state,'review_required');assert.equal(p.ocrTableStructure.markdown,null);assert.equal(result.indexingEligible,false);
 assert.equal(p.ocrTableCells.find(c=>c.row===3&&c.column===1)?.text,'-3');
});
const words=rows=>rows.flatMap((row,r)=>row.map((text,c)=>({text,confidence:95,bbox:{x0:20+c*200,y0:20+r*60,x1:20+c*200+text.length*8,y1:40+r*60}})));
test('irregular partial row refuses Markdown while retaining evidence',()=>{
 const table=borderlessTable(words([['Item','Valor','Limite'],['A','-3','5%'],['B','7','0%'],['C','9']]),{page:1});
 assert.equal(table.structure.state,'review_required');assert.equal(table.structure.markdown,null);
});
test('literal pipes are escaped in validated rectangular Markdown',()=>{
 const table=borderlessTable(words([['Item','Valor','Limite'],['A|B','-3','5%'],['C','7','0%']]),{page:1});
 assert.match(table.structure.markdown,/A\\\|B/);
 assert.equal(table.cells.find(c=>c.row===1&&c.column===1).text,'-3');
});
test('three-column prose with numeric dates is not a table',()=>{
 assert.equal(borderlessTable(words([['Leia.','Guarde.','Exclua.'],['Prazo 3','Prazo 4','Prazo 5'],['Prazo 6','Prazo 7','Prazo 8']]),{page:1}),null);
});
test('low confidence cannot certify a rectangular table',()=>{
 const evidence=words([['Item','Valor','Limite'],['A','-3','5%'],['B','7','0%']]);evidence[4].confidence=20;
 const table=borderlessTable(evidence,{page:1});assert.equal(table.structure.state,'review_required');assert.equal(table.structure.markdown,null);assert.equal(table.cells[4].text,'-3');
});
