// Conservative single-line borderless association. Raw OCR remains authoritative.
export function borderlessTable(words, provenance) {
 const valid=words.filter(w=>w.text.trim()&&w.bbox.x1>w.bbox.x0&&w.bbox.y1>w.bbox.y0);
 if(!valid.length)return null;
 const heights=valid.map(w=>w.bbox.y1-w.bbox.y0).sort((a,b)=>a-b),h=heights[Math.floor(heights.length/2)];
 const lines=[];
 for(const word of [...valid].sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0)){
  const cy=(word.bbox.y0+word.bbox.y1)/2;
  let line=lines.find(l=>Math.abs(l.cy-cy)<h*.65);
  if(!line){line={cy,words:[]};lines.push(line);}line.words.push(word);
 }
 for(const line of lines){
  line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);line.groups=[];
  for(const word of line.words){const group=line.groups.at(-1);if(!group||word.bbox.x0-group.at(-1).bbox.x1>h*2)line.groups.push([word]);else group.push(word);}
 }
 const candidates=[];
 for(let start=0;start<lines.length;start++){
  const header=lines[start],n=header.groups.length;
  // Two newspaper columns are deliberately unsupported; require numeric data
  // and compact, non-sentence headers, not language-specific header literals.
  if(n<3||n>10||header.groups.some(g=>g.length>4||g.some(w=>/[.!?;]$/.test(w.text)||/\d/.test(w.text))))continue;
  const rows=[header];let ambiguous=false;
  for(let j=start+1;j<lines.length;j++){
   const line=lines[j];if(line.cy-rows.at(-1).cy>h*6)break;
   if(line.groups.length!==n){
    // A full-width sentence is a note; a partial aligned row is ambiguous.
    if(line.groups.length>1||Math.abs(line.words[0].bbox.x0-header.words[0].bbox.x0)>h||!/[.!?]$/.test(line.words.at(-1).text))ambiguous=true;
    break;
   }
   if(line.groups.some((g,c)=>Math.abs(g[0].bbox.x0-header.groups[c][0].bbox.x0)>h*3)){ambiguous=true;break;}
   rows.push(line);
  }
  if(rows.length<3||!rows.slice(1).every(l=>l.groups.some(g=>g.some(w=>/\d/.test(w.text)))))continue;
  const cuts=header.groups.slice(1).map((_,c)=>{
   const left=Math.max(...rows.map(l=>l.groups[c].at(-1).bbox.x1));
   const right=Math.min(...rows.map(l=>l.groups[c+1][0].bbox.x0));
   if(right-left<h*.6)ambiguous=true;
   return (left+right)/2;
  });
  if(rows.some(l=>l.groups.some((g,c)=>g.some(w=>(c>0&&w.bbox.x0<cuts[c-1])||(c<n-1&&w.bbox.x1>cuts[c])))))ambiguous=true;
  if(rows.some(l=>l.words.some(w=>w.confidence<60)))ambiguous=true;
  const cells=rows.flatMap((line,row)=>line.groups.map((group,column)=>{
   const x=Math.min(...group.map(w=>w.bbox.x0)),y=Math.min(...group.map(w=>w.bbox.y0));
   return {...provenance,row,column,rowSpan:1,columnSpan:1,text:group.map(w=>w.text).join(' '),confidence:Math.min(...group.map(w=>w.confidence)),bbox:{x,y,width:Math.max(...group.map(w=>w.bbox.x1))-x,height:Math.max(...group.map(w=>w.bbox.y1))-y},words:group,header:row===0,headerText:header.groups[column].map(w=>w.text).join(' '),associationMethod:'coordinate_gutters'};
  }));
  const escape=s=>s.replace(/\\/g,'\\\\').replace(/\|/g,'\\|');
  const rendered=rows.map((_,r)=>'| '+cells.filter(c=>c.row===r).map(c=>escape(c.text)).join(' | ')+' |');
  rendered.splice(1,0,'| '+Array(n).fill('---').join(' | ')+' |');
  candidates.push({cells,structure:{state:ambiguous?'review_required':'validated_rectangular',reason:ambiguous?'ambiguous_borderless_association':'coordinate_rectangular_single_line',markdown:ambiguous?null:rendered.join('\n')}});
 }
 if(candidates.length!==1)return null;
 return candidates[0];
}
