/* ═══════════════════════════════════════════════════════════════
   FOCUS RUNNER ⚡ — Complete Game Engine
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─── SETTINGS ──────────────────────────────────────────────────
const Settings = {
  sound:   localStorage.getItem('fr_sound')   !== 'off',
  vibrate: localStorage.getItem('fr_vibrate') !== 'off',
  toggle(key) {
    this[key] = !this[key];
    localStorage.setItem('fr_' + key, this[key] ? 'on' : 'off');
  }
};

// ─── PERSISTENCE ────────────────────────────────────────────────
const Save = {
  get highScore()    { return parseInt(localStorage.getItem('fr_highScore')    || '0'); },
  get totalCoins()   { return parseInt(localStorage.getItem('fr_totalCoins')   || '0'); },
  get bestDistance() { return parseInt(localStorage.getItem('fr_bestDistance') || '0'); },
  get bestCombo()    { return parseInt(localStorage.getItem('fr_bestCombo')    || '0'); },
  set highScore(v)    { localStorage.setItem('fr_highScore',    v); },
  set totalCoins(v)   { localStorage.setItem('fr_totalCoins',   v); },
  set bestDistance(v) { localStorage.setItem('fr_bestDistance', v); },
  set bestCombo(v)    { localStorage.setItem('fr_bestCombo',    v); },
};

// ─── AUDIO ENGINE ───────────────────────────────────────────────
const Audio = {
  ctx: null,
  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  },
  play(type) {
    if (!Settings.sound || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    switch(type) {
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
        break;
      case 'hit':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
        break;
      case 'boost':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);
        break;
      case 'wrong':
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
        break;
      case 'coin':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1046, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
        break;
    }
  }
};

// ─── VIBRATION ──────────────────────────────────────────────────
function vibe(pattern) {
  if (!Settings.vibrate) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ─── QUESTION POOL (50+ questions) ──────────────────────────────
const QUESTIONS = [
  { q: "What is 7 × 8?", a: "56", opts: ["48","56","54","63"] },
  { q: "Capital of France?", a: "Paris", opts: ["Berlin","Madrid","Paris","Rome"] },
  { q: "√144 = ?", a: "12", opts: ["11","14","12","13"] },
  { q: "H₂O is?", a: "Water", opts: ["Salt","Water","Acid","Gas"] },
  { q: "Largest planet?", a: "Jupiter", opts: ["Saturn","Jupiter","Mars","Neptune"] },
  { q: "9² = ?", a: "81", opts: ["72","81","90","64"] },
  { q: "Speed of light?", a: "3×10⁸ m/s", opts: ["3×10⁶","3×10⁸","3×10⁵","9×10⁸"] },
  { q: "Who wrote Romeo & Juliet?", a: "Shakespeare", opts: ["Dickens","Shakespeare","Twain","Tolstoy"] },
  { q: "15% of 200?", a: "30", opts: ["25","35","30","20"] },
  { q: "DNA stands for?", a: "Deoxyribonucleic Acid", opts: ["Deoxyribonucleic Acid","Dynamic Neural Array","Dual Nitrogen Atom","Dense Nucleic Agent"] },
  { q: "Closest planet to Sun?", a: "Mercury", opts: ["Venus","Earth","Mercury","Mars"] },
  { q: "2 + 2 × 2 = ?", a: "6", opts: ["8","6","4","16"] },
  { q: "Capital of Japan?", a: "Tokyo", opts: ["Seoul","Beijing","Tokyo","Bangkok"] },
  { q: "Periodic symbol for Gold?", a: "Au", opts: ["Go","Gd","Au","Ag"] },
  { q: "How many sides in hexagon?", a: "6", opts: ["5","7","6","8"] },
  { q: "Boiling point of water (°C)?", a: "100", opts: ["90","100","110","120"] },
  { q: "Who painted Mona Lisa?", a: "Da Vinci", opts: ["Picasso","Da Vinci","Monet","Dali"] },
  { q: "25 ÷ 5 = ?", a: "5", opts: ["4","6","5","7"] },
  { q: "Largest ocean?", a: "Pacific", opts: ["Atlantic","Indian","Pacific","Arctic"] },
  { q: "Symbol for Oxygen?", a: "O", opts: ["Or","Ox","O","Om"] },
  { q: "What is π (pi) approx?", a: "3.14", opts: ["3.12","3.14","3.16","3.18"] },
  { q: "Year WW2 ended?", a: "1945", opts: ["1943","1944","1945","1946"] },
  { q: "Mitochondria is the powerhouse of?", a: "Cell", opts: ["Body","Nucleus","Cell","Brain"] },
  { q: "1 km = ? meters", a: "1000", opts: ["100","1000","10000","10"] },
  { q: "Photosynthesis uses?", a: "Sunlight", opts: ["Water","Sunlight","CO₂","Oxygen"] },
  { q: "Largest continent?", a: "Asia", opts: ["Africa","Asia","Europe","Americas"] },
  { q: "12 × 12 = ?", a: "144", opts: ["124","132","144","148"] },
  { q: "Human body has how many bones?", a: "206", opts: ["204","206","208","210"] },
  { q: "Light year measures?", a: "Distance", opts: ["Time","Distance","Speed","Weight"] },
  { q: "Fastest land animal?", a: "Cheetah", opts: ["Lion","Horse","Cheetah","Jaguar"] },
  { q: "Newton's 1st law is?", a: "Inertia", opts: ["Motion","Gravity","Inertia","Force"] },
  { q: "Symbol of Sodium?", a: "Na", opts: ["So","Na","Sd","Sn"] },
  { q: "60 × 60 = ?", a: "3600", opts: ["3200","3400","3600","4000"] },
  { q: "Brain uses which side for logic?", a: "Left", opts: ["Right","Left","Both","None"] },
  { q: "Hardest natural substance?", a: "Diamond", opts: ["Iron","Steel","Diamond","Quartz"] },
  { q: "CO₂ is?", a: "Carbon Dioxide", opts: ["Carbon Monoxide","Carbon Dioxide","Chlorine","Cobalt"] },
  { q: "Square root of 256?", a: "16", opts: ["14","15","16","17"] },
  { q: "Earth revolves around Sun in?", a: "365 days", opts: ["360 days","365 days","366 days","364 days"] },
  { q: "Gravity acceleration (m/s²)?", a: "9.8", opts: ["8.8","9.2","9.8","10.2"] },
  { q: "Tallest mountain?", a: "Everest", opts: ["K2","Kangchenjunga","Everest","Lhotse"] },
  { q: "What is 3⁴?", a: "81", opts: ["64","81","72","96"] },
  { q: "Atom's center is called?", a: "Nucleus", opts: ["Core","Center","Nucleus","Proton"] },
  { q: "Capital of Australia?", a: "Canberra", opts: ["Sydney","Melbourne","Canberra","Brisbane"] },
  { q: "Blood type 'universal donor'?", a: "O-", opts: ["A+","O+","O-","AB-"] },
  { q: "Python is a?", a: "Programming Language", opts: ["Snake","Programming Language","Framework","Database"] },
  { q: "LCM of 4 and 6?", a: "12", opts: ["8","10","12","24"] },
  { q: "Deepest ocean point?", a: "Mariana Trench", opts: ["Bermuda Triangle","Mariana Trench","Pacific Deep","Java Trench"] },
  { q: "1 byte = ? bits", a: "8", opts: ["4","8","16","32"] },
  { q: "Frequency unit?", a: "Hertz", opts: ["Watt","Pascal","Hertz","Newton"] },
  { q: "Area of circle = ?", a: "πr²", opts: ["2πr","πd","πr²","2πr²"] },
  { q: "Ozone protects from?", a: "UV Rays", opts: ["Rain","UV Rays","Wind","Heat"] },
  { q: "WWII started in?", a: "1939", opts: ["1935","1937","1939","1941"] },
  { q: "Richest natural resource in body?", a: "Water", opts: ["Blood","Fat","Water","Protein"] },
];

// ─── EMOJIS ─────────────────────────────────────────────────────
const OBSTACLES = ['📱','💬','🎮','📲','🔔','🕹️','📺','💻'];
const COLLECTIBLES = ['📚','🧠','⚡','💡','🔬','📖','⭐','🎯'];

// ─── GAME STATE ──────────────────────────────────────────────────
let G = {};

function resetState() {
  G = {
    running: false,
    paused:  false,
    score:   0,
    coins:   0,
    distance: 0,
    lives:   3,
    combo:   1,
    bestCombo: 1,
    shield:  false,
    shieldTimer: 0,
    boost:   false,
    boostTimer: 0,
    speed:   3.5,
    baseSpeed: 3.5,
    speedLevel: 1,
    frame:   0,
    questionTimer: 0,
    questionInterval: () => 300 + Math.random() * 400,
    nextQuestion: 0,
    difficultyTimer: 0,
    lanes: 3,
    playerLane: 1,
    playerY: 0,        // jump offset (px)
    playerVY: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    // objects
    obstacles: [],
    collectibles: [],
    particles: [],
    // spawn timers
    obsTimer: 0,
    obsInterval: 80,
    colTimer: 0,
    colInterval: 60,
    // track scroll
    trackOffset: 0,
    lastTime: 0,
    raf: null,
  };
}

// ─── CANVAS & DIMENSIONS ────────────────────────────────────────
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

const bgCanvas  = document.getElementById('bgCanvas');
const bgCtx     = bgCanvas.getContext('2d');

let W = 0, H = 0;
let LANE_W = 0;
let LANE_X = []; // center x of each lane
let GROUND_Y = 0;
const PLAYER_SIZE = 28;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  gameCanvas.width  = W; gameCanvas.height = H;
  bgCanvas.width    = W; bgCanvas.height   = H;
  LANE_W    = W / 3;
  LANE_X    = [LANE_W * 0.5, LANE_W * 1.5, LANE_W * 2.5];
  GROUND_Y  = H * 0.72;
}
window.addEventListener('resize', resize);
resize();

// ─── BG PARTICLE SYSTEM ─────────────────────────────────────────
const BG_PARTICLES = [];
for (let i = 0; i < 80; i++) {
  BG_PARTICLES.push({
    x: Math.random() * 1920, y: Math.random() * 1080,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.2,
    hue: Math.random() * 60 + 160,
  });
}

let bgFrame = 0;
function renderBg() {
  bgFrame++;
  bgCtx.clearRect(0, 0, W, H);
  // Deep gradient
  const grad = bgCtx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#000010');
  grad.addColorStop(0.5, '#080820');
  grad.addColorStop(1, '#000818');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, W, H);

  // Star particles
  BG_PARTICLES.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    bgCtx.beginPath();
    bgCtx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `hsla(${p.hue},100%,80%,${p.alpha})`;
    bgCtx.fill();
  });

  // Grid lines (moving)
  const gridOffset = (bgFrame * 2) % 60;
  bgCtx.strokeStyle = 'rgba(0,245,255,0.06)';
  bgCtx.lineWidth = 1;
  for (let y = gridOffset; y < H; y += 60) {
    bgCtx.beginPath();
    bgCtx.moveTo(0, y);
    bgCtx.lineTo(W, y);
    bgCtx.stroke();
  }
  const gOff2 = (bgFrame * 1.5) % 80;
  for (let x = gOff2; x < W; x += 80) {
    bgCtx.beginPath();
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x, H);
    bgCtx.stroke();
  }

  requestAnimationFrame(renderBg);
}
renderBg();

// ─── GAME RENDERING ─────────────────────────────────────────────

function drawTrack() {
  // Track background
  const trackTop = GROUND_Y - 10;
  const trackBot = H * 0.9;

  const tg = ctx.createLinearGradient(0, trackTop, 0, trackBot);
  tg.addColorStop(0, 'rgba(0,30,60,0.9)');
  tg.addColorStop(1, 'rgba(0,10,30,0.5)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, trackTop, W, trackBot - trackTop);

  // Lane dividers
  ctx.strokeStyle = 'rgba(0,245,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([20, 15]);
  ctx.lineDashOffset = -(G.trackOffset % 35);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(LANE_X[i] - LANE_W / 2, trackTop);
    ctx.lineTo(LANE_X[i] - LANE_W / 2, trackBot);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Ground glow line
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  const gg = ctx.createLinearGradient(0, GROUND_Y, W, GROUND_Y);
  gg.addColorStop(0, 'rgba(0,245,255,0)');
  gg.addColorStop(0.2, 'rgba(0,245,255,0.6)');
  gg.addColorStop(0.8, 'rgba(191,0,255,0.6)');
  gg.addColorStop(1, 'rgba(191,0,255,0)');
  ctx.strokeStyle = gg;
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  G.trackOffset += G.speed;
}

function drawPlayer() {
  const px = LANE_X[G.playerLane];
  const py = GROUND_Y - PLAYER_SIZE / 2 - G.playerY;

  ctx.save();
  // Glow
  const glowColor = G.shield ? '#00f5ff' : G.boost ? '#ffee00' : '#00ff88';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = G.boost ? 30 : 16;

  // Body
  const bodyH = G.sliding ? PLAYER_SIZE * 0.5 : PLAYER_SIZE;
  const bodyY = G.sliding ? py + PLAYER_SIZE * 0.25 : py;

  // Orb glow layers
  ctx.beginPath();
  ctx.arc(px, bodyY, bodyH * 0.7, 0, Math.PI * 2);
  const cg = ctx.createRadialGradient(px - 4, bodyY - 4, 2, px, bodyY, bodyH * 0.7);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.3, glowColor);
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fill();

  // Invincible flash
  if (G.invincible && G.frame % 6 < 3) {
    ctx.globalAlpha = 0.3;
  }

  // Core orb
  ctx.beginPath();
  ctx.arc(px, bodyY, bodyH * 0.5, 0, Math.PI * 2);
  const og = ctx.createRadialGradient(px - 3, bodyY - 3, 1, px, bodyY, bodyH * 0.5);
  og.addColorStop(0, '#fff');
  og.addColorStop(0.5, glowColor);
  og.addColorStop(1, glowColor + '99');
  ctx.fillStyle = og;
  ctx.fill();

  // Ring
  if (G.frame % 30 < 15) {
    ctx.beginPath();
    ctx.arc(px, bodyY, bodyH * 0.65 + Math.sin(G.frame * 0.15) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = glowColor + '88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Shield visual
  if (G.shield) {
    ctx.beginPath();
    ctx.arc(px, bodyY, bodyH * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.5 + Math.sin(G.frame * 0.2) * 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // Trail particles
  if (G.running && G.frame % 3 === 0) {
    G.particles.push({
      x: px + (Math.random() - 0.5) * 10,
      y: bodyY + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: Math.random() * -1.5,
      life: 1,
      size: Math.random() * 6 + 2,
      color: glowColor,
    });
  }
}

function drawParticles() {
  G.particles = G.particles.filter(p => p.life > 0);
  G.particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.life -= 0.04;
    p.size *= 0.97;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
    ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2,'0');
    ctx.fill();
  });
}

function drawObjects() {
  const objSize = Math.min(LANE_W * 0.5, 36);

  // Obstacles
  G.obstacles.forEach(o => {
    ctx.save();
    ctx.font = `${objSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Glow
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 15 + Math.sin(G.frame * 0.1 + o.phase) * 5;
    // Wobble
    const wobble = Math.sin(G.frame * 0.1 + o.phase) * 4;
    ctx.fillText(o.emoji, LANE_X[o.lane], o.y + wobble);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // Collectibles
  G.collectibles.forEach(c => {
    ctx.save();
    ctx.font = `${objSize * 0.9}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bob = Math.sin(G.frame * 0.12 + c.phase) * 6;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 18 + Math.sin(G.frame * 0.08 + c.phase) * 6;
    // Glow ring
    ctx.beginPath();
    ctx.arc(LANE_X[c.lane], c.y + bob, objSize * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff8844';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillText(c.emoji, LANE_X[c.lane], c.y + bob);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawEnvironment() {
  // Moving side pillars / city silhouette
  const pillarOffset = G.trackOffset % 200;
  ctx.fillStyle = 'rgba(0,20,50,0.5)';
  for (let i = 0; i < 5; i++) {
    const bx = (i * 200 - pillarOffset + W) % (W + 200) - 50;
    const bh = 60 + (i * 37) % 80;
    ctx.fillRect(bx, GROUND_Y - bh, 30, bh);
    // Windows
    ctx.fillStyle = 'rgba(0,245,255,0.15)';
    for (let w = 0; w < 3; w++) {
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(bx + 3 + w * 8, GROUND_Y - bh + 5 + r * 12, 5, 7);
      }
    }
    ctx.fillStyle = 'rgba(0,20,50,0.5)';
  }

  // Perspective lines
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 1;
  const vp = { x: W / 2, y: GROUND_Y - 100 };
  for (let i = 0; i <= 3; i++) {
    const startX = (W / 3) * i;
    ctx.beginPath();
    ctx.moveTo(startX, GROUND_Y + 50);
    ctx.lineTo(vp.x, vp.y);
    ctx.stroke();
  }
}

// ─── GAME LOOP ───────────────────────────────────────────────────

function gameLoop(ts) {
  if (!G.running) return;
  G.frame++;
  G.raf = requestAnimationFrame(gameLoop);

  const dt = Math.min((ts - G.lastTime) / 16.67, 3);
  G.lastTime = ts;

  ctx.clearRect(0, 0, W, H);

  // ── Update difficulty ─────────────────────────────────────
  G.difficultyTimer++;
  if (G.difficultyTimer > 300) {
    G.difficultyTimer = 0;
    G.speedLevel = Math.min(10, G.speedLevel + 1);
    const variation = 0.8 + Math.random() * 0.4;
    G.baseSpeed = (3.5 + G.speedLevel * 0.4) * variation;
    G.obsInterval = Math.max(35, 80 - G.speedLevel * 4 + Math.floor(Math.random() * 20 - 10));
    G.colInterval = Math.max(40, 70 - G.speedLevel * 3 + Math.floor(Math.random() * 15 - 7));
    updateSpeedBar();
  }

  G.speed = G.boost ? G.baseSpeed * 1.6 : G.baseSpeed;

  // ── Timers ───────────────────────────────────────────────
  if (G.boost) { G.boostTimer--; if (G.boostTimer <= 0) { G.boost = false; } }
  if (G.shield) { G.shieldTimer--; if (G.shieldTimer <= 0) { G.shield = false; updateShieldUI(); } }
  if (G.invincible) { G.invincibleTimer--; if (G.invincibleTimer <= 0) { G.invincible = false; } }

  // ── Physics ──────────────────────────────────────────────
  if (G.jumping) {
    G.playerVY -= 0.7;
    G.playerY += G.playerVY;
    if (G.playerY <= 0) {
      G.playerY = 0; G.playerVY = 0; G.jumping = false;
    }
  }
  if (G.sliding) {
    G.slideTimer--;
    if (G.slideTimer <= 0) G.sliding = false;
  }

  // ── Distance & Score ────────────────────────────────────
  G.distance += G.speed * dt * 0.05;
  G.score    += Math.floor(G.speed * G.combo * dt * 0.3);
  updateHUD();

  // ── Question Trigger ────────────────────────────────────
  G.questionTimer++;
  if (G.questionTimer >= G.nextQuestion) {
    G.questionTimer = 0;
    G.nextQuestion = G.questionInterval();
    showQuestion();
    return;
  }

  // ── Spawn Objects ───────────────────────────────────────
  G.obsTimer++;
  if (G.obsTimer >= G.obsInterval) {
    G.obsTimer = 0;
    spawnObstacle();
  }
  G.colTimer++;
  if (G.colTimer >= G.colInterval) {
    G.colTimer = 0;
    spawnCollectible();
  }

  // ── Move Objects ────────────────────────────────────────
  const moveSpeed = G.speed * dt;
  G.obstacles.forEach(o => { o.y += moveSpeed; });
  G.collectibles.forEach(c => { c.y += moveSpeed; });

  G.obstacles   = G.obstacles.filter(o => o.y < H + 60);
  G.collectibles= G.collectibles.filter(c => c.y < H + 60);

  // ── Collision Detection ─────────────────────────────────
  if (!G.invincible) {
    const px = LANE_X[G.playerLane];
    const playerTop = GROUND_Y - PLAYER_SIZE - G.playerY;
    const playerBot = GROUND_Y - G.playerY + (G.sliding ? -PLAYER_SIZE * 0.4 : 0);

    // Obstacles
    G.obstacles = G.obstacles.filter(o => {
      const hitRadius = 28;
      const oy = o.y;
      if (o.lane === G.playerLane && Math.abs(oy - (GROUND_Y - PLAYER_SIZE / 2 - G.playerY)) < hitRadius) {
        if (!G.shield) {
          handleHit();
          return false;
        } else {
          // Shield absorbs
          spawnHitParticles(LANE_X[o.lane], o.y, '#00f5ff');
          return false;
        }
      }
      return true;
    });

    // Collectibles
    G.collectibles = G.collectibles.filter(c => {
      const hitRadius = 32;
      const cy = c.y;
      if (c.lane === G.playerLane && Math.abs(cy - (GROUND_Y - PLAYER_SIZE / 2 - G.playerY)) < hitRadius + (G.jumping ? 16 : 0)) {
        handleCollect(c);
        return false;
      }
      return true;
    });
  }

  // ── Draw ─────────────────────────────────────────────────
  drawEnvironment();
  drawTrack();
  drawParticles();
  drawObjects();
  drawPlayer();
}

// ─── SPAWN ───────────────────────────────────────────────────────

function spawnObstacle() {
  const patterns = [
    [Math.floor(Math.random() * 3)],                   // single random lane
    [0, 2],                                             // sides
    [1],                                                // center
    [Math.floor(Math.random() * 3)],                   // random
  ];
  const lanes = patterns[Math.floor(Math.random() * patterns.length)];
  lanes.forEach(lane => {
    if (Math.random() < 0.15) return; // occasional skip for fairness
    G.obstacles.push({
      lane,
      y: -40 - Math.random() * 40,
      emoji: OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)],
      phase: Math.random() * Math.PI * 2,
    });
  });
}

function spawnCollectible() {
  const lane = Math.floor(Math.random() * 3);
  const isBoost = Math.random() < 0.15;
  G.collectibles.push({
    lane,
    y: -40 - Math.random() * 30,
    emoji: isBoost ? '⚡' : COLLECTIBLES[Math.floor(Math.random() * (COLLECTIBLES.length - 1))],
    isBoost,
    phase: Math.random() * Math.PI * 2,
  });
}

// ─── COLLISION HANDLERS ─────────────────────────────────────────

function handleHit() {
  G.lives--;
  G.combo = 1;
  G.invincible = true;
  G.invincibleTimer = 90;
  updateComboUI();

  vibe([100, 50, 200]);
  Audio.play('hit');
  spawnHitParticles(LANE_X[G.playerLane], GROUND_Y - PLAYER_SIZE, '#ff00aa');

  // Screen shake
  const gs = document.getElementById('gameScreen');
  gs.classList.remove('shake');
  void gs.offsetWidth; // reflow
  gs.classList.add('shake');
  setTimeout(() => gs.classList.remove('shake'), 400);

  updateLivesUI();
  if (G.lives <= 0) {
    setTimeout(endGame, 300);
  }
}

function handleCollect(c) {
  const pts = c.isBoost ? 50 : 20;
  const coinVal = c.isBoost ? 5 : 1 + (G.combo > 3 ? 2 : 0);

  G.score  += pts * G.combo;
  G.coins  += coinVal;
  G.combo   = Math.min(G.combo + 1, 16);

  if (c.isBoost) {
    G.boost = true;
    G.boostTimer = 150;
    Audio.play('boost');
  } else {
    Audio.play('collect');
  }
  Audio.play('coin');

  vibe(30);
  spawnHitParticles(LANE_X[c.lane], c.y, c.isBoost ? '#ffee00' : '#00ff88');
  showFloatingScore('+' + (pts * G.combo), LANE_X[c.lane], c.y, c.isBoost ? '#ffee00' : '#00ff88');

  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  updateComboUI();

  // Combo flash
  const cf = document.getElementById('comboFlash');
  cf.className = 'combo-flash';
  void cf.offsetWidth;
  if (G.combo >= 8) cf.classList.add('flash-gold');
  else if (G.combo >= 4) cf.classList.add('flash-purple');
  else cf.classList.add('flash-green');
  setTimeout(() => cf.classList.remove('flash-green','flash-purple','flash-gold'), 200);
}

function spawnHitParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 / 10) * i;
    G.particles.push({
      x, y,
      vx: Math.cos(angle) * (2 + Math.random() * 3),
      vy: Math.sin(angle) * (2 + Math.random() * 3),
      life: 1,
      size: Math.random() * 7 + 3,
      color,
    });
  }
}

// ─── HUD UPDATES ─────────────────────────────────────────────────

function updateHUD() {
  document.getElementById('hudScore').textContent = Math.floor(G.score).toLocaleString();
  document.getElementById('hudCoins').textContent = G.coins;
  document.getElementById('hudDist').textContent  = Math.floor(G.distance) + 'm';
}

function updateLivesUI() {
  ['life1','life2','life3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) {
      if (i >= G.lives) el.classList.add('dead');
      else el.classList.remove('dead');
    }
  });
}

function updateComboUI() {
  const cv = document.getElementById('comboVal');
  if (cv) {
    cv.textContent = 'x' + G.combo;
    cv.style.color = G.combo >= 8 ? '#ffee00' : G.combo >= 4 ? '#bf00ff' : '#00ff88';
  }
}

function updateSpeedBar() {
  const fill = document.getElementById('speedBar');
  const lbl  = document.getElementById('speedLabel');
  if (fill) fill.style.width = Math.min(100, G.speedLevel * 10) + '%';
  if (lbl)  lbl.textContent = 'SPEED ' + G.speedLevel;
}

function updateShieldUI() {
  const so = document.getElementById('shieldOverlay');
  if (so) {
    if (G.shield) so.classList.add('active');
    else so.classList.remove('active');
  }
}

// ─── FLOATING SCORE ─────────────────────────────────────────────

function showFloatingScore(text, x, y, color) {
  const el = document.createElement('div');
  el.className = 'float-score';
  el.textContent = text;
  el.style.left  = (x - 30) + 'px';
  el.style.top   = (y - 20) + 'px';
  el.style.color = color;
  document.getElementById('floatingScores').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ─── QUESTION SYSTEM ─────────────────────────────────────────────

let currentQ = null;
let qTimeout = null;

function showQuestion() {
  G.running = false;
  cancelAnimationFrame(G.raf);

  const pool = QUESTIONS;
  currentQ = pool[Math.floor(Math.random() * pool.length)];

  // Shuffle options
  const opts = [...currentQ.opts].sort(() => Math.random() - 0.5);

  document.getElementById('qText').textContent = currentQ.q;

  const optsEl = document.getElementById('qOptions');
  optsEl.innerHTML = '';
  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'q-option';
    btn.textContent = opt;
    btn.addEventListener('click', () => answerQuestion(opt, btn, optsEl), { once: true });
    optsEl.appendChild(btn);
  });

  // Timer bar (3 seconds)
  const fill = document.getElementById('qTimerFill');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = 'width 3s linear';
  fill.style.width = '0%';

  showScreen('questionOverlay');

  qTimeout = setTimeout(() => {
    // Time's up → wrong
    answerQuestion('__timeout__', null, optsEl);
  }, 3000);
}

function answerQuestion(answer, clickedBtn, optsEl) {
  clearTimeout(qTimeout);
  const correct = answer === currentQ.a;

  // Disable all buttons
  optsEl.querySelectorAll('.q-option').forEach(b => {
    b.style.pointerEvents = 'none';
    if (b.textContent === currentQ.a) b.classList.add('correct');
  });
  if (clickedBtn && !correct) clickedBtn.classList.add('wrong');

  if (correct) {
    Audio.play('boost');
    vibe(50);
    G.boost = true;
    G.boostTimer = 200;
    G.shield = true;
    G.shieldTimer = 120;
    G.score += 200 * G.combo;
    G.combo = Math.min(G.combo + 2, 16);
    updateShieldUI();
    showFloatingScore('+200 BOOST!', W/2, H/2, '#ffee00');
  } else {
    Audio.play('wrong');
    vibe([80,30,80]);
    G.speed = Math.max(2, G.speed * 0.6);
    G.baseSpeed = Math.max(2, G.baseSpeed * 0.7);
    G.combo = Math.max(1, G.combo - 2);
    showFloatingScore('SLOW!', W/2, H/2, '#ff00aa');
  }

  setTimeout(() => {
    hideScreen('questionOverlay');
    resumeGame();
  }, 800);
}

function resumeGame() {
  G.running = true;
  G.lastTime = performance.now();
  G.raf = requestAnimationFrame(gameLoop);
}

// ─── CONTROLS ────────────────────────────────────────────────────

let touchStart = { x: 0, y: 0, t: 0 };

document.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!G.running) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const dt = Date.now() - touchStart.t;
  const minSwipe = 30;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal swipe
    if (Math.abs(dx) > minSwipe) {
      if (dx > 0 && G.playerLane < 2) G.playerLane++;
      else if (dx < 0 && G.playerLane > 0) G.playerLane--;
    }
  } else {
    // Vertical swipe
    if (dy < -minSwipe && !G.jumping) {
      // Jump
      G.jumping = true;
      G.playerVY = 14 + G.speedLevel * 0.3;
      G.sliding = false;
    } else if (dy > minSwipe && !G.jumping) {
      // Slide
      G.sliding = true;
      G.slideTimer = 40;
    }
  }
}, { passive: true });

// Keyboard (desktop testing)
document.addEventListener('keydown', e => {
  if (!G.running) return;
  switch (e.key) {
    case 'ArrowLeft':  if (G.playerLane > 0) G.playerLane--; break;
    case 'ArrowRight': if (G.playerLane < 2) G.playerLane++; break;
    case 'ArrowUp':
      if (!G.jumping) { G.jumping = true; G.playerVY = 14; G.sliding = false; }
      break;
    case 'ArrowDown':
      if (!G.jumping) { G.sliding = true; G.slideTimer = 40; }
      break;
  }
});

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────

function showScreen(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  el.classList.add('active');
}
function hideScreen(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  el.style.display = 'none';
}
function switchScreen(fromId, toId) {
  const from = document.getElementById(fromId);
  const to   = document.getElementById(toId);
  if (from) {
    from.classList.add('screen-exit');
    setTimeout(() => { from.classList.remove('screen-exit'); hideScreen(fromId); }, 280);
  }
  setTimeout(() => { showScreen(toId); }, 150);
}

// ─── GAME FLOW ────────────────────────────────────────────────────

function startGame() {
  Audio.init();
  resetState();
  G.nextQuestion = G.questionInterval();
  G.lastTime = performance.now();
  G.running = true;

  switchScreen('startScreen', 'gameScreen');
  updateLivesUI();
  updateComboUI();
  updateSpeedBar();
  updateHUD();

  setTimeout(() => {
    G.raf = requestAnimationFrame(gameLoop);
  }, 300);
}

function endGame() {
  G.running = false;
  cancelAnimationFrame(G.raf);

  // Save records
  const isRecord = G.score > Save.highScore;
  if (isRecord) Save.highScore = Math.floor(G.score);
  Save.totalCoins += G.coins;
  if (G.distance > Save.bestDistance) Save.bestDistance = Math.floor(G.distance);
  if (G.bestCombo > Save.bestCombo) Save.bestCombo = G.bestCombo;

  // Populate over screen
  document.getElementById('overScore').textContent = Math.floor(G.score).toLocaleString();
  document.getElementById('overDist').textContent  = Math.floor(G.distance) + 'm';
  document.getElementById('overCoins').textContent = G.coins;
  document.getElementById('overCombo').textContent = 'x' + G.bestCombo;
  document.getElementById('overBest').textContent  = Save.highScore.toLocaleString();
  document.getElementById('overTitle').textContent = isRecord ? '⚡ LEGEND!' : 'GAME OVER';
  document.getElementById('overSubtitle').textContent = isRecord ? 'You set a new record!' : 'Distraction wins… this time.';
  document.getElementById('newRecordBadge').style.display = isRecord ? 'inline-block' : 'none';

  switchScreen('gameScreen', 'gameOverScreen');
}

function restartGame() {
  switchScreen('gameOverScreen', 'gameScreen');
  setTimeout(() => {
    resetState();
    G.nextQuestion = G.questionInterval();
    G.lastTime = performance.now();
    G.running = true;
    updateLivesUI();
    updateComboUI();
    updateSpeedBar();
    updateHUD();
    G.raf = requestAnimationFrame(gameLoop);
  }, 300);
}

function goBack() {
  G.running = false;
  cancelAnimationFrame(G.raf);
  // Try to go back in history (from dashboard iframe / page)
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'dashboard-home.html';
  }
}

// ─── SETTINGS ─────────────────────────────────────────────────────

window.toggleSound = function() {
  Settings.toggle('sound');
  const icon = document.getElementById('soundIcon');
  const btn  = document.getElementById('soundToggle');
  if (icon) icon.textContent = Settings.sound ? '🔊' : '🔇';
  if (btn)  btn.classList.toggle('active', Settings.sound);
};

window.toggleVibe = function() {
  Settings.toggle('vibrate');
  const icon = document.getElementById('vibeIcon');
  const btn  = document.getElementById('vibeToggle');
  if (icon) icon.textContent = Settings.vibrate ? '📳' : '📴';
  if (btn)  btn.classList.toggle('active', Settings.vibrate);
};

// ─── INIT START SCREEN ────────────────────────────────────────────

function initStartScreen() {
  document.getElementById('previewBest').textContent  = Save.highScore.toLocaleString();
  document.getElementById('previewCoins').textContent = Save.totalCoins.toLocaleString();
  document.getElementById('previewDist').textContent  = Save.bestDistance + 'm';

  // Sync toggles
  const sb = document.getElementById('soundToggle');
  const vb = document.getElementById('vibeToggle');
  const si = document.getElementById('soundIcon');
  const vi = document.getElementById('vibeIcon');
  if (Settings.sound)   { sb?.classList.add('active'); }
  if (Settings.vibrate) { vb?.classList.add('active'); }
  if (si) si.textContent = Settings.sound   ? '🔊' : '🔇';
  if (vi) vi.textContent = Settings.vibrate ? '📳' : '📴';
}

// Expose globals needed by HTML
window.startGame   = startGame;
window.restartGame = restartGame;
window.goBack      = goBack;

// Boot
initStartScreen();
showScreen('startScreen');
