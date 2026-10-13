import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
import {rotateRaster} from '../scripts/ocr-orientation.mjs';
test('coordinate ordering is independent of strings and reversed PDF painting',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([640,800]);
 const left=['Grupo Z: 91','Prazo: 17 dias','Sem prorrogar'],right=['Grupo K: 42','Prazo: 33 dias','Encerrar registro'];
 for(let row=2;row>=0;row--){page.drawText(right[row],{x:340,y:650-row*40,font,size:14});page.drawText(left[row],{x:40,y:650-row*40,font,size:14});}
 page.drawText('Registro de teste independente',{x:30,y:760,font,size:18});
 const {pages:[p]}=await extractPdf(await pdf.save());
 const order=[...left,...right].map(text=>p.text.indexOf(text));
 assert.ok(order.every((n,i)=>n>=0&&(i===0||n>order[i-1])));
 assert.ok(p.nativeRawText.indexOf(right[2])<p.nativeRawText.indexOf(left[0]));
 assert.equal(p.nativeSpans.filter(s=>s.text.trim()).length,7);
 assert.ok(p.nativeSpans.every(s=>s.transform.length===6));
});
test('physical quarter-turns and upside-down rasters preserve evidence without PDF rotation metadata',async()=>{
 const original=createCanvas(1000,500),ctx=original.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,500);ctx.fillStyle='black';ctx.font='36px Arial';
 ctx.fillText('Registro independente: taxa de 8,25%.',40,100);ctx.fillText('Não renovar após 27 dias.',40,200);
 for(const degrees of [90,180,270]){
  const raster=rotateRaster(original,degrees).canvas,pdf=await PDFDocument.create(),image=await pdf.embedPng(raster.toBuffer('image/png'));
  pdf.addPage([raster.width/2,raster.height/2]).drawImage(image,{x:0,y:0,width:raster.width/2,height:raster.height/2});
  const result=await extractPdf(await pdf.save()),p=result.pages[0];
  assert.match(p.text,/8,25%/,String(degrees));assert.match(p.text,/Não renovar após 27 dias/,String(degrees));
  assert.ok(p.ocrOrientation.attempts.length<=3);assert.equal(result.indexingEligible,false);
 }
});
test('nonblank unreadable page remains review-required alongside usable evidence',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 pdf.addPage([300,300]).drawText('Registro preservado: 147 dias',{x:10,y:220,font,size:14});
 pdf.addPage([300,300]).drawRectangle({x:40,y:40,width:180,height:180,color:rgb(0,0,0)});
 const result=await extractPdf(await pdf.save());
 assert.equal(result.pages.length,2);assert.equal(result.pages[1].evidenceState,'review_required');
 assert.ok(result.pages[1].warnings.includes('raster_text_unverified'));assert.equal(result.indexingEligible,false);
 assert.match(result.pages[0].text,/147 dias/);
});
