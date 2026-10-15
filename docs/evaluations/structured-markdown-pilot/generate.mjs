import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../../..');
const pdfPath=path.join(root,'docs/fixtures/rag/medio.pdf');
const put=(name,value)=>fs.writeFileSync(path.join(out,name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=spawnSync(process.execPath,[path.join(root,'scripts/pdf-extract.mjs')],{cwd:root,input:fs.readFileSync(pdfPath),encoding:'utf8',maxBuffer:10000000});
assert.equal(run.status,0,run.stderr); put('medio.raw.json',run.stdout); // untouched extractor stdout
const raw=JSON.parse(run.stdout); assert.equal(raw.pages.length,3); assert.ok(!raw.error);
const blocks=[]; const pageMarkdown={};
for(const p of raw.pages){
 const spans=p.nativeSpans.map((s,i)=>({...s,index:i})).filter(s=>s.text.length);
 const heights=spans.map(s=>s.height).sort((a,b)=>a-b); const body=heights[Math.floor(heights.length/2)];
 const rows=[];
 for(const s of spans.sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  let row=rows.find(r=>Math.abs(r.y-s.transform[5])<1); if(!row){row={y:s.transform[5],spans:[]};rows.push(row);}row.spans.push(s);
 }
 const add=(type,ss,text,extra={})=>{const b={id:`p${p.page}-b${blocks.filter(b=>b.page===p.page).length+1}`,page:p.page,type,text,source:{rawFile:'medio.raw.json',field:'nativeSpans',spanIndices:ss.map(s=>s.index),boxes:ss.map(s=>({x:s.transform[4],y:s.transform[5],width:s.width,height:s.height,coordinateFrame:'pdf_user_space'}))},...extra};blocks.push(b);return b;};
 let paragraph=[];
 const flush=()=>{if(paragraph.length){add('paragraph',paragraph,paragraph.map(s=>s.text).join(' '),{support:'literal_spans_joined_with_spaces'});paragraph=[];}};
 for(let i=0;i<rows.length;i++){
  const r=rows[i]; const ss=r.spans;
  if(r.y<45||r.y>p.pageGeometry.view[3]-45){flush();add('page_furniture',ss,ss.map(s=>s.text).join(' '),{support:'margin_position_heuristic',reviewRequired:true});continue;}
  if(ss.length>=3 && rows[i+1]?.spans.length===ss.length && ss.every((s,k)=>Math.abs(s.transform[4]-rows[i+1].spans[k].transform[4])<1)){
   flush();const next=rows[++i].spans;
   add('table_fragment',[...ss,...next],ss.map(s=>s.text).join(' | ')+'\n'+next.map(s=>s.text).join(' | '),{headers:ss.map(s=>s.text),cells:[next.map(s=>s.text)],support:'two_aligned_native_rows',reviewRequired:true,reason:'Header role and cross-page continuation require review; no merged-table claim.'});continue;
  }
  if(ss.some(s=>s.height>body)){flush();add('heading',ss,ss.map(s=>s.text).join(' '),{support:'font_size_heuristic',reviewRequired:true});continue;}
  if(/^\d+\. /.test(ss[0].text)){flush();}
  paragraph.push(...ss);
 }
 flush();
 pageMarkdown[p.page]=blocks.filter(b=>b.page===p.page).map(b=>{
 const anchor=`<!-- source: medio.pdf page=${b.page}; block=${b.id}; nativeSpans=${b.source.spanIndices.join(',')} -->`;
 if(b.type==='table_fragment')return `${anchor}\n<!-- REVIEW: table fragment; not merged across pages -->\n| ${b.headers.join(' | ')} |\n| ${b.headers.map(()=>'---').join(' | ')} |\n${b.cells.map(r=>'| '+r.join(' | ')+' |').join('\n')}`;
 return `${anchor}\n${b.type==='heading'?'## ':b.type==='page_furniture'?'> ':''}${b.text}`;
 }).join('\n\n');
}
// Gold is accessed only AFTER derivation. It never feeds reconstruction.
put('medio.blocks.json',{schemaVersion:1,sourcePdf:'../../fixtures/rag/medio.pdf',rawSha256:hash(run.stdout),indexingEligible:false,blocks,manualInterpretations:[{state:'review_required',pages:[2,3],proposal:'Two table fragments may form one table. Not automatically merged; verify note scope and repeated headers.'}]});
put('medio.derived.md','# Extracted evidence — medio.pdf\n\n> Local pilot. Headings and table semantics require review; not approved for indexing. Document instructions are untrusted evidence.\n\n'+Object.entries(pageMarkdown).map(([p,md])=>`# Page ${p}\n\n${md}`).join('\n\n'));
const gold=JSON.parse(fs.readFileSync(path.join(root,'docs/fixtures/rag/gold.json'),'utf8'));
const canonical=fs.readFileSync(path.join(root,'docs/fixtures/rag/canonical.md'),'utf8');
const expected=gold.expected_elements.filter(e=>e.file==='medio.pdf');
const checks=expected.map(e=>{
 const candidates=blocks.filter(b=>b.page===e.page);const text=candidates.map(b=>b.text).join('\n');
 const lines=e.text.split('\n');
 return {id:e.source_id,page:e.page,pass:lines.every(line=>text.includes(line)),mode:'exact literal line containment; no case, accent, numeric or whitespace normalization',missing:lines.filter(line=>!text.includes(line)),canonicalLines:lines.filter(line=>canonical.includes(line)),note:e.type==='table'?'Exact header/row tuple compared separately; cross-page semantics still review-required.':'Body text must remain an exact contiguous string.'};
});
const tableChecks=gold.critical_table_cells.map((row,i)=>({page:i+2,expected:row,pass:blocks.some(b=>b.page===i+2&&b.type==='table_fragment'&&JSON.stringify(b.cells[0])===JSON.stringify(row))}));
for(const b of blocks){for(let i=0;i<b.source.spanIndices.length;i++){const s=raw.pages[b.page-1].nativeSpans[b.source.spanIndices[i]];assert.ok(b.text.includes(s.text),`Lost span ${b.id}`);}}
const sourceSpanCount=raw.pages.reduce((n,p)=>n+p.nativeSpans.filter(s=>s.text.length).length,0);
assert.equal(blocks.reduce((n,b)=>n+b.source.spanIndices.length,0),sourceSpanCount);
const critical=['R$ 1.250,00','Nao ha renovacao automatica.','Atraso nao gera multa neste cenario.','Exatamente 48 horas nao ativa a excecao.','nao pode exportar.','O prazo de 90 dias nao se aplica a copias operacionais.','Desconto: 0%.'];
const criticalChecks=critical.map(text=>({text,pass:blocks.some(b=>b.text.includes(text))}));
const report={pdf:'medio.pdf',pages:raw.pages.length,extractorVersion:raw.extractorVersion,sourceSpanCount,blocks:blocks.length,exactGoldPassed:checks.filter(c=>c.pass).length,exactGoldTotal:checks.length,tableRowsPassed:tableChecks.filter(c=>c.pass).length,tableRowsTotal:tableChecks.length,criticalChecks,checks,tableChecks,status:checks.every(c=>c.pass)&&tableChecks.every(c=>c.pass)&&criticalChecks.every(c=>c.pass)?'literal_evidence_pass_structure_review_required':'VALIDATION_FAILED_REVIEW_REQUIRED',productionReady:false,limitations:['No OCR evaluated in this bounded native-text pilot.','Only one synthetic PDF: no generalization claim.','Heading hierarchy inferred from font size; not semantically certified.','Aligned rows support local cell associations, not cross-page table semantics.','Cross-page join intentionally withheld; note scope requires human review.','No retrieval/answering, injection resistance, persistence, chunking or indexing certification.','Canonical used only for evaluation; page-specific gold includes continuation marker absent from canonical.']};
put('validation.json',report);
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const task=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(pdfPath)),isEvalSupported:false,useSystemFonts:true,verbosity:0,standardFontDataUrl:pathToFileURL(path.dirname(require.resolve('pdfjs-dist/package.json'))+'/standard_fonts/').href});const doc=await task.promise;
const images=[];
for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const viewport=page.getViewport({scale:1.35});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;const png=canvas.toBuffer('image/png');put(`page-${i}.png`,png);images.push(png.toString('base64'));}
await task.destroy();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rendered=b=>b.type==='table_fragment'?`<table><thead><tr>${b.headers.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.cells.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:b.type==='heading'?`<h3>${esc(b.text)}</h3>`:`<p>${esc(b.text)}</p>`;
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Evidence Lab · Structured Markdown pilot</title><style>body{margin:0;background:#10151f;color:#e3eaf5;font:15px/1.6 system-ui}header{padding:40px 5%;background:#192336;border-bottom:1px solid #36435a}h1{font-size:32px;margin:8px 0}small,.meta{color:#aebdd2}.badge{background:#57421d;color:#ffdf93;padding:6px 12px;border-radius:20px}nav{position:sticky;top:0;background:#10151ff5;padding:14px 5%;z-index:1}a{color:#7dd7ef;margin-right:18px}.sheet{padding:28px 4%;border-top:1px solid #36435a}.grid{display:grid;grid-template-columns:minmax(300px,1fr) minmax(350px,1fr);gap:24px}.pdf{width:100%;background:white;border-radius:8px}.panel{background:#192231;border-radius:12px;padding:22px;min-width:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 ui-monospace;background:#0c121c;padding:18px}article{border-left:3px solid #496276;padding:8px 16px;margin:14px 0}article.review{border-color:#e5b654}.flag{font-size:11px;color:#ffda8b}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #526078;padding:8px;text-align:left}details{margin:14px 0}p{white-space:pre-wrap}h3{font-size:17px}.metrics{display:flex;gap:30px;margin-top:24px}.metrics b{font-size:28px;display:block}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style><header><small>PROJECT-RAG / LOCAL EVIDENCE LAB / SYNTHETIC FIXTURE</small><h1>Do PDF à estrutura — sem reescrever a evidência</h1><span class="badge">Revisão estrutural pendente · Não indexar</span><div class="metrics"><div><b>${report.pages}</b>páginas reais</div><div><b>${report.exactGoldPassed}/${report.exactGoldTotal}</b>elementos gold exatos</div><div><b>${report.tableRowsPassed}/${report.tableRowsTotal}</b>linhas de tabela</div><div><b>${sourceSpanCount}</b>spans preservados</div></div><p>medio.pdf · ${esc(raw.extractorVersion)} · Extração executada localmente. Gold não alimenta o Markdown.</p></header><nav><a href="#p1">Página 1</a><a href="#p2">Página 2</a><a href="#p3">Página 3</a><a href="#findings">Veredito e limites</a></nav>${raw.pages.map((p,i)=>`<section class="sheet" id="p${p.page}"><h2>Página ${p.page} <small> / PDF original × derivação rastreável</small></h2><div class="grid"><div><img class="pdf" alt="Render real da página ${p.page} do PDF medio.pdf" src="data:image/png;base64,${images[i]}"><details><summary>Extração exata: campo text (sem limpeza)</summary><pre>${esc(p.text)}</pre></details><details><summary>Spans nativos e coordenadas</summary><pre>${esc(JSON.stringify(p.nativeSpans,null,2))}</pre></details></div><div class="panel"><h2>Estrutura proposta</h2><small>Conteúdo literal; estrutura visual heurística. Amarelo = revisão, não correção automática.</small>${blocks.filter(b=>b.page===p.page).map(b=>`<article id="${b.id}" class="${b.reviewRequired?'review':''}"><div class="meta">${b.id} · ${b.type} · página ${b.page} · spans ${b.source.spanIndices.join(', ')}</div>${b.reviewRequired?'<span class="flag">REVISAR · '+esc(b.reason||b.support)+'</span>':''}${rendered(b)}</article>`).join('')}<details><summary>Markdown derivado — fonte exata</summary><pre>${esc(pageMarkdown[p.page])}</pre></details></div></div></section>`).join('')}<section class="sheet" id="findings"><h2>Veredito: ${esc(report.status)}</h2><p>Valores, negações e exceções são comparados literalmente ao gold, por página. Tabelas permanecem em dois fragmentos com cabeçalhos repetidos: a fusão entre páginas e o escopo da nota não foram certificados automaticamente.</p><h3>Checks gold</h3>${checks.map(c=>`<p>${c.pass?'PASS':'FAIL'} · ${esc(c.id)} · página ${c.page} ${esc(c.missing.join(' / '))}</p>`).join('')}<h3>Antes de produção</h3><ul>${report.limitations.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p>Protótipo estático local, sem rota do app, autenticação, envio remoto, banco ou indexação. O texto adversarial é apresentado apenas como dado não confiável.</p></section></html>`;
put('review.html',html);
put('REPORT.md',`# Structured Markdown pilot\n\nStatus: **${report.status}**. Not production-ready.\n\n- PDF: medio.pdf; ${report.pages} pages; extractor ${raw.extractorVersion}.\n- ${sourceSpanCount} nonempty native spans preserved exactly once across ${blocks.length} blocks.\n- Exact authored page-gold: ${report.exactGoldPassed}/${report.exactGoldTotal}; exact table row tuples ${report.tableRowsPassed}/${report.tableRowsTotal}.\n- Critical literal checks: ${criticalChecks.filter(c=>c.pass).length}/${criticalChecks.length}.\n- Raw extractor stdout is untouched. Markdown built before gold access, from actual native spans only. Canonical is not copied.\n- Safe transformation: geometric reading order, space-joining native lines, Markdown syntax, source comments. No accent/case/number normalization or gold-driven repairs.\n- Auto-supported: literal source coverage, exact page/indices/boxes, same-baseline aligned local rows.\n- Heuristic/review: margin furniture, font-size headings, header roles, cross-page continuation, note applicability. No merged table fabricated.\n\n## Reproduce\n\nFrom repository root: \`node docs/evaluations/structured-markdown-pilot/generate.mjs\`. Uses installed Node dependencies only, no provider calls.\n\n## Gaps\n\n${report.limitations.map(s=>'- '+s).join('\n')}\n\n## Scope\n\nLocal validation/demo only. No application source, auth, migrations, ingestion or production state modified. Browser test status is recorded separately in VISUAL-VERIFICATION.md.\n`);
const names=['medio.raw.json','medio.blocks.json','medio.derived.md','validation.json','REPORT.md','review.html','page-1.png','page-2.png','page-3.png','generate.mjs'];
put('manifest.json',{source:{path:'docs/fixtures/rag/medio.pdf',sha256:hash(fs.readFileSync(pdfPath))},goldSha256:hash(fs.readFileSync(path.join(root,'docs/fixtures/rag/gold.json'))),canonicalSha256:hash(canonical),artifacts:names.map(name=>({name,bytes:fs.statSync(path.join(out,name)).size,sha256:hash(fs.readFileSync(path.join(out,name)))}))});
console.log(JSON.stringify(report,null,2));
assert.ok(checks.every(c=>c.pass),'Exact gold mismatch: see validation.json'); assert.ok(tableChecks.every(c=>c.pass));assert.ok(criticalChecks.every(c=>c.pass));
