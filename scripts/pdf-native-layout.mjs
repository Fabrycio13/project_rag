// Conservative two-column XY cut. Original glyph strings/coordinates are retained.
export function nativeLayout(items) {
 const spans=items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(i=>({text:i.str,transform:i.transform,width:i.width,height:i.height,hasEOL:i.hasEOL}));
 const sorted=[...spans].sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
 const rows=[];
 for(const span of sorted){const y=span.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,span.height*.3));if(!row){row={y,spans:[]};rows.push(row);}row.spans.push(span);}
 const gaps=[];
 for(const row of rows){row.spans.sort((a,b)=>a.transform[4]-b.transform[4]);for(let i=1;i<row.spans.length;i++){const a=row.spans[i-1],b=row.spans[i];const left=a.transform[4]+a.width,right=b.transform[4];if(right-left>Math.max(24,a.height*2))gaps.push({left,right,y:row.y});}}
 const candidate=gaps.find(g=>gaps.filter(other=>Math.min(g.right,other.right)-Math.max(g.left,other.left)>24).length>=2);
 let ordered=sorted,columnCut=null;
 if(candidate){
  const support=gaps.filter(g=>Math.min(g.right,candidate.right)-Math.max(g.left,candidate.left)>24);
  const cut=(Math.max(...support.map(g=>g.left))+Math.min(...support.map(g=>g.right)))/2;
  const crosses=spans.filter(s=>s.transform[4]<cut&&s.transform[4]+s.width>cut);
  const bodyTop=Math.max(...support.map(g=>g.y));
  // Spanning headings are allowed above the columns, not inside an ambiguous body.
  if(crosses.every(s=>s.transform[5]>bodyTop)){
   const header=sorted.filter(s=>s.transform[5]>bodyTop);
   const body=sorted.filter(s=>s.transform[5]<=bodyTop);
   ordered=[...header,...body.filter(s=>s.transform[4]<cut),...body.filter(s=>s.transform[4]>=cut)];columnCut=cut;
  }
 }
 return {text:ordered.map(s=>s.text).join(' ').trim(),spans,rawText:items.map(i=>i.str||'').join(' ').trim(),columnCut};
}
