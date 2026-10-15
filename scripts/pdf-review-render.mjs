// Private raster-only preview: no HTML, annotations, actions, JS or external links.
import {createCanvas} from '@napi-rs/canvas';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);let task;
try{
 const pageNumber=Number(process.argv[2]),expected=Number(process.argv[3]);
 if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>30||!Number.isInteger(expected)||expected<1||expected>30)throw Error();
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>10485760)throw Error();chunks.push(chunk);}
 const data=new Uint8Array(Buffer.concat(chunks));if(data.length<8||!Buffer.from(data.subarray(0,8)).toString().startsWith('%PDF-'))throw Error();
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const base=path.dirname(require.resolve('pdfjs-dist/package.json'));
 task=pdfjs.getDocument({data,isEvalSupported:false,useSystemFonts:true,verbosity:0,stopAtErrors:true,maxImageSize:12000000,standardFontDataUrl:pathToFileURL(base+'/standard_fonts/').href});task.onPassword=()=>task.destroy();
 const pdf=await task.promise;if(pdf.numPages!==expected||pageNumber>pdf.numPages)throw Error();
 const page=await pdf.getPage(pageNumber);const natural=page.getViewport({scale:1});if(!Number.isFinite(natural.width)||!Number.isFinite(natural.height)||natural.width<1||natural.height<1||natural.width>4000||natural.height>4000)throw Error();
 const viewport=page.getViewport({scale:Math.min(1.5,1400/natural.width,1800/natural.height)});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:pdfjs.AnnotationMode.DISABLE}).promise;
 const png=canvas.toBuffer('image/png');if(png.length>8*1024*1024)throw Error();process.stdout.write(png);await task.destroy();
}catch{try{await task?.destroy();}catch{}process.exitCode=1;}
