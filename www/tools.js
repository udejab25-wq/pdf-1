// PDF Studio tools: pages, combine, crop, numbering, signing, compression, fonts
const {PDFDocument,StandardFonts,rgb,degrees}=PDFLib;
const FS={fam:'Helvetica',b:false,i:false,size:12},MM=72/25.4,spOf=new WeakMap();
let customBytes=null,act=null,sigData=null,sigAR=.4,sigMode=false,sel=new Set(),comb=[],thumbsFor=null;
const CSSF={Helvetica:'Helvetica,Arial,sans-serif',Times:'"Times New Roman",Times,serif',Courier:'"Courier New",monospace',Custom:'PSCustom,sans-serif'};
const STD={Helvetica:['Helvetica','HelveticaBold','HelveticaOblique','HelveticaBoldOblique'],Times:['TimesRoman','TimesRomanBold','TimesRomanItalic','TimesRomanBoldItalic'],Courier:['Courier','CourierBold','CourierOblique','CourierBoldOblique']};
const THEMES={Modern:['Helvetica',0,0,11],Classic:['Times',0,0,12],Elegant:['Times',0,1,14],Typewriter:['Courier',0,0,10],Headline:['Helvetica',1,0,24],Report:['Times',1,0,16]};
const kb=n=>n>1e6?(n/1e6).toFixed(2)+' MB':Math.round(n/1e3)+' KB',idx=()=>[...sel].sort((a,b)=>a-b);

// ---------- UI injection
document.head.insertAdjacentHTML('beforeend',`<style>.tg{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:12px}.thg{display:flex;flex-wrap:wrap;gap:10px;max-height:46vh;overflow:auto;padding:6px}.th{width:110px;text-align:center;font-size:12px;padding:4px;border:2px solid var(--bd);border-radius:8px;cursor:grab}.th canvas{max-width:100%;display:block;margin:auto;background:#fff}.th.sl{border-color:var(--ac);background:var(--ac2)}.row{display:flex;gap:6px;align-items:center;margin:4px 0}.row span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}input[type=text],input[type=number]{font:inherit;color:var(--tx);background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:6px 8px;width:76px}#pad{border:1px dashed var(--bd);border-radius:8px;background:#fff;touch-action:none;width:100%;max-width:360px}.card .bar{border:0;padding:6px 0;margin:0}</style>`);
const opt=(a,sel2)=>a.map(x=>`<option${x==sel2?' selected':''}>${x}</option>`).join('');
document.querySelector('#ed .bar').insertAdjacentHTML('afterend',`<div class="bar"><select id="ft"><option value="">Font theme…</option>${opt(Object.keys(THEMES))}</select><select id="ff"><option value="Helvetica">Sans (Helvetica)</option><option value="Times">Serif (Times)</option><option value="Courier">Mono (Courier)</option></select><button id="fb"><b>B</b></button><button id="fi"><i>I</i></button><select id="fz">${opt([8,9,10,11,12,14,16,18,20,24,28,32,36,48,60,72],12)}</select><label class="btn">Load font (.ttf/.otf)<input id="ffile" type="file" accept=".ttf,.otf"></label><span class="note">Applies to the word you’re editing and to new text</span></div>`);
const nt=document.createElement('button');nt.className='tab';nt.dataset.p='tools';nt.textContent='Tools';
document.querySelector('.tabs').insertBefore(nt,document.querySelector('.tab[data-p=from]'));
const sec=document.createElement('section');sec.id='tools';sec.className='pane';
sec.innerHTML=`<div class="bar"><button id="svt" class="pri">Save current PDF</button><span class="note">Each tool changes the open PDF, so you can chain them, then save.</span></div>
<div class="card"><b>Pages</b> <span class="note">click to select · drag to reorder · no selection = all pages</span>
<div class="bar"><button id="pl">⟲ Left</button><button id="pr">⟳ Right</button><button id="pd">Delete</button><button id="pdu">Duplicate</button><button id="pb">Blank page after</button><label class="btn">Insert PDF here<input id="ins" type="file" accept=".pdf"></label><button id="pex">Extract to new PDF</button><button id="pa">Select all</button><button id="pn">None</button></div><div id="th" class="thg"></div></div>
<div class="tg">
<div class="card"><b>Combine PDFs</b><div id="cl"></div><div class="bar"><label class="btn">Add PDFs<input id="cin2" type="file" accept=".pdf" multiple></label><label><input id="cin" type="checkbox" checked> open PDF first</label><button id="cmb" class="pri">Combine</button></div></div>
<div class="card"><b>Crop (margins to remove, mm)</b><div class="bar">Top <input id="ct" type="number" value="0"> Right <input id="cr" type="number" value="0"> Bottom <input id="cb" type="number" value="0"> Left <input id="cl" type="number" value="0"></div><div class="bar"><button id="ca" class="pri">Crop all pages</button><button id="c1">Current page only</button></div></div>
<div class="card"><b>Page numbers</b> <span class="note">uses the font and size from the Edit toolbar</span><div class="bar"><select id="nf"><option value="1">1</option><option value="2">Page 1</option><option value="3">1 / N</option><option value="4">Page 1 of N</option><option value="5">- 1 -</option></select><select id="np"><option value="bc">Bottom centre</option><option value="br">Bottom right</option><option value="bl">Bottom left</option><option value="tc">Top centre</option><option value="tr">Top right</option><option value="tl">Top left</option></select></div><div class="bar">Start <input id="ns" type="number" value="1"> Margin pt <input id="nm" type="number" value="28"> <label><input id="nsk" type="checkbox"> skip page 1</label></div><button id="nn" class="pri">Add page numbers</button></div>
<div class="card"><b>Sign or add image</b><canvas id="pad" width="720" height="260"></canvas><div class="bar"><input id="stx" type="text" placeholder="Type name" style="width:130px"><select id="sty"><option value="italic 90px 'Brush Script MT','Segoe Script',cursive">Script</option><option value="italic 80px Georgia,serif">Serif italic</option><option value="80px 'Comic Sans MS',cursive">Handwriting</option></select><button id="sg">Type</button><label class="btn">Upload image<input id="sup" type="file" accept="image/*"></label><button id="sc">Clear</button></div><div class="bar">Width pt <input id="sw" type="number" value="150"><button id="place" class="pri">Place on page</button></div><span class="note">Visual signature (not a certificate-based digital signature).</span></div>
<div class="card"><b>Compress</b><div class="bar"><select id="cz2"><option value="light">Light (lossless)</option><option value="strong" selected>Strong</option><option value="max">Maximum</option></select><button id="cz" class="pri">Compress</button></div><span class="note">With the Python engine, text stays selectable. Without it, Strong/Maximum turn pages into images.</span></div>
</div>`;
document.querySelector('main').insertBefore(sec,$('st'));
nt.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===nt));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('show',p.id==='tools'));if(thumbsFor!==pdf)thumbs()};

// ---------- fonts
async function getFont(doc,f,c){const k=JSON.stringify(f);if(c[k])return c[k];
  if(f.fam==='Custom'&&customBytes){doc.registerFontkit(fontkit);return c[k]=await doc.embedFont(customBytes,{subset:true})}
  return c[k]=await doc.embedFont(StandardFonts[STD[f.fam in STD?f.fam:'Helvetica'][+!!f.b+2*+!!f.i]])}
function sty(sp,o){const f=o.f||{fam:'Helvetica'};Object.assign(sp.style,{fontFamily:CSSF[f.fam],fontWeight:f.b?700:400,fontStyle:f.i?'italic':'normal',fontSize:o.s*S+'px'})}
function fc(){FS.fam=$('ff').value;FS.b=$('fb').classList.contains('on');FS.i=$('fi').classList.contains('on');FS.size=+$('fz').value;
  if(act){act.f={fam:FS.fam,b:FS.b,i:FS.i};act.s=FS.size;const sp=spOf.get(act);if(sp)sty(sp,act)}}
$('ff').onchange=$('fz').onchange=fc;
$('fb').onclick=()=>{$('fb').classList.toggle('on');fc()};$('fi').onclick=()=>{$('fi').classList.toggle('on');fc()};
$('ft').onchange=e=>{const t=THEMES[e.target.value];if(!t)return;$('ff').value=t[0];$('fb').classList.toggle('on',!!t[1]);$('fi').classList.toggle('on',!!t[2]);$('fz').value=t[3];fc()};
$('ffile').onchange=async e=>{const f=e.target.files[0];if(!f)return;customBytes=new Uint8Array(await f.arrayBuffer());
  try{const ff=new FontFace('PSCustom',customBytes.slice().buffer);await ff.load();document.fonts.add(ff)}catch(x){}
  if(![...$('ff').options].some(o=>o.value==='Custom'))$('ff').add(new Option('Custom: '+f.name,'Custom'));$('ff').value='Custom';fc();st('Custom font loaded (full Unicode supported).')};

// ---------- editor overrides: fonts + image/signature objects
window.mk=o=>{
  const [px,py]=vp.convertToViewportPoint(o.x,o.y);
  if(o.del)return document.createComment('');
  if(o.img){const im=new Image();im.src=o.img;im.draggable=false;im.title='Double-click to remove';
    Object.assign(im.style,{position:'absolute',left:px+'px',top:(py-o.h*S)+'px',width:o.w*S+'px',height:o.h*S+'px',outline:'1px dashed #e0457b'});
    im.onclick=e=>e.stopPropagation();im.ondblclick=()=>{o.del=true;im.remove()};return im}
  const f=o.s*S,sp=document.createElement('span');sp.contentEditable='true';sp.spellcheck=false;sp.textContent=o.t;
  Object.assign(sp.style,{left:px+'px',top:(py-f*.82)+'px',minWidth:Math.max(o.w*S,f)+'px',height:f*1.15+'px'});sty(sp,o);spOf.set(o,sp);
  if(o.add)sp.className='a';else if(o.t!==o.o)sp.classList.add('m');
  sp.onfocus=()=>{act=o;if(o.f){$('ff').value=o.f.fam;$('fb').classList.toggle('on',!!o.f.b);$('fi').classList.toggle('on',!!o.f.i);$('fz').value=Math.round(o.s)}};
  sp.oninput=()=>{o.t=sp.textContent;if(!o.add)sp.classList.toggle('m',o.t!==o.o)};
  sp.onclick=e=>e.stopPropagation();return sp};
$('ov').onclick=e=>{
  if(!pdf)return;const r=$('ov').getBoundingClientRect(),X=e.clientX-r.left,Y=e.clientY-r.top;
  if(sigMode&&sigData){const w=+$('sw').value||150,h=w*sigAR,[x,y]=vp.convertToPdfPoint(X,Y),o={img:sigData,x:x-w/2,y:y-h/2,w,h,add:true};
    edits[cur].push(o);$('ov').appendChild(mk(o));sigMode=false;st('Signature placed. Double-click it to remove, or use “Place on page” again.');return}
  if(!addMode)return;const s=FS.size,[x,y]=vp.convertToPdfPoint(X,Y+s*S*.82),o={x,y,w:60,s,o:'',t:'New text',add:true,f:{fam:FS.fam,b:FS.b,i:FS.i}};
  edits[cur].push(o);const sp=mk(o);$('ov').appendChild(sp);sp.focus();document.getSelection().selectAllChildren(sp)};

// ---------- applying edits / committing
const dirty=()=>Object.values(edits).flat().some(o=>o.del?false:o.img?true:o.add?o.t.trim():o.t!==o.o);
async function applyEdits(doc){const pages=doc.getPages(),c={};let n=0;
  for(const k in edits){const p=pages[k-1];if(!p)continue;
    for(const o of edits[k]){if(o.del)continue;
      if(o.img){p.drawImage(await doc.embedPng(o.img),{x:o.x,y:o.y,width:o.w,height:o.h});n++;continue}
      if(!(o.add?o.t.trim():o.t!==o.o))continue;n++;
      if(!o.add)p.drawRectangle({x:o.x-1,y:o.y-o.s*.25,width:o.w+2,height:o.s*1.2,color:rgb(1,1,1)});
      if(o.t.trim()){const f=o.f||{fam:'Helvetica'};p.drawText(f.fam==='Custom'?o.t:clean(o.t),{x:o.x,y:o.y,size:o.s,font:await getFont(doc,f,c),color:rgb(0,0,0)})}}}
  return n}
async function currentBytes(){if(!dirty())return bytes;const d=await PDFDocument.load(bytes,{ignoreEncryption:true});await applyEdits(d);return await d.save()}
async function loadBytes(b){bytes=b;pdf=await pdfjsLib.getDocument({data:b.slice()}).promise;edits={};cur=Math.min(cur,pdf.numPages);sel.clear();act=null;
  $('fn').textContent=name+'.pdf · '+pdf.numPages+' pages · '+kb(b.length);$('sv').disabled=false;await show(cur);if(sec.classList.contains('show'))thumbs()}
async function op(fn,msg){if(!need())return;try{st('Working…');const d=await PDFDocument.load(await currentBytes(),{ignoreEncryption:true});await loadBytes(await((await fn(d))||d).save());st(msg||'Done')}catch(e){st('Failed: '+e.message)}}
$('sv').onclick=async()=>{if(!need())return;if(!dirty())return st('No changes to save yet.');st('Applying edits…');try{await save(name+'-edited.pdf',new Blob([await currentBytes()],{type:'application/pdf'}))}catch(e){st('Save failed: '+e.message)}};
$('svt').onclick=async()=>{if(need())await save(name+'-modified.pdf',new Blob([await currentBytes()],{type:'application/pdf'}))};

// ---------- pages
async function thumbs(){const box=$('th'),P=pdf;box.innerHTML='';thumbsFor=P;if(!P)return;
  for(let n=1;n<=P.numPages&&P===pdf;n++){const i=n-1,d=document.createElement('div'),c=document.createElement('canvas');d.className='th'+(sel.has(i)?' sl':'');d.draggable=true;d.append(c,String(n));box.appendChild(d);
    d.onclick=()=>{sel.has(i)?sel.delete(i):sel.add(i);d.classList.toggle('sl')};d.ondragstart=e=>e.dataTransfer.setData('text/plain',i);d.ondragover=e=>e.preventDefault();
    d.ondrop=e=>{e.preventDefault();move(+e.dataTransfer.getData('text/plain'),i)};
    const pg=await P.getPage(n),v=pg.getViewport({scale:.22});c.width=v.width;c.height=v.height;await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise}}
async function rebuild(d,o){const out=await PDFDocument.create();(await out.copyPages(d,o)).forEach(p=>out.addPage(p));return out}
const all=d=>[...Array(d.getPageCount()).keys()],tgt=d=>idx().length?idx():all(d);
const move=(a,b)=>a!==b&&op(d=>{const o=all(d);o.splice(b,0,o.splice(a,1)[0]);return rebuild(d,o)},'Pages rearranged');
const rot=a=>op(d=>tgt(d).forEach(i=>{const p=d.getPage(i);p.setRotation(degrees((p.getRotation().angle+a+360)%360))}),'Rotated');
$('pl').onclick=()=>rot(-90);$('pr').onclick=()=>rot(90);
$('pd').onclick=()=>sel.size?op(d=>{if(sel.size>=d.getPageCount())throw Error('Cannot delete every page');idx().reverse().forEach(i=>d.removePage(i))},'Pages deleted'):st('Select pages first (click thumbnails).');
$('pdu').onclick=()=>op(d=>{const o=all(d);idx().reverse().forEach(i=>o.splice(i+1,0,i));return rebuild(d,o)},'Duplicated');
const at=d=>idx().length?idx().pop()+1:d.getPageCount();
$('pb').onclick=()=>op(d=>{const i=at(d),s=d.getPage(Math.max(0,Math.min(i-1,d.getPageCount()-1))).getSize();d.insertPage(i,[s.width,s.height])},'Blank page added');
$('ins').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const b=await f.arrayBuffer();
  op(async d=>{const s=await PDFDocument.load(b,{ignoreEncryption:true}),i=at(d);(await d.copyPages(s,s.getPageIndices())).forEach((p,k)=>d.insertPage(i+k,p))},'PDF inserted')};
$('pex').onclick=async()=>{if(!need())return;if(!sel.size)return st('Select pages first.');const d=await PDFDocument.load(await currentBytes());await save(name+'-extract.pdf',new Blob([await(await rebuild(d,idx())).save()]))};
$('pa').onclick=()=>{if(pdf){sel=new Set([...Array(pdf.numPages).keys()]);thumbs()}};$('pn').onclick=()=>{sel.clear();thumbs()};

// ---------- combine
function combList(){const L=$('cl');L.innerHTML='';comb.forEach((c,i)=>{const r=document.createElement('div');r.className='row';r.innerHTML='<span>'+esc(c.name)+'</span>';
  [['↑',-1],['↓',1],['✕',0]].forEach(([t,k])=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{if(!k)comb.splice(i,1);else if(comb[i+k])[comb[i],comb[i+k]]=[comb[i+k],comb[i]];combList()};r.appendChild(b)});L.appendChild(r)})}
$('cin2').onchange=async e=>{for(const f of e.target.files)comb.push({name:f.name,b:new Uint8Array(await f.arrayBuffer())});e.target.value='';combList()};
$('cmb').onclick=async()=>{const L=[...(pdf&&$('cin').checked?[{b:await currentBytes()}]:[]),...comb];if(L.length<2)return st('Add at least two PDFs.');
  try{st('Combining…');const out=await PDFDocument.create();for(const c of L){const s=await PDFDocument.load(c.b,{ignoreEncryption:true});(await out.copyPages(s,s.getPageIndices())).forEach(p=>out.addPage(p))}
    if(!pdf)name='combined';comb=[];combList();await loadBytes(await out.save());st('Combined '+L.length+' PDFs into '+pdf.numPages+' pages')}catch(e){st('Combine failed: '+e.message)}};

// ---------- crop
const crop=whole=>op(d=>{const m=['ct','cr','cb','cl'].map(k=>(+$(k).value||0)*MM);(whole?d.getPages():[d.getPage(cur-1)]).forEach(p=>{const b=p.getCropBox(),w=b.width-m[1]-m[3],h=b.height-m[0]-m[2];
  if(w<20||h<20)throw Error('Margins too large');p.setCropBox(b.x+m[3],b.y+m[2],w,h);p.setMediaBox(b.x+m[3],b.y+m[2],w,h)})},'Cropped');
$('ca').onclick=()=>crop(true);$('c1').onclick=()=>crop(false);

// ---------- page numbers
const NF={1:'{n}',2:'Page {n}',3:'{n} / {t}',4:'Page {n} of {t}',5:'- {n} -'};
$('nn').onclick=()=>op(async d=>{const f=await getFont(d,FS,{}),ps=d.getPages(),sk=$('nsk').checked,s0=+$('ns').value||1,m=+$('nm').value||28,pos=$('np').value,tot=s0-1+ps.length-(sk?1:0);
  ps.forEach((p,i)=>{if(sk&&!i)return;let t=NF[$('nf').value].replace('{n}',s0+i-(sk?1:0)).replace('{t}',tot);if(FS.fam!=='Custom')t=clean(t);
    const {width:W,height:H}=p.getSize(),w=f.widthOfTextAtSize(t,FS.size),x=pos[1]==='l'?m:pos[1]==='r'?W-m-w:(W-w)/2,y=pos[0]==='b'?m:H-m-FS.size;
    p.drawText(t,{x,y,size:FS.size,font:f,color:rgb(.1,.1,.1)})})},'Page numbers added');

// ---------- signature
const pad=$('pad'),pc=pad.getContext('2d');let dr=false;
const pp=e=>{const r=pad.getBoundingClientRect();return[(e.clientX-r.left)*pad.width/r.width,(e.clientY-r.top)*pad.height/r.height]};
const ink=()=>{pc.lineWidth=4;pc.lineCap=pc.lineJoin='round';pc.strokeStyle=pc.fillStyle='#0b2a6f'};ink();
pad.onpointerdown=e=>{dr=true;pad.setPointerCapture(e.pointerId);pc.beginPath();pc.moveTo(...pp(e))};
pad.onpointermove=e=>{if(dr){pc.lineTo(...pp(e));pc.stroke()}};pad.onpointerup=()=>dr=false;
$('sc').onclick=()=>pc.clearRect(0,0,pad.width,pad.height);
$('sg').onclick=()=>{pc.clearRect(0,0,pad.width,pad.height);pc.font=$('sty').value;pc.textBaseline='middle';pc.fillText($('stx').value||'Signature',20,pad.height/2)};
$('sup').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{pc.clearRect(0,0,pad.width,pad.height);const k=Math.min(pad.width/im.width,pad.height/im.height);pc.drawImage(im,0,0,im.width*k,im.height*k);
  const d=pc.getImageData(0,0,pad.width,pad.height),a=d.data;for(let i=0;i<a.length;i+=4)if(a[i]>200&&a[i+1]>200&&a[i+2]>200)a[i+3]=0;pc.putImageData(d,0,0)};im.src=URL.createObjectURL(f)};
function sigUse(){const w=pad.width,h=pad.height,a=pc.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]>10){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return false;const c=document.createElement('canvas');c.width=x1-x0+1;c.height=y1-y0+1;c.getContext('2d').drawImage(pad,x0,y0,c.width,c.height,0,0,c.width,c.height);sigData=c.toDataURL('image/png');sigAR=c.height/c.width;return true}
$('place').onclick=()=>{if(!need())return;if(!sigUse())return st('Draw, type or upload a signature first.');sigMode=true;addMode=false;$('ad').classList.remove('on');
  document.querySelector('.tab[data-p=ed]').click();st('Click the page where the signature should go.')};

// ---------- compress
$('cz').onclick=async()=>{if(!need())return;const lv=$('cz2').value;
  try{st('Compressing…');const base=await currentBytes();if(base!==bytes)await loadBytes(base);let out;
    if(window.HQ)out=new Uint8Array(await(await hqPost('/pdf/compress',new Blob([base]),name+'.pdf',{level:lv})).arrayBuffer());
    else if(lv==='light')out=await(await PDFDocument.load(base,{ignoreEncryption:true})).save({useObjectStreams:true});
    else{const [dpi,q]=lv==='max'?[72,.4]:[110,.55],o=await PDFDocument.create();
      for(let n=1;n<=pdf.numPages;n++){st('Compressing page '+n+' of '+pdf.numPages+'…');const pg=await pdf.getPage(n),v1=pg.getViewport({scale:1}),v=pg.getViewport({scale:dpi/72}),c=document.createElement('canvas');
        c.width=v.width;c.height=v.height;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:v}).promise;
        const im=await o.embedJpg(new Uint8Array(await(await blobOf(c,'image/jpeg',q)).arrayBuffer()));o.addPage([v1.width,v1.height]).drawImage(im,{x:0,y:0,width:v1.width,height:v1.height})}
      out=await o.save()}
    if(out.length>=base.length)return st('Already compact: no smaller version found ('+kb(base.length)+').');
    await loadBytes(out);st('Compressed '+kb(base.length)+' → '+kb(out.length)+' ('+Math.round(100-out.length*100/base.length)+'% smaller).'+(window.HQ||lv==='light'?'':' Pages are now images; text is no longer selectable.'))}
  catch(e){st('Compression failed: '+e.message)}};
