import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createCanvas} from '@napi-rs/canvas';
import {createWorker} from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const require=createRequire(import.meta.url);
const pdf=await pdfjs.getDocument({data:new Uint8Array(await fs.readFile('docs/fixtures/rag/dificil.pdf')),useSystemFonts:true,verbosity:0}).promise;
const page=await pdf.getPage(3);
const worker=await createWorker('por',1,{langPath:require('@tesseract.js-data/por').langPath,cacheMethod:'none'});
const results=[];
for(const scale of [2,3]) {
 const viewport=page.getViewport({scale});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
 await fs.writeFile(`docs/evaluations/table-p3-scale${scale}.png`,canvas.toBuffer('image/png'));
 if(!process.argv.includes('--original')){
 const threshold=process.argv.includes('--threshold160')?160:230;
 const ctx=canvas.getContext('2d');const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const {width:w,height:h,data:p}=pixels;const marks=new Uint8Array(w*h);const dark=(x,y)=>p[(y*w+x)*4]<threshold;
 for(let y=0;y<h;y++){let start=0;for(let x=0;x<=w;x++){if(x<w&&dark(x,y))continue;if(x-start>=w*.15)for(let k=start;k<x;k++)marks[y*w+k]=1;start=x+1;}}
 for(let x=0;x<w;x++){let start=0;for(let y=0;y<=h;y++){if(y<h&&dark(x,y))continue;if(y-start>=60*scale/2)for(let k=start;k<y;k++)marks[k*w+x]=1;start=y+1;}}
 for(let k=0;k<marks.length;k++)if(marks[k])p.fill(255,k*4,k*4+3);ctx.putImageData(pixels,0,0);
 }
 for(const mode of [3,6,11]) {
  await worker.setParameters({tessedit_pageseg_mode:String(mode)});
  const {data}=await worker.recognize(canvas.toBuffer('image/png'));
  results.push({scale,mode,text:data.text,confidence:data.confidence});
 }
}
const suffix=process.argv.includes('--original')?'-original':process.argv.includes('--threshold160')?'-threshold160':'';
await fs.writeFile(`docs/evaluations/scanned-table-probes${suffix}.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));await worker.terminate();
