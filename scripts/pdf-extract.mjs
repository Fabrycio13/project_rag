import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const useful=text=>(text.match(/[\p{L}\p{N}]/gu)||[]).length>=12;
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import { tableCells } from './ocr-table-cells.mjs';
import { borderlessTable } from './ocr-borderless-table.mjs';
import { rereadBorderlessNumbers } from './ocr-borderless-numeric.mjs';
import { nativeLayout } from './pdf-native-layout.mjs';
import { recognizeOriented } from './ocr-orientation.mjs';
let task,worker;
try {
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>10485760)throw Error('invalid_pdf');chunks.push(chunk);}
 const data=new Uint8Array(Buffer.concat(chunks));
 if(!/^%PDF-/.test(Buffer.from(data.subarray(0,8)).toString()))throw Error('invalid_pdf');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const base=path.dirname(require.resolve('pdfjs-dist/package.json'));
 task=pdfjs.getDocument({data,isEvalSupported:false,useSystemFonts:true,verbosity:0,stopAtErrors:true,maxImageSize:12000000,standardFontDataUrl:pathToFileURL(base+'/standard_fonts/').href});
 task.onPassword=()=>task.destroy();
 const pdf=await task.promise;
 if(pdf.numPages>30)throw Error('page_limit');
 const pages=[];let total=0;
 for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i);
  const pageGeometry={view:page.view,rotation:page.rotate,userUnit:page.userUnit};
  const content=await page.getTextContent();
  const layout=nativeLayout(content.items);
  let text=layout.text;
  const nativeText=text;
  const operators=await page.getOperatorList();
  // Raster presence is independent of native text quantity (including body text).
  const imageOps=new Set(Object.entries(pdfjs.OPS).filter(([name])=>/^paint.*Image/.test(name)).map(([,code])=>code));
  const hasRaster=operators.fnArray.some(code=>imageOps.has(code));
  const textOps=new Set([pdfjs.OPS.showText,pdfjs.OPS.showSpacedText,pdfjs.OPS.nextLineShowText,pdfjs.OPS.nextLineSetSpacingShowText]);
  const warnings=['layout_unverified'];
  let method='text',ocrText='',ocrConfidence=null,ocrTableCells=[],ocrPageText='',ocrOrientation=null,borderlessStructure=null;
  if(!useful(text)||hasRaster){
   const viewport=page.getViewport({scale:2});
   if(viewport.width*viewport.height>12000000 || viewport.width>6000 || viewport.height>6000)throw Error('page_dimensions');
   const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
   // Suppress native glyph painting, not pixels/bounding boxes: do not erase
   // raster evidence where text overlaps. Native evidence remains verbatim.
   await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas,
    operationsFilter:nativeText?(index,list)=>!textOps.has(list.fnArray[index]):undefined}).promise;
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let ink=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p]<245||pixels[p+1]<245||pixels[p+2]<245)ink++;
   if(!nativeText && ink===0){
    pages.push({page:i,pageGeometry,method:'empty',evidenceState:'empty',text:'',nativeText:'',ocrText:'',ocrPageText:'',ocrTableCells:[],ocrConfidence:null,warnings:[]});
    canvas.width=1;canvas.height=1;page.cleanup();continue;
   }
   if(!worker){
    worker=await createWorker('por',1,{langPath:require('@tesseract.js-data/por').langPath,cacheMethod:'none',logger:()=>{},errorHandler:()=>{}});
   }
   await worker.setParameters({tessedit_pageseg_mode:'6'});
   const oriented=await recognizeOriented(worker,canvas,page.rotate);
   const result=oriented.result;
   ocrOrientation={rotation:oriented.angle,sourceToOcr:oriented.sourceToOcr,viewportTransform:viewport.transform,projection:oriented.projection,attempts:oriented.attempts,ambiguous:oriented.ambiguous};
   if(oriented.ambiguous)warnings.push('orientation_review_required');
   ocrPageText=result.data.text.trim();ocrConfidence=result.data.confidence;method='ocr';
   const cells=tableCells(oriented.canvas);
   if(cells.length>120)throw Error('text_limit');
   if(cells.length) {
    await worker.setParameters({tessedit_pageseg_mode:'6'});
    for(const cell of cells){const recognized=await worker.recognize(cell.image);ocrTableCells.push({page:i,bbox:cell.bbox,row:cell.row,column:cell.column,columnSpan:cell.columnSpan,rowSpan:cell.rowSpan,text:recognized.data.text.trim(),confidence:recognized.data.confidence,method:'ocr',scale:2,coordinateFrame:'oriented_raster_pixels',sourceToOcr:oriented.sourceToOcr,viewportTransform:viewport.transform});}
    warnings.push('table_cells_reading_order_unverified');
   }
   if(!cells.length&&!oriented.ambiguous){
    const provenance={page:i,method:'ocr',scale:2,coordinateFrame:'oriented_raster_pixels',sourceToOcr:oriented.sourceToOcr,viewportTransform:viewport.transform};
    const originalWords=oriented.attempts.find(a=>a.rotation===oriented.angle)?.words??[];
    const association=borderlessTable(originalWords,provenance);
    if(association){await rereadBorderlessNumbers(worker,oriented.canvas,association);ocrTableCells=association.cells;borderlessStructure=association.structure;if(ocrTableCells.some(c=>c.numericOcr?.disagreement))warnings.push('numeric_ocr_disagreement');}
   }
   ocrText=[ocrPageText,...ocrTableCells.map(cell=>cell.text)].filter(Boolean).join('\n');
   text=[nativeText,ocrText].filter(Boolean).join('\n\n');
   if(nativeText)warnings.push('mixed_reading_order_unverified');
   canvas.width=1;canvas.height=1;
   if(!useful(ocrText)||(result.data.confidence<35&&!useful(ocrTableCells.filter(cell=>cell.confidence>=35).map(cell=>cell.text).join(' ')))){
    warnings.push('raster_text_unverified');
   }
  }
  total+=text.length;if(total>1000000)throw Error('text_limit');
  if(method==='ocr')warnings.push('raster_layout_review_required');
  const evidenceState=method==='ocr'?'review_required':'extracted';
  // Only conservative rectangular borderless associations have Markdown.
  // Ruled cells and merged spans remain review-only; whole-page review stays.
  const ocrTableStructure=borderlessStructure??(method==='ocr'?{state:'review_required',markdown:null,reason:ocrTableCells.some(cell=>cell.columnSpan>1||cell.rowSpan>1)?'spans_not_representable_in_markdown':ocrTableCells.length?'cell_association_not_certified':'no_validated_table_structure'}:null);
  pages.push({page:i,pageGeometry,method,evidenceState,ocrTableStructure,text,nativeText,nativeRawText:layout.rawText,nativeSpans:layout.spans,nativeColumnCut:layout.columnCut,ocrOrientation,ocrText,ocrPageText,ocrTableCells,ocrConfidence,warnings});page.cleanup();
 }
 if(!pages.some(p=>useful(p.text)))throw Error('no_useful_text');
 const reviewRequired=pages.some(p=>p.evidenceState==='review_required');
 console.log(JSON.stringify({pages,reviewRequired,indexingEligible:!reviewRequired,extractorVersion:'pdf-evidence-v4-numeric-crop'}));
} catch(error) {
 const codes=['invalid_pdf','page_limit','text_limit','page_dimensions','no_useful_text'];
 console.log(JSON.stringify({error:codes.includes(error.message)?error.message:'invalid_or_encrypted_pdf'}));
} finally {await worker?.terminate();await task?.destroy();}
