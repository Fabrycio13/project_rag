import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
async function mixedPage(body=false) {
 const pdf=await PDFDocument.create(); const font=await pdf.embedFont(StandardFonts.Helvetica);
 const page=pdf.addPage([600,600]);
 page.drawText(body?'NATIVE CONTRACT PAYMENT 12345':'NATIVE HEADER DOCUMENT 12345',{x:30,y:550,size:18,font});
 page.drawText('NATIVE FOOTER PAGE 1',{x:30,y:30,size:16,font});
 const canvas=createCanvas(1100,500); const ctx=canvas.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,1100,500);ctx.fillStyle='black';ctx.font='40px Arial';
 ctx.fillText('RASTER CLAUSE CANCEL AFTER 48 HOURS',25,180);
 const image=await pdf.embedPng(canvas.toBuffer('image/png'));
 page.drawImage(image,{x:25,y:180,width:550,height:250});
 return Buffer.from(await pdf.save());
}
for(const body of [false,true]) test(`same-page raster evidence survives native ${body?'meaningful body':'furniture'}`,async()=>{
 const {pages:[page]}=await extractPdf(await mixedPage(body));
 assert.match(page.text,/RASTER CLAUSE CANCEL AFTER 48 HOURS/);
 assert.match(page.text,/NATIVE FOOTER PAGE 1/);
 assert.equal(page.text.match(/NATIVE FOOTER PAGE 1/g).length,1);
 assert.match(page.nativeText,/NATIVE/); assert.match(page.ocrText,/RASTER/);
 assert.doesNotMatch(page.ocrText,/NATIVE/);
 assert.ok(page.warnings.includes('mixed_reading_order_unverified'));
});
test('real hard fixture retains C7 and T1 on mixed page',async()=>{
 const {pages}=await extractPdf(await readFile(new URL('../docs/fixtures/rag/dificil.pdf',import.meta.url)));
 assert.match(pages[3].text,/Desconto: 0%/);
 assert.match(pages[3].text,/Nao\s+existe permissao de exportacao para auditor/);
 assert.match(pages[3].text,/9,99/);
});
