import {createCanvas} from '@napi-rs/canvas';
// Conservative axis-aligned ruled-grid detector; no authored values or PDF identifiers.
export function tableCells(canvas) {
 const {width:w,height:h}=canvas;const p=canvas.getContext('2d').getImageData(0,0,w,h).data;
 const dark=(x,y)=>p[(y*w+x)*4]<200;
 const lines=[];
 for(let y=0;y<h;y++){let start=0;for(let x=0;x<=w;x++){if(x<w&&dark(x,y))continue;if(x-start>w*.3)lines.push({y,left:start,right:x});start=x+1;}}
 const groups=[];for(const line of lines){const last=groups.at(-1);if(last&&line.y-last.y<4&&Math.abs(line.left-last.left)<4){last.bottom=line.y;}else groups.push({...line,bottom:line.y});}
 const bands=[];
 for(let i=0;i<groups.length-1;i++){
  const top=groups[i],bottom=groups[i+1];if(bottom.y-top.bottom<15||bottom.y-top.bottom>h*.12||Math.abs(top.left-bottom.left)>4||Math.abs(top.right-bottom.right)>4)continue;
  const xs=[];for(let x=top.left;x<top.right;x++){let count=0;for(let y=top.bottom+1;y<bottom.y;y++)if(dark(x,y))count++;if(count/(bottom.y-top.bottom-1)>.85&&(!xs.length||x-xs.at(-1)>4))xs.push(x);}
  if(xs.length<2||xs.length>12)continue;
  bands.push({top,bottom,xs,row:i});
 }
 const cells=[];
 for(const {top,bottom,xs,row} of bands){
  const all=[];for(const b of bands.filter(b=>Math.abs(b.top.left-top.left)<4&&Math.abs(b.top.right-top.right)<4))for(const x of b.xs)if(!all.some(v=>Math.abs(v-x)<5))all.push(x);
  all.sort((a,b)=>a-b);if(all.length<3)continue;
  for(let j=0;j<xs.length-1;j++){const x=xs[j]+4,y=top.bottom+4,width=xs[j+1]-x-4,height=bottom.y-y-3;if(width<20||height<10)continue;const crop=createCanvas(width+20,height+20);const ctx=crop.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(canvas,x,y,width,height,10,10,width,height);const column=all.findIndex(v=>Math.abs(v-xs[j])<5),end=all.findIndex(v=>Math.abs(v-xs[j+1])<5);cells.push({bbox:{x,y,width,height},row,column,columnSpan:end-column,rowSpan:1,image:crop.toBuffer('image/png')});if(cells.length>120)return cells;}
 }
 return cells;
}
