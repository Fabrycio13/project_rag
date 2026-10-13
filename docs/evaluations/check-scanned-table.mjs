import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const before=await read('docs/evaluations/mixed-pdf-after/dificil.raw.json');
const after=await read('docs/evaluations/scanned-table-after/dificil.raw.json');
for(let i=0;i<4;i++){assert.equal(after.pages[i].nativeText,before.pages[i].nativeText);if(i!==2)assert.equal(after.pages[i].text,before.pages[i].text);}
assert.equal(after.pages[2].ocrPageText,before.pages[2].ocrText);
const cells=after.pages[2].ocrTableCells;
for(const value of ['Extra','40 unidades','4 horas uteis','R$ 200,00'])assert.ok(cells.some(c=>c.text===value&&c.page===3));
const paths=['docs/fixtures/rag/facil.pdf','docs/fixtures/rag/medio.pdf','docs/fixtures/rag/dificil.pdf','docs/fixtures/rag/canonical.md','docs/fixtures/rag/gold.json','docs/fixtures/rag/manifest.json','docs/evaluations/mixed-pdf-after/dificil.raw.json','docs/evaluations/scanned-table-after/dificil.raw.json','docs/evaluations/scanned-table-probes-original.json','docs/evaluations/scanned-table-probes-threshold160.json','docs/evaluations/scanned-table-probes.json'];
const hashes=[];for(const path of paths)hashes.push({path,sha256:crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex')});
const report={native_text_unchanged:true,other_pages_text_unchanged:true,page_ocr_raw_unchanged:true,before_characters:before.pages[2].text.length,after_characters:after.pages[2].text.length,cells,hashes};
await fs.writeFile('docs/evaluations/scanned-table-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
