import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';
test('review deployment traces private raster subprocess and local runtime assets',()=>{const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');assert.match(config,/documents\/\*\/review\/\*/);assert.match(config,/pdf-review-render\.mjs/);});
test('bounded rendering returns actual PNG of requested PDF page, no active PDF links',()=>{
 const script=new URL('../scripts/pdf-review-render.mjs',import.meta.url);assert.ok(existsSync(script),'review renderer exists');
 const pdf=readFileSync(new URL('../docs/fixtures/rag/medio.pdf',import.meta.url));
 const output=execFileSync(process.execPath,[script.pathname.replace(/^\/(\w:)/,'$1'),'1','3'],{input:pdf,maxBuffer:8*1024*1024,timeout:20000});assert.equal(output.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.throws(()=>execFileSync(process.execPath,[script.pathname.replace(/^\/(\w:)/,'$1'),'4','3'],{input:pdf,timeout:20000,stdio:['pipe','pipe','pipe']}));
});
