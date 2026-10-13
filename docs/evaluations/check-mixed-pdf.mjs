// Local evidence checks; ordered substrings are not a table reconstruction metric.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../fixtures/rag/',import.meta.url);
const gold=JSON.parse(await fs.readFile(new URL('gold.json',root)));
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root)));
const normalize=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const checks=[];
for(const fixture of manifest.fixtures){
 const bytes=await fs.readFile(new URL(fixture.file,root));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
 const name=fixture.file.replace('.pdf','');
 const before=JSON.parse(await fs.readFile(new URL(`mixed-pdf-before/${name}.raw.json`,import.meta.url)));
 const after=JSON.parse(await fs.readFile(new URL(`mixed-pdf-after/${name}.raw.json`,import.meta.url)));
 const headings=gold.expected_elements.filter(e=>e.file===fixture.file).map(e=>{
  const text=normalize(after.pages[e.page-1].text);
  return {page:e.page,id:e.source_id,heading_offset:text.indexOf(`[${e.source_id}]`)};
 });
 const tables=gold.expected_elements.filter(e=>e.file===fixture.file&&e.type==='table').map(e=>{
  const text=normalize(after.pages[e.page-1].text);
  const rows=gold.critical_table_cells.filter(row=>e.text.includes(row[0])).map(cells=>{
   const offsets=cells.map(cell=>text.indexOf(cell));
   return {cells,offsets,present_in_order:offsets.every((offset,i)=>offset>=0&&(i===0||offset>offsets[i-1]))};
  });
  return {page:e.page,id:e.source_id,rows};
 });
 for(const page of before.pages)if(page.method==='text')assert.equal(after.pages[page.page-1].nativeText,page.text);
 checks.push({file:fixture.file,hash_verified:true,native_unchanged:true,headings,tables});
}
const hard=JSON.parse(await fs.readFile(new URL('mixed-pdf-after/dificil.raw.json',import.meta.url)));
assert.equal((hard.pages[3].text.match(/pagina 4/g)||[]).length,1);
assert.equal(hard.pages[3].ocrText.includes('pagina 4'),false);
console.log(JSON.stringify(checks,null,2));
