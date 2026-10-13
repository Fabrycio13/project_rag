import {createCanvas} from '@napi-rs/canvas';
// Projection evidence chooses horizontal-vs-vertical, not language/content terms.
export function orientationProjection(canvas){
 const {width:w,height:h}=canvas,p=canvas.getContext('2d').getImageData(0,0,w,h).data;
 const rows=new Float64Array(h),cols=new Float64Array(w);let ink=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4;if(p[at]<200&&p[at+1]<200&&p[at+2]<200){rows[y]++;cols[x]++;ink++;}}
 const energy=a=>a.reduce((sum,n)=>sum+n*n,0)/Math.max(1,ink);
 return {horizontal:energy(rows),vertical:energy(cols),ink};
}
export function rotateRaster(canvas,degrees){
 const swap=degrees%180!==0,w=canvas.width,h=canvas.height;
 const result=createCanvas(swap?h:w,swap?w:h),ctx=result.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,result.width,result.height);
 ctx.translate(result.width/2,result.height/2);ctx.rotate(degrees*Math.PI/180);ctx.drawImage(canvas,-w/2,-h/2);
 const matrices={0:[1,0,0,1,0,0],90:[0,1,-1,0,h,0],180:[-1,0,0,-1,w,h],270:[0,-1,1,0,0,w]};
 return {canvas:result,sourceToOcr:matrices[degrees]};
}
export async function recognizeOriented(worker,canvas,pdfRotation){
 const projection=orientationProjection(canvas);
 const angles=projection.vertical>projection.horizontal*1.3?[90,270]:[0,180];
 const metadataCorrection=(360-pdfRotation)%360;
 if(pdfRotation&&angles.includes(metadataCorrection))angles.sort(a=>a===metadataCorrection?-1:1);
 const attempts=[];let selected;
 for(const angle of [...new Set([0,...angles])]){
  const rotated=rotateRaster(canvas,angle);
  const result=await worker.recognize(rotated.canvas.toBuffer('image/png'),{}, {blocks:true});
  const text=result.data.text.trim();
  const letters=(text.match(/[\p{L}\p{N}]/gu)||[]).length;
  const tokens=(text.match(/[\p{L}\p{N}]{2,}/gu)||[]).length;
  const words=(result.data.blocks??[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>(p.lines??[]).flatMap(l=>(l.words??[]).map(w=>({text:w.text,bbox:w.bbox,confidence:w.confidence})))));
  attempts.push({rotation:angle,text,confidence:result.data.confidence,letters,tokens,words,sourceToOcr:rotated.sourceToOcr});
  // Confidence is only ranking evidence; independent projection and token coverage required.
  const eligible=angles.includes(angle)&&letters>=12&&tokens>=3;
  const score=eligible?result.data.confidence:0;
  if(!selected||score>selected.score){selected={score,result,canvas:rotated.canvas,angle,sourceToOcr:rotated.sourceToOcr};}
 }
 const credible=attempts.filter(a=>angles.includes(a.rotation)&&a.letters>=12&&a.tokens>=3).sort((a,b)=>b.confidence-a.confidence);
 const ambiguous=!credible.length||credible[0].confidence<60||(credible[1]&&credible[0].confidence-credible[1].confidence<15);
 return {...selected,attempts,projection,ambiguous};
}
