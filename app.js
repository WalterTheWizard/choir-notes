const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],NS='http://www.w3.org/2000/svg';
const templates={
 trio:[['Soprano','S','treble'],['Alto','A','treble'],['Baritone','Bar.','bass']],
 satb:[['Soprano','S','treble'],['Alto','A','treble'],['Tenor','T','treble'],['Bass','B','bass']],
 ttbb:[['Tenor I','T1','treble'],['Tenor II','T2','treble'],['Baritone','Bar.','bass'],['Bass','B','bass']]
};
const pitches={treble:['C6','B5','A5','G5','F5','E5','D5','C5','B4','A4','G4','F4','E4','D4','C4'],bass:['E4','D4','C4','B3','A3','G3','F3','E3','D3','C3','B2','A2','G2','F2','E2']};
const semis={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const fresh=()=>({title:'Untitled anthem',template:'trio',key:'C major',time:'4/4',tempo:92,measures:8,activePart:0,notes:[]});
let state=load()||fresh(),selected=null,history=[],timers=[],audio=null;
let input={voice:1,duration:1,dotted:false,rest:false,accidental:''};
function load(){try{return JSON.parse(localStorage.getItem('choir-notes-v2'))}catch{return null}}
function save(){try{localStorage.setItem('choir-notes-v2',JSON.stringify(state));$('#save-state').textContent='Saved on this device'}catch{$('#save-state').textContent='Editor ready'}}
function snap(){history.push(JSON.stringify(state));if(history.length>60)history.shift()}
function parts(){return templates[state.template]}
function beats(){return state.time==='3/4'||state.time==='6/8'?3:4}
function node(name,a={}){const n=document.createElementNS(NS,name);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v));return n}
function txt(parent,value,a={}){const n=node('text',a);n.textContent=value;parent.append(n);return n}
function toast(v){const t=$('#toast');t.textContent=v;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1700)}
function glyph(a){return a==='#'?'♯':a==='b'?'♭':a==='n'?'♮':''}
function pitch(part,step,a=''){const p=pitches[parts()[part][2]][Math.max(0,Math.min(14,step))];return p[0]+(a==='n'?'':a)+p.slice(1)}
function midi(p){const m=p.match(/^([A-G])([#b]?)(\d)$/);let n=(+m[3]+1)*12+semis[m[1]];return n+(m[2]==='#'?1:m[2]==='b'?-1:0)}
function freq(p){return 440*2**((midi(p)-69)/12)}
function render(){
 $('#title').value=state.title;$('#template').value=state.template;$('#key').value=state.key;$('#time').value=state.time;$('#tempo').value=state.tempo;
 $('#score-title').textContent=state.title;$('#score-subtitle').textContent=`${state.template==='trio'?'SAB':state.template.toUpperCase()} · ${state.key} · ${state.time}`;
 const box=$('#part-buttons');box.replaceChildren();parts().forEach((p,i)=>{const b=document.createElement('button');b.textContent=p[0];b.className=i===state.activePart?'active':'';b.onclick=()=>{state.activePart=i;selected=null;render()};box.append(b)});
 const d={4:'whole',2:'half',1:'quarter',.5:'eighth'}[input.duration];$('#cursor-help').textContent=`Entering ${input.dotted?'dotted ':''}${input.rest?'rest':d+' note'} in ${parts()[state.activePart][0]}, voice ${input.voice}.`;
 draw();save();
}
function draw(){
 const root=$('#score'),left=145,mw=205,gap=82,pc=parts().length,systems=Math.ceil(state.measures/4),sysH=pc*gap+68,height=systems*sysH+35;
 root.setAttribute('viewBox',`0 0 1000 ${height}`);root.style.height=Math.max(420,height)+'px';root.replaceChildren();
 for(let s=0;s<systems;s++)for(let p=0;p<pc;p++){
  const y=55+s*sysH+p*gap,hit=node('rect',{x:left,y:y-24,width:mw*4,height:76,class:'staff-hit','data-part':p,'data-system':s});root.append(hit);
  txt(root,parts()[p][1],{x:18,y:y+24,class:'part-label'});txt(root,parts()[p][2]==='bass'?'𝄢':'𝄞',{x:105,y:y+37,class:'clef'});
  for(let l=0;l<5;l++)root.append(node('line',{x1:left,y1:y+l*10,x2:left+mw*4,y2:y+l*10,class:'staff-line'}));
  for(let m=0;m<=4;m++)root.append(node('line',{x1:left+m*mw,y1:y,x2:left+m*mw,y2:y+40,class:m===4?'bar-line end':'bar-line'}));
  if(p===0){for(let m=0;m<4;m++){const no=s*4+m+1;if(no<=state.measures)txt(root,String(no),{x:left+m*mw+7,y:y-10,class:'measure-number'})}const ts=state.time.split('/');txt(root,ts[0],{x:left-34,y:y+18,class:'time-number'});txt(root,ts[1],{x:left-34,y:y+39,class:'time-number'})}
 }
 state.notes.forEach(n=>drawEvent(root,n,left,mw,gap,sysH));
 root.querySelectorAll('.staff-hit').forEach(h=>h.addEventListener('pointerdown',e=>enter(e,h,left,mw,gap,sysH)));
}
function pos(n,left,mw,gap,sysH){const s=Math.floor(n.measure/4),m=n.measure%4;return{x:left+m*mw+14+(n.beat/beats())*(mw-25),y:55+s*sysH+n.part*gap-20+n.step*5}}
function drawEvent(root,n,left,mw,gap,sysH){
 const {x,y}=pos(n,left,mw,gap,sysH),g=node('g',{class:'event'+(n.id===selected?' selected':''),'data-id':n.id,tabindex:0,role:'button'});
 if(n.rest){g.append(node('rect',{x:x-7,y:y+10,width:14,height:6,rx:1,class:'rest-mark'}));txt(g,'𝄽',{x:x-8,y:y+20,class:'rest-glyph'})}
 else{if(y<55||y>95)g.append(node('line',{x1:x-14,y1:y,x2:x+14,y2:y,class:'ledger'}));g.append(node('ellipse',{cx:x,cy:y,rx:9,ry:6,transform:`rotate(-18 ${x} ${y})`,class:'note-head '+(n.duration<2?'filled':'open')}));const up=n.voice===1;if(n.duration<4)g.append(node('line',{x1:x+(up?8:-8),y1:y,x2:x+(up?8:-8),y2:y+(up?-34:34),class:'stem'}));if(n.duration===.5)g.append(node('path',{d:up?`M${x+8} ${y-34}q20 8 8 24`:`M${x-8} ${y+34}q-20-8-8-24`,class:'flag'}));if(n.accidental)txt(g,glyph(n.accidental),{x:x-24,y:y+6,class:'accidental'});if(n.dotted)g.append(node('circle',{cx:x+17,cy:y,r:2.3,class:'dot'}))}
 if(n.lyric)txt(g,n.lyric,{x,y:y+64,class:'lyric'});g.addEventListener('pointerdown',e=>{e.stopPropagation();selected=n.id;state.activePart=n.part;$('#lyric').value=n.lyric||'';render()});root.append(g);
}
function enter(e,hit,left,mw,gap,sysH){
 const root=$('#score'),q=root.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const matrix=root.getScreenCTM();if(!matrix)return;const pt=q.matrixTransform(matrix.inverse()),part=+hit.dataset.part,sys=+hit.dataset.system,staffY=55+sys*sysH+part*gap,mi=Math.max(0,Math.min(3,Math.floor((pt.x-left)/mw))),measure=sys*4+mi;if(measure>=state.measures)return;
 const mx=pt.x-(left+mi*mw),beat=Math.max(0,Math.min(beats()-.5,Math.round(((mx-14)/(mw-25))*beats()*2)/2)),step=Math.max(0,Math.min(14,Math.round((pt.y-(staffY-20))/5)));
 snap();state.activePart=part;state.notes=state.notes.filter(n=>!(n.part===part&&n.voice===input.voice&&n.measure===measure&&n.beat===beat));const n={id:String(Date.now())+Math.random(),part,voice:input.voice,measure,beat,step,duration:input.duration,dotted:input.dotted,rest:input.rest,accidental:input.accidental,pitch:pitch(part,step,input.accidental),lyric:''};state.notes.push(n);selected=n.id;render();
}
function activate(sel,b){$$(sel).forEach(x=>x.classList.toggle('active',x===b))}
$$('[data-duration]').forEach(b=>b.onclick=()=>{input.duration=+b.dataset.duration;activate('[data-duration]',b);render()});
$$('[data-voice]').forEach(b=>b.onclick=()=>{input.voice=+b.dataset.voice;activate('[data-voice]',b);render()});
$$('[data-accidental]').forEach(b=>b.onclick=()=>{input.accidental=b.dataset.accidental;activate('[data-accidental]',b);render()});
$('#dotted').onchange=e=>{input.dotted=e.target.checked;render()};$('#rest-mode').onchange=e=>{input.rest=e.target.checked;render()};
$('#title').oninput=e=>{state.title=e.target.value||'Untitled anthem';render()};$('#key').onchange=e=>{state.key=e.target.value;render()};$('#time').onchange=e=>{snap();state.time=e.target.value;render()};$('#tempo').onchange=e=>{state.tempo=Math.max(40,Math.min(220,+e.target.value||92));render()};
$('#template').onchange=e=>{snap();state.template=e.target.value;state.activePart=0;state.notes=[];selected=null;render();toast('Template changed; score cleared.')};
$('#apply-lyric').onclick=()=>{const n=state.notes.find(n=>n.id===selected);if(!n)return toast('Select a note first.');snap();n.lyric=$('#lyric').value.trim();render()};
function remove(){if(!selected)return;snap();state.notes=state.notes.filter(n=>n.id!==selected);selected=null;$('#lyric').value='';render()}$('#delete-note').onclick=remove;
$('#undo').onclick=()=>{if(history.length){state=JSON.parse(history.pop());selected=null;render()}};
$('#add-measure').onclick=()=>{snap();state.measures+=4;render();toast('Four measures added.')};
$('#new-score').onclick=()=>{if(confirm('Begin a new score?')){snap();state=fresh();selected=null;render()}};
function stop(){timers.forEach(clearTimeout);timers=[];if(audio){audio.close();audio=null}$$('.playing').forEach(x=>x.classList.remove('playing'))}
function play(partOnly=false){stop();const ns=state.notes.filter(n=>!n.rest&&(!partOnly||n.part===state.activePart)).sort((a,b)=>a.measure*beats()+a.beat-b.measure*beats()-b.beat);if(!ns.length)return toast('There are no notes to play.');audio=new(window.AudioContext||window.webkitAudioContext)();const sec=60/state.tempo,start=audio.currentTime+.08;ns.forEach(n=>{const at=(n.measure*beats()+n.beat)*sec,dur=n.duration*(n.dotted?1.5:1)*sec*.88,o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=freq(n.pitch);g.gain.setValueAtTime(.0001,start+at);g.gain.exponentialRampToValueAtTime(partOnly?.16:.08,start+at+.02);g.gain.exponentialRampToValueAtTime(.0001,start+at+dur);o.connect(g).connect(audio.destination);o.start(start+at);o.stop(start+at+dur+.03);timers.push(setTimeout(()=>$('[data-id="'+n.id+'"]').classList.add('playing'),at*1000));timers.push(setTimeout(()=>$('[data-id="'+n.id+'"]').classList.remove('playing'),(at+dur)*1000))});const n=ns.at(-1);timers.push(setTimeout(stop,(n.measure*beats()+n.beat+n.duration)*sec*1000+300))}
$('#play-all').onclick=()=>play();$('#play-part').onclick=()=>play(true);$('#stop').onclick=stop;
function lilyPitch(p){const m=p.match(/^([A-G])([#b]?)(\d)$/),names={C:'c',D:'d',E:'e',F:'f',G:'g',A:'a',B:'b'};let s=names[m[1]]+(m[2]==='#'?'is':m[2]==='b'?'es':'');return s+(+m[3]>=4?"'".repeat(+m[3]-3):','.repeat(3-+m[3]))}
function lilyDur(n){return({4:'1',2:'2',1:'4',.5:'8'}[n.duration]||'4')+(n.dotted?'.':'')}
function gaps(g){const out=[];for(const [b,d] of [[4,'1'],[2,'2'],[1,'4'],[.5,'8']])while(g>=b-.01){out.push('r'+d);g-=b}return out}
function lilyVoice(part,voice){let out=[];for(let m=0;m<state.measures;m++){let cur=0,t=[];for(const n of state.notes.filter(n=>n.part===part&&n.voice===voice&&n.measure===m).sort((a,b)=>a.beat-b.beat)){if(n.beat>cur)t.push(...gaps(n.beat-cur));t.push((n.rest?'r':lilyPitch(n.pitch))+lilyDur(n));cur=Math.max(cur,n.beat+n.duration*(n.dotted?1.5:1))}if(cur<beats())t.push(...gaps(beats()-cur));out.push(t.join(' ')+' |')}return out.join('\n    ')}
function exportLy(){const km={'C major':'c \\major','G major':'g \\major','D major':'d \\major','F major':'f \\major','E♭ major':'ees \\major'};let defs='',staves='';parts().forEach((p,i)=>{const id='part'+(i+1),lyrics=state.notes.filter(n=>n.part===i&&n.voice===1&&!n.rest&&n.lyric).sort((a,b)=>a.measure-b.measure||a.beat-b.beat).map(n=>n.lyric.replace(/-/g,' -- ')).join(' ');defs+=`${id}One = { \\key ${km[state.key]} \\time ${state.time} \\tempo 4 = ${state.tempo}\n    ${lilyVoice(i,1)}\n}\n${id}Two = { ${lilyVoice(i,2)} }\n${id}Lyrics = \\lyricmode { ${lyrics} }\n\n`;staves+=`    \\new Staff \\with { instrumentName = "${p[1]}" } <<\n      \\clef ${p[2]} \\new Voice = "${id}" { \\voiceOne \\${id}One }\n      \\new Voice { \\voiceTwo \\${id}Two }\n      \\new Lyrics \\lyricsto "${id}" { \\${id}Lyrics }\n    >>\n`});const file=`\\version "2.24.0"\n\\header { title = "${state.title.replace(/"/g,'\\\"')}" tagline = ##f }\n\n${defs}\\score {\n  \\new ChoirStaff <<\n${staves}  >>\n  \\layout { }\n  \\midi { }\n}\n`,blob=new Blob([file],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.title||'choir_score').replace(/[^a-z0-9]+/gi,'_')+'.ly';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('LilyPond file exported.')}
$('#export-ly').onclick=exportLy;
addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('#undo').click()}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}else if(e.key===' '){e.preventDefault();play()}else if({'1':4,'2':2,'4':1,'8':.5}[e.key])$('[data-duration="'+{'1':4,'2':2,'4':1,'8':.5}[e.key]+'"]').click();else if(e.key.toLowerCase()==='r')$('#rest-mode').click();else if(e.key==='.')$('#dotted').click()});
render();
