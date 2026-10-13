import {PDFDocument} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);await mkdir(root,{recursive:true});
// Independently authored before extraction: four columns, three data rows.
const cases=[{id:'inventory',rows:[['Item','Saldo','Taxa','Restrição'],['Cobre','17','4,25%','Não vender'],['Prata','28','0%','Não exportar'],['Zinco','3','1,5%','Não acumular']],xs:[45,340,550,790]},
{id:'prose-columns',rows:[['Leia o contrato.','Guarde por 20 dias.'],['Não exporte dados.','Não elimine provas.'],['Peça autorização.','Registre a decisão.']],xs:[45,650]},
{id:'inventory-low-confidence',rows:[['Item','Saldo','Taxa','Restrição'],['Cobre','-17','4,25%','Não vender'],['Prata','28','0%','Não exportar'],['Zinco','-3','1,5%','Não acumular']],xs:[45,340,550,790]}];
for(const c of cases){const canvas=createCanvas(1200,900),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,900);ctx.fillStyle='black';ctx.font='30px Arial';ctx.fillText('FICTÍCIO — avaliação local',45,70);c.rows.forEach((row,r)=>row.forEach((text,col)=>ctx.fillText(text,c.xs[col],220+r*90)));const png=canvas.toBuffer('image/png');await writeFile(new URL(c.id+'.png',root),png);const pdf=await PDFDocument.create();pdf.setCreationDate(new Date('2026-10-13T00:00:00Z'));pdf.setModificationDate(new Date('2026-10-13T00:00:00Z'));const image=await pdf.embedPng(png);pdf.addPage([600,450]).drawImage(image,{x:0,y:0,width:600,height:450});const bytes=await pdf.save();await writeFile(new URL(c.id+'.pdf',root),bytes);c.sha256=createHash('sha256').update(bytes).digest('hex');}
await writeFile(new URL('gold.json',root),JSON.stringify({synthetic:true,authored:true,cases},null,2)+'\n');
