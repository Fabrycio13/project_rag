import {PDFDocument} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
import {mkdir,writeFile} from 'node:fs/promises';
const root=new URL('./numeric-signs/',import.meta.url);await mkdir(root,{recursive:true});
// Independent source values, never consumed by extraction.
const rows=[['Material','Quantidade','Variação'],['Níquel','-3','-0,75'],['Ferro','-17','-12,5'],['Estanho','-125','-125,25'],['Bronze','3','0,75'],['Alumínio','17','12,5'],['Titânio','125','125,25']];
const canvas=createCanvas(1200,1000),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,1000);ctx.fillStyle='black';ctx.font='30px Arial';ctx.fillText('FICTÍCIO — sinais numéricos independentes',45,70);
rows.forEach((row,r)=>row.forEach((text,c)=>ctx.fillText(text,[45,460,850][c],210+r*100)));
const png=canvas.toBuffer('image/png');await writeFile(new URL('source.png',root),png);
const pdf=await PDFDocument.create();pdf.setCreationDate(new Date('2026-10-13T00:00:00Z'));pdf.setModificationDate(new Date('2026-10-13T00:00:00Z'));const image=await pdf.embedPng(png);pdf.addPage([600,500]).drawImage(image,{x:0,y:0,width:600,height:500});await writeFile(new URL('source.pdf',root),await pdf.save());await writeFile(new URL('gold.json',root),JSON.stringify({synthetic:true,rows},null,2)+'\n');
