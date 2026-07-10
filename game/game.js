/* ═══════════════════════════════════════════════════════════════
   FOCUS RUNNER ⚡ v3.0 — KHATARNAK Edition
   Smooth 60fps · SVG character · Neon trails · Real game feel
   ══════════════════════════════════════════════════════════════ */
'use strict';

// ─── FIREBASE DISABLED (this build = full game features, no live/cloud system yet) ───
// Sab _db/_auth/etc null hi rahenge — jahan bhi code `if(_db && ...)` check karta hai,
// wahan wo silently skip ho jaayega. Koi crash nahi, bas cloud sync off hai is build mein.
let _db=null,_auth=null,_setDoc=null,_doc=null,_getDoc=null,_serverTimestamp=null,_firebaseUser=null;
console.log('[FR] Cloud sync disabled in this build — local-only mode.');

// ─── SETTINGS ───────────────────────────────────────────────────
const Settings={sound:localStorage.getItem('fr_sound')!=='off',vibrate:localStorage.getItem('fr_vibrate')!=='off',toggle(k){this[k]=!this[k];localStorage.setItem('fr_'+k,this[k]?'on':'off');}};

// ─── SAVE ────────────────────────────────────────────────────────
const Save={g:k=>localStorage.getItem(k),s:(k,v)=>localStorage.setItem(k,v),
  get highScore(){return+this.g('fr_highScore')||0;},get totalCoins(){return+this.g('fr_totalCoins')||0;},
  get bestDistance(){return+this.g('fr_bestDistance')||0;},get bestCombo(){return+this.g('fr_bestCombo')||0;},
  get totalXP(){return+this.g('fr_totalXP')||0;},get gamesPlayed(){return+this.g('fr_gamesPlayed')||0;},
  get correctAns(){return+this.g('fr_correctAns')||0;},
  get achievements(){try{return JSON.parse(this.g('fr_achievements')||'[]');}catch(e){return[];}},
  get ghostBest(){try{return JSON.parse(this.g('fr_ghostBest')||'null');}catch(e){return null;}},
  get uid(){let id=this.g('fr_uid');if(!id){id=crypto.randomUUID();this.s('fr_uid',id);}return id;},
  get username(){return this.g('fr_username')||'Runner';},
  set highScore(v){this.s('fr_highScore',v);},set totalCoins(v){this.s('fr_totalCoins',v);},
  set bestDistance(v){this.s('fr_bestDistance',v);},set bestCombo(v){this.s('fr_bestCombo',v);},
  set totalXP(v){this.s('fr_totalXP',v);},set gamesPlayed(v){this.s('fr_gamesPlayed',v);},
  set correctAns(v){this.s('fr_correctAns',v);},set achievements(v){this.s('fr_achievements',JSON.stringify(v));},
  set ghostBest(v){this.s('fr_ghostBest',JSON.stringify(v));},
};

// ─── RANKS ───────────────────────────────────────────────────────
const RANKS=[
  {name:'Beginner',xp:0,    color:'#94a3b8',glow:'rgba(148,163,184,0.4)',icon:'🏅',trail:'#94a3b8'},
  {name:'Focused', xp:200,  color:'#22d3ee',glow:'rgba(34,211,238,0.4)', icon:'🎯',trail:'#22d3ee'},
  {name:'Scholar', xp:600,  color:'#a78bfa',glow:'rgba(167,139,250,0.4)',icon:'📚',trail:'#a78bfa'},
  {name:'Elite',   xp:1400, color:'#fb923c',glow:'rgba(251,146,60,0.4)', icon:'⚡',trail:'#fb923c'},
  {name:'Master',  xp:3000, color:'#f472b6',glow:'rgba(244,114,182,0.4)',icon:'🔥',trail:'#f472b6'},
  {name:'Legend',  xp:6000, color:'#ffd700',glow:'rgba(255,215,0,0.5)',  icon:'👑',trail:'#ffd700'},
];
const getRank=xp=>{for(let i=RANKS.length-1;i>=0;i--)if(xp>=RANKS[i].xp)return RANKS[i];return RANKS[0];};
const getNextRank=xp=>{for(let i=0;i<RANKS.length;i++)if(xp<RANKS[i].xp)return RANKS[i];return null;};
const getXPPct=xp=>{const c=getRank(xp),n=getNextRank(xp);if(!n)return 100;return Math.round((xp-c.xp)/(n.xp-c.xp)*100);};

// ─── XP ──────────────────────────────────────────────────────────
let sessionXP=0;
const XP_MAP={collect:2,correct_answer:10,score_1k:20,score_5k:50,score_10k:100,distance_500:30,distance_1k:60};
function awardXP(type,mult=1){const base=XP_MAP[type]||5;const earned=Math.max(1,Math.floor(base*mult));sessionXP+=earned;Save.totalXP=Save.totalXP+earned;showXPToast(earned);return earned;}

// ─── ACHIEVEMENTS ────────────────────────────────────────────────
const ACH_DEFS=[
  {id:'first_run',name:'First Step',desc:'Complete your first run',icon:'🚀',xp:25},
  {id:'score_1k',name:'Four Figures',desc:'Score 1,000 points',icon:'💯',xp:20},
  {id:'score_5k',name:'Score Machine',desc:'Score 5,000 points',icon:'⭐',xp:50},
  {id:'score_10k',name:'Legend Score',desc:'Score 10,000 points',icon:'🏆',xp:100},
  {id:'combo_5',name:'Combo King',desc:'Reach x5 combo',icon:'🔥',xp:15},
  {id:'combo_10',name:'Unstoppable',desc:'Reach x10 combo',icon:'💥',xp:30},
  {id:'perfect_q',name:'Quick Thinker',desc:'10 correct answers in one run',icon:'🧠',xp:40},
  {id:'distance_500',name:'Half-K Runner',desc:'Run 500m',icon:'🏃',xp:30},
  {id:'distance_1k',name:'Marathon Mind',desc:'Run 1,000m',icon:'🌟',xp:60},
  {id:'no_hit',name:'Ghost Runner',desc:'Finish without being hit',icon:'👻',xp:50},
  {id:'speed_8',name:'Speed Demon',desc:'Reach Speed Level 8',icon:'⚡',xp:35},
  {id:'coin_100',name:'Coin Collector',desc:'Collect 100 coins total',icon:'💰',xp:25},
  {id:'games_10',name:'Dedicated',desc:'Play 10 games',icon:'🎮',xp:30},
  {id:'shield_5',name:'Defender',desc:'Use shield 5 times',icon:'🛡️',xp:20},
];
let sessionAch=new Set();let achQueue=[],achShowing=false;
function checkAch(id){
  if(Save.achievements.includes(id)||sessionAch.has(id))return;
  const def=ACH_DEFS.find(a=>a.id===id);if(!def)return;
  sessionAch.add(id);const arr=Save.achievements;arr.push(id);Save.achievements=arr;
  achQueue.push(def);if(!achShowing)processAchQueue();
}
function processAchQueue(){
  if(!achQueue.length){achShowing=false;return;}achShowing=true;
  const def=achQueue.shift();const box=$('achievementBox');if(!box)return;
  $('achIcon').textContent=def.icon;$('achName').textContent=def.name;$('achDesc').textContent=def.desc;$('achXP').textContent='+'+def.xp+' XP';
  AudioSys.play('achieve');vibe([50,30,80]);box.classList.add('show');
  setTimeout(()=>{box.classList.remove('show');setTimeout(processAchQueue,400);},2800);
}

// ─── FIREBASE SYNC ───────────────────────────────────────────────
async function syncToFirebase(data){
  if(!_db||!_firebaseUser||!_setDoc||!_doc)return;
  try{await _setDoc(_doc(_db,'leaderboard',_firebaseUser.uid),{name:_firebaseUser.displayName||Save.username,uid:_firebaseUser.uid,score:data.score||0,distance:data.distance||0,coins:data.coins||0,combo:data.combo||0,xp:Save.totalXP,rank:getRank(Save.totalXP).name,gamesPlayed:Save.gamesPlayed,achievements:Save.achievements,updatedAt:_serverTimestamp?_serverTimestamp():new Date().toISOString()},{merge:true});}
  catch(e){console.warn('[FR] sync:',e);}
}
async function loadCloudProfile(user){
  if(!_db||!_getDoc||!_doc)return;
  try{const snap=await _getDoc(_doc(_db,'leaderboard',user.uid));if(snap.exists()){const d=snap.data();if(d.score>Save.highScore)Save.highScore=d.score;if(d.distance>Save.bestDistance)Save.bestDistance=d.distance;if(d.combo>Save.bestCombo)Save.bestCombo=d.combo;if(d.xp>Save.totalXP)Save.totalXP=d.xp;}updateStartStats();}catch(e){}
}

// ─── AUDIO ───────────────────────────────────────────────────────
const AudioSys={
  ctx:null,
  init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}},
  play(type){
    if(!Settings.sound||!this.ctx)return;
    const ctx=this.ctx;if(ctx.state==='suspended')ctx.resume();
    const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
    o.connect(g);g.connect(ctx.destination);
    const C={collect:{t:'sine',f:[880,1320],gv:[0.18,0.001],d:0.14},hit:{t:'sawtooth',f:[160,55],gv:[0.32,0.001],d:0.28},boost:{t:'sine',f:[440,1760],gv:[0.22,0.001],d:0.38},wrong:{t:'square',f:[200,90],gv:[0.18,0.001],d:0.28},coin:{t:'triangle',f:[1046,1046],gv:[0.12,0.001],d:0.1},rankup:{t:'sine',f:[523,1047],gv:[0.28,0.001],d:0.55},achieve:{t:'sine',f:[659,1318],gv:[0.25,0.001],d:0.48},levelup:{t:'sine',f:[392,1568],gv:[0.28,0.001],d:0.65},countdown:{t:'triangle',f:[660,660],gv:[0.15,0.001],d:0.08},};
    const c=C[type]||C.collect;o.type=c.t;o.frequency.setValueAtTime(c.f[0],now);o.frequency.exponentialRampToValueAtTime(c.f[1],now+c.d*0.8);g.gain.setValueAtTime(c.gv[0],now);g.gain.exponentialRampToValueAtTime(c.gv[1],now+c.d);o.start(now);o.stop(now+c.d);
  },
  playNote(freq,dur=0.1,vol=0.1){
    if(!Settings.sound||!this.ctx)return;const ctx=this.ctx;if(ctx.state==='suspended')ctx.resume();
    const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(0.001,now+dur);o.start(now);o.stop(now+dur);
  }
};
const vibe=p=>Settings.vibrate&&navigator.vibrate&&navigator.vibrate(p);

// ─── QUESTIONS (60+) ─────────────────────────────────────────────
const QUESTIONS=[
  {q:"7 × 8 = ?",a:"56",opts:["48","56","54","63"]},{q:"Capital of France?",a:"Paris",opts:["Berlin","Madrid","Paris","Rome"]},
  {q:"√144 = ?",a:"12",opts:["11","14","12","13"]},{q:"H₂O is?",a:"Water",opts:["Salt","Water","Acid","Gas"]},
  {q:"Largest planet?",a:"Jupiter",opts:["Saturn","Jupiter","Mars","Neptune"]},{q:"9² = ?",a:"81",opts:["72","81","90","64"]},
  {q:"Speed of light?",a:"3×10⁸ m/s",opts:["3×10⁶","3×10⁸","3×10⁵","9×10⁸"]},{q:"2 + 2 × 2 = ?",a:"6",opts:["8","6","4","16"]},
  {q:"Capital of Japan?",a:"Tokyo",opts:["Seoul","Beijing","Tokyo","Bangkok"]},{q:"Symbol for Gold?",a:"Au",opts:["Go","Gd","Au","Ag"]},
  {q:"Sides in hexagon?",a:"6",opts:["5","7","6","8"]},{q:"Boiling point H₂O °C?",a:"100",opts:["90","100","110","120"]},
  {q:"Mona Lisa painter?",a:"Da Vinci",opts:["Picasso","Da Vinci","Monet","Dali"]},{q:"25 ÷ 5 = ?",a:"5",opts:["4","6","5","7"]},
  {q:"Largest ocean?",a:"Pacific",opts:["Atlantic","Indian","Pacific","Arctic"]},{q:"Symbol for Oxygen?",a:"O",opts:["Or","Ox","O","Om"]},
  {q:"π ≈ ?",a:"3.14",opts:["3.12","3.14","3.16","3.18"]},{q:"WW2 ended?",a:"1945",opts:["1943","1944","1945","1946"]},
  {q:"Powerhouse of cell?",a:"Mitochondria",opts:["Nucleus","Mitochondria","Ribosome","Vacuole"]},{q:"1 km = ? m",a:"1000",opts:["100","1000","10000","10"]},
  {q:"Photosynthesis needs?",a:"Sunlight",opts:["Water","Sunlight","CO₂","Oxygen"]},{q:"Largest continent?",a:"Asia",opts:["Africa","Asia","Europe","Americas"]},
  {q:"12 × 12 = ?",a:"144",opts:["124","132","144","148"]},{q:"Bones in human body?",a:"206",opts:["204","206","208","210"]},
  {q:"Fastest land animal?",a:"Cheetah",opts:["Lion","Horse","Cheetah","Jaguar"]},{q:"Newton's 1st law?",a:"Inertia",opts:["Motion","Gravity","Inertia","Force"]},
  {q:"Symbol for Sodium?",a:"Na",opts:["So","Na","Sd","Sn"]},{q:"Hardest substance?",a:"Diamond",opts:["Iron","Steel","Diamond","Quartz"]},
  {q:"CO₂ is?",a:"Carbon Dioxide",opts:["Carbon Monoxide","Carbon Dioxide","Chlorine","Cobalt"]},{q:"√256 = ?",a:"16",opts:["14","15","16","17"]},
  {q:"Earth year = ?",a:"365 days",opts:["360 days","365 days","366 days","364 days"]},{q:"g = ? m/s²",a:"9.8",opts:["8.8","9.2","9.8","10.2"]},
  {q:"Tallest mountain?",a:"Everest",opts:["K2","Kangchenjunga","Everest","Lhotse"]},{q:"3⁴ = ?",a:"81",opts:["64","81","72","96"]},
  {q:"Atom center?",a:"Nucleus",opts:["Core","Center","Nucleus","Proton"]},{q:"Universal blood donor?",a:"O-",opts:["A+","O+","O-","AB-"]},
  {q:"LCM of 4 and 6?",a:"12",opts:["8","10","12","24"]},{q:"1 byte = ? bits",a:"8",opts:["4","8","16","32"]},
  {q:"Frequency unit?",a:"Hertz",opts:["Watt","Pascal","Hertz","Newton"]},{q:"Area of circle?",a:"πr²",opts:["2πr","πd","πr²","2πr²"]},
  {q:"WWII started?",a:"1939",opts:["1935","1937","1939","1941"]},{q:"Newton's 3rd law?",a:"Action-Reaction",opts:["Gravity","Inertia","Action-Reaction","Momentum"]},
  {q:"Electron charge?",a:"Negative",opts:["Positive","Negative","Neutral","Variable"]},{q:"F = ?",a:"Mass × Acceleration",opts:["Mass × Velocity","Mass × Acceleration","Weight × Time","Energy × Distance"]},
  {q:"Ohm's law V = ?",a:"IR",opts:["I/R","IR","I+R","R/I"]},{q:"Derivative of x²?",a:"2x",opts:["x","2x","x²","2x²"]},
  {q:"sin 90° = ?",a:"1",opts:["0","1","0.5","√2/2"]},{q:"HCl is?",a:"Hydrochloric Acid",opts:["Hydrochloric Acid","Hydroxide","Hydrogen Chlorate","Hypochlorous"]},
  {q:"Valence electrons C?",a:"4",opts:["2","3","4","6"]},{q:"Capital of Australia?",a:"Canberra",opts:["Sydney","Melbourne","Canberra","Brisbane"]},
  {q:"Ozone blocks?",a:"UV Rays",opts:["Rain","UV Rays","Wind","Heat"]},{q:"1 Pascal = ?",a:"N/m²",opts:["kg/m","N/m²","J/s","W/m²"]},
  {q:"cos 0° = ?",a:"1",opts:["0","1","-1","∞"]},{q:"Avogadro number?",a:"6.022×10²³",opts:["6.022×10²¹","6.022×10²³","6.022×10²⁵","3.011×10²³"]},
  {q:"Light speed in vacuum?",a:"3×10⁸ m/s",opts:["1×10⁸","2×10⁸","3×10⁸","4×10⁸"]},{q:"Planck's constant unit?",a:"J·s",opts:["J/s","J·s","W·s","N·m"]},
];

// ─── PARTICLE POOL ───────────────────────────────────────────────
const POOL=Array.from({length:500},()=>({active:false,x:0,y:0,vx:0,vy:0,life:0,size:4,color:'#fff',type:'spark',rot:0,rotV:0}));
function getP(){return POOL.find(p=>!p.active)||POOL[0];}
function spawnP(x,y,color,count=8,type='spark',spread=1){
  for(let i=0;i<count;i++){
    const p=getP();const ang=(Math.PI*2/count)*i+(Math.random()-.5)*spread;const spd=(1.5+Math.random()*4)*spread;
    p.active=true;p.x=x;p.y=y;p.vx=Math.cos(ang)*spd;p.vy=Math.sin(ang)*spd-(type==='burst'?2.5:0);
    p.life=1;p.size=type==='burst'?5+Math.random()*8:type==='trail'?2+Math.random()*4:2+Math.random()*5;
    p.color=color;p.type=type;p.rot=Math.random()*Math.PI*2;p.rotV=(Math.random()-.5)*.2;
  }
}

// ─── TRAIL SYSTEM ────────────────────────────────────────────────
const TRAIL=[];const TRAIL_MAX=40;
function addTrail(x,y,color,size){
  TRAIL.push({x,y,color,size,life:1,age:0});
  if(TRAIL.length>TRAIL_MAX)TRAIL.shift();
}

// ─── GHOST ───────────────────────────────────────────────────────
let ghostFrames=[],ghostPlayback=null,ghostIdx=0;
function recordGhost(){if(ghostFrames.length<5000)ghostFrames.push({lane:G.playerLane,y:G.playerY,frame:G.frame});}

// ─── OBSTACLE TYPES ──────────────────────────────────────────────
// Each obstacle has a visual style beyond just emoji
const OBS_TYPES=[
  {emoji:'📱',color:'#ff4488',glow:'#ff0066',w:32,h:44},
  {emoji:'💬',color:'#44aaff',glow:'#0088ff',w:38,h:32},
  {emoji:'🎮',color:'#aa44ff',glow:'#8800ff',w:38,h:28},
  {emoji:'📲',color:'#ff8844',glow:'#ff4400',w:30,h:46},
  {emoji:'🔔',color:'#ffdd44',glow:'#ffaa00',w:34,h:36},
  {emoji:'🕹️',color:'#44ffaa',glow:'#00ff88',w:36,h:40},
  {emoji:'📺',color:'#ff44aa',glow:'#cc0088',w:46,h:36},
  {emoji:'💻',color:'#4488ff',glow:'#0055ff',w:44,h:32},
  {emoji:'🎵',color:'#ff6644',glow:'#ff2200',w:32,h:36},
  {emoji:'📸',color:'#44ffdd',glow:'#00eebb',w:38,h:34},
];
const COL_TYPES=[
  {emoji:'📚',color:'#00ff88',glow:'#00cc66',xp:2},{emoji:'🧠',color:'#aa88ff',glow:'#8844ff',xp:3},
  {emoji:'💡',color:'#ffee44',glow:'#ffcc00',xp:2},{emoji:'🔬',color:'#44ffee',glow:'#00ccbb',xp:2},
  {emoji:'📖',color:'#88ff44',glow:'#55cc00',xp:2},{emoji:'⭐',color:'#ffcc00',glow:'#ff9900',xp:3},
  {emoji:'🎯',color:'#ff6644',glow:'#ff3300',xp:4},{emoji:'🔑',color:'#ffaa44',glow:'#ff8800',xp:3},
];

// ─── GAME STATE ──────────────────────────────────────────────────
let G={};
function resetState(){
  ghostFrames=[];ghostIdx=0;ghostPlayback=Save.ghostBest||null;
  sessionXP=0;sessionAch=new Set();TRAIL.length=0;
  G={
    running:false,paused:false,
    score:0,coins:0,distance:0,lives:3,
    combo:1,bestCombo:1,
    shield:false,shieldTimer:0,shieldsUsed:0,
    boost:false,boostTimer:0,
    magnet:false,magnetTimer:0,   // NEW: magnet power-up
    slowmo:false,slowmoTimer:0,   // NEW: slowmo after correct answer
    speed:3.5,baseSpeed:3.5,speedLevel:1,
    frame:0,
    questionTimer:0,questionInterval:()=>260+Math.random()*360,nextQuestion:0,
    difficultyTimer:0,
    playerLane:1,laneT:1,playerX:0,
    playerY:0,playerVY:0,
    jumping:false,sliding:false,slideTimer:0,
    invincible:false,invincibleTimer:0,
    hitlessRun:true,correctQ:0,totalQ:0,
    obstacles:[],collectibles:[],
    obsTimer:0,obsInterval:80,colTimer:0,colInterval:60,
    trackOffset:0,cityOffset:0,bgPulse:0,
    lastTime:0,raf:null,
    shakeDecay:0,shakeX:0,shakeY:0,
    flash:0,flashCol:'#fff',
    xp1k:false,xp5k:false,xp10k:false,d500:false,d1k:false,
    // Visual enhancement state
    boostLineTimer:0,
    groundPulse:0,
    dangerFlash:0,
    warpEffect:0,       // warp tunnel when speed very high
    comboGlowIntensity:0,
    // Obstacle pattern system
    nextPatternIn:0,
    currentPattern:null,
    patternStep:0,
  };
}

// ─── CANVAS ──────────────────────────────────────────────────────
const gameCanvas=document.getElementById('gameCanvas');
const ctx=gameCanvas.getContext('2d',{alpha:false});
const bgCanvas=document.getElementById('bgCanvas');
const bgCtx=bgCanvas.getContext('2d');
let W=0,H=0,LANE_W=0,LANE_X=[],GROUND_Y=0;
const PR=22; // player radius

function resize(){
  W=window.innerWidth;H=window.innerHeight;
  gameCanvas.width=W;gameCanvas.height=H;
  bgCanvas.width=W;bgCanvas.height=H;
  LANE_W=W/3;LANE_X=[LANE_W*.5,LANE_W*1.5,LANE_W*2.5];
  GROUND_Y=H*.70;
  if(G)G.playerX=LANE_X[G.playerLane||1];
}
window.addEventListener('resize',resize);resize();

// ─── BACKGROUND (PERFORMANCE-OPTIMIZED: cached gradients, adaptive star count/frame-skip) ───
const _isLowEnd = (navigator.hardwareConcurrency||4) <= 4 || /Android/i.test(navigator.userAgent);
const STAR_COUNT = _isLowEnd ? 45 : 90;
const STARS=Array.from({length:STAR_COUNT},()=>({
  x:Math.random()*2000,y:Math.random()*1200,
  r:Math.random()*2+.2,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,
  a:Math.random()*.7+.1,h:160+Math.random()*90,twinkle:Math.random()*Math.PI*2,
}));
const NEBULA=[
  {x:W*.2,y:H*.3,r:200,color:'rgba(0,80,255,0.04)'},
  {x:W*.8,y:H*.6,r:250,color:'rgba(180,0,255,0.04)'},
  {x:W*.5,y:H*.1,r:180,color:'rgba(0,200,255,0.03)'},
];
const NEBULA_GRADS = NEBULA.map(n=>{
  const gr=bgCtx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r);
  gr.addColorStop(0,n.color);gr.addColorStop(1,'transparent');
  return gr;
});
let bgF=0,bgPulseGlobal=0;
const BG_SKIP = _isLowEnd ? 2 : 1;

function renderBg(){
  bgF++;
  if(bgF % BG_SKIP === 0){
    bgPulseGlobal=Math.sin(bgF*.02)*.5+.5;
    bgCtx.fillStyle='#000008';bgCtx.fillRect(0,0,W,H);

    NEBULA_GRADS.forEach(gr=>{ bgCtx.fillStyle=gr; bgCtx.fillRect(0,0,W,H); });

    STARS.forEach(s=>{
      s.x+=s.vx;s.y+=s.vy;
      if(s.x<0)s.x=W;if(s.x>W)s.x=0;if(s.y<0)s.y=H;if(s.y>H)s.y=0;
      s.twinkle+=.04;
      const a=s.a+Math.sin(s.twinkle)*.2;
      bgCtx.beginPath();bgCtx.arc(s.x,s.y,s.r,0,Math.PI*2);
      bgCtx.fillStyle=`hsla(${s.h},100%,90%,${Math.max(0,a)})`;bgCtx.fill();
    });

    if(!_isLowEnd){
      bgCtx.save();bgCtx.strokeStyle=`rgba(0,245,255,${.025+bgPulseGlobal*.015})`;bgCtx.lineWidth=.8;
      const hxOff=(bgF*.6)%60;
      for(let y=-30+hxOff;y<H+30;y+=52){for(let x=-30;x<W+30;x+=60){drawHex(bgCtx,x,y,28);}}
      bgCtx.stroke();bgCtx.restore();

      bgCtx.font='11px monospace';bgCtx.textAlign='center';
      const rainChars='⚡📚🧠🔬⭐💡🎯';
      for(let i=0;i<15;i++){
        const rx=((i*137+bgF*1.2)%W);
        const ry=((i*73+bgF*(1+i*.1))%H);
        bgCtx.fillStyle=`rgba(0,255,136,${.04+bgPulseGlobal*.03})`;
        bgCtx.fillText(rainChars[Math.floor(bgF/10+i)%rainChars.length],rx,ry);
      }
      bgCtx.textAlign='left';
    }
  }
  requestAnimationFrame(renderBg);
}
function drawHex(c,x,y,r){const a=Math.PI/3;c.moveTo(x+r,y);for(let i=1;i<6;i++)c.lineTo(x+r*Math.cos(a*i),y+r*Math.sin(a*i));c.closePath();}
renderBg();

// ─── ENVIRONMENT (ROAD + CITY) ────────────────────────────────────
function drawEnv(){
  G.cityOffset=(G.cityOffset||0)+G.speed*.75;
  G.groundPulse=(G.groundPulse||0)+.04;
  const vp={x:W/2,y:GROUND_Y*.28};

  // Road base with perspective
  const rg=ctx.createLinearGradient(0,vp.y,0,H);
  rg.addColorStop(0,'rgba(0,0,16,0)');
  rg.addColorStop(.25,'rgba(0,10,35,0.85)');
  rg.addColorStop(.7,'rgba(0,5,20,0.96)');
  rg.addColorStop(1,'rgba(0,2,12,1)');
  ctx.fillStyle=rg;ctx.fillRect(0,vp.y,W,H-vp.y);

  // Road surface texture (subtle grid)
  ctx.save();ctx.strokeStyle='rgba(0,80,160,0.08)';ctx.lineWidth=1;
  const texOff=(G.trackOffset*.8)%40;
  for(let y=GROUND_Y;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y-texOff*(y-GROUND_Y)/H);ctx.lineTo(W,y-texOff*(y-GROUND_Y)/H);ctx.stroke();}
  ctx.restore();

  // Perspective side rails with glow
  const railAlpha=.25+Math.sin(G.groundPulse)*.05;
  [[-1,0],[1,W]].forEach(([dir,sx])=>{
    const grd=ctx.createLinearGradient(sx,GROUND_Y,vp.x+dir*18,vp.y);
    grd.addColorStop(0,`rgba(0,245,255,${railAlpha})`);grd.addColorStop(1,'rgba(0,245,255,0)');
    ctx.beginPath();ctx.moveTo(sx,H);ctx.lineTo(vp.x+dir*18,vp.y);
    ctx.strokeStyle=grd;ctx.lineWidth=2;ctx.shadowColor='#00f5ff';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
  });

  // Lane dividers (dashed, perspective)
  ctx.setLineDash([22,16]);ctx.lineDashOffset=-(G.trackOffset*1.4%38);
  [.33,.67].forEach(t=>{
    const grd=ctx.createLinearGradient(t*W,H,vp.x,vp.y);
    grd.addColorStop(0,'rgba(0,245,255,0.12)');grd.addColorStop(1,'rgba(0,245,255,0)');
    ctx.beginPath();ctx.moveTo(t*W,H);ctx.lineTo(vp.x,vp.y);ctx.strokeStyle=grd;ctx.lineWidth=1;ctx.stroke();
  });
  ctx.setLineDash([]);

  // City skyline - 4 layers
  const cityLayers=[
    {spd:.12,bh:55, bwBase:20, color:'rgba(0,10,30,0.7)',  winColor:'rgba(0,245,255,0.06)',  wrows:2,wcols:2},
    {spd:.25,bh:90, bwBase:28, color:'rgba(0,12,38,0.8)',  winColor:'rgba(0,245,255,0.09)',  wrows:3,wcols:3},
    {spd:.45,bh:130,bwBase:36, color:'rgba(0,14,45,0.88)', winColor:'rgba(100,200,255,0.12)',wrows:4,wcols:3},
    {spd:.8, bh:175,bwBase:42, color:'rgba(0,8,28,0.94)',  winColor:'rgba(0,245,255,0.15)',  wrows:5,wcols:4},
  ];
  cityLayers.forEach((layer,li)=>{
    const off=(G.cityOffset*layer.spd)%(W+250);
    for(let i=0;i<9;i++){
      const bx=((i*(W/5+li*15+20)-off+W*3)%(W+250))-60;
      const bh=layer.bh+(i*43+li*17)%90;
      const bw=layer.bwBase+(i*7)%20;
      // Building body
      ctx.fillStyle=layer.color;ctx.fillRect(bx,GROUND_Y-bh,bw,bh);
      // Building edge glow
      ctx.shadowColor=`rgba(0,100,200,0.3)`;ctx.shadowBlur=4;
      ctx.strokeStyle=`rgba(0,150,255,0.08)`;ctx.lineWidth=.5;
      ctx.strokeRect(bx,GROUND_Y-bh,bw,bh);ctx.shadowBlur=0;
      // Windows with flicker
      for(let wy=0;wy<layer.wrows;wy++){
        for(let wx=0;wx<layer.wcols;wx++){
          const flicker=Math.sin(G.frame*.04+i*3.7+wy*2.3+wx*1.9)>.3;
          if(!flicker)continue;
          const wx0=bx+3+wx*(bw/layer.wcols+2);
          const wy0=GROUND_Y-bh+8+wy*(bh/layer.wrows*0.8);
          ctx.fillStyle=layer.winColor;
          ctx.fillRect(wx0,wy0,bw/layer.wcols-4,bh/layer.wrows*.4);
        }
      }
      // Antenna/rooftop details on taller buildings
      if(bh>120&&li>=2){
        const antennaH=8+Math.random()*15;
        ctx.fillStyle='rgba(255,50,50,0.8)';
        ctx.beginPath();ctx.arc(bx+bw/2,GROUND_Y-bh-antennaH,2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(200,200,200,0.3)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(bx+bw/2,GROUND_Y-bh);ctx.lineTo(bx+bw/2,GROUND_Y-bh-antennaH);ctx.stroke();
      }
    }
    // Layer atmospheric fog at horizon
    const fogY=GROUND_Y-layer.bh-20;
    const fog=ctx.createLinearGradient(0,fogY,0,fogY+40);
    fog.addColorStop(0,`rgba(0,20,60,0)`);fog.addColorStop(1,`rgba(0,20,60,${.04*li})`);
    ctx.fillStyle=fog;ctx.fillRect(0,fogY,W,40);
  });

  // Ground glow line - pulsing
  const gPulse=.7+Math.sin(G.groundPulse)*.15+(G.boost?.3:0);
  const gg=ctx.createLinearGradient(0,GROUND_Y,W,GROUND_Y);
  gg.addColorStop(0,'rgba(0,245,255,0)');gg.addColorStop(.2,`rgba(0,245,255,${gPulse})`);
  gg.addColorStop(.5,`rgba(191,0,255,${gPulse*.9})`);gg.addColorStop(.8,`rgba(0,245,255,${gPulse})`);gg.addColorStop(1,'rgba(0,245,255,0)');
  ctx.beginPath();ctx.moveTo(0,GROUND_Y);ctx.lineTo(W,GROUND_Y);
  ctx.strokeStyle=gg;ctx.lineWidth=G.boost?4:2.5;
  ctx.shadowColor='#00f5ff';ctx.shadowBlur=G.boost?20:12;ctx.stroke();ctx.shadowBlur=0;

  // Ground reflections (lane glow on road surface)
  LANE_X.forEach((lx,li)=>{
    const rg2=ctx.createRadialGradient(lx,GROUND_Y,0,lx,GROUND_Y,60);
    rg2.addColorStop(0,`rgba(0,245,255,${.06+G.groundPulse*.01})`);rg2.addColorStop(1,'transparent');
    ctx.fillStyle=rg2;ctx.fillRect(lx-60,GROUND_Y,120,40);
  });

  // Speed lines (motion blur) - more dramatic
  if(G.boost||G.speedLevel>=4){
    const lineCount=G.boost?22:Math.min(18,(G.speedLevel-3)*4);
    const baseAlpha=G.boost?.22:(G.speedLevel-3)*.04;
    for(let i=0;i<lineCount;i++){
      const sy=GROUND_Y*.2+Math.random()*GROUND_Y*.75;
      const len=30+Math.random()*(G.boost?120:80);
      const lx=Math.random()*W;
      const lg=ctx.createLinearGradient(lx,sy,lx+len,sy);
      lg.addColorStop(0,'transparent');lg.addColorStop(.5,`rgba(0,245,255,${baseAlpha+Math.random()*.1})`);lg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.moveTo(lx,sy);ctx.lineTo(lx+len,sy);
      ctx.strokeStyle=lg;ctx.lineWidth=.8;ctx.stroke();
    }
  }

  // WARP EFFECT at high speed
  if(G.speedLevel>=8||G.boost){
    G.warpEffect=Math.min(1,(G.warpEffect||0)+.05);
    const warpLines=12;
    for(let i=0;i<warpLines;i++){
      const angle=(i/warpLines)*Math.PI*2+(G.frame*.02);
      const r1=50+G.warpEffect*30;const r2=Math.max(W,H);
      const sx=W/2+Math.cos(angle)*r1,sy=H*.4+Math.sin(angle)*r1;
      const ex=W/2+Math.cos(angle)*r2,ey=H*.4+Math.sin(angle)*r2;
      const wg=ctx.createLinearGradient(sx,sy,ex,ey);
      wg.addColorStop(0,`rgba(0,245,255,${.06*G.warpEffect})`);wg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);
      ctx.strokeStyle=wg;ctx.lineWidth=.6;ctx.stroke();
    }
  }else{G.warpEffect=Math.max(0,(G.warpEffect||0)-.03);}

  G.trackOffset+=G.speed;
}

// ─── TRAIL RENDER ────────────────────────────────────────────────
function drawTrail(){
  for(let i=TRAIL.length-1;i>=0;i--){
    const t=TRAIL[i];t.age+=.08;t.life=Math.max(0,1-t.age);
    if(t.life<=0){TRAIL.splice(i,1);continue;}
    const alpha=t.life*.6;
    ctx.beginPath();ctx.arc(t.x,t.y,t.size*t.life,0,Math.PI*2);
    ctx.fillStyle=t.color+Math.floor(alpha*255).toString(16).padStart(2,'0');ctx.fill();
  }
}

// ─── PLAYER ──────────────────────────────────────────────────────
function drawPlayer(){
  // Smooth lane lerp
  G.laneT=Math.min(1,G.laneT+.2);
  G.playerX+=(LANE_X[G.playerLane]-G.playerX)*G.laneT;

  const px=G.playerX+G.shakeX;
  const bodyR=G.sliding?PR*.45:PR;
  const squishX=G.jumping?0.85:G.sliding?1.4:1;
  const squishY=G.jumping?1.2:G.sliding?0.6:1;
  const py=GROUND_Y-bodyR-G.playerY+G.shakeY;

  if(G.invincible&&G.frame%5<2)return;

  const gc=G.shield?'#00f5ff':G.boost?'#ffee00':G.magnet?'#ff44ff':'#00ff88';
  const rankColor=getRank(Save.totalXP).color;
  const rankTrail=getRank(Save.totalXP).trail;

  // Add to trail
  if(G.running&&G.frame%2===0)addTrail(px,py,gc,bodyR*.7);

  ctx.save();

  // Ground shadow
  const shadowAlpha=Math.max(.05,.35-G.playerY*.003);
  ctx.beginPath();ctx.ellipse(px,GROUND_Y+3,bodyR*squishX*1.1*(1-G.playerY*.005),4*(1-G.playerY*.004),0,0,Math.PI*2);
  ctx.fillStyle=`rgba(0,0,0,${shadowAlpha})`;ctx.fill();

  // Outer aura
  ctx.save();ctx.scale(squishX,squishY);
  const scaledPy=py/squishY;
  const scaledPx=px/squishX;
  const aura=ctx.createRadialGradient(scaledPx,scaledPy,0,scaledPx,scaledPy,bodyR*4);
  aura.addColorStop(0,gc+'55');aura.addColorStop(.4,gc+'22');aura.addColorStop(1,'transparent');
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(scaledPx,scaledPy,bodyR*4,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // Particle trails based on rank
  if(G.frame%3===0){
    spawnP(px+(Math.random()-.5)*8,py+bodyR*.8,rankTrail,1,'trail');
    if(G.boost&&G.frame%2===0)spawnP(px+(Math.random()-.5)*15,py+(Math.random()-.5)*15,'#ffee00',2,'trail');
  }

  // Main body (squish effect)
  ctx.save();
  ctx.translate(px,py);ctx.scale(squishX,squishY);ctx.translate(-px,-py);

  // Core glow
  ctx.shadowColor=gc;ctx.shadowBlur=G.boost?40:25;
  const coreGrad=ctx.createRadialGradient(px-bodyR*.25,py-bodyR*.25,1,px,py,bodyR);
  coreGrad.addColorStop(0,'#ffffff');coreGrad.addColorStop(.25,gc);coreGrad.addColorStop(.6,rankColor+'dd');coreGrad.addColorStop(1,rankColor+'44');
  ctx.beginPath();ctx.arc(px,py,bodyR,0,Math.PI*2);ctx.fillStyle=coreGrad;ctx.fill();
  ctx.shadowBlur=0;

  // Inner highlight
  ctx.beginPath();ctx.arc(px-bodyR*.28,py-bodyR*.28,bodyR*.35,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fill();

  ctx.restore();

  // Spinning rings (multiple, different speeds)
  const rings=[
    {r:1.45,speed:.07,arc:1.4,color:gc+'cc',w:2},
    {r:1.75,speed:-.045,arc:.9,color:rankColor+'88',w:1.5},
    {r:2.05,speed:.03,arc:.6,color:gc+'44',w:1},
  ];
  rings.forEach(ring=>{
    const angle=G.frame*ring.speed;
    ctx.beginPath();ctx.arc(px,py,bodyR*ring.r,angle,angle+Math.PI*ring.arc);
    ctx.strokeStyle=ring.color;ctx.lineWidth=ring.w;
    ctx.shadowColor=gc;ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
  });

  // Energy dots orbiting
  if(G.combo>=5){
    const dotCount=Math.min(G.combo>=10?6:3,6);
    for(let i=0;i<dotCount;i++){
      const a=G.frame*.08+i*(Math.PI*2/dotCount);
      const dr=bodyR*2.2;
      const dx=px+Math.cos(a)*dr,dy=py+Math.sin(a)*dr;
      ctx.beginPath();ctx.arc(dx,dy,2.5,0,Math.PI*2);
      ctx.fillStyle=G.combo>=10?'#ffd700':gc;
      ctx.shadowColor=G.combo>=10?'#ffd700':gc;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
    }
  }

  // Shield bubble
  if(G.shield){
    const pulse=1+Math.sin(G.frame*.18)*.07;
    ctx.beginPath();ctx.arc(px,py,bodyR*2.3*pulse,0,Math.PI*2);
    const shieldGrad=ctx.createRadialGradient(px,py,bodyR,px,py,bodyR*2.3*pulse);
    shieldGrad.addColorStop(0,'rgba(0,245,255,0.08)');shieldGrad.addColorStop(1,'rgba(0,245,255,0)');
    ctx.fillStyle=shieldGrad;ctx.fill();
    ctx.strokeStyle='#00f5ff';ctx.lineWidth=2;
    ctx.shadowColor='#00f5ff';ctx.shadowBlur=18;
    ctx.globalAlpha=.6+Math.sin(G.frame*.15)*.2;ctx.stroke();
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    // Hex pattern on shield
    ctx.globalAlpha=.15+Math.sin(G.frame*.1)*.05;
    ctx.strokeStyle='#00f5ff';ctx.lineWidth=.8;
    for(let a=0;a<6;a++){const ang=a*Math.PI/3+G.frame*.02;ctx.beginPath();ctx.moveTo(px+Math.cos(ang)*bodyR*1.4,py+Math.sin(ang)*bodyR*1.4);ctx.lineTo(px+Math.cos(ang)*bodyR*2.1,py+Math.sin(ang)*bodyR*2.1);ctx.stroke();}
    ctx.globalAlpha=1;
  }

  // Magnet field visual
  if(G.magnet){
    ctx.beginPath();ctx.arc(px,py,LANE_W*.9,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,68,255,${.3+Math.sin(G.frame*.2)*.15})`;ctx.lineWidth=1;
    ctx.setLineDash([5,8]);ctx.stroke();ctx.setLineDash([]);
  }

  ctx.restore();
}

// ─── GHOST ───────────────────────────────────────────────────────
function drawGhost(){
  if(!ghostPlayback||ghostIdx>=ghostPlayback.length)return;
  while(ghostIdx<ghostPlayback.length-1&&ghostPlayback[ghostIdx].frame<G.frame)ghostIdx++;
  const gf=ghostPlayback[ghostIdx];if(!gf)return;
  const gx=LANE_X[gf.lane],gy=GROUND_Y-PR-gf.y;
  ctx.save();ctx.globalAlpha=.18;
  const ghostGrad=ctx.createRadialGradient(gx,gy,0,gx,gy,PR*1.5);
  ghostGrad.addColorStop(0,'#00f5ff55');ghostGrad.addColorStop(1,'transparent');
  ctx.fillStyle=ghostGrad;ctx.beginPath();ctx.arc(gx,gy,PR*1.5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#00f5ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(gx,gy,PR*.85,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

// ─── PARTICLES ───────────────────────────────────────────────────
function drawParticles(){
  POOL.forEach(p=>{
    if(!p.active)return;
    p.x+=p.vx;p.y+=p.vy;
    p.vy+=p.type==='trail'?.01:.07;
    p.vx*=.97;p.rot+=p.rotV;
    p.life-=p.type==='trail'?.15:.04;
    if(p.life<=0){p.active=false;return;}
    const alpha=p.life;const sz=Math.max(.1,p.size*p.life);
    if(p.type==='spark'){
      // Diamond shape for sparks
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.fillStyle=p.color+Math.floor(alpha*255).toString(16).padStart(2,'0');
      ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(sz*.5,0);ctx.lineTo(0,sz);ctx.lineTo(-sz*.5,0);ctx.closePath();ctx.fill();
      ctx.restore();
    }else{
      ctx.beginPath();ctx.arc(p.x,p.y,sz,0,Math.PI*2);
      ctx.fillStyle=p.color+Math.floor(alpha*255).toString(16).padStart(2,'0');ctx.fill();
    }
  });
}

// ─── OBJECTS ─────────────────────────────────────────────────────
function drawObjects(){
  const sz=Math.min(LANE_W*.5,40);

  G.obstacles.forEach(o=>{
    const ot=OBS_TYPES[o.typeIdx||0];
    const ox=LANE_X[o.lane];
    const wb=Math.sin(G.frame*.1+o.ph)*5;
    // Rotation for flying-in effect
    const rotAmount=Math.sin(G.frame*.08+o.ph)*.15;
    const distRatio=Math.max(0,Math.min(1,(o.y+50)/H));

    // Warning pulse when close
    const proximity=Math.max(0,(o.y-(GROUND_Y*.4))/(GROUND_Y*.55));
    if(proximity>0){
      const pulseR=(sz*.9+Math.sin(G.frame*.25)*4)*distRatio;
      ctx.beginPath();ctx.arc(ox,o.y+wb,pulseR,0,Math.PI*2);
      const warnGrad=ctx.createRadialGradient(ox,o.y+wb,pulseR*.5,ox,o.y+wb,pulseR);
      warnGrad.addColorStop(0,`rgba(255,0,100,${proximity*.15})`);warnGrad.addColorStop(1,'transparent');
      ctx.fillStyle=warnGrad;ctx.fill();
      // Warning ring
      ctx.strokeStyle=`${ot.color}${Math.floor(proximity*.6*255).toString(16).padStart(2,'0')}`;
      ctx.lineWidth=2;ctx.shadowColor=ot.glow;ctx.shadowBlur=12*proximity;
      ctx.beginPath();ctx.arc(ox,o.y+wb,sz*.82*distRatio,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    }

    // Emoji with shadow glow
    ctx.save();
    ctx.translate(ox,o.y+wb);ctx.rotate(rotAmount);
    ctx.shadowColor=ot.glow;ctx.shadowBlur=18+Math.sin(G.frame*.08+o.ph)*6;
    ctx.font=`${sz*distRatio*.9}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(ot.emoji,0,0);
    ctx.shadowBlur=0;ctx.restore();

    // Spawn particles from moving obstacles
    if(G.running&&G.frame%8===0&&o.y>0&&o.y<H){
      spawnP(ox+(Math.random()-.5)*10,o.y+(Math.random()-.5)*8,ot.color,1,'trail');
    }
  });

  G.collectibles.forEach(c=>{
    const ct=c.colType;
    const cx=LANE_X[c.lane];
    const bob=Math.sin(G.frame*.13+c.ph)*8;
    const spinAngle=G.frame*.06+c.ph;
    const distRatio=Math.max(0,Math.min(1,(c.y+50)/H));

    // Magnet pull if active
    if(G.magnet){
      const px2=G.playerX,py2=GROUND_Y-PR-G.playerY;
      const dx=px2-cx,dy=py2-(c.y+bob);
      const dist=Math.hypot(dx,dy);
      if(dist<LANE_W*1.2&&dist>5){c.y+=dy*.08;if(Math.abs(LANE_X[c.lane]-px2)>10)c.x=(c.x||cx)+dx*.05;}
    }

    // Glow aura
    const glowR=sz*.85*distRatio;
    const glowGrad=ctx.createRadialGradient(cx,c.y+bob,0,cx,c.y+bob,glowR*1.5);
    glowGrad.addColorStop(0,ct.glow+'44');glowGrad.addColorStop(1,'transparent');
    ctx.fillStyle=glowGrad;ctx.beginPath();ctx.arc(cx,c.y+bob,glowR*1.5,0,Math.PI*2);ctx.fill();

    // Orbit ring
    ctx.save();ctx.translate(cx,c.y+bob);ctx.rotate(spinAngle);
    ctx.strokeStyle=ct.color+'66';ctx.lineWidth=1.5;
    ctx.shadowColor=ct.glow;ctx.shadowBlur=10;
    ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(0,0,glowR,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);ctx.shadowBlur=0;ctx.restore();

    // Emoji
    ctx.save();ctx.translate(cx,c.y+bob);ctx.rotate(Math.sin(G.frame*.04+c.ph)*.12);
    ctx.shadowColor=ct.glow;ctx.shadowBlur=20+Math.sin(G.frame*.1+c.ph)*7;
    ctx.font=`${sz*distRatio*.85}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(ct.emoji,0,0);ctx.shadowBlur=0;ctx.restore();

    // Floating XP text on higher-value items
    if(ct.xp>=3&&G.frame%60===Math.floor(c.ph*20)%60){
      ctx.fillStyle=ct.color+'88';ctx.font='bold 10px Orbitron,sans-serif';ctx.textAlign='center';
      ctx.fillText('+'+ct.xp,cx,c.y+bob-sz*.7*distRatio);ctx.textAlign='left';
    }
  });
}

// ─── SCREEN FX ───────────────────────────────────────────────────
function drawFX(){
  // Flash overlay
  if(G.flash>0){
    ctx.fillStyle=G.flashCol+Math.floor(G.flash*255).toString(16).padStart(2,'0');
    ctx.fillRect(0,0,W,H);G.flash=Math.max(0,G.flash-.07);
  }
  // Camera shake
  if(G.shakeDecay>0){
    const mag=G.shakeDecay;
    G.shakeX=(Math.random()-.5)*mag*14;G.shakeY=(Math.random()-.5)*mag*14;
    G.shakeDecay=Math.max(0,G.shakeDecay-.09);
  }else{G.shakeX=0;G.shakeY=0;}

  // Combo glow overlay
  if(G.combo>=5){
    const intensity=Math.min(.12,(G.combo-4)*.015)*(.8+Math.sin(G.frame*.1)*.2);
    const comboColor=G.combo>=10?'rgba(255,215,0,':'rgba(191,0,255,';
    ctx.fillStyle=comboColor+intensity+')';ctx.fillRect(0,0,W,H);
  }

  // Slowmo visual overlay
  if(G.slowmo){
    ctx.fillStyle=`rgba(100,200,255,${.04+Math.sin(G.frame*.15)*.02})`;
    ctx.fillRect(0,0,W,H);
  }

  // Danger flash (lives=1)
  if(G.lives===1){
    G.dangerFlash=(G.dangerFlash||0)+.05;
    const df=Math.abs(Math.sin(G.dangerFlash))*.06;
    ctx.fillStyle=`rgba(255,0,0,${df})`;ctx.fillRect(0,0,W,H);
    // Red vignette
    const vig=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.8);
    vig.addColorStop(0,'transparent');vig.addColorStop(1,`rgba(255,0,0,${df*2})`);
    ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  }

  // Boost turbo lines from sides
  if(G.boost){
    G.boostLineTimer=(G.boostLineTimer||0)+1;
    for(let i=0;i<6;i++){
      const ty=H*.2+((i/6)*H*.7+(G.boostLineTimer*4))%(H*.7);
      const len=40+Math.random()*80;
      const la=ctx.createLinearGradient(0,ty,len,ty);
      la.addColorStop(0,'rgba(0,245,255,0)');la.addColorStop(.5,`rgba(0,245,255,.15)`);la.addColorStop(1,'rgba(0,245,255,0)');
      ctx.beginPath();ctx.moveTo(0,ty);ctx.lineTo(len,ty);ctx.strokeStyle=la;ctx.lineWidth=1;ctx.stroke();
      const ra=ctx.createLinearGradient(W,ty,W-len,ty);
      ra.addColorStop(0,'rgba(0,245,255,0)');ra.addColorStop(.5,`rgba(0,245,255,.15)`);ra.addColorStop(1,'rgba(0,245,255,0)');
      ctx.beginPath();ctx.moveTo(W,ty);ctx.lineTo(W-len,ty);ctx.strokeStyle=ra;ctx.lineWidth=1;ctx.stroke();
    }
  }
}

// ─── HUD ─────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
function updateHUD(){
  const sc=$('hudScore'),co=$('hudCoins'),di=$('hudDist');
  if(sc)sc.textContent=Math.floor(G.score).toLocaleString();
  if(co)co.textContent=G.coins;
  if(di)di.textContent=Math.floor(G.distance)+'m';
}
function updateLives(){['life1','life2','life3'].forEach((id,i)=>{const el=$(id);if(el)el.classList.toggle('dead',i>=G.lives);});}
function updateCombo(){
  const cv=$('comboVal');if(!cv)return;
  cv.textContent='x'+G.combo;
  if(G.combo>=10){cv.style.color='#ffd700';cv.style.textShadow='0 0 20px #ffd700,0 0 40px #ffd700';}
  else if(G.combo>=5){cv.style.color='#bf00ff';cv.style.textShadow='0 0 14px #bf00ff';}
  else{cv.style.color='#00ff88';cv.style.textShadow='0 0 8px #00ff88';}
}
function updateSpeed(){
  const f=$('speedBar'),l=$('speedLabel');
  if(f){const pct=Math.min(100,G.speedLevel*10);f.style.width=pct+'%';
    f.style.background=G.speedLevel>=8?'linear-gradient(90deg,#ff4444,#ff0000)':G.speedLevel>=5?'linear-gradient(90deg,#ffaa00,#ff6600)':'linear-gradient(90deg,#00f5ff,#bf00ff)';}
  if(l)l.textContent='SPEED '+G.speedLevel;
}
function updateShield(){const so=$('shieldOverlay');if(so)so.classList.toggle('active',G.shield);}

// ─── FLOATERS ────────────────────────────────────────────────────
function floatScore(text,x,y,color,size=18){
  const el=document.createElement('div');el.className='float-score';el.textContent=text;
  el.style.cssText=`left:${x-40}px;top:${y-20}px;color:${color};font-size:${size}px`;
  $('floatingScores').appendChild(el);setTimeout(()=>el.remove(),1300);
}
function showXPToast(xp){
  if(xp<=0)return;const t=document.createElement('div');t.className='xp-toast';t.textContent='+'+xp+' XP';
  document.body.appendChild(t);setTimeout(()=>t.remove(),1600);
}

// ─── RANK UP ─────────────────────────────────────────────────────
let lastRankName='';
function checkRankUp(){
  const r=getRank(Save.totalXP);
  if(lastRankName&&r.name!==lastRankName){
    const el=$('rankUpBox');if(el){
      $('rankUpIcon').textContent=r.icon;$('rankUpName').textContent=r.name.toUpperCase();
      el.style.setProperty('--ru-color',r.color);el.style.setProperty('--ru-glow',r.glow);
      AudioSys.play('rankup');vibe([100,50,100,50,200]);
      el.classList.add('show');spawnP(W/2,H/2,r.color,25,'burst',1.5);
      setTimeout(()=>el.classList.remove('show'),3500);
    }
  }
  lastRankName=r.name;
}

// ─── OBSTACLE PATTERNS ───────────────────────────────────────────
const PATTERNS=[
  {name:'zigzag',  sequence:[[0],[1],[2],[1],[0]]},
  {name:'walls',   sequence:[[0,1],[1,2],[0,2]]},
  {name:'slalom',  sequence:[[2],[0],[2],[0]]},
  {name:'center',  sequence:[[0,2],[1],[0,2]]},
  {name:'random',  sequence:null},
  {name:'sides',   sequence:[[0,2],[0,2],[1]]},
  {name:'cascade', sequence:[[0],[0,1],[0,1,2],[1,2],[2]]},
];

// ─── GAME LOOP ────────────────────────────────────────────────────
function gameLoop(ts){
  if(!G.running)return;
  G.raf=requestAnimationFrame(gameLoop);
  const rawDt=Math.min((ts-G.lastTime)/16.667,3);
  const dt=G.slowmo?rawDt*.5:rawDt; // slowmo halves effective speed
  G.lastTime=ts;G.frame++;

  ctx.fillStyle='#000008';ctx.fillRect(0,0,W,H);

  // Difficulty ramp
  G.difficultyTimer++;
  if(G.difficultyTimer>=260){
    G.difficultyTimer=0;G.speedLevel=Math.min(10,G.speedLevel+1);
    const v=.85+Math.random()*.3;
    G.baseSpeed=(3.5+G.speedLevel*.42)*v;
    G.obsInterval=Math.max(28,82-G.speedLevel*4.5+Math.floor(Math.random()*20-10));
    G.colInterval=Math.max(35,72-G.speedLevel*3+Math.floor(Math.random()*15-7));
    updateSpeed();
    if(G.speedLevel>=8)checkAch('speed_8');
    // Speed up announcement
    floatScore('⚡ SPEED '+G.speedLevel,W/2,H*.35,G.speedLevel>=8?'#ff4444':'#ffaa00',16);
  }

  const effectiveSpeed=G.boost?G.baseSpeed*1.7:G.slowmo?G.baseSpeed*.5:G.baseSpeed;
  G.speed=effectiveSpeed;

  if(G.boost){G.boostTimer-=rawDt;if(G.boostTimer<=0)G.boost=false;}
  if(G.shield){G.shieldTimer-=rawDt;if(G.shieldTimer<=0){G.shield=false;updateShield();}}
  if(G.invincible){G.invincibleTimer-=rawDt;if(G.invincibleTimer<=0)G.invincible=false;}
  if(G.slowmo){G.slowmoTimer-=rawDt;if(G.slowmoTimer<=0)G.slowmo=false;}
  if(G.magnet){G.magnetTimer-=rawDt;if(G.magnetTimer<=0)G.magnet=false;}

  // Physics (always real dt for responsiveness)
  if(G.jumping){G.playerVY-=.8*rawDt;G.playerY+=G.playerVY*rawDt;if(G.playerY<=0){G.playerY=0;G.playerVY=0;G.jumping=false;}}
  if(G.sliding){G.slideTimer-=rawDt;if(G.slideTimer<=0)G.sliding=false;}

  // Progress
  G.distance+=G.speed*dt*.048;
  G.score+=G.speed*G.combo*dt*.3;

  // Milestones
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
  G.obstacles=G.obstacles.filter(o=>o.y<H+80);G.collectibles=G.collectibles.filter(c=>c.y<H+80);

  // Collisions
  if(!G.invincible){
    const px=G.playerX,py=GROUND_Y-PR-G.playerY,hr=PR+14;
    G.obstacles=G.obstacles.filter(o=>{
      const ox=LANE_X[o.lane];
      if(Math.hypot(ox-px,o.y-py)<hr+12){
        if(G.shield){spawnP(ox,o.y,'#00f5ff',12,'burst');G.flash=.18;G.flashCol='#00f5ff';AudioSys.play('collect');return false;}
        handleHit();return false;
      }return true;
    });
    G.collectibles=G.collectibles.filter(c=>{
      const cx=c.x||LANE_X[c.lane];
      if(Math.hypot(cx-px,c.y-py)<hr+20){handleCollect(c);return false;}
      return true;
    });
  }

  if(G.frame%3===0)recordGhost();
  if(G.frame%3===0)updateHUD();

  // Draw order
  drawEnv();
  drawTrail();
  drawGhost();
  drawParticles();
  drawObjects();
  drawPlayer();
  drawFX();
}

// ─── SPAWN ───────────────────────────────────────────────────────
function spawnObs(){
  // Use patterns at higher speeds
  let lanes;
  if(G.speedLevel>=4&&Math.random()<.4){
    const pat=PATTERNS[Math.floor(Math.random()*PATTERNS.length)];
    if(pat.sequence){lanes=pat.sequence[Math.floor(Math.random()*pat.sequence.length)];}
    else{lanes=[Math.floor(Math.random()*3)];}
  }else{
    const r=Math.random();
    lanes=r<.45?[Math.floor(Math.random()*3)]:r<.7?[0,2]:r<.85?[Math.floor(Math.random()*3)]:[0,2];
  }
  // Never block all 3
  if(Array.isArray(lanes)&&new Set(lanes).size>=3)lanes=[lanes[0]];
  lanes=Array.isArray(lanes)?lanes:[lanes];

  lanes.forEach(lane=>{
    const typeIdx=Math.floor(Math.random()*OBS_TYPES.length);
    G.obstacles.push({lane,y:-60-Math.random()*60,typeIdx,emoji:OBS_TYPES[typeIdx].emoji,ph:Math.random()*Math.PI*2});
  });
}

function spawnCol(){
  const isBoost=Math.random()<.12,isShield=!isBoost&&Math.random()<.07,isMagnet=!isBoost&&!isShield&&Math.random()<.05;
  const colTypeIdx=Math.floor(Math.random()*COL_TYPES.length);
  const ct=COL_TYPES[colTypeIdx];
  G.collectibles.push({
    lane:Math.floor(Math.random()*3),y:-50-Math.random()*40,
    emoji:isBoost?'⚡':isShield?'🛡️':isMagnet?'🧲':ct.emoji,
    colType:isBoost?{emoji:'⚡',color:'#ffee00',glow:'#ffcc00',xp:5}:isShield?{emoji:'🛡️',color:'#00f5ff',glow:'#0088ff',xp:3}:isMagnet?{emoji:'🧲',color:'#ff44ff',glow:'#cc00cc',xp:3}:ct,
    isBoost,isShield,isMagnet,ph:Math.random()*Math.PI*2,
  });
}

// ─── HIT / COLLECT ───────────────────────────────────────────────
function handleHit(){
  G.lives--;G.combo=1;G.hitlessRun=false;G.invincible=true;G.invincibleTimer=110;
  updateCombo();vibe([150,60,250]);AudioSys.play('hit');
  spawnP(G.playerX,GROUND_Y-PR-G.playerY,'#ff00aa',18,'burst',1.2);
  G.shakeDecay=1.2;G.flash=.42;G.flashCol='#ff003388';
  updateLives();
  // Heart break animation
  floatScore('💔',G.playerX,GROUND_Y-PR*3,'#ff4444',24);
  if(G.lives<=0)setTimeout(endGame,400);
  else if(G.lives===1){floatScore('⚠️ LAST LIFE!',W/2,H*.4,'#ff4444',20);}
}

function handleCollect(c){
  const xpBonus=c.colType?.xp||1;
  const pts=c.isBoost?70:c.isShield?45:c.isMagnet?35:(22+xpBonus*5);
  const coins=c.isBoost?6:1+(G.combo>5?2:0);
  G.score+=pts*G.combo;G.coins+=coins;
  G.combo=Math.min(G.combo+1,20);if(G.combo>G.bestCombo)G.bestCombo=G.combo;

  if(c.isBoost){
    G.boost=true;G.boostTimer=180;AudioSys.play('boost');
    G.flash=.15;G.flashCol='#ffee00';
    floatScore('⚡ BOOST!',LANE_X[c.lane],c.y,'#ffee00',20);
    spawnP(LANE_X[c.lane],c.y,'#ffee00',12,'burst');
  }else if(c.isShield){
    G.shield=true;G.shieldTimer=180;AudioSys.play('boost');updateShield();
    floatScore('🛡️ SHIELD!',LANE_X[c.lane],c.y,'#00f5ff',18);
    spawnP(LANE_X[c.lane],c.y,'#00f5ff',10,'burst');
  }else if(c.isMagnet){
    G.magnet=true;G.magnetTimer=200;AudioSys.play('boost');
    floatScore('🧲 MAGNET!',LANE_X[c.lane],c.y,'#ff44ff',18);
    spawnP(LANE_X[c.lane],c.y,'#ff44ff',8,'burst');
  }else{
    AudioSys.play('collect');
    spawnP(LANE_X[c.lane],c.y,c.colType?.color||'#00ff88',6,'spark');
  }

  // Coin sound
  AudioSys.playNote(1046,.08,.08);vibe(15);
  floatScore('+'+Math.floor(pts*G.combo),LANE_X[c.lane],c.y-20,c.isBoost?'#ffee00':'#00ff88');
  updateCombo();

  if(G.combo>=5)checkAch('combo_5');if(G.combo>=10)checkAch('combo_10');
  if(G.shieldsUsed>=5)checkAch('shield_5');

  // Combo flash
  const cf=$('comboFlash');
  if(cf){cf.className='combo-flash';void cf.offsetWidth;
    cf.classList.add(G.combo>=10?'flash-gold':G.combo>=5?'flash-purple':'flash-green');
    setTimeout(()=>cf.classList.remove('flash-green','flash-purple','flash-gold'),220);}

  awardXP('collect',Math.max(1,Math.floor(G.combo/5+1)+(xpBonus*.5)));
  checkRankUp();
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
  // Countdown beeps
  [2000,1000].forEach(t=>setTimeout(()=>AudioSys.play('countdown'),3000-t));
  qTimeout=setTimeout(()=>answerQ('__timeout__',null,oe),3000);
}

function answerQ(answer,btn,oe){
  clearTimeout(qTimeout);const correct=answer===currentQ.a;
  oe.querySelectorAll('.q-option').forEach(b=>{b.style.pointerEvents='none';if(b.textContent===currentQ.a)b.classList.add('correct');});
  if(btn&&!correct)btn.classList.add('wrong');

  if(correct){
    AudioSys.play('boost');vibe(60);
    G.boost=true;G.boostTimer=220;G.shield=true;G.shieldTimer=160;
    G.slowmo=true;G.slowmoTimer=180; // NEW: slowmo on correct answer
    G.score+=300*G.combo;G.combo=Math.min(G.combo+3,20);G.correctQ++;
    updateShield();floatScore('+300 ⚡ CORRECT!',W/2,H*.45,'#ffee00',22);
    G.flash=.2;G.flashCol='#00ff88';
    awardXP('correct_answer',G.combo>5?1.8:1);checkRankUp();
    if(G.correctQ>=10)checkAch('perfect_q');
    spawnP(W/2,H*.5,'#ffee00',20,'burst',1.5);
  }else{
    AudioSys.play('wrong');vibe([100,40,100]);
    G.speed=Math.max(2,G.speed*.55);G.baseSpeed=Math.max(2,G.baseSpeed*.65);
    G.combo=Math.max(1,G.combo-3);
    floatScore('WRONG! 💀',W/2,H*.45,'#ff00aa',22);
    G.flash=.28;G.flashCol='#ff003388';G.shakeDecay=.6;
  }
  updateCombo();
  setTimeout(()=>{hideScreen('questionOverlay');G.running=true;G.lastTime=performance.now();G.raf=requestAnimationFrame(gameLoop);},750);
}

// ─── CONTROLS ────────────────────────────────────────────────────
let touchStart={x:0,y:0,t:0};
// Input buffer for smoother feel
let inputBuffer=[];
function processInput(){
  if(!G.running||!inputBuffer.length)return;
  const inp=inputBuffer.shift();
  if(inp.type==='left'&&G.playerLane>0){G.playerLane--;G.laneT=0;vibe(12);}
  else if(inp.type==='right'&&G.playerLane<2){G.playerLane++;G.laneT=0;vibe(12);}
  else if(inp.type==='jump'&&!G.jumping){G.jumping=true;G.playerVY=15+G.speedLevel*.3;G.sliding=false;vibe(10);}
  else if(inp.type==='slide'&&!G.jumping){G.sliding=true;G.slideTimer=45;vibe(10);}
}
// Process buffer every frame
setInterval(processInput,16);

document.addEventListener('touchstart',e=>{const t=e.touches[0];touchStart={x:t.clientX,y:t.clientY,t:Date.now()};},{passive:true});
document.addEventListener('touchend',e=>{
  if(!G.running)return;
  const t=e.changedTouches[0];const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  const dt2=Date.now()-touchStart.t;if(dt2>400)return; // ignore long press
  if(Math.abs(dx)>Math.abs(dy)){
    if(Math.abs(dx)>20)inputBuffer.push({type:dx>0?'right':'left'});
  }else{
    if(dy<-20)inputBuffer.push({type:'jump'});
    else if(dy>20)inputBuffer.push({type:'slide'});
  }
},{passive:true});

document.addEventListener('keydown',e=>{
  if(!G.running)return;
  const{key}=e;
  if(key==='ArrowLeft')inputBuffer.push({type:'left'});
  else if(key==='ArrowRight')inputBuffer.push({type:'right'});
  else if(key==='ArrowUp'||key===' ')inputBuffer.push({type:'jump'});
  else if(key==='ArrowDown')inputBuffer.push({type:'slide'});
});

// ─── TUTORIAL ────────────────────────────────────────────────────
function maybeShowTutorial(){localStorage.setItem('fr_tutorial_done','1');} // tutorial auto-skip
function showTutorial(){
  const steps=[
    {icon:'👈👉',title:'CHANGE LANES',  text:'Swipe left or right to dodge distractions'},
    {icon:'👆',  title:'JUMP',          text:'Swipe up to jump over low obstacles'},
    {icon:'👇',  title:'SLIDE',         text:'Swipe down to slide under obstacles'},
    {icon:'📚',  title:'COLLECT ITEMS', text:'Grab study items for XP and score'},
    {icon:'⚡',  title:'QUICK BOOST',   text:'Answer correctly → speed boost + shield + slowmo!'},
    {icon:'🧲',  title:'MAGNET',        text:'Collect 🧲 to pull nearby items automatically'},
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

// ─── SCREEN MGMT ─────────────────────────────────────────────────
function showScreen(id){const el=$(id);if(!el)return;el.style.display='flex';el.classList.add('active');}
function hideScreen(id){const el=$(id);if(!el)return;el.classList.remove('active');el.style.display='none';}
function switchScreen(fromId,toId,delay=150){
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
  Save.gamesPlayed=Save.gamesPlayed+1;Save.correctAns=Save.correctAns+G.correctQ;
  if(isRecord&&ghostFrames.length>10)Save.ghostBest=ghostFrames;

  checkAch('first_run');if(G.hitlessRun&&G.distance>80)checkAch('no_hit');
  if(Save.gamesPlayed>=10)checkAch('games_10');if(Save.totalCoins>=100)checkAch('coin_100');
  awardXP('collect',Math.max(1,Math.floor(G.combo/3)));checkRankUp();

  try{const studyXP=parseInt(localStorage.getItem('uw_xp')||'0')+Math.floor(sessionXP*.5);localStorage.setItem('uw_xp',studyXP);window.dispatchEvent(new CustomEvent('uw_xp_changed',{detail:{xp:studyXP}}));}catch(e){}
  syncToFirebase({score:Math.floor(G.score),distance:Math.floor(G.distance),coins:G.coins,combo:G.bestCombo});

  $('overScore').textContent=Math.floor(G.score).toLocaleString();$('overDist').textContent=Math.floor(G.distance)+'m';
  $('overCoins').textContent=G.coins;$('overCombo').textContent='x'+G.bestCombo;
  $('overBest').textContent=Save.highScore.toLocaleString();$('overXP').textContent='+'+sessionXP+' XP';
  const r=getRank(Save.totalXP),nxt=getNextRank(Save.totalXP);
  $('overRank').textContent=r.icon+' '+r.name;$('overRank').style.color=r.color;
  $('overRankFill').style.width=getXPPct(Save.totalXP)+'%';
  $('overRankLabel').textContent=nxt?`${Save.totalXP} / ${nxt.xp} XP → ${nxt.name}`:'👑 MAX RANK';
  $('overTitle').textContent=isRecord?'⚡ LEGEND!':'GAME OVER';
  $('overSubtitle').textContent=isRecord?'New personal record!':'Distraction wins… this time.';
  $('newRecordBadge').style.display=isRecord?'inline-block':'none';
  if(isRecord)spawnP(W/2,H/2,'#ffd700',30,'burst',2);
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
  else window.location.href='/dashboard-home.html';
}

// ─── SETTINGS ────────────────────────────────────────────────────
window.toggleSound=function(){Settings.toggle('sound');$('soundIcon').textContent=Settings.sound?'🔊':'🔇';$('soundToggle').classList.toggle('active',Settings.sound);};
window.toggleVibe=function(){Settings.toggle('vibrate');$('vibeIcon').textContent=Settings.vibrate?'📳':'📴';$('vibeToggle').classList.toggle('active',Settings.vibrate);};

// ─── START STATS ─────────────────────────────────────────────────
function updateStartStats(){
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  set('previewBest',Save.highScore.toLocaleString());set('previewCoins',Save.totalCoins.toLocaleString());
  set('previewDist',Save.bestDistance+'m');set('previewXP',Save.totalXP+' XP');
  const r=getRank(Save.totalXP);const pr=$('previewRank');
  if(pr){pr.textContent=r.icon+' '+r.name;pr.style.color=r.color;pr.style.textShadow='0 0 12px '+r.color;}
  $('soundToggle')&&$('soundToggle').classList.toggle('active',Settings.sound);
  $('vibeToggle')&&$('vibeToggle').classList.toggle('active',Settings.vibrate);
  $('soundIcon')&&($('soundIcon').textContent=Settings.sound?'🔊':'🔇');
  $('vibeIcon')&&($('vibeIcon').textContent=Settings.vibrate?'📳':'📴');
}

// ─── BOOT ────────────────────────────────────────────────────────
window.startGame=startGame;window.restartGame=restartGame;window.goBack=goBack;
updateStartStats();showScreen('startScreen');maybeShowTutorial();
