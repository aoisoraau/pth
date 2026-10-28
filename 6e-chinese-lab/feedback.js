/* 6E Chinese Lab: layered local audio and tactile visual feedback. No network, analytics or external assets. */
(() => {
'use strict';
const VERSION='20261028-sfx1';
const prefKey='6e-lab-feedback-v1';
let prior=null;
try { prior=JSON.parse(localStorage.getItem(prefKey)||'null'); } catch (_) {}
const prefs=Object.assign({volume:0.45,haptics:false},prior||{});
prefs.volume=Math.max(0,Math.min(1,Number(prefs.volume)||0));
// The hosted release starts with sound enabled; later mute choices are preserved.
if(!prior){DB.settings.sound=true;save();}
const persist=()=>{try{localStorage.setItem(prefKey,JSON.stringify(prefs));}catch(_){}};
persist();
let ctx=null,master=null,noise=null,forceKind=null,lastSound=0,lastTick=0;
let soundFailed=false,pressed=null;
const nodes=new Set();
const reduced=()=>isReduced();
function setGain(){if(ctx&&master)master.gain.setTargetAtTime(DB.settings.sound?prefs.volume*0.5:0,ctx.currentTime,0.015);}
function unlock(){
 if(!DB.settings.sound)return;
 try{
  if(!ctx){
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return;
   ctx=new AC({latencyHint:'interactive'});
   master=ctx.createGain();
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-12;limiter.knee.value=10;limiter.ratio.value=10;
   limiter.attack.value=0.003;limiter.release.value=0.12;
   master.connect(limiter);limiter.connect(ctx.destination);
   noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*0.25),ctx.sampleRate);
   const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
   setGain();
  }
  if(ctx.state==='suspended'||ctx.state==='interrupted')ctx.resume().catch(()=>{});
 }catch(_){if(!soundFailed){soundFailed=true;toast('聲音未能啟動；視覺回饋仍可使用。');}}
}
function tone(freq,delay,dur=0.14,level=0.25,type='sine',to=null){
 if(!ctx||!master)return;
 const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);
 if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+0.006);
 g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 o.connect(g);g.connect(master);nodes.add(o);
 o.onended=()=>{nodes.delete(o);o.disconnect();g.disconnect();};
 o.start(t);o.stop(t+dur+0.02);
}
function air(delay=0,dur=0.045,level=0.055,freq=1800){
 if(!ctx||!noise)return;
 const t=ctx.currentTime+delay,b=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
 b.buffer=noise;f.type='bandpass';f.frequency.value=freq;f.Q.value=0.8;
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+0.004);
 g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 b.connect(f);f.connect(g);g.connect(master);nodes.add(b);
 b.onended=()=>{nodes.delete(b);b.disconnect();f.disconnect();g.disconnect();};
 b.start(t);b.stop(t+dur+0.01);
}
function play(kind){
 if(!DB.settings.sound||document.hidden||prefs.volume===0)return;
 unlock();if(!ctx||ctx.state!=='running')return;
 const now=performance.now();
 if(['tap','tick','snap'].includes(kind)&&now-lastSound<35)return;
 lastSound=now;
 switch(kind){
 case 'tap':tone(680,0,0.065,0.19,'triangle',440);air(0,0.025,0.035,2500);break;
 case 'pickup':tone(250,0,0.085,0.16,'triangle',650);air(0,0.055,0.05,1400);break;
 case 'tick':tone(980,0,0.035,0.08,'sine');break;
 case 'snap':tone(150,0,0.075,0.27,'sine',95);tone(940,0.012,0.1,0.18,'triangle',680);air(0,0.026,0.065,2200);break;
 case 'release':tone(430,0,0.08,0.11,'triangle',230);break;
 case 'correct':
  [523.25,659.25,783.99,1046.5].forEach((n,i)=>tone(n,i*0.065,0.24,i===3?0.19:0.24,'sine'));
  tone(130.81,0,0.2,0.19,'triangle');air(0.02,0.07,0.035,3600);break;
 case 'retry':tone(370,0,0.17,0.18,'sine',310);tone(294,0.10,0.19,0.13,'triangle');break;
 case 'start':air(0,0.18,0.06,1300);[261.63,392,523.25,783.99].forEach((n,i)=>tone(n,i*0.055,0.19,0.2,'triangle'));break;
 case 'next':air(0,0.11,0.07,1700);tone(440,0,0.10,0.12,'sine',660);break;
 case 'finish':
  [523.25,659.25,783.99,1046.5].forEach((n,i)=>tone(n,i*0.1,0.28,0.22,'triangle'));
  [523.25,659.25,783.99,1046.5].forEach(n=>tone(n,0.45,0.65,0.085,'sine'));
  tone(130.81,0.45,0.7,0.18);break;
 case 'hint':tone(660,0,0.16,0.14);tone(880,0.065,0.18,0.12);break;
 }
}
function pulseVibration(kind){
 if(!prefs.haptics||!navigator.vibrate||document.hidden)return;
 const p={tap:5,snap:12,correct:[12,35,18],retry:[7,35,7],finish:[15,45,15,45,24]}[kind];
 if(p)try{navigator.vibrate(p);}catch(_){}
}
function anim(el,frames,options){
 if(!el||reduced()||!el.animate)return;
 el.animate(frames,Object.assign({duration:250,easing:'cubic-bezier(.2,.8,.3,1)'},options||{}));
}
function floatPoints(text,anchor){
 if(reduced()||!anchor)return;
 const r=anchor.getBoundingClientRect(),p=document.createElement('span');
 p.className='lab-fx-points';p.textContent=text;p.setAttribute('aria-hidden','true');
 p.style.left=Math.min(innerWidth-100,Math.max(20,r.right-80))+'px';
 p.style.top=Math.max(90,r.top+18)+'px';document.body.appendChild(p);
 setTimeout(()=>p.remove(),1100);
}
function feedback(kind){
 pulseVibration(kind);
 requestAnimationFrame(()=>{
  const work=document.querySelector('.workspace');
  if(kind==='correct'){
   anim(work,[{boxShadow:'0 0 0 0 rgba(40,115,91,0)'},{boxShadow:'0 0 0 6px rgba(40,115,91,.22)',offset:.25},{boxShadow:'0 0 0 0 rgba(40,115,91,0)'}],{duration:650});
   anim(document.querySelector('.feedback.good'),[{transform:'translateY(8px) scale(.985)',opacity:.6},{transform:'translateY(-2px) scale(1.005)',opacity:1,offset:.7},{transform:'translateY(0) scale(1)',opacity:1}],{duration:370});
   anim(document.querySelector('.score-val'),[{transform:'scale(1)'},{transform:'scale(1.28)',color:'#28735b',offset:.35},{transform:'scale(1)'}],{duration:420});
   const points=outcome()?.points; if(Number.isFinite(points))floatPoints('+'+points+' 能量',work);
  }else if(kind==='retry'){
   anim(work,[{transform:'translateX(0)'},{transform:'translateX(-4px)',offset:.2},{transform:'translateX(4px)',offset:.4},{transform:'translateX(-2px)',offset:.65},{transform:'translateX(0)'}],{duration:260});
  }else if(kind==='snap'){
   anim(document.querySelector('.chip-socket.filled')||document.querySelector('.word-track')||document.querySelector('.sentence-track'),[{transform:'scale(.986)'},{transform:'scale(1.008)',offset:.6},{transform:'scale(1)'}],{duration:240});
  }else if(kind==='tap'){
   anim(document.querySelector('.option.selected:last-of-type')||document.querySelector('.rhet-chip.selected')||document.querySelector('.cartridge.selected'),[{transform:'scale(.975)'},{transform:'scale(1.018)',offset:.65},{transform:'scale(1)'}],{duration:200});
  }else if(kind==='next'||kind==='start'){
   anim(work,[{opacity:.3,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:230});
  }else if(kind==='finish'){
   anim(document.querySelector('.finish-badge'),[{transform:'rotate(-12deg) scale(.7)'},{transform:'rotate(3deg) scale(1.08)',offset:.68},{transform:'rotate(-7deg) scale(1)'}],{duration:550});
  }
 });
}
// Replace the original synth; existing game event routes still control scoring.
sfx=function(kind){kind=forceKind||kind;play(kind);feedback(kind);};
function withKind(kind,fn,args){const old=forceKind;forceKind=kind;try{return fn(...args);}finally{forceKind=old;}}
const oldTapWord=tapWord;tapWord=function(...args){return withKind('snap',oldTapWord,args);};
const oldMoveSentence=moveSentence;moveSentence=function(...args){return withKind('snap',oldMoveSentence,args);};
const oldNext=next;next=function(...args){return withKind(S.game&&S.game.index===S.game.qids.length-1?'finish':'next',oldNext,args);};
const oldDragMove=dragMove;
dragMove=function(e){
 const was=drag?.active;oldDragMove(e);
 if(drag?.active&&!was)play('pickup');
 if(!drag?.active)return;
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop],[data-sentence]');
 const key=target?(target.dataset.sentence||target.dataset.drop):'';
 if(key!==drag.fxTarget){drag.fxTarget=key;if(key&&performance.now()-lastTick>100){lastTick=performance.now();play('tick');}}
};
const oldDragEnd=dragEnd;
dragEnd=function(e){
 const dr=drag,active=dr?.active;
 const hit=document.elementFromPoint(e.clientX,e.clientY);
 const accepted=active&&(dr.type==='rhet'?!!hit?.closest('[data-drop="rhet"]'):dr.type==='sentence'?!!hit?.closest('[data-sentence]'):!!hit?.closest('[data-drop="word"],[data-drop="bank"]'));
 withKind(accepted?'snap':'tap',oldDragEnd,[e]);
 if(active&&!accepted)play('release');
};
// Existing listener registrations retain the previous function references.
document.removeEventListener('pointermove',oldDragMove);
document.removeEventListener('pointerup',oldDragEnd);
document.addEventListener('pointermove',dragMove,{passive:false});
document.addEventListener('pointerup',dragEnd,{passive:false});
const style=document.createElement('style');style.id='lab-feedback-style';style.textContent=`
.score-val{display:inline-block;transform-origin:center}.lab-pressed{filter:brightness(.97);box-shadow:inset 0 2px 5px #2b254014!important}
.lab-fx-ring{position:fixed;pointer-events:none;z-index:30000;width:34px;height:34px;border:2px solid #a38be3;border-radius:50%;animation:lab-ring .33s ease-out forwards}
.lab-fx-points{position:fixed;pointer-events:none;z-index:30000;color:#28735b;background:#f5fff3;border:1px solid #b9d9ba;border-radius:24px;padding:7px 14px;font-size:18px;font-weight:850;box-shadow:0 5px 20px #28735b20;animation:lab-points 1s ease-out forwards}
.lab-sound-control{background:#f0ebfa;border:1px solid #dbd0ed;padding:16px 18px;border-radius:14px;margin:18px 0}.lab-sound-control label{display:flex;justify-content:space-between;font-size:14px;font-weight:750;margin-bottom:11px}.lab-sound-control input{width:100%;accent-color:#6550ca;min-height:34px;touch-action:pan-x}.lab-sound-control p{font-size:12px;color:#796d87;line-height:1.8;margin:9px 0}.lab-sound-control .button-row{gap:8px}.lab-sound-status{font-size:11px;color:#796d87;margin-top:8px}.top-tools [data-action="sound"]{border:1px solid #ded4ec}.top-tools [data-action="sound"].active{box-shadow:0 0 0 3px #6550ca0e}.chip-socket.dropzone-active{box-shadow:0 0 0 5px #6550ca14,inset 0 0 20px #6550ca0a}.word-track.dropzone-active{box-shadow:0 0 0 4px #6550ca14}.drag-ghost{transition:box-shadow .12s;box-shadow:0 16px 30px #2d1c4b40,0 0 0 2px #a38be355}
@keyframes lab-ring{from{opacity:.6;transform:translate(-50%,-50%) scale(.4)}to{opacity:0;transform:translate(-50%,-50%) scale(1.8)}}
@keyframes lab-points{0%{opacity:0;transform:translateY(10px) scale(.9)}20%{opacity:1;transform:translateY(0) scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-35px)}}
@media(prefers-reduced-motion:reduce){.lab-fx-ring,.lab-fx-points{display:none}}.reduced-motion .lab-fx-ring,.reduced-motion .lab-fx-points{display:none}
`;document.head.appendChild(style);
function clearPress(){pressed?.classList.remove('lab-pressed');pressed=null;}
document.addEventListener('pointerdown',e=>{
 unlock();const b=e.target.closest('button');if(!b||b.disabled)return;
 clearPress();pressed=b;b.classList.add('lab-pressed');
 if(reduced())return;
 const ring=document.createElement('span');ring.className='lab-fx-ring';ring.setAttribute('aria-hidden','true');
 ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';document.body.appendChild(ring);setTimeout(()=>ring.remove(),380);
},{capture:true,passive:true});
document.addEventListener('pointerup',clearPress,{capture:true,passive:true});
document.addEventListener('pointercancel',clearPress,{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(!e.repeat)unlock();},{capture:true});
function installControls(){
 const body=document.querySelector('#dialog .dialog-body');if(!body||body.querySelector('.lab-sound-control'))return;
 const box=document.createElement('section');box.className='lab-sound-control';
 box.innerHTML=`<label for="lab-volume">音效音量 <output id="lab-volume-value">${Math.round(prefs.volume*100)}%</output></label><input id="lab-volume" type="range" min="0" max="100" step="5" value="${Math.round(prefs.volume*100)}" aria-label="音效音量"><div class="button-row"><button class="btn compact" type="button" data-fx="preview">試聽接駁音效</button>${navigator.vibrate?`<button class="btn compact" type="button" data-fx="haptic" aria-pressed="${prefs.haptics}">裝置震動：${prefs.haptics?'開':'關'}</button>`:''}</div><p>按鍵、卡片吸附、答對、重試及完成任務各有聲效。不播放背景音樂；右上角喇叭可一鍵靜音。</p><div class="lab-sound-status">${DB.settings.sound?'音效已開啟':'目前為靜音'} · 音效在此裝置即時合成</div>`;
 body.prepend(box);
}
const oldSettingsModal=settingsModal;
settingsModal=function(...args){oldSettingsModal(...args);const a=document.querySelector('[data-setting="sound"]')?.closest('.setting-row')?.querySelector('small');if(a)a.textContent='按鍵、吸附、答對及完成任務的分層音效。';installControls();};
document.addEventListener('input',e=>{if(e.target.id!=='lab-volume')return;prefs.volume=Math.max(0,Math.min(1,Number(e.target.value)/100));document.getElementById('lab-volume-value').textContent=Math.round(prefs.volume*100)+'%';setGain();persist();});
document.addEventListener('change',e=>{if(e.target.id==='lab-volume')play('snap');});
const handled=new Set(['selectStage','prevStage','nextStage','start','freshStart','option','word','moveSentence','next','submit','toggleSetting','sound']);
document.addEventListener('click',e=>{
 if(Date.now()<suppressClickUntil)return;
 const fx=e.target.closest('[data-fx]');
 if(fx){
  if(fx.dataset.fx==='preview'){
   if(!DB.settings.sound){toast('目前為靜音，請先開啟「操作音效」。');return;}
   unlock();play('snap');setTimeout(()=>play('correct'),220);
  }else if(fx.dataset.fx==='haptic'){prefs.haptics=!prefs.haptics;persist();fx.textContent='裝置震動：'+(prefs.haptics?'開':'關');fx.setAttribute('aria-pressed',String(prefs.haptics));pulseVibration('snap');}
  return;
 }
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
 const action=b.dataset.action;
 if(action==='sound'||(action==='toggleSetting'&&b.dataset.setting==='sound')){
  setGain();persist();if(!DB.settings.sound){for(const n of nodes)try{n.stop();}catch(_){}nodes.clear();}else{unlock();play('snap');}
  const status=document.querySelector('.lab-sound-status');if(status)status.textContent=(DB.settings.sound?'音效已開啟':'目前為靜音')+' · 音效在此裝置即時合成';
 }else if(!handled.has(action))sfx(action==='hint'?'hint':'tap');
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearPress();if(ctx?.state==='running')ctx.suspend().catch(()=>{});}else if(DB.settings.sound&&ctx?.state==='suspended')ctx.resume().catch(()=>{});});
const originalHeader=header;
header=function(){return originalHeader().replace('離線就緒','音效互動版');};
// Re-render only the untouched initial home, not an in-progress task.
if(S.screen==='home')home();
window.LabFeedback={version:VERSION,diagnostics:()=>({audioState:ctx?.state||'not-started',enabled:DB.settings.sound,volume:prefs.volume,activeNodes:nodes.size,questions:Object.keys(Q).length}),preview:kind=>{unlock();play(kind||'snap');}};
})();
