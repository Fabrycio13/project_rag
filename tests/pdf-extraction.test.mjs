import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { extractPdf } from '../src/lib/pdf-extraction.mjs';
async function fixture(scan=false,mixed=false) {
 const pdf=await PDFDocument.create();
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 if(!scan||mixed) pdf.addPage([600,300]).drawText('PRIVATE TEXT PAGE ALPHA 12345',{x:30,y:200,size:22,font});
 if(scan){const canvas=createCanvas(1200,600);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,600);ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('SCANNED PAGE BRAVO 67890',60,220);const image=await pdf.embedPng(canvas.toBuffer('image/png'));pdf.addPage([600,300]).drawImage(image,{x:0,y:0,width:600,height:300});}
 return Buffer.from(await pdf.save());
}
test('extracts native text without OCR',async()=>{const result=await extractPdf(await fixture());assert.equal(result.pages[0].method,'text');assert.match(result.pages[0].text,/PRIVATE TEXT PAGE ALPHA 12345/);console.log('native:',JSON.stringify(result));});
test('OCR runs only on scanned page of a mixed PDF',async()=>{const result=await extractPdf(await fixture(true,true));assert.equal(result.pages[0].method,'text');assert.equal(result.pages[1].method,'ocr');assert.match(result.pages[1].text,/SCANNED PAGE BRAVO 67890/);console.log('mixed:',JSON.stringify(result));});
test('scanned-only PDF uses real OCR',async()=>{const result=await extractPdf(await fixture(true));assert.equal(result.pages[0].method,'ocr');assert.match(result.pages[0].text,/SCANNED PAGE BRAVO 67890/);console.log('scan:',JSON.stringify(result));});
test('corrupted PDF fails, not empty success',async()=>{await assert.rejects(extractPdf(Buffer.from('%PDF-1.7 broken document')),/invalid_or_encrypted_pdf/);});
test('blank page fails after OCR, not empty success',async()=>{const pdf=await PDFDocument.create();pdf.addPage([300,300]);await assert.rejects(extractPdf(Buffer.from(await pdf.save())),/no_useful_text/);});
test('page count is capped',async()=>{const pdf=await PDFDocument.create();for(let i=0;i<31;i++)pdf.addPage([10,10]);await assert.rejects(extractPdf(Buffer.from(await pdf.save())),/page_limit/);});
test('large raster dimensions are rejected before OCR',async()=>{const pdf=await PDFDocument.create();pdf.addPage([4000,4000]);await assert.rejects(extractPdf(Buffer.from(await pdf.save())),/page_dimensions/);});
test('timeout terminates local child',async()=>{await assert.rejects(extractPdf(await fixture(true),{timeout:1}),/processing_timeout/);});
test('password-protected PDF fails without asking for a password',async()=>{await assert.rejects(extractPdf(await readFile(new URL('./fixtures/encrypted.pdf',import.meta.url))),/invalid_or_encrypted_pdf/);});
export {fixture};
