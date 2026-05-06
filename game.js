/* ═══════════════════════════════════════════════════════════════
   FOCUS RUNNER ⚡ v2.0 — AAA Game Engine
   Firebase sync · XP/Rank · Achievements · Tutorial · Ghost runs
   ══════════════════════════════════════════════════════════════ */
'use strict';

// ─── FIREBASE LAZY IMPORT (non-blocking) ────────────────────────
let _db=null,_auth=null,_setDoc=null,_doc=null,_getDoc=null,_serverTimestamp=null,_firebaseUser=null;
(async()=>{
  try{
    const fb=await import('./firebase.js');
    _db=fb.db;_auth=fb.auth;_setDoc=fb.setDoc;_doc=fb.doc;
    _getDoc=fb.getDoc;_serverTimestamp=fb.serverTimestamp;
    fb.onAuthStateChanged(fb.auth,user=>{
      _firebaseUser=user;
      if(user) loadCloudProfile(user);
    });
  }catch(e){console.warn('[FR] Firebase offline mode');}
})();

// ─── SETTINGS ──────────────────────────────────────────────────
const Settings={
  sound:  localStorage.getItem('fr_sound')  !=='off',
  vibrate:localStorage.getItem('fr_vibrate')!=='off',
  toggle(k){this[k]=!this[k];localStorage.setItem('fr_'+k,this[k]?'on':'off');}
};

// ─── SAVE ────────────────────────────────────────────────────────
const Save={
  g:k=>localStorage.getItem(k),
  s:(k,v)=>localStorage.setItem(k,v),
  get highScore()   {return+this.g('fr_highScore')||0;},
  get totalCoins()  {return+this.g('fr_totalCoins')||0;},
  get bestDistance(){return+this.g('fr_bestDistance')||0;},
  get bestCombo()   {return+this.g('fr_bestCombo')||0;},
  get totalXP()     {return+this.g('fr_totalXP')||0;},
  get gamesPlayed() {return+this.g('fr_gamesPlayed')||0;},
  get correctAns()  {return+this.g('fr_correctAns')||0;},
  get achievements(){try{return JSON.parse(this.g('fr_achievements')||'[]');}catch(e){return[];}},
  get ghostBest()   {try{return JSON.parse(this.g('fr_ghostBest')||'null');}catch(e){return null;}},
  get uid()         {let id=this.g('fr_uid');if(!id){id=crypto.randomUUID();this.s('fr_uid',id);}return id;},
  get username()    {return this.g('fr_username')||'Runner';},
  set highScore(v)    {this.s('fr_highScore',v);},
  set totalCoins(v)   {this.s('fr_totalCoins',v);},
  set bestDistance(v) {this.s('fr_bestDistance',v);},
  set bestCombo(v)    {this.s('fr_bestCombo',v);},
  set totalXP(v)      {this.s('fr_totalXP',v);},
  set gamesPlayed(v)  {this.s('fr_gamesPlayed',v);},
  set correctAns(v)   {this.s('fr_correctAns',v);},
  set achievements(v) {this.s('fr_achievements',JSON.stringify(v));},
  set ghostBest(v)    {this.s('fr_ghostBest',JSON.stringify(v));},
};

// ─── RANK SYSTEM ─────────────────────────────────────────────────
const RANKS=[
  {name:'Beginner', xp:0,    color:'#94a3b8',glow:'rgba(148,163,184,0.4)',icon:'🏅'},
  {name:'Focused',  xp:200,  color:'#22d3ee',glow:'rgba(34,211,238,0.4)', icon:'🎯'},
  {name:'Scholar',  xp:600,  color:'#a78bfa',glow:'rgba(167,139,250,0.4)',icon:'📚'},
  {name:'Elite',    xp:1400, color:'#fb923c',glow:'rgba(251,146,60,0.4)', icon:'⚡'},
  {name:'Master',   xp:3000, color:'#f472b6',glow:'rgba(244,114,182,0.4)',icon:'🔥'},
  {name:'Legend',   xp:6000, color:'#ffd700',glow:'rgba(255,215,0,0.5)',  icon:'👑'},
];
const getRank   =xp=>{for(let i=RANKS.length-1;i>=0;i--)if(xp>=RANKS[i].xp)return RANKS[i];return RANKS[0];};
const getNextRank=xp=>{for(let i=0;i<RANKS.length;i++)if(xp<RANKS[i].xp)return RANKS[i];return null;};
const getXPPct   =xp=>{const c=getRank(xp),n=getNextRank(xp);if(!n)return 100;return Math.round((xp-c.xp)/(n.xp-c.xp)*100);};

// ─── XP SYSTEM ────────────────────────────────────────────────────
let sessionXP=0;
const XP_MAP={collect:2,correct_answer:10,score_1k:20,score_5k:50,score_10k:100,distance_500:30,distance_1k:60};
function awardXP(type,mult=1){
  const base=XP_MAP[type]||5;
  const earned=Math.max(1,Math.floor(base*mult));
  sessionXP+=earned;
  Save.totalXP=Save.totalXP+earned;
  showXPToast(earned);
  return earned;
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────
const ACH_DEFS=[
  {id:'first_run',    name:'First Step',    desc:'Complete your first run',        icon:'🚀',xp:25},
  {id:'score_1k',     name:'Four Figures',  desc:'Score 1,000 points',             icon:'💯',xp:20},
  {id:'score_5k',     name:'Score Machine', desc:'Score 5,000 points',             icon:'⭐',xp:50},
  {id:'score_10k',    name:'Legend Score',  desc:'Score 10,000 points',            icon:'🏆',xp:100},
  {id:'combo_5',      name:'Combo King',    desc:'Reach x5 combo',                 icon:'🔥',xp:15},
  {id:'combo_10',     name:'Unstoppable',   desc:'Reach x10 combo',                icon:'💥',xp:30},
  {id:'perfect_q',    name:'Quick Thinker', desc:'10 correct answers in one run',  icon:'🧠',xp:40},
  {id:'distance_500', name:'Half-K Runner', desc:'Run 500m in one session',        icon:'🏃',xp:30},
  {id:'distance_1k',  name:'Marathon Mind', desc:'Run 1,000m in one session',      icon:'🌟',xp:60},
  {id:'no_hit',       name:'Ghost Runner',  desc:'Finish a run without being hit', icon:'👻',xp:50},
  {id:'speed_8',      name:'Speed Demon',   desc:'Reach Speed Level 8',            icon:'⚡',xp:35},
  {id:'coin_100',     name:'Coin Collector',desc:'Collect 100 coins total',        icon:'💰',xp:25},
  {id:'games_10',     name:'Dedicated',     desc:'Play 10 games',                  icon:'🎮',xp:30},
  {id:'shield_5',     name:'Defender',      desc:'Use a shield 5 times',           icon:'🛡️',xp:20},
];
let sessionAch=new Set();
let achQueue=[],achShowing=false;
function checkAch(id){
  if(Save.achievements.includes(id)||sessionAch.has(id))return;
  const def=ACH_DEFS.find(a=>a.id===id);if(!def)return;
  sessionAch.add(id);
  const arr=Save.achievements;arr.push(id);Save.achievements=arr;
  achQueue.push(def);
  if(!achShowing)processAchQueue();
}
function processAchQueue(){
  if(!achQueue.length){achShowing=false;return;}
  achShowing=true;
  const def=achQueue.shift();
  const box=document.getElementById('achievementBox');if(!box)return;
  document.getElementById('achIcon').textContent=def.icon;
  document.getElementById('achName').textContent=def.name;
  document.getElementById('achDesc').textContent=def.desc;
  document.getElementById('achXP').textContent='+'+def.xp+' XP';
  AudioSys.play('achieve');vibe([50,30,80]);
  box.classList.add('show');
  setTimeout(()=>{box.classList.remove('show');setTimeout(processAchQueue,400);},2800);
}

// ─── FIREBASE SYNC ────────────────────────────────────────────────
async function syncToFirebase(data){
  if(!_db||!_firebaseUser||!_setDoc||!_doc)return;
  try{
    await _setDoc(_doc(_db,'leaderboard',_firebaseUser.uid),{
      name:_firebaseUser.displayName||Save.username,
      uid:_firebaseUser.uid,
      score:data.score||0,
      distance:data.distance||0,
      coins:data.coins||0,
      combo:data.combo||0,
      xp:Save.totalXP,
      rank:getRank(Save.totalXP).name,
      gamesPlayed:Save.gamesPlayed,
      achievements:Save.achievements,
      updatedAt:_serverTimestamp?_serverTimestamp():new Date().toISOString(),
    },{merge:true});
  }catch(e){console.warn('[FR] sync failed:',e);}
}
async function loadCloudProfile(user){
  if(!_db||!_getDoc||!_doc)return;
  try{
    const snap=await _getDoc(_doc(_db,'leaderboard',user.uid));
    if(snap.exists()){
      const d=snap.data();
      if(d.score    >Save.highScore)    Save.highScore    =d.score;
      if(d.distance >Save.bestDistance) Save.bestDistance =d.distance;
      if(d.combo    >Save.bestCombo)    Save.bestCombo    =d.combo;
      if(d.xp       >Save.totalXP)      Save.totalXP      =d.xp;
    }
    updateStartStats();
  }catch(e){}
}

// ─── AUDIO ───────────────────────────────────────────────────────
const AudioSys={
  ctx:null,
  init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}},
  play(type){
    if(!Settings.sound||!this.ctx)return;
    const ctx=this.ctx;
    if(ctx.state==='suspended')ctx.resume();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    const now=ctx.currentTime;
    const C={
      collect: {t:'sine',     f:[880,1320], g:[0.2,0.001], d:0.15},
      hit:     {t:'sawtooth', f:[180,60],   g:[0.35,0.001],d:0.25},
      boost:   {t:'sine',     f:[440,1760], g:[0.25,0.001],d:0.35},
      wrong:   {t:'square',   f:[220,110],  g:[0.2,0.001], d:0.25},
      coin:    {t:'triangle', f:[1046,1046],g:[0.15,0.001],d:0.12},
      rankup:  {t:'sine',     f:[523,1047], g:[0.3,0.001], d:0.5},
      achieve: {t:'sine',     f:[659,1318], g:[0.28,0.001],d:0.45},
    };
    const c=C[type]||C.collect;
    osc.type=c.t;
    osc.frequency.setValueAtTime(c.f[0],now);
    osc.frequency.exponentialRampToValueAtTime(c.f[1],now+c.d*0.8);
    gain.gain.setValueAtTime(c.g[0],now);
    gain.gain.exponentialRampToValueAtTime(c.g[1],now+c.d);
    osc.start(now);osc.stop(now+c.d);
  }
};
const vibe=p=>Settings.vibrate&&navigator.vibrate&&navigator.vibrate(p);

// ─── QUESTIONS (60) ──────────────────────────────────────────────
const QUESTIONS=[
  {q:"7 × 8 = ?",             a:"56",                    opts:["48","56","54","63"]},
  {q:"Capital of France?",    a:"Paris",                 opts:["Berlin","Madrid","Paris","Rome"]},
  {q:"√144 = ?",              a:"12",                    opts:["11","14","12","13"]},
  {q:"H₂O is?",               a:"Water",                 opts:["Salt","Water","Acid","Gas"]},
  {q:"Largest planet?",       a:"Jupiter",               opts:["Saturn","Jupiter","Mars","Neptune"]},
  {q:"9² = ?",                a:"81",                    opts:["72","81","90","64"]},
  {q:"Speed of light?",       a:"3×10⁸ m/s",            opts:["3×10⁶","3×10⁸","3×10⁵","9×10⁸"]},
  {q:"Romeo & Juliet author?",a:"Shakespeare",           opts:["Dickens","Shakespeare","Twain","Tolstoy"]},
  {q:"15% of 200?",           a:"30",                    opts:["25","35","30","20"]},
  {q:"Closest planet to Sun?",a:"Mercury",               opts:["Venus","Earth","Mercury","Mars"]},
  {q:"2 + 2 × 2 = ?",         a:"6",                    opts:["8","6","4","16"]},
  {q:"Capital of Japan?",     a:"Tokyo",                 opts:["Seoul","Beijing","Tokyo","Bangkok"]},
  {q:"Symbol for Gold?",      a:"Au",                    opts:["Go","Gd","Au","Ag"]},
  {q:"Sides in hexagon?",     a:"6",                     opts:["5","7","6","8"]},
  {q:"Boiling point H₂O °C?", a:"100",                  opts:["90","100","110","120"]},
  {q:"Mona Lisa painter?",    a:"Da Vinci",              opts:["Picasso","Da Vinci","Monet","Dali"]},
  {q:"25 ÷ 5 = ?",            a:"5",                    opts:["4","6","5","7"]},
  {q:"Largest ocean?",        a:"Pacific",               opts:["Atlantic","Indian","Pacific","Arctic"]},
  {q:"Symbol for Oxygen?",    a:"O",                    opts:["Or","Ox","O","Om"]},
  {q:"π ≈ ?",                 a:"3.14",                 opts:["3.12","3.14","3.16","3.18"]},
  {q:"WW2 ended in?",         a:"1945",                 opts:["1943","1944","1945","1946"]},
  {q:"Powerhouse of cell?",   a:"Mitochondria",         opts:["Nucleus","Mitochondria","Ribosome","Vacuole"]},
  {q:"1 km = ? m",            a:"1000",                 opts:["100","1000","10000","10"]},
  {q:"Photosynthesis needs?", a:"Sunlight",             opts:["Water","Sunlight","CO₂","Oxygen"]},
  {q:"Largest continent?",    a:"Asia",                 opts:["Africa","Asia","Europe","Americas"]},
  {q:"12 × 12 = ?",          a:"144",                   opts:["124","132","144","148"]},
  {q:"Bones in human body?",  a:"206",                  opts:["204","206","208","210"]},
  {q:"Light year measures?",  a:"Distance",             opts:["Time","Distance","Speed","Weight"]},
  {q:"Fastest land animal?",  a:"Cheetah",              opts:["Lion","Horse","Cheetah","Jaguar"]},
  {q:"Newton's 1st law?",     a:"Inertia",              opts:["Motion","Gravity","Inertia","Force"]},
  {q:"Symbol for Sodium?",    a:"Na",                   opts:["So","Na","Sd","Sn"]},
  {q:"60 × 60 = ?",          a:"3600",                  opts:["3200","3400","3600","4000"]},
  {q:"Logic brain side?",     a:"Left",                 opts:["Right","Left","Both","None"]},
  {q:"Hardest substance?",    a:"Diamond",              opts:["Iron","Steel","Diamond","Quartz"]},
  {q:"CO₂ is?",              a:"Carbon Dioxide",        opts:["Carbon Monoxide","Carbon Dioxide","Chlorine","Cobalt"]},
  {q:"√256 = ?",             a:"16",                    opts:["14","15","16","17"]},
  {q:"Earth year = ?",       a:"365 days",              opts:["360 days","365 days","366 days","364 days"]},
  {q:"g = ? m/s²",           a:"9.8",                   opts:["8.8","9.2","9.8","10.2"]},
  {q:"Tallest mountain?",    a:"Everest",               opts:["K2","Kangchenjunga","Everest","Lhotse"]},
  {q:"3⁴ = ?",              a:"81",                    opts:["64","81","72","96"]},
  {q:"Atom center?",         a:"Nucleus",               opts:["Core","Center","Nucleus","Proton"]},
  {q:"Capital of Australia?",a:"Canberra",              opts:["Sydney","Melbourne","Canberra","Brisbane"]},
  {q:"Universal blood donor?",a:"O-",                  opts:["A+","O+","O-","AB-"]},
  {q:"Python is a?",         a:"Programming Language",  opts:["Snake","Programming Language","Framework","Database"]},
  {q:"LCM of 4 and 6?",      a:"12",                   opts:["8","10","12","24"]},
  {q:"Deepest ocean point?",  a:"Mariana Trench",       opts:["Bermuda Triangle","Mariana Trench","Pacific Deep","Java Trench"]},
  {q:"1 byte = ? bits",       a:"8",                   opts:["4","8","16","32"]},
  {q:"Frequency unit?",       a:"Hertz",               opts:["Watt","Pascal","Hertz","Newton"]},
  {q:"Area of circle?",       a:"πr²",                 opts:["2πr","πd","πr²","2πr²"]},
  {q:"Ozone blocks?",         a:"UV Rays",             opts:["Rain","UV Rays","Wind","Heat"]},
  {q:"WWII started in?",      a:"1939",                opts:["1935","1937","1939","1941"]},
  {q:"Newton's 3rd law?",     a:"Action-Reaction",     opts:["Gravity","Inertia","Action-Reaction","Momentum"]},
  {q:"Electron charge?",      a:"Negative",            opts:["Positive","Negative","Neutral","Variable"]},
  {q:"1 mole = ?",           a:"6.022×10²³",           opts:["6.022×10²¹","6.022×10²³","6.022×10²⁵","3.011×10²³"]},
  {q:"F = ?",                a:"Mass × Acceleration",  opts:["Mass × Velocity","Mass × Acceleration","Weight × Time","Energy × Distance"]},
  {q:"Ohm's law V = ?",      a:"IR",                   opts:["I/R","IR","I+R","R/I"]},
  {q:"Derivative of x²?",   a:"2x",                   opts:["x","2x","x²","2x²"]},
  {q:"sin 90° = ?",          a:"1",                   opts:["0","1","0.5","√2/2"]},
  {q:"Light in water?",      a:"Slower",               opts:["Faster","Slower","Same","Zero"]},
  {q:"HCl is?",              a:"Hydrochloric Acid",    opts:["Hydrochloric Acid","Hydroxide","Hydrogen Chlorate","Hypochlorous Acid"]},
  {q:"Valence electrons C?", a:"4",                    opts:["2","3","4","6"]},
  {q:"1 Pascal = ?",         a:"N/m²",                 opts:["kg/m","N/m²","J/s","W/m²"]},
];

// ─── PARTICLE POOL ───────────────────────────────────────────────
const POOL=Array.from({length:300},()=>({active:false,x:0,y:0,vx:0,vy:0,life:0,size:4,color:'#fff',type:'spark'}));
function getP(){return POOL.find(p=>!p.active)||POOL[0];}
function spawnP(x,y,color,count=8,type='spark'){
  for(let i=0;i<count;i++){
    const p=getP();
    const ang=(Math.PI*2/count)*i+Math.random()*0.6;
    const spd=1.5+Math.random()*3;
    p.active=true;p.x=x;p.y=y;
    p.vx=Math.cos(ang)*spd;p.vy=Math.sin(ang)*spd-(type==='burst'?2:0);
    p.life=1;p.size=type==='burst'?5+Math.random()*6:2+Math.random()*5;
    p.color=color;p.type=type;
  }
}

// ─── GHOST SYSTEM ────────────────────────────────────────────────
let ghostFrames=[],ghostPlayback=null,ghostIdx=0;
function recordGhost(){if(ghostFrames.length<5000)ghostFrames.push({lane:G.playerLane,y:G.playerY,frame:G.frame});}

// ─── GAME STATE ──────────────────────────────────────────────────
let G={};
function resetState(){
  ghostFrames=[];ghostIdx=0;ghostPlayback=Save.ghostBest||null;
  sessionXP=0;sessionAch=new Set();
  G={
    running:false,paused:false,
    score:0,coins:0,distance:0,lives:3,
    combo:1,bestCombo:1,
    shield:false,shieldTimer:0,shieldsUsed:0,
    boost:false,boostTimer:0,
    speed:3.5,baseSpeed:3.5,speedLevel:1,
    frame:0,
    questionTimer:0,questionInterval:()=>280+Math.random()*380,nextQuestion:0,
    difficultyTimer:0,
    playerLane:1,targetLane:1,laneT:1,playerX:0,
    playerY:0,playerVY:0,
    jumping:false,sliding:false,slideTimer:0,
    invincible:false,invincibleTimer:0,
    hitlessRun:true,correctQ:0,totalQ:0,
    obstacles:[],collectibles:[],
    obsTimer:0,obsInterval:80,colTimer:0,colInterval:60,
    trackOffset:0,cityOffset:0,
    lastTime:0,raf:null,
    shakeDecay:0,shakeX:0,shakeY:0,
    flash:0,flashCol:'#fff',
    xp1k:false,xp5k:false,xp10k:false,d500:false,d1k:false,
  };
}

// ─── CANVAS ──────────────────────────────────────────────────────
const gameCanvas=document.getElementById('gameCanvas');
const ctx=gameCanvas.getContext('2d',{alpha:false});
const bgCanvas=document.getElementById('bgCanvas');
const bgCtx=bgCanvas.getContext('2d');
let W=0,H=0,LANE_W=0,LANE_X=[],GROUND_Y=0;
const PR=20;

function resize(){
  W=window.innerWidth;H=window.innerHeight;
  gameCanvas.width=W;gameCanvas.height=H;
  bgCanvas.width=W;bgCanvas.height=H;
  LANE_W=W/3;LANE_X=[LANE_W*.5,LANE_W*1.5,LANE_W*2.5];
  GROUND_Y=H*.70;
  if(G)G.playerX=LANE_X[G.playerLane||1];
}
window.addEventListener('resize',resize);resize();

// ─── BG SYSTEM ───────────────────────────────────────────────────
const STARS=Array.from({length:130},()=>({
  x:Math.random()*2000,y:Math.random()*1200,
  r:Math.random()*1.8+.2,
  vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,
  a:Math.random()*.6+.15,h:160+Math.random()*80,
}));
const RAIN=Array.from({length:Math.max(20,Math.floor(W/24))},()=>({
  x:Math.random()*2000,y:Math.random()*1200,
  spd:1+Math.random()*2,a:Math.random()*.1+.03,
  chars:'⚡📚🧠🔬⭐',
}));
let bgF=0;

function renderBg(){
  bgF++;
  bgCtx.fillStyle='#000010';
  bgCtx.fillRect(0,0,W,H);
  const gr=bgCtx.createRadialGradient(W*.3,H*.2,0,W*.3,H*.2,W*.8);
  gr.addColorStop(0,'rgba(0,10,40,0.8)');gr.addColorStop(1,'rgba(0,0,16,0)');
  bgCtx.fillStyle=gr;bgCtx.fillRect(0,0,W,H);

  STARS.forEach(s=>{
    s.x+=s.vx;s.y+=s.vy;
    if(s.x<0)s.x=W;if(s.x>W)s.x=0;
    if(s.y<0)s.y=H;if(s.y>H)s.y=0;
    bgCtx.beginPath();bgCtx.arc(s.x,s.y,s.r,0,Math.PI*2);
    bgCtx.fillStyle=`hsla(${s.h},100%,85%,${s.a+Math.sin(bgF*.03+s.x)*.05})`;
    bgCtx.fill();
  });

  bgCtx.strokeStyle='rgba(0,245,255,0.045)';bgCtx.lineWidth=1;
  const g1=(bgF*1.2)%60;
  for(let y=g1;y<H;y+=60){bgCtx.beginPath();bgCtx.moveTo(0,y);bgCtx.lineTo(W,y);bgCtx.stroke();}
  const g2=(bgF*.9)%80;
  for(let x=g2;x<W;x+=80){bgCtx.beginPath();bgCtx.moveTo(x,0);bgCtx.lineTo(x,H);bgCtx.stroke();}

  bgCtx.font='10px monospace';bgCtx.textAlign='center';
  RAIN.forEach(d=>{
    d.y+=d.spd;if(d.y>H+20){d.y=-20;d.x=Math.random()*W;}
    bgCtx.fillStyle=`rgba(0,255,136,${d.a})`;
    bgCtx.fillText(d.chars[Math.floor(bgF/8)%d.chars.length],d.x,d.y);
  });
  bgCtx.textAlign='left';
  requestAnimationFrame(renderBg);
}
renderBg();

// ─── ENVIRONMENT ─────────────────────────────────────────────────
function drawEnv(){
  G.cityOffset=(G.cityOffset||0)+G.speed*.7;
  const vp={x:W/2,y:GROUND_Y*.3};

  // Road
  const rg=ctx.createLinearGradient(0,vp.y,0,H);
  rg.addColorStop(0,'rgba(0,20,50,0)');rg.addColorStop(.4,'rgba(0,20,50,0.88)');rg.addColorStop(1,'rgba(0,5,20,0.96)');
  ctx.fillStyle=rg;ctx.fillRect(0,vp.y,W,H);

  // Road edges
  ctx.strokeStyle='rgba(0,245,255,0.13)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(vp.x-15,vp.y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(W,H);ctx.lineTo(vp.x+15,vp.y);ctx.stroke();

  // Lane lines
  ctx.setLineDash([18,14]);ctx.lineDashOffset=-(G.trackOffset*1.2%32);
  ctx.strokeStyle='rgba(0,245,255,0.08)';ctx.lineWidth=1;
  [.33,.67].forEach(t=>{ctx.beginPath();ctx.moveTo(t*W,H);ctx.lineTo(vp.x,vp.y);ctx.stroke();});
  ctx.setLineDash([]);

  // City layers (parallax)
  [[.2,70,'rgba(0,15,40,0.15)'],[.45,110,'rgba(0,15,40,0.3)'],[.85,155,'rgba(0,15,40,0.55)']].forEach(([spd,bh,fill],li)=>{
    const off=(G.cityOffset*spd)%(W+200);
    ctx.fillStyle=fill;
    for(let i=0;i<8;i++){
      const bx=((i*(W/4+li*28)-off+W*2)%(W+200))-50;
      const h=bh+(i*37+li*19)%80,bw=26+li*9;
      ctx.fillRect(bx,GROUND_Y-h,bw,h);
      ctx.fillStyle=`rgba(0,245,255,${.07+li*.04})`;
      for(let wy=0;wy<4;wy++)for(let wx=0;wx<3;wx++){
        if(Math.floor((G.frame*.05+i*3+wy*7)%20)===0)continue;
        ctx.fillRect(bx+3+wx*8,GROUND_Y-h+6+wy*14,5,8);
      }
      ctx.fillStyle=fill;
    }
  });

  // Ground glow
  const gg=ctx.createLinearGradient(0,GROUND_Y,W,GROUND_Y);
  gg.addColorStop(0,'rgba(0,245,255,0)');
  gg.addColorStop(.25,'rgba(0,245,255,0.72)');
  gg.addColorStop(.5,'rgba(191,0,255,0.85)');
  gg.addColorStop(.75,'rgba(0,245,255,0.72)');
  gg.addColorStop(1,'rgba(0,245,255,0)');
  ctx.beginPath();ctx.moveTo(0,GROUND_Y);ctx.lineTo(W,GROUND_Y);
  ctx.strokeStyle=gg;ctx.lineWidth=2;
  ctx.shadowColor='#00f5ff';ctx.shadowBlur=14;ctx.stroke();ctx.shadowBlur=0;

  // Speed streaks
  if(G.boost||G.speedLevel>=5){
    const a=G.boost?.18:(G.speedLevel-4)*.025;
    ctx.strokeStyle=`rgba(0,245,255,${a})`;ctx.lineWidth=1;
    for(let i=0;i<12;i++){
      const sy=GROUND_Y*.4+Math.random()*GROUND_Y*.5;
      const len=20+Math.random()*60;
      ctx.beginPath();ctx.moveTo(Math.random()*W,sy);ctx.lineTo(Math.random()*W+len,sy);ctx.stroke();
    }
  }
  G.trackOffset+=G.speed;
}

// ─── PLAYER ──────────────────────────────────────────────────────
function drawPlayer(){
  G.laneT=Math.min(1,G.laneT+.18);
  G.playerX+=( LANE_X[G.playerLane]-G.playerX)*G.laneT;
  const px=G.playerX+G.shakeX;
  const bodyR=G.sliding?PR*.5:PR;
  const py=GROUND_Y-bodyR-G.playerY+G.shakeY;
  if(G.invincible&&G.frame%6<3)return;
  const gc=G.shield?'#00f5ff':G.boost?'#ffee00':'#00ff88';
  const rc=getRank(Save.totalXP).color;
  ctx.save();
  // Aura
  const aura=ctx.createRadialGradient(px,py,0,px,py,bodyR*3.5);
  aura.addColorStop(0,gc+'44');aura.addColorStop(1,'transparent');
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(px,py,bodyR*3.5,0,Math.PI*2);ctx.fill();
  // Shadow
  ctx.beginPath();ctx.ellipse(px,GROUND_Y+2,bodyR*.9,4,0,0,Math.PI*2);
  ctx.fillStyle=`rgba(0,0,0,${.35-G.playerY*.002})`;ctx.fill();
  // Glow
  ctx.shadowColor=gc;ctx.shadowBlur=G.boost?32:20;
  // Core
  const og=ctx.createRadialGradient(px-bodyR*.3,py-bodyR*.3,1,px,py,bodyR);
  og.addColorStop(0,'#fff');og.addColorStop(.35,gc);og.addColorStop(.75,rc+'cc');og.addColorStop(1,'transparent');
  ctx.beginPath();ctx.arc(px,py,bodyR,0,Math.PI*2);ctx.fillStyle=og;ctx.fill();
  ctx.shadowBlur=0;
  // Spinning rings
  const ra=G.frame*.06;
  ctx.beginPath();ctx.arc(px,py,bodyR*1.35,ra,ra+Math.PI*1.3);
  ctx.strokeStyle=gc+'aa';ctx.lineWidth=1.5;ctx.shadowColor=gc;ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(px,py,bodyR*1.6,-ra,-ra+Math.PI*.8);
  ctx.strokeStyle=rc+'77';ctx.lineWidth=1;ctx.stroke();
  // Shield bubble
  if(G.shield){
    const pulse=1+Math.sin(G.frame*.15)*.08;
    ctx.beginPath();ctx.arc(px,py,bodyR*2.1*pulse,0,Math.PI*2);
    ctx.strokeStyle='#00f5ff';ctx.lineWidth=2;
    ctx.shadowColor='#00f5ff';ctx.shadowBlur=22;
    ctx.globalAlpha=.5+Math.sin(G.frame*.12)*.25;ctx.stroke();
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
  ctx.restore();
  // Trail
  if(G.frame%2===0)spawnP(px+(Math.random()-.5)*10,py+bodyR*.5,gc,2,'trail');
}

// ─── GHOST ───────────────────────────────────────────────────────
function drawGhost(){
  if(!ghostPlayback||ghostIdx>=ghostPlayback.length)return;
  while(ghostIdx<ghostPlayback.length-1&&ghostPlayback[ghostIdx].frame<G.frame)ghostIdx++;
  const gf=ghostPlayback[ghostIdx];if(!gf)return;
  const gx=LANE_X[gf.lane],gy=GROUND_Y-PR-gf.y;
  ctx.save();ctx.globalAlpha=.22;
  ctx.beginPath();ctx.arc(gx,gy,PR*.85,0,Math.PI*2);
  ctx.fillStyle='#00f5ff22';ctx.strokeStyle='#00f5ff88';ctx.lineWidth=1.5;
  ctx.fill();ctx.stroke();ctx.restore();
}

// ─── PARTICLES ───────────────────────────────────────────────────
function drawParticles(){
  POOL.forEach(p=>{
    if(!p.active)return;
    p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.vx*=.96;
    p.life-=p.type==='trail'?.12:.04;
    if(p.life<=0){p.active=false;return;}
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.1,p.size*p.life),0,Math.PI*2);
    ctx.fillStyle=p.color+Math.floor(p.life*255).toString(16).padStart(2,'0');
    ctx.fill();
  });
}

// ─── OBJECTS ─────────────────────────────────────────────────────
const OBS_E=['📱','💬','🎮','📲','🔔','🕹️','📺','💻','🎵','📸'];
const COL_E=['📚','🧠','💡','🔬','📖','⭐','🎯','🔑'];

function drawObjects(){
  const sz=Math.min(LANE_W*.48,38);
  G.obstacles.forEach(o=>{
    const ox=LANE_X[o.lane],wb=Math.sin(G.frame*.1+o.ph)*4;
    ctx.shadowColor='#ff00aa';ctx.shadowBlur=14+Math.sin(G.frame*.08+o.ph)*6;
    if(o.y>GROUND_Y*.55){
      const w=(o.y-GROUND_Y*.55)/(GROUND_Y*.45);
      ctx.beginPath();ctx.arc(ox,o.y+wb,sz*.75,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,0,100,${w*.5})`;ctx.lineWidth=2;ctx.stroke();
    }
    ctx.font=`${sz}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(o.emoji,ox,o.y+wb);ctx.shadowBlur=0;
  });
  G.collectibles.forEach(c=>{
    const cx=LANE_X[c.lane],bob=Math.sin(G.frame*.12+c.ph)*7;
    ctx.shadowColor=c.isBoost?'#ffee00':'#00ff88';
    ctx.shadowBlur=18+Math.sin(G.frame*.1+c.ph)*7;
    ctx.beginPath();ctx.arc(cx,c.y+bob,sz*.58,0,Math.PI*2);
    ctx.strokeStyle=c.isBoost?'#ffee0044':'#00ff8844';ctx.lineWidth=1.5;ctx.stroke();
    ctx.font=`${sz*.88}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(c.emoji,cx,c.y+bob);ctx.shadowBlur=0;
  });
  ctx.textAlign='left';
}

// ─── SCREEN FX ───────────────────────────────────────────────────
function drawFX(){
  if(G.flash>0){
    ctx.fillStyle=G.flashCol+Math.floor(G.flash*255).toString(16).padStart(2,'0');
    ctx.fillRect(0,0,W,H);G.flash-=.06;
  }
  if(G.shakeDecay>0){
    G.shakeX=(Math.random()-.5)*G.shakeDecay*12;
    G.shakeY=(Math.random()-.5)*G.shakeDecay*12;
    G.shakeDecay-=.09;
  }else{G.shakeX=0;G.shakeY=0;G.shakeDecay=0;}
}

// ─── HUD ─────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
function updateHUD(){
  const sc=$('hudScore'),co=$('hudCoins'),di=$('hudDist');
  if(sc)sc.textContent=Math.floor(G.score).toLocaleString();
  if(co)co.textContent=G.coins;
  if(di)di.textContent=Math.floor(G.distance)+'m';
}
function updateLives(){
  ['life1','life2','life3'].forEach((id,i)=>{const el=$(id);if(el)el.classList.toggle('dead',i>=G.lives);});
}
function updateCombo(){
  const cv=$('comboVal');if(!cv)return;
  cv.textContent='x'+G.combo;
  cv.style.color=G.combo>=10?'#ffd700':G.combo>=5?'#bf00ff':'#00ff88';
  cv.style.textShadow=G.combo>=10?'0 0 16px #ffd700':G.combo>=5?'0 0 12px #bf00ff':'0 0 8px #00ff88';
}
function updateSpeed(){
  const f=$('speedBar'),l=$('speedLabel');
  if(f)f.style.width=Math.min(100,G.speedLevel*10)+'%';
  if(l)l.textContent='SPEED '+G.speedLevel;
}
function updateShield(){const so=$('shieldOverlay');if(so)so.classList.toggle('active',G.shield);}

// ─── FLOATERS ────────────────────────────────────────────────────
function floatScore(text,x,y,color){
  const el=document.createElement('div');
  el.className='float-score';el.textContent=text;
  el.style.cssText=`left:${x-30}px;top:${y-20}px;color:${color}`;
  $('floatingScores').appendChild(el);setTimeout(()=>el.remove(),1200);
}
function showXPToast(xp){
  if(xp<=0)return;
  const t=document.createElement('div');t.className='xp-toast';t.textContent='+'+xp+' XP';
  document.body.appendChild(t);setTimeout(()=>t.remove(),1500);
}

// ─── RANK UP ─────────────────────────────────────────────────────
let lastRankName='';
function checkRankUp(){
  const r=getRank(Save.totalXP);
  if(lastRankName&&r.name!==lastRankName){
    const el=$('rankUpBox');if(el){
      $('rankUpIcon').textContent=r.icon;
      $('rankUpName').textContent=r.name.toUpperCase();
      el.style.setProperty('--ru-color',r.color);el.style.setProperty('--ru-glow',r.glow);
      AudioSys.play('rankup');vibe([100,50,100,50,200]);
      el.classList.add('show');spawnP(W/2,H/2,r.color,20,'burst');
      setTimeout(()=>el.classList.remove('show'),3200);
    }
  }
  lastRankName=r.name;
}

// ─── GAME LOOP ────────────────────────────────────────────────────
function gameLoop(ts){
  if(!G.running)return;
  G.raf=requestAnimationFrame(gameLoop);
  const dt=Math.min((ts-G.lastTime)/16.667,3);
  G.lastTime=ts;G.frame++;

  ctx.fillStyle='#000010';ctx.fillRect(0,0,W,H);

  // Difficulty
  G.difficultyTimer++;
  if(G.difficultyTimer>=280){
    G.difficultyTimer=0;G.speedLevel=Math.min(10,G.speedLevel+1);
    const v=.85+Math.random()*.3;
    G.baseSpeed=(3.5+G.speedLevel*.38)*v;
    G.obsInterval=Math.max(32,80-G.speedLevel*4+Math.floor(Math.random()*18-9));
    G.colInterval=Math.max(38,70-G.speedLevel*3+Math.floor(Math.random()*14-7));
    updateSpeed();
    if(G.speedLevel>=8)checkAch('speed_8');
  }

  G.speed=G.boost?G.baseSpeed*1.65:G.baseSpeed;
  if(G.boost){G.boostTimer-=dt;if(G.boostTimer<=0)G.boost=false;}
  if(G.shield){G.shieldTimer-=dt;if(G.shieldTimer<=0){G.shield=false;updateShield();}}
  if(G.invincible){G.invincibleTimer-=dt;if(G.invincibleTimer<=0)G.invincible=false;}

  // Physics
  if(G.jumping){G.playerVY-=.75*dt;G.playerY+=G.playerVY*dt;if(G.playerY<=0){G.playerY=0;G.playerVY=0;G.jumping=false;}}
  if(G.sliding){G.slideTimer-=dt;if(G.slideTimer<=0)G.sliding=false;}

  // Progress
  G.distance+=G.speed*dt*.045;
  G.score+=G.speed*G.combo*dt*.28;

  // XP milestones
  if(!G.xp1k&&G.score>=1000){G.xp1k=true;awardXP('score_1k');checkAch('score_1k');}
  if(!G.xp5k&&G.score>=5000){G.xp5k=true;awardXP('score_5k');checkAch('score_5k');}
  if(!G.xp10k&&G.score>=10000){G.xp10k=true;awardXP('score_10k');checkAch('score_10k');}
  if(!G.d500&&G.distance>=500){G.d500=true;awardXP('distance_500');checkAch('distance_500');}
  if(!G.d1k&&G.distance>=1000){G.d1k=true;awardXP('distance_1k');checkAch('distance_1k');}

  // Question trigger
  G.questionTimer++;
  if(G.questionTimer>=G.nextQuestion){G.questionTimer=0;G.nextQuestion=G.questionInterval();showQuestion();return;}

  // Spawn
  G.obsTimer+=dt;if(G.obsTimer>=G.obsInterval){G.obsTimer=0;spawnObs();}
  G.colTimer+=dt;if(G.colTimer>=G.colInterval){G.colTimer=0;spawnCol();}

  // Move
  const mv=G.speed*dt;
  G.obstacles.forEach(o=>o.y+=mv);G.collectibles.forEach(c=>c.y+=mv);
  G.obstacles=G.obstacles.filter(o=>o.y<H+60);
  G.collectibles=G.collectibles.filter(c=>c.y<H+60);

  // Collisions
  if(!G.invincible){
    const px=G.playerX,py=GROUND_Y-PR-G.playerY,hr=PR+13;
    G.obstacles=G.obstacles.filter(o=>{
      const ox=LANE_X[o.lane];
      if(Math.hypot(ox-px,o.y-py)<hr+14){
        if(G.shield){spawnP(ox,o.y,'#00f5ff',10,'burst');G.flash=.15;G.flashCol='#00f5ff';return false;}
        handleHit();return false;
      }return true;
    });
    G.collectibles=G.collectibles.filter(c=>{
      const cx=LANE_X[c.lane];
      if(Math.hypot(cx-px,c.y-py)<hr+18){handleCollect(c);return false;}
      return true;
    });
  }

  if(G.frame%3===0)recordGhost();
  if(G.frame%4===0)updateHUD();

  drawEnv();drawGhost();drawParticles();drawObjects();drawPlayer();drawFX();
}

// ─── SPAWN ───────────────────────────────────────────────────────
function spawnObs(){
  const r=Math.random();
  let lanes=r<.5?[Math.floor(Math.random()*3)]:r<.72?[0,2]:[Math.floor(Math.random()*3)];
  if(new Set(lanes).size>=3)lanes=[lanes[0]];
  lanes.forEach(lane=>G.obstacles.push({lane,y:-50-Math.random()*50,emoji:OBS_E[Math.floor(Math.random()*OBS_E.length)],ph:Math.random()*Math.PI*2}));
}
function spawnCol(){
  const isBoost=Math.random()<.14,isShield=!isBoost&&Math.random()<.08;
  G.collectibles.push({
    lane:Math.floor(Math.random()*3),y:-40-Math.random()*35,
    emoji:isBoost?'⚡':isShield?'🛡️':COL_E[Math.floor(Math.random()*COL_E.length)],
    isBoost,isShield,ph:Math.random()*Math.PI*2,
  });
}

// ─── COLLISION HANDLERS ──────────────────────────────────────────
function handleHit(){
  G.lives--;G.combo=1;G.hitlessRun=false;G.invincible=true;G.invincibleTimer=100;
  updateCombo();vibe([120,50,220]);AudioSys.play('hit');
  spawnP(G.playerX,GROUND_Y-PR-G.playerY,'#ff00aa',14,'burst');
  G.shakeDecay=1.0;G.flash=.38;G.flashCol='#ff003388';
  updateLives();if(G.lives<=0)setTimeout(endGame,350);
}
function handleCollect(c){
  const pts=c.isBoost?60:c.isShield?40:22;
  const coins=c.isBoost?5:1+(G.combo>5?2:0);
  G.score+=pts*G.combo;G.coins+=coins;
  G.combo=Math.min(G.combo+1,20);if(G.combo>G.bestCombo)G.bestCombo=G.combo;
  if(c.isBoost){G.boost=true;G.boostTimer=160;AudioSys.play('boost');G.flash=.12;G.flashCol='#ffee00';}
  else if(c.isShield){G.shield=true;G.shieldTimer=160;G.shieldsUsed++;AudioSys.play('boost');updateShield();if(G.shieldsUsed>=5)checkAch('shield_5');}
  else AudioSys.play('collect');
  AudioSys.play('coin');vibe(20);
  spawnP(LANE_X[c.lane],c.y,c.isBoost?'#ffee00':c.isShield?'#00f5ff':'#00ff88',7,'spark');
  floatScore('+'+Math.floor(pts*G.combo),LANE_X[c.lane],c.y,c.isBoost?'#ffee00':'#00ff88');
  updateCombo();
  if(G.combo>=5)checkAch('combo_5');if(G.combo>=10)checkAch('combo_10');
  const cf=$('comboFlash');
  if(cf){cf.className='combo-flash';void cf.offsetWidth;
    cf.classList.add(G.combo>=10?'flash-gold':G.combo>=5?'flash-purple':'flash-green');
    setTimeout(()=>cf.classList.remove('flash-green','flash-purple','flash-gold'),200);}
  awardXP('collect',Math.floor(G.combo/5)+1);checkRankUp();
}

// ─── QUESTION SYSTEM ─────────────────────────────────────────────
let currentQ=null,qTimeout=null;
function showQuestion(){
  G.running=false;cancelAnimationFrame(G.raf);
  currentQ=QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)];
  const opts=[...currentQ.opts].sort(()=>Math.random()-.5);
  $('qText').textContent=currentQ.q;
  const oe=$('qOptions');oe.innerHTML='';
  opts.forEach(opt=>{
    const btn=document.createElement('button');btn.className='q-option';btn.textContent=opt;
    btn.addEventListener('click',()=>answerQ(opt,btn,oe),{once:true});oe.appendChild(btn);
  });
  const fill=$('qTimerFill');
  if(fill){fill.style.transition='none';fill.style.width='100%';void fill.offsetWidth;fill.style.transition='width 3s linear';fill.style.width='0%';}
  showScreen('questionOverlay');G.totalQ++;
  qTimeout=setTimeout(()=>answerQ('__timeout__',null,oe),3000);
}
function answerQ(answer,btn,oe){
  clearTimeout(qTimeout);const correct=answer===currentQ.a;
  oe.querySelectorAll('.q-option').forEach(b=>{b.style.pointerEvents='none';if(b.textContent===currentQ.a)b.classList.add('correct');});
  if(btn&&!correct)btn.classList.add('wrong');
  if(correct){
    AudioSys.play('boost');vibe(50);
    G.boost=true;G.boostTimer=200;G.shield=true;G.shieldTimer=140;
    G.score+=250*G.combo;G.combo=Math.min(G.combo+2,20);G.correctQ++;
    updateShield();floatScore('+250 ⚡',W/2,H*.45,'#ffee00');
    G.flash=.15;G.flashCol='#00ff88';
    awardXP('correct_answer',G.combo>5?1.5:1);checkRankUp();
    if(G.correctQ>=10)checkAch('perfect_q');
  }else{
    AudioSys.play('wrong');vibe([80,30,80]);
    G.speed=Math.max(2,G.speed*.58);G.baseSpeed=Math.max(2,G.baseSpeed*.68);
    G.combo=Math.max(1,G.combo-2);floatScore('SLOW! 💀',W/2,H*.45,'#ff00aa');
    G.flash=.22;G.flashCol='#ff003388';
  }
  updateCombo();
  setTimeout(()=>{hideScreen('questionOverlay');G.running=true;G.lastTime=performance.now();G.raf=requestAnimationFrame(gameLoop);},700);
}

// ─── CONTROLS ────────────────────────────────────────────────────
let touchStart={x:0,y:0,t:0};
document.addEventListener('touchstart',e=>{const t=e.touches[0];touchStart={x:t.clientX,y:t.clientY,t:Date.now()};},{passive:true});
document.addEventListener('touchend',e=>{
  if(!G.running)return;
  const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  if(Math.abs(dx)>Math.abs(dy)){
    if(Math.abs(dx)>25){const nl=dx>0?Math.min(2,G.playerLane+1):Math.max(0,G.playerLane-1);if(nl!==G.playerLane){G.playerLane=nl;G.laneT=0;vibe(15);}}
  }else{
    if(dy<-25&&!G.jumping){G.jumping=true;G.playerVY=14+G.speedLevel*.25;G.sliding=false;vibe(10);}
    else if(dy>25&&!G.jumping){G.sliding=true;G.slideTimer=40;vibe(10);}
  }
},{passive:true});
document.addEventListener('keydown',e=>{
  if(!G.running)return;
  const{key}=e;
  if(key==='ArrowLeft'&&G.playerLane>0){G.playerLane--;G.laneT=0;}
  else if(key==='ArrowRight'&&G.playerLane<2){G.playerLane++;G.laneT=0;}
  else if(key==='ArrowUp'&&!G.jumping){G.jumping=true;G.playerVY=14;G.sliding=false;}
  else if(key==='ArrowDown'&&!G.jumping){G.sliding=true;G.slideTimer=40;}
});

// ─── TUTORIAL ────────────────────────────────────────────────────
function maybeShowTutorial(){if(!localStorage.getItem('fr_tutorial_done'))showTutorial();}
function showTutorial(){
  const steps=[
    {icon:'👈👉',title:'CHANGE LANES',  text:'Swipe left or right to dodge distractions'},
    {icon:'👆',  title:'JUMP',          text:'Swipe up to jump over low obstacles'},
    {icon:'👇',  title:'SLIDE',         text:'Swipe down to slide under obstacles'},
    {icon:'📚',  title:'COLLECT ITEMS', text:'Grab books, brains, and stars for points'},
    {icon:'⚡',  title:'QUICK BOOST',   text:'Answer correctly for a speed boost + shield'},
  ];
  let step=0;
  const ov=$('tutorialOverlay'),icon=$('tutIcon'),title=$('tutTitle'),text=$('tutText'),dots=$('tutDots'),btn=$('tutBtn');
  function render(){
    const s=steps[step];icon.textContent=s.icon;title.textContent=s.title;text.textContent=s.text;
    btn.textContent=step<steps.length-1?'NEXT →':'LET\'S GO! ⚡';
    dots.innerHTML=steps.map((_,i)=>`<div class="tut-dot ${i===step?'active':''}"></div>`).join('');
  }
  btn.onclick=()=>{step++;if(step>=steps.length){ov.classList.remove('show');localStorage.setItem('fr_tutorial_done','1');return;}render();};
  render();ov.classList.add('show');
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────
function showScreen(id){const el=$(id);if(!el)return;el.style.display='flex';el.classList.add('active');}
function hideScreen(id){const el=$(id);if(!el)return;el.classList.remove('active');el.style.display='none';}
function switchScreen(fromId,toId,delay=160){
  const from=$(fromId);
  if(from){from.classList.add('screen-exit');setTimeout(()=>{from.classList.remove('screen-exit');hideScreen(fromId);},280);}
  setTimeout(()=>showScreen(toId),delay);
}

// ─── GAME FLOW ────────────────────────────────────────────────────
function startGame(){
  AudioSys.init();lastRankName=getRank(Save.totalXP).name;
  resetState();G.playerX=LANE_X[1];G.nextQuestion=G.questionInterval();
  G.lastTime=performance.now();G.running=true;
  switchScreen('startScreen','gameScreen');
  updateLives();updateCombo();updateSpeed();updateHUD();
  setTimeout(()=>{G.raf=requestAnimationFrame(gameLoop);},320);
}

async function endGame(){
  G.running=false;cancelAnimationFrame(G.raf);
  const isRecord=G.score>Save.highScore;
  if(isRecord)Save.highScore=Math.floor(G.score);
  Save.totalCoins+=G.coins;
  if(G.distance>Save.bestDistance)Save.bestDistance=Math.floor(G.distance);
  if(G.bestCombo>Save.bestCombo)Save.bestCombo=G.bestCombo;
  Save.gamesPlayed=Save.gamesPlayed+1;
  Save.correctAns=Save.correctAns+G.correctQ;
  if(isRecord&&ghostFrames.length>10)Save.ghostBest=ghostFrames;

  checkAch('first_run');
  if(G.hitlessRun&&G.distance>80)checkAch('no_hit');
  if(Save.gamesPlayed>=10)checkAch('games_10');
  if(Save.totalCoins>=100)checkAch('coin_100');

  awardXP('collect',Math.max(1,Math.floor(G.combo/3)));checkRankUp();

  // Share XP with study platform
  try{
    const studyXP=parseInt(localStorage.getItem('uw_xp')||'0')+Math.floor(sessionXP*.5);
    localStorage.setItem('uw_xp',studyXP);
    window.dispatchEvent(new CustomEvent('uw_xp_changed',{detail:{xp:studyXP}}));
  }catch(e){}

  syncToFirebase({score:Math.floor(G.score),distance:Math.floor(G.distance),coins:G.coins,combo:G.bestCombo});

  // Populate game over screen
  $('overScore').textContent=Math.floor(G.score).toLocaleString();
  $('overDist').textContent=Math.floor(G.distance)+'m';
  $('overCoins').textContent=G.coins;
  $('overCombo').textContent='x'+G.bestCombo;
  $('overBest').textContent=Save.highScore.toLocaleString();
  $('overXP').textContent='+'+sessionXP+' XP';
  const r=getRank(Save.totalXP),nxt=getNextRank(Save.totalXP);
  $('overRank').textContent=r.icon+' '+r.name;
  $('overRank').style.color=r.color;
  $('overRankFill').style.width=getXPPct(Save.totalXP)+'%';
  $('overRankLabel').textContent=nxt?`${Save.totalXP} / ${nxt.xp} XP → ${nxt.name}`:'👑 MAX RANK';
  $('overTitle').textContent=isRecord?'⚡ LEGEND!':'GAME OVER';
  $('overSubtitle').textContent=isRecord?'New personal record!':'Distraction wins… this time.';
  $('newRecordBadge').style.display=isRecord?'inline-block':'none';
  switchScreen('gameScreen','gameOverScreen');
}

function restartGame(){
  switchScreen('gameOverScreen','gameScreen');
  setTimeout(()=>{
    resetState();G.playerX=LANE_X[1];G.nextQuestion=G.questionInterval();
    G.lastTime=performance.now();G.running=true;lastRankName=getRank(Save.totalXP).name;
    updateLives();updateCombo();updateSpeed();updateHUD();
    G.raf=requestAnimationFrame(gameLoop);
  },320);
}

function goBack(){
  G.running=false;cancelAnimationFrame(G.raf);
  if(window.history.length>1)window.history.back();
  else window.location.href='dashboard-home.html';
}

// ─── SETTINGS ────────────────────────────────────────────────────
window.toggleSound=function(){
  Settings.toggle('sound');
  $('soundIcon').textContent=Settings.sound?'🔊':'🔇';
  $('soundToggle').classList.toggle('active',Settings.sound);
};
window.toggleVibe=function(){
  Settings.toggle('vibrate');
  $('vibeIcon').textContent=Settings.vibrate?'📳':'📴';
  $('vibeToggle').classList.toggle('active',Settings.vibrate);
};

// ─── START SCREEN STATS ──────────────────────────────────────────
function updateStartStats(){
  const el=id=>{const e=$(id);return e;};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  set('previewBest',Save.highScore.toLocaleString());
  set('previewCoins',Save.totalCoins.toLocaleString());
  set('previewDist',Save.bestDistance+'m');
  set('previewXP',Save.totalXP+' XP');
  const r=getRank(Save.totalXP);
  const pr=$('previewRank');
  if(pr){pr.textContent=r.icon+' '+r.name;pr.style.color=r.color;pr.style.textShadow='0 0 10px '+r.color;}
  $('soundToggle')&&$('soundToggle').classList.toggle('active',Settings.sound);
  $('vibeToggle')&&$('vibeToggle').classList.toggle('active',Settings.vibrate);
  $('soundIcon')&&($('soundIcon').textContent=Settings.sound?'🔊':'🔇');
  $('vibeIcon')&&($('vibeIcon').textContent=Settings.vibrate?'📳':'📴');
}

// ─── EXPOSE + BOOT ────────────────────────────────────────────────
window.startGame=startGame;window.restartGame=restartGame;window.goBack=goBack;
updateStartStats();showScreen('startScreen');maybeShowTutorial();
