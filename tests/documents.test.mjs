import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const url = new URL('../src/lib/documents.ts', import.meta.url);
test('PDF validation rejects disguised, oversized, empty and unsafe filenames', async () => {
 assert.ok(existsSync(url), 'PDF validator missing');
 const { validatePdf, DOCUMENT_MAX_BYTES } = await import(url);
 const pdf = new File(['%PDF-1.7\n%%EOF'], 'guia.pdf', {type:'application/pdf'});
 assert.equal((await validatePdf(pdf)).name, 'guia.pdf');
 for (const file of [new File(['fake'],'a.pdf',{type:'application/pdf'}),new File(['%PDF-1.7'],'../a.pdf',{type:'application/pdf'}),new File(['%PDF-1.7'],'a.txt',{type:'application/pdf'}),new File(['%PDF-1.7'],'a.pdf',{type:'text/plain'}),new File([],'a.pdf',{type:'application/pdf'}),new File([new Uint8Array(DOCUMENT_MAX_BYTES+1)],'a.pdf',{type:'application/pdf'})]) assert.equal(await validatePdf(file),null);
});
