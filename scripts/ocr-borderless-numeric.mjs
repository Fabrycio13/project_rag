import {createCanvas} from '@napi-rs/canvas';
// Reread numeric cells from pixels, not the recognized word box: a dropped
// leading glyph is outside that box. Row/column gutters bound the search.
export async function rereadBorderlessNumbers(worker,canvas,association) {
 const cells=association.cells,ctx=canvas.getContext('2d');
 for(const cell of cells.filter(c=>!c.header&&c.confidence<60&&/^[+−-]?\s*\d+(?:[.,]\d+)?%?$/.test(c.text))){
  const column=cells.filter(c=>c.column===cell.column),row=cells.filter(c=>c.row===cell.row);
  const left=cells.filter(c=>c.column===cell.column-1),right=cells.filter(c=>c.column===cell.column+1);
  const above=cells.filter(c=>c.row===cell.row-1),below=cells.filter(c=>c.row===cell.row+1);
  const x0=Math.floor(left.length?(Math.max(...left.map(c=>c.bbox.x+c.bbox.width))+Math.min(...column.map(c=>c.bbox.x)))/2:0);
  const x1=Math.ceil(right.length?(Math.max(...column.map(c=>c.bbox.x+c.bbox.width))+Math.min(...right.map(c=>c.bbox.x)))/2:canvas.width);
  const y0=Math.floor(above.length?(Math.max(...above.map(c=>c.bbox.y+c.bbox.height))+Math.min(...row.map(c=>c.bbox.y)))/2:0);
  const y1=Math.ceil(below.length?(Math.max(...row.map(c=>c.bbox.y+c.bbox.height))+Math.min(...below.map(c=>c.bbox.y)))/2:Math.max(...row.map(c=>c.bbox.y+c.bbox.height))+cell.bbox.height);
  const w=x1-x0,h=y1-y0;if(w<=0||h<=0)continue;
  const data=ctx.getImageData(x0,y0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(data[i]<160&&data[i+1]<160&&data[i+2]<160){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  if(maxX<0)continue;
  const pad=Math.ceil((maxY-minY+1)/2),bbox={x:x0+minX,y:y0+minY,width:maxX-minX+1,height:maxY-minY+1};
  const crop=createCanvas((bbox.width+2*pad)*2,(bbox.height+2*pad)*2),out=crop.getContext('2d');out.fillStyle='white';out.fillRect(0,0,crop.width,crop.height);out.drawImage(canvas,bbox.x,bbox.y,bbox.width,bbox.height,pad*2,pad*2,bbox.width*2,bbox.height*2);
  await worker.setParameters({tessedit_pageseg_mode:'7'});
  const {data:recognized}=await worker.recognize(crop.toBuffer('image/png'));
  const rawText=recognized.text.trim(),text=rawText.replace(/^([+−-])\s+(?=\d)/,'$1');
  cell.numericOcr={originalText:cell.text,originalConfidence:cell.confidence,originalBbox:cell.bbox,rawText,text,confidence:recognized.confidence,bbox,padding:pad,resizeScale:2,psm:7,disagreement:text!==cell.text};
  if(text!==cell.text){
   association.structure={state:'review_required',markdown:null,reason:'numeric_ocr_disagreement'};
   // No sign is inferred. Only a complete numeric OCR reading can be selected;
   // disagreement remains explicit, and cannot authorize indexing/Markdown.
   if(/^[+−-]?\d+(?:[.,]\d+)?%?$/.test(text)){cell.text=text;cell.confidence=recognized.confidence;cell.bbox=bbox;}
  }
  crop.width=1;crop.height=1;
 }
 await worker.setParameters({tessedit_pageseg_mode:'6'});
 return association;
}
