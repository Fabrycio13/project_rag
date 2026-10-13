import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPdf} from '../src/lib/pdf-extraction.mjs';
import {PDFDocument} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
test('different synthetic scanned ruled grid retains cells without fixture-specific vocabulary',async()=>{
 const canvas=createCanvas(1000,600),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,600);ctx.strokeStyle='black';ctx.lineWidth=2;
 for(const y of [100,160,220]){ctx.beginPath();ctx.moveTo(50,y);ctx.lineTo(950,y);ctx.stroke();}
 for(const x of [50,350,650,950]){ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x,220);ctx.stroke();}
 ctx.fillStyle='black';ctx.font='24px Arial';
 for(const [y,values] of [[140,['Produto','Quantidade','Valor']],[200,['Premium','73 unidades','R$ 345,67']]])values.forEach((value,i)=>ctx.fillText(value,60+i*300,y));
 const pdf=await PDFDocument.create(),page=pdf.addPage([500,300]);page.drawImage(await pdf.embedPng(canvas.toBuffer('image/png')),{x:0,y:0,width:500,height:300});
 const result=await extractPdf(Buffer.from(await pdf.save()));
 const cells=result.pages[0].ocrTableCells;
 for(const value of ['Premium','73 unidades','R$ 345,67'])assert.ok(cells.some(c=>c.text===value&&c.page===1),value);
});
test('scanned page 3 preserves the Extra row with page and OCR provenance',async()=>{
 const {pages}=await extractPdf(await readFile('docs/fixtures/rag/dificil.pdf'));
 const page=pages.find(p=>p.page===3);
 for(const value of ['40 unidades','4 horas uteis','R$ 200,00'])assert.ok(page.ocrText.includes(value),`page 3 OCR missing ${value}`);
 const cells=page.ocrTableCells;assert.ok(cells.some(c=>c.text==='Extra'));
 for(const value of ['40 unidades','4 horas uteis','R$ 200,00'])assert.ok(cells.some(c=>c.text===value&&c.page===3&&c.bbox.width>0));
});
