const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],NS='http://www.w3.org/2000/svg';
const templates={
 trio:[['Soprano','S','treble'],['Alto','A','treble'],['Baritone','Bar.','bass']],
 satb:[['Soprano','S','treble'],['Alto','A','treble'],['Tenor','T','treble'],['Bass','B','bass']],
 ttbb:[['Tenor I','T1','treble'],['Tenor II','T2','treble'],['Baritone','Bar.','bass'],['Bass','B','bass']]
};
const pitches={treble:['C6','B5','A5','G5','F5','E5','D5','C5','B4','A4','G4','F4','E4','D4','C4'],bass:['E4','D4','C4','B3','A3','G3','F3','E3','D3','C3','B2','A2','G2','F2','E2']};
const semis={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const CLERK_PUBLISHABLE_KEY='pk_test_YXdhcmUtY2ljYWRhLTY0ODMuY2xlcmsuYWNjb3VudHMuZGV2JA';
const fresh=()=>({title:'Untitled anthem',template:'trio',key:'C major',time:'4/4',tempo:92,measures:8,activePart:0,notes:[]});
let state=load()||fresh(),selected=null,selectedIds=new Set(),history=[],timers=[],audio=null;
let input={voice:1,duration:1,dotted:false,rest:false,chord:false,accidental:''};
function load(){try{return JSON.parse(localStorage.getItem('choir-notes-v2'))}catch{return null}}
function save(){try{localStorage.setItem('choir-notes-v2',JSON.stringify(state));$('#save-state').textContent='Saved on this device'}catch{$('#save-state').textContent='Editor ready'}}
function snap(){history.push(JSON.stringify(state));if(history.length>60)history.shift()}
function parts(){return templates[state.template]}
function beats(){return state.time==='3/4'||state.time==='6/8'?3:4}
function node(name,a={}){const n=document.createElementNS(NS,name);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v));return n}
function txt(parent,value,a={}){const n=node('text',a);n.textContent=value;parent.append(n);return n}
function toast(v){const t=$('#toast');t.textContent=v;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1700)}
function loadScript(src,attributes={}){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.crossOrigin='anonymous';Object.entries(attributes).forEach(([key,value])=>script.setAttribute(key,value));script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Clerk.'));document.head.append(script)})}
function showAuth(){const signedIn=!!window.Clerk?.user,$in=$('#sign-in'),$up=$('#sign-up'),$user=$('#user-button');$in.hidden=signedIn;$up.hidden=signedIn;$in.disabled=false;$up.disabled=false;$user.replaceChildren();if(signedIn)window.Clerk.mountUserButton($user,{appearance:{variables:{colorPrimary:'#20395e'}}})}
async function initAuth(){const status=$('#save-state');try{const domain=atob(CLERK_PUBLISHABLE_KEY.split('_')[2]).slice(0,-1);await loadScript(`https://${domain}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`,{'data-clerk-publishable-key':CLERK_PUBLISHABLE_KEY});await window.Clerk.load({appearance:{variables:{colorPrimary:'#20395e',colorText:'#152139'}}});$('#sign-in').onclick=()=>window.Clerk.openSignIn();$('#sign-up').onclick=()=>window.Clerk.openSignUp();window.Clerk.addListener(showAuth);showAuth()}catch(error){console.error(error);status.textContent='Account sign-in unavailable';status.classList.add('auth-error')}}
function glyph(a){return a==='#'?'♯':a==='b'?'♭':a==='n'?'♮':''}
function pitch(part,step,a=''){const p=pitches[parts()[part][2]][Math.max(0,Math.min(14,step))];return p[0]+(a==='n'?'':a)+p.slice(1)}
function midi(p){const m=p.match(/^([A-G])([#b]?)(\d)$/);let n=(+m[3]+1)*12+semis[m[1]];return n+(m[2]==='#'?1:m[2]==='b'?-1:0)}
function freq(p){return 440*2**((midi(p)-69)/12)}
function render(){
 $('#title').value=state.title;$('#template').value=state.template;$('#key').value=state.key;$('#time').value=state.time;$('#tempo').value=state.tempo;$('#shape-mode').checked=!!state.shapedNotes;
 $('#score-title').textContent=state.title;$('#score-subtitle').textContent=`${state.template==='trio'?'SAB':state.template.toUpperCase()} · ${state.key} · ${state.time}`;
 const box=$('#part-buttons');box.replaceChildren();parts().forEach((p,i)=>{const b=document.createElement('button');b.textContent=p[0];b.className=i===state.activePart?'active':'';b.onclick=()=>{state.activePart=i;clearSelection();render()};box.append(b)});
 const chosen=state.notes.filter(n=>selectedIds.has(n.id)),stem=chosen.length&&chosen.every(n=>(n.stem||'auto')===(chosen[0].stem||'auto'))?(chosen[0].stem||'auto'):'';
 $$('[data-stem]').forEach(b=>{b.classList.toggle('active',b.dataset.stem===stem);b.disabled=!chosen.length});
 $('#beam-notes').disabled=chosen.length<2;$('#unbeam-notes').disabled=!chosen.some(n=>n.beamGroup);$('#selection-help').textContent=chosen.length>1?`${chosen.length} notes selected.`:'Turn on Select group, then tap eighth notes.';
 const d={4:'whole',2:'half',1:'quarter',.5:'eighth'}[input.duration],mode=input.chord&&!input.rest?' · chord mode':'';$('#cursor-help').textContent=`Entering ${input.dotted?'dotted ':''}${input.rest?'rest':d+' note'} in ${parts()[state.activePart][0]}, voice ${input.voice}${mode}.`;
 draw();save();
}
function draw(){
 const root=$('#score'),left=195,mw=192.5,gap=82,pc=parts().length,systems=Math.ceil(state.measures/4),sysH=pc*gap+68,height=systems*sysH+35;
 root.setAttribute('viewBox',`0 0 1000 ${height}`);root.style.height=Math.max(420,height)+'px';root.replaceChildren();
 for(let s=0;s<systems;s++)for(let p=0;p<pc;p++){
  const y=55+s*sysH+p*gap,hit=node('rect',{x:left,y:y-24,width:mw*4,height:76,class:'staff-hit','data-part':p,'data-system':s});root.append(hit);
  txt(root,parts()[p][1],{x:18,y:y+24,class:'part-label'});txt(root,parts()[p][2]==='bass'?'𝄢':'𝄞',{x:96,y:y+37,class:'clef'});
  for(let l=0;l<5;l++)root.append(node('line',{x1:left,y1:y+l*10,x2:left+mw*4,y2:y+l*10,class:'staff-line'}));
  for(let m=0;m<=4;m++)root.append(node('line',{x1:left+m*mw,y1:y,x2:left+m*mw,y2:y+40,class:m===4?'bar-line end':'bar-line'}));
  if(p===0)for(let m=0;m<4;m++){const no=s*4+m+1;if(no<=state.measures)txt(root,String(no),{x:left+m*mw+7,y:y-10,class:'measure-number'})}const ts=state.time.split('/');txt(root,ts[0],{x:158,y:y+18,class:'time-number'});txt(root,ts[1],{x:158,y:y+39,class:'time-number'});
 }
 const beams=beamLayout(left,mw,gap,sysH);state.notes.forEach(n=>drawEvent(root,n,left,mw,gap,sysH,beams.byNote.get(n.id)));beams.groups.forEach(b=>root.append(node('path',{d:b.path,class:'beam'+(b.ids.some(id=>selectedIds.has(id))?' selected':'')})));
 root.querySelectorAll('.staff-hit').forEach(h=>h.addEventListener('pointerdown',e=>enter(e,h,left,mw,gap,sysH)));
}
function effectiveStem(n){return n.stem==='up'||n.stem==='down'?n.stem:n.voice===1?'up':'down'}
function beamLayout(left,mw,gap,sysH){
 const byNote=new Map(),groups=[],bucket=new Map();state.notes.filter(n=>n.beamGroup&&!n.rest&&n.duration===.5&&!n.dotted).forEach(n=>{const key=n.beamGroup;(bucket.get(key)||bucket.set(key,[]).get(key)).push(n)});
 for(const notes of bucket.values()){
  notes.sort((a,b)=>a.measure-b.measure||a.beat-b.beat||a.step-b.step);if(notes.length<2)continue;const first=notes[0],same=notes.every(n=>n.part===first.part&&n.voice===first.voice&&n.measure===first.measure);if(!same)continue;
  const up=effectiveStem(notes.find(n=>n.stem==='up'||n.stem==='down')||first)==='up',points=notes.map(n=>{const p=pos(n,left,mw,gap,sysH);return{n,x:p.x+(up?8:-8),y:p.y}}),a=points[0],z=points.at(-1),rise=Math.max(-8,Math.min(8,z.y-a.y)),base=up?Math.min(...points.map(p=>p.y))-34:Math.max(...points.map(p=>p.y))+34,span=Math.max(1,z.x-a.x);
  points.forEach(p=>byNote.set(p.n.id,{up,stemX:p.x,beamY:base+rise*((p.x-a.x)/span)}));const end=base+rise,thick=up?5:-5;groups.push({ids:notes.map(n=>n.id),path:`M${a.x} ${base} L${z.x} ${end} L${z.x} ${end+thick} L${a.x} ${base+thick} Z`});
 }
 return{byNote,groups};
}
function pos(n,left,mw,gap,sysH){const s=Math.floor(n.measure/4),m=n.measure%4;return{x:left+m*mw+14+(n.beat/beats())*(mw-25),y:55+s*sysH+n.part*gap-20+n.step*5}}
function headShape(n,x,y){
 const cls='note-head '+(n.duration<2?'filled':'open');
 if(!state.shapedNotes)return node('ellipse',{cx:x,cy:y,rx:9,ry:6,transform:`rotate(-18 ${x} ${y})`,class:cls});
 const letters=['C','D','E','F','G','A','B'],tonics={'C major':'C','G major':'G','D major':'D','F major':'F','E♭ major':'E'},degree=(letters.indexOf(n.pitch[0])-letters.indexOf(tonics[state.key])+7)%7;
 // Aiken seven-shape heads, optically balanced to the ordinary oval head.
 if(degree===0)return node('path',{d:`M${x-9.5} ${y+5.5} L${x+9.5} ${y+5.5} L${x} ${y-7.5} Z`,class:cls});
 if(degree===1)return node('path',{d:`M${x-9} ${y-4.5} L${x+9} ${y-4.5} C${x+8.5} ${y+3.5} ${x+4} ${y+6.5} ${x} ${y+6.5} C${x-4} ${y+6.5} ${x-8.5} ${y+3.5} ${x-9} ${y-4.5} Z`,class:cls});
 if(degree===2)return node('path',{d:`M${x-10} ${y} L${x} ${y-5.5} L${x+10} ${y} L${x} ${y+5.5} Z`,class:cls});
 if(degree===3)return node('path',{d:`M${x-9} ${y-5.5} L${x+9} ${y-5.5} L${x+9} ${y+5.5} Z`,class:cls});
 if(degree===4)return node('ellipse',{cx:x,cy:y,rx:9.5,ry:5.8,transform:`rotate(-18 ${x} ${y})`,class:cls});
 if(degree===5)return node('rect',{x:x-9,y:y-5.2,width:18,height:10.4,rx:.7,class:cls});
 return node('path',{d:`M${x-9} ${y-2.5} L${x-4} ${y-6} L${x+4} ${y-6} L${x+9} ${y-2.5} L${x} ${y+6} Z`,class:cls});
}
function drawRest(g,n,x,staffY){
 if(n.duration===4)g.append(node('rect',{x:x-8,y:staffY+10,width:16,height:5,rx:.7,class:'rest-symbol'}));
 else if(n.duration===2)g.append(node('rect',{x:x-8,y:staffY+15,width:16,height:5,rx:.7,class:'rest-symbol'}));
 else if(n.duration===.5){g.append(node('circle',{cx:x+4,cy:staffY+11,r:4.2,class:'rest-symbol'}));g.append(node('path',{d:`M${x+7} ${staffY+12} C${x+5} ${staffY+20} ${x+1} ${staffY+27} ${x-3} ${staffY+34}`,class:'rest-stroke'}))}
 else g.append(node('path',{d:`M${x+2} ${staffY+3} L${x-5} ${staffY+15} L${x+2} ${staffY+21} L${x-2} ${staffY+27} C${x+6} ${staffY+25} ${x+8} ${staffY+32} ${x+4} ${staffY+36} C${x} ${staffY+39} ${x-5} ${staffY+34} ${x-4} ${staffY+31} C${x} ${staffY+33} ${x+2} ${staffY+31} ${x} ${staffY+28} L${x-7} ${staffY+21} L${x} ${staffY+10} Z`,class:'rest-symbol'}));
 if(n.dotted)g.append(node('circle',{cx:x+15,cy:staffY+21,r:2.3,class:'dot'}));
}
function drawEvent(root,n,left,mw,gap,sysH,beam){
 const {x,y}=pos(n,left,mw,gap,sysH),staffY=55+Math.floor(n.measure/4)*sysH+n.part*gap,g=node('g',{class:'event'+(selectedIds.has(n.id)?' selected':''),'data-id':n.id,tabindex:0,role:'button'});
 if(n.rest)drawRest(g,n,x,staffY);
 else{if(y<55||y>95)g.append(node('line',{x1:x-14,y1:y,x2:x+14,y2:y,class:'ledger'}));g.append(headShape(n,x,y));const up=beam?beam.up:effectiveStem(n)==='up',stemX=beam?beam.stemX:x+(up?8:-8),stemY=beam?beam.beamY:y+(up?-34:34);if(n.duration<4)g.append(node('line',{x1:stemX,y1:y,x2:stemX,y2:stemY,class:'stem'}));if(n.duration===.5&&!beam){const sx=x+(up?8:-8),sy=y+(up?-34:34),d=up?`M${sx} ${sy} C${sx+3} ${sy+6} ${sx+16} ${sy+7} ${sx+18} ${sy+16} C${sx+19} ${sy+23} ${sx+14} ${sy+27} ${sx+10} ${sy+29} C${sx+14} ${sy+20} ${sx+10} ${sy+14} ${sx} ${sy+11} Z`:`M${sx} ${sy} C${sx+3} ${sy-6} ${sx+16} ${sy-7} ${sx+18} ${sy-16} C${sx+19} ${sy-23} ${sx+14} ${sy-27} ${sx+10} ${sy-29} C${sx+14} ${sy-20} ${sx+10} ${sy-14} ${sx} ${sy-11} Z`;g.append(node('path',{d,class:'flag'}))}if(n.accidental)txt(g,glyph(n.accidental),{x:x-24,y:y+6,class:'accidental'});if(n.dotted)g.append(node('circle',{cx:x+17,cy:y,r:2.3,class:'dot'}))}
 if(n.lyric)txt(g,n.lyric,{x,y:y+64,class:'lyric'});g.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.shiftKey||$('#multi-select').checked){selectedIds.has(n.id)&&selectedIds.size>1?selectedIds.delete(n.id):selectedIds.add(n.id)}else{selectedIds.clear();selectedIds.add(n.id)}selected=n.id;state.activePart=n.part;$('#lyric').value=n.lyric||'';render()});root.append(g);
}
function enter(e,hit,left,mw,gap,sysH){
 const root=$('#score'),q=root.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const matrix=root.getScreenCTM();if(!matrix)return;const pt=q.matrixTransform(matrix.inverse()),part=+hit.dataset.part,sys=+hit.dataset.system,staffY=55+sys*sysH+part*gap,mi=Math.max(0,Math.min(3,Math.floor((pt.x-left)/mw))),measure=sys*4+mi;if(measure>=state.measures)return;
 const mx=pt.x-(left+mi*mw),beat=Math.max(0,Math.min(beats()-.5,Math.round(((mx-14)/(mw-25))*beats()*2)/2)),step=Math.max(0,Math.min(14,Math.round((pt.y-(staffY-20))/5)));
 snap();state.activePart=part;if(!input.chord||input.rest)state.notes=state.notes.filter(n=>!(n.part===part&&n.voice===input.voice&&n.measure===measure&&n.beat===beat));else state.notes=state.notes.filter(n=>!(n.part===part&&n.voice===input.voice&&n.measure===measure&&n.beat===beat&&n.step===step));const n={id:String(Date.now())+Math.random(),part,voice:input.voice,measure,beat,step,duration:input.duration,dotted:input.dotted,rest:input.rest,accidental:input.accidental,pitch:pitch(part,step,input.accidental),lyric:'',stem:'auto'};state.notes.push(n);selected=n.id;selectedIds.clear();selectedIds.add(n.id);render();
}
function clearSelection(){selected=null;selectedIds.clear();$('#lyric').value=''}
function activate(sel,b){$$(sel).forEach(x=>x.classList.toggle('active',x===b))}
$$('[data-duration]').forEach(b=>b.onclick=()=>{input.duration=+b.dataset.duration;activate('[data-duration]',b);render()});
$$('[data-voice]').forEach(b=>b.onclick=()=>{input.voice=+b.dataset.voice;activate('[data-voice]',b);render()});
$$('[data-accidental]').forEach(b=>b.onclick=()=>{input.accidental=b.dataset.accidental;activate('[data-accidental]',b);render()});
$('#dotted').onchange=e=>{input.dotted=e.target.checked;render()};$('#rest-mode').onchange=e=>{input.rest=e.target.checked;render()};$('#chord-mode').onchange=e=>{input.chord=e.target.checked;render()};$('#shape-mode').onchange=e=>{state.shapedNotes=e.target.checked;render()};
$$('[data-stem]').forEach(b=>b.onclick=()=>{const notes=state.notes.filter(n=>selectedIds.has(n.id)&&!n.rest&&n.duration<4);if(!notes.length)return toast('Select a note with a stem first.');snap();notes.forEach(n=>n.stem=b.dataset.stem);render();toast(`Stem direction: ${b.dataset.stem}.`)});
$('#beam-notes').onclick=()=>{const notes=state.notes.filter(n=>selectedIds.has(n.id)).sort((a,b)=>a.beat-b.beat);if(notes.length<2)return toast('Select at least two eighth notes.');const first=notes[0],valid=notes.every((n,i)=>!n.rest&&n.duration===.5&&!n.dotted&&n.part===first.part&&n.voice===first.voice&&n.measure===first.measure&&(i===0||Math.abs(n.beat-notes[i-1].beat-.5)<.01));if(!valid)return toast('Choose consecutive eighth notes in one voice and measure.');snap();const group='beam-'+Date.now()+'-'+Math.random();notes.forEach(n=>n.beamGroup=group);render();toast(`${notes.length} eighth notes beamed.`)};
$('#unbeam-notes').onclick=()=>{const groups=new Set(state.notes.filter(n=>selectedIds.has(n.id)&&n.beamGroup).map(n=>n.beamGroup));if(!groups.size)return toast('Select a beamed note first.');snap();state.notes.forEach(n=>{if(groups.has(n.beamGroup))delete n.beamGroup});render();toast('Beam removed.')};
$('#title').oninput=e=>{state.title=e.target.value||'Untitled anthem';render()};$('#key').onchange=e=>{state.key=e.target.value;render()};$('#time').onchange=e=>{snap();state.time=e.target.value;render()};$('#tempo').onchange=e=>{state.tempo=Math.max(40,Math.min(220,+e.target.value||92));render()};
$('#template').onchange=e=>{snap();state.template=e.target.value;state.activePart=0;state.notes=[];clearSelection();render();toast('Template changed; score cleared.')};
$('#apply-lyric').onclick=()=>{const n=state.notes.find(n=>n.id===selected);if(!n)return toast('Select a note first.');snap();n.lyric=$('#lyric').value.trim();render()};
function remove(){if(!selectedIds.size)return;snap();state.notes=state.notes.filter(n=>!selectedIds.has(n.id));clearSelection();render()}$('#delete-note').onclick=remove;
$('#undo').onclick=()=>{if(history.length){state=JSON.parse(history.pop());clearSelection();render()}};
$('#add-measure').onclick=()=>{snap();state.measures+=4;render();toast('Four measures added.')};
$('#new-score').onclick=()=>{if(confirm('Begin a new score?')){snap();state=fresh();clearSelection();render()}};
function stop(){timers.forEach(clearTimeout);timers=[];if(audio){audio.close();audio=null}$$('.playing').forEach(x=>x.classList.remove('playing'))}
function choirRoom(ctx){
 const length=Math.floor(ctx.sampleRate*1.65),impulse=ctx.createBuffer(2,length,ctx.sampleRate);
 for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<length;i++){const fade=(1-i/length)**2.6;data[i]=(Math.random()*2-1)*fade}}
 const convolver=ctx.createConvolver();convolver.buffer=impulse;return convolver;
}
function choirVoice(ctx,dry,wet,hz,when,duration,level,part){
 const finish=when+duration,release=.24,source=ctx.createGain(),body=ctx.createBiquadFilter(),voice=ctx.createGain(),pan=ctx.createStereoPanner();
 body.type='lowpass';body.frequency.value=part<2?3600:2800;body.Q.value=.7;pan.pan.value=Math.max(-.42,Math.min(.42,(part-(parts().length-1)/2)*.28));
 voice.gain.setValueAtTime(.0001,when);voice.gain.exponentialRampToValueAtTime(level,when+.11);voice.gain.setValueAtTime(level,Math.max(when+.12,finish-.09));voice.gain.exponentialRampToValueAtTime(.0001,finish+release);
 source.connect(body).connect(voice).connect(pan);pan.connect(dry);pan.connect(wet);
 [[720,5.5,.8],[1120,7,.42],[2550,10,.13]].forEach(([frequency,q,amount])=>{const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=amount;source.connect(filter).connect(gain).connect(voice)});
 const vibrato=ctx.createOscillator(),vibratoDepth=ctx.createGain();vibrato.frequency.value=5.1+(part*.12);vibratoDepth.gain.setValueAtTime(0,when);vibratoDepth.gain.linearRampToValueAtTime(Math.max(1.2,hz*.006),when+.28);vibrato.connect(vibratoDepth);
 [-5,4].forEach((detune,index)=>{const osc=ctx.createOscillator(),oscGain=ctx.createGain();osc.type=index?'triangle':'sawtooth';osc.frequency.value=hz;osc.detune.value=detune+(part*1.2);oscGain.gain.value=index?.34:.16;vibratoDepth.connect(osc.frequency);osc.connect(oscGain).connect(source);osc.start(when);osc.stop(finish+release+.04)});
 vibrato.start(when);vibrato.stop(finish+release+.04);
}
function play(partOnly=false){
 stop();const ns=state.notes.filter(n=>!n.rest&&(!partOnly||n.part===state.activePart)).sort((a,b)=>a.measure*beats()+a.beat-b.measure*beats()-b.beat);if(!ns.length)return toast('There are no notes to play.');
 audio=new(window.AudioContext||window.webkitAudioContext)();const master=audio.createGain(),compressor=audio.createDynamicsCompressor(),dry=audio.createGain(),wet=audio.createGain(),room=choirRoom(audio),sec=60/state.tempo,start=audio.currentTime+.1;
 master.gain.value=.72;compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.012;compressor.release.value=.22;dry.gain.value=.9;wet.gain.value=.18;dry.connect(master);wet.connect(room).connect(master);master.connect(compressor).connect(audio.destination);
 const notesAtOnce=new Map();ns.forEach(n=>{const key=`${n.measure}:${n.beat}`;notesAtOnce.set(key,(notesAtOnce.get(key)||0)+1)});
 ns.forEach(n=>{const at=(n.measure*beats()+n.beat)*sec,dur=n.duration*(n.dotted?1.5:1)*sec*.92,count=notesAtOnce.get(`${n.measure}:${n.beat}`)||1,level=(partOnly?.13:.105)/Math.sqrt(count);choirVoice(audio,dry,wet,freq(n.pitch),start+at,dur,level,n.part);timers.push(setTimeout(()=>document.querySelector(`[data-id="${CSS.escape(n.id)}"]`)?.classList.add('playing'),at*1000));timers.push(setTimeout(()=>document.querySelector(`[data-id="${CSS.escape(n.id)}"]`)?.classList.remove('playing'),(at+dur)*1000))});
 const last=Math.max(...ns.map(n=>(n.measure*beats()+n.beat+n.duration*(n.dotted?1.5:1))*sec));timers.push(setTimeout(stop,last*1000+650));toast(partOnly?'Playing selected part with choir sound.':'Playing full choir.');
}
$('#play-all').onclick=()=>play();$('#play-part').onclick=()=>play(true);$('#stop').onclick=stop;
function lilyPitch(p){const m=p.match(/^([A-G])([#b]?)(\d)$/),names={C:'c',D:'d',E:'e',F:'f',G:'g',A:'a',B:'b'};let s=names[m[1]]+(m[2]==='#'?'is':m[2]==='b'?'es':'');return s+(+m[3]>=4?"'".repeat(+m[3]-3):','.repeat(3-+m[3]))}
function lilyDur(n){return({4:'1',2:'2',1:'4',.5:'8'}[n.duration]||'4')+(n.dotted?'.':'')}
function gaps(g){const out=[];for(const [b,d] of [[4,'1'],[2,'2'],[1,'4'],[.5,'8']])while(g>=b-.01){out.push('r'+d);g-=b}return out}
function lilyVoice(part,voice){let out=[];for(let m=0;m<state.measures;m++){let cur=0,t=[],events=state.notes.filter(n=>Number(n.part)===part&&Number(n.voice??1)===voice&&Number(n.measure)===m).sort((a,b)=>Number(a.beat)-Number(b.beat)||Number(a.step)-Number(b.step)),groups=[],beamRanges=new Map();for(const n of events){let g=groups.find(g=>Number(g[0].beat)===Number(n.beat));g?g.push(n):groups.push([n]);if(n.beamGroup&&!n.rest&&n.duration===.5&&!n.dotted){const a=beamRanges.get(n.beamGroup)||[];a.push(n);beamRanges.set(n.beamGroup,a)}}for(const a of beamRanges.values())a.sort((x,y)=>x.beat-y.beat);for(const g of groups){const first=g[0],start=Number(first.beat);if(start>cur)t.push(...gaps(start-cur));const sounding=g.filter(n=>!n.rest),pitchToken=sounding.length>1?'<'+sounding.map(n=>lilyPitch(n.pitch)).join(' ')+'>':sounding.length?lilyPitch(sounding[0].pitch):'r',stem=first.stem==='up'?'\\stemUp ':first.stem==='down'?'\\stemDown ':'\\stemNeutral ',range=beamRanges.get(first.beamGroup),beamStart=range?.length>1&&range[0].id===first.id?'[':'',beamEnd=range?.length>1&&range.at(-1).id===first.id?']':'';t.push(stem+pitchToken+lilyDur(first)+beamStart+beamEnd);cur=Math.max(cur,start+Math.max(...g.map(n=>Number(n.duration)*(n.dotted?1.5:1))))}if(cur<beats())t.push(...gaps(beats()-cur));out.push(t.join(' ')+' |')}return out.join('\n    ')}
function lilySource(){const km={'C major':'c \\major','G major':'g \\major','D major':'d \\major','F major':'f \\major','E♭ major':'ees \\major'},heads=state.shapedNotes?'\\aikenHeads ':'',ids=['partOne','partTwo','partThree','partFour'];let defs='',staves='';parts().forEach((p,i)=>{const id=ids[i],lyrics=state.notes.filter(n=>Number(n.part)===i&&Number(n.voice??1)===1&&!n.rest&&n.lyric).sort((a,b)=>Number(a.measure)-Number(b.measure)||Number(a.beat)-Number(b.beat)).map(n=>n.lyric.replace(/-/g,' -- ')).join(' ');defs+=`${id}Upper = { ${heads}\\autoBeamOff \\key ${km[state.key]} \\time ${state.time} \\tempo 4 = ${state.tempo}\n    ${lilyVoice(i,1)}\n}\n${id}Lower = { ${heads}\\autoBeamOff ${lilyVoice(i,2)} }\n${id}Lyrics = \\lyricmode { ${lyrics} }\n\n`;staves+=`    \\new Staff \\with { instrumentName = "${p[1]}" } <<\n      \\clef ${p[2]} \\new Voice = "${id}" { \\voiceOne \\${id}Upper }\n      \\new Voice { \\voiceTwo \\${id}Lower }\n      \\new Lyrics \\lyricsto "${id}" { \\${id}Lyrics }\n    >>\n`});return `\\version "2.24.0"\n\\header { title = "${state.title.replace(/"/g,'\\\"')}" tagline = ##f }\n\n${defs}\\score {\n  \\new ChoirStaff <<\n${staves}  >>\n  \\layout { }\n  \\midi { }\n}\n`}
function exportName(ext){return(state.title||'choir_score').replace(/[^a-z0-9]+/gi,'_')+'.'+ext}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportLy(){download(new Blob([lilySource()],{type:'text/plain;charset=utf-8'}),exportName('ly'));toast('LilyPond code exported.')}
function renderLilyPdf(src){return new Promise((resolve,reject)=>{const ws=new WebSocket('wss://render.hacklily.org/rpc'),id='choir-notes-'+Date.now()+'-'+Math.random(),timer=setTimeout(()=>{ws.close();reject(new Error('The LilyPond renderer timed out.'))},25000);let done=false;const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);ws.close();fn(value)};ws.onopen=()=>ws.send(JSON.stringify({jsonrpc:'2.0',id,method:'render',params:{version:'stable',backend:'pdf',src}}));ws.onmessage=e=>{let response;try{response=JSON.parse(e.data)}catch{return}if(response.id!==id)return;if(response.error)return finish(reject,new Error('LilyPond could not typeset this score.'));const logs=response.result?.logs||'';if(/(^|\n).*error:/i.test(logs)){console.error(logs);return finish(reject,new Error('LilyPond found an error in the generated score.'))}const pdf=response.result?.files?.[0];if(!pdf)return finish(reject,new Error('The renderer returned no PDF.'));finish(resolve,pdf)};ws.onerror=()=>finish(reject,new Error('Could not reach the LilyPond renderer.'));ws.onclose=()=>{if(!done)finish(reject,new Error('The LilyPond renderer closed the connection.'))}})}
async function exportPdf(){const button=$('#export-score');button.disabled=true;button.textContent='Typesetting…';toast('Sending score to the online LilyPond renderer…');try{const base64=await renderLilyPdf(lilySource()),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));download(new Blob([bytes],{type:'application/pdf'}),exportName('pdf'));toast('LilyPond PDF exported.')}catch(error){console.error(error);toast(error.message||'PDF export failed.')}finally{button.disabled=false;button.textContent='Export'}}
$('#export-score').onclick=()=>$('#export-format').value==='pdf'?exportPdf():exportLy();
addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('#undo').click()}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}else if(e.key===' '){e.preventDefault();play()}else if({'1':4,'2':2,'4':1,'8':.5}[e.key])$('[data-duration="'+{'1':4,'2':2,'4':1,'8':.5}[e.key]+'"]').click();else if(e.key.toLowerCase()==='r')$('#rest-mode').click();else if(e.key.toLowerCase()==='c')$('#chord-mode').click();else if(e.key.toLowerCase()==='s')$('#shape-mode').click();else if(e.key==='.')$('#dotted').click()});
render();initAuth();
