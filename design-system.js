// ═══════════════════════════════════════════════
// STUDY GRID PREP — SHARED PAGE BEHAVIORS
// Identical on every page. Include verbatim after
// the header/footer markup on any new content page.
// ═══════════════════════════════════════════════

// ── FAQ ──
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── HAMBURGER / MOBILE MENU ──
function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('mobileMenu').classList.remove('open');
}
document.addEventListener('click', (e) => {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (hamburger && menu && !hamburger.contains(e.target) && !menu.contains(e.target)) {
    hamburger.classList.remove('open');
    menu.classList.remove('open');
  }
});

// ── SCROLL REVEAL ──
document.addEventListener('DOMContentLoaded', () => {
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
});

// ═══════════════════════════════════════════════
// SITEWIDE FAQ ("Got questions?") — identical content
// on every page (index.html, jee-preparation-2027.html,
// cuet-preparation-guide.html all use these exact 6 Q&As).
// ═══════════════════════════════════════════════
const SGP_SITE_FAQ = [
  { q: "What is Study Grid Prep?", a: "Study Grid Prep is an all-in-one study platform designed for students preparing for JEE, NEET, CUET and Board Exams. It brings together Mock Tests with PYQs, a Smart Focus Timer with live study rooms, Study Playlist for distraction-free video learning, Todo Planner, Performance Tracking, and Leaderboard — all in a single clean platform built to keep you focused and consistent." },
  { q: "Is Study Grid Prep free to use?", a: "Most features — Focus Timer, Study Playlist, Todo Planner, Leaderboard and Progress Tracking — are completely free. Mock Tests are available at an affordable price. Sign up and explore for free before deciding." },
  { q: "Which exams does this platform cover?", a: "Study Grid Prep is built for JEE Main, NEET, CUET UG and Board Exams. Mock tests, PYQs and subject tracking are all tailored for these specific exams — nothing generic." },
  { q: "How does the AI analysis in Mock Tests work?", a: "After every mock test, our AI reviews your attempt and gives you a detailed breakdown — topic-wise weak areas, time management insights and actionable tips to improve. It's available right inside the Mock Analysis and Solutions page." },
  { q: "What is the Study Playlist and how does Ask AI work there?", a: "Study Playlist lets you organise YouTube videos subject-wise and watch them distraction-free. Right beside the video, you can tap Ask AI to ask doubts about what you're watching, chat with AI for deeper explanations, or instantly generate a timed quiz from the video content." },
  { q: "Can I study with friends on this platform?", a: "Yes! The Smart Focus Timer lets you join live study rooms with other students. You can see who's studying, wave 👋, chat and compete on the leaderboard — making solo study feel like a group session." }
];

function renderSiteFaq(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = SGP_SITE_FAQ.map(item => `
    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        <span>${item.q}</span>
        <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="faq-a"><p>${item.a}</p></div>
    </div>
  `).join('');
}
window.renderSiteFaq = renderSiteFaq;

// ═══════════════════════════════════════════════
// CHATBOT WIDGET — identical logic/KB across every page.
// Call initChatbot() once the chatbot markup (button + window,
// see content-render.html for the exact markup) is in the DOM.
// ═══════════════════════════════════════════════
function initChatbot(notifText) {
  const btn = document.getElementById('sgpChatBtn');
  const win = document.getElementById('sgpWindow');
  const msgs = document.getElementById('sgpMessages');
  const chips = document.getElementById('sgpChips');
  const input = document.getElementById('sgpInput');
  const notif = document.getElementById('sgpNotif');
  const emailFrm = document.getElementById('sgpEmailForm');
  if (!btn || !win) return;

  if (notif && notifText) notif.textContent = notifText;

  let isOpen = false, hasInteracted = false, autoIdx = 0, autoTimer = null, lastUserMsg = '';
  const defaultChips = ['Mock Tests', 'AI Analysis', 'Features', 'Pricing'];
  const defaultReply = 'Great question! Let me connect you with our team for more details.';

  const KB = [
    { k: ['mock','test','jee','neet','cuet','board'], r: '📝 We have <strong>100+ mock tests</strong> for JEE, NEET, CUET & Boards with AI-powered analysis after every attempt! <a href="/" style="color:#4F46E5;font-weight:600;">Explore Tests →</a>' },
    { k: ['ai','analysis','result','score','performance'], r: '📊 After every mock, AI gives topic-wise weak areas, time management insights and improvement tips. Available in Mock Analysis & Solutions page.' },
    { k: ['free','cost','price','pricing','paid'], r: '💰 Most features are <strong>free</strong> — Focus Timer, Study Playlist, Todo, Leaderboard, Progress Tracking. Mock Tests are at an affordable price. No credit card needed to sign up!' },
    { k: ['focus','timer','pomodoro','study room','room'], r: '⏱️ Smart Focus Timer uses Pomodoro sessions. Join live study rooms, earn XP and build streaks with students across India!' },
    { k: ['contact','email','reach','support','team'], r: '📧 Reach us at <strong>support@studygridprep.online</strong> or share your query here and I\'ll forward it to the team!' },
    { k: ['sign','signup','register','get started','start'], r: '🚀 Sign up in 10 seconds — just tap "Get Started" and sign in with Google. No forms needed! <a href="/login.html" style="color:#4F46E5;font-weight:600;">Sign Up Free →</a>' },
    { k: ['hello','hi','hey','namaste'], r: 'Hello! 👋 I\'m your <strong>Study Assistant</strong> for Study Grid Prep. Ask me anything about mock tests, AI tools, features or pricing!' },
    { k: ['features','tools','what'], r: '🌟 Study Grid Prep has: 📝 Mock Tests with AI Analysis · ⏱️ Focus Timer + Study Rooms · ▶️ Study Playlist with AI · ✅ Todo Planner · 🏆 Leaderboard · 📊 Performance Tracking. Most features are free!' },
    { k: ['playlist','video','youtube'], r: '▶️ Study Playlist lets you watch YouTube videos distraction-free with Ask AI for doubts, Chat with AI, and Create Quiz from any video!' },
  ];

  function getBotReply(text) {
    const t = text.toLowerCase();
    for (const item of KB) { if (item.k.some(k => t.includes(k))) return item.r; }
    return defaultReply;
  }
  function addMsg(text, side) {
    const d = document.createElement('div');
    d.className = 'sgp-msg ' + side;
    d.innerHTML = side === 'bot' ? `<div class="sgp-msg-icon">🎓</div><div class="sgp-bubble">${text}</div>` : `<div class="sgp-bubble">${text}</div>`;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }
  function setChips(arr) {
    chips.innerHTML = '';
    arr.forEach(t => {
      const c = document.createElement('button');
      c.className = 'sgp-chip'; c.textContent = t;
      c.onclick = () => {
        hasInteracted = true; chips.innerHTML = ''; addMsg(t, 'user');
        const reply = getBotReply(t);
        setTimeout(() => { addMsg(reply, 'bot'); setChips(['Ask Another', 'Contact Team', 'Sign Up Free']); }, 700);
      };
      chips.appendChild(c);
    });
  }
  function openChat() {
    isOpen = true; win.classList.add('open'); btn.classList.add('open'); if (notif) notif.classList.remove('show');
    if (msgs.children.length === 0) {
      setTimeout(() => {
        addMsg('Hello! 👋 I\'m your <strong>Study Assistant</strong> for Study Grid Prep.', 'bot');
        setTimeout(() => { addMsg('Ask me anything about mock tests, AI tools, features or pricing!', 'bot'); setTimeout(() => setChips(defaultChips), 200); }, 650);
      }, 200);
    }
  }
  function closeChat() {
    isOpen = false; win.classList.remove('open'); btn.classList.remove('open');
    if (!hasInteracted) startAutoPrompts();
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); isOpen ? closeChat() : openChat(); });
  document.addEventListener('click', (e) => { if (!isOpen) return; if (win.contains(e.target) || btn.contains(e.target)) return; closeChat(); });
  win.addEventListener('click', e => e.stopPropagation());

  window.sgpSend = function () {
    const text = input.value.trim(); if (!text) return;
    hasInteracted = true; stopAutoPrompts(); lastUserMsg = text; input.value = '';
    addMsg(text, 'user'); chips.innerHTML = '';
    const reply = getBotReply(text);
    setTimeout(() => { addMsg(reply, 'bot'); setChips(['Ask Another', 'Contact Team', 'Sign Up Free']); }, 700);
  };
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sgpSend(); } });

  window.sgpSubmitEmail = function (e) {
    if (e) e.stopPropagation();
    const nameEl = document.getElementById('sgpFormName');
    const emailEl = document.getElementById('sgpFormEmail');
    const name = nameEl.value.trim(), email = emailEl.value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    nameEl.style.borderColor = name ? '' : '#EF4444';
    emailEl.style.borderColor = emailOk ? '' : '#EF4444';
    if (!name || !emailOk) return;
    if (emailFrm) emailFrm.style.display = 'none';
    addMsg(name + ' · ' + email, 'user');
    fetch('https://formsubmit.co/ajax/untitledworld9@gmail.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, subject: 'Study Grid Prep — Chat Query from ' + name, message: 'Name: ' + name + '\nEmail: ' + email + '\n\nQuery:\n' + (lastUserMsg || 'General inquiry'), _captcha: 'false' })
    }).catch(() => {});
    setTimeout(() => { addMsg('Got it! ✅ We\'ll get back to you at <strong>' + email + '</strong> very soon.', 'bot'); nameEl.value = ''; emailEl.value = ''; }, 1000);
  };

  const autoPrompts = ['Preparing for an exam? I can help! 📚', 'Ask me about our 100+ mock tests! 📝', 'Want AI-powered study analysis? ✨', 'Study Rooms are live — join one! 👥'];
  function showNotif(text) { if (!notif) return; notif.textContent = text; notif.classList.add('show'); setTimeout(() => notif.classList.remove('show'), 4500); }
  function startAutoPrompts() {
    if (hasInteracted || isOpen) return;
    autoTimer = setTimeout(function loop() {
      if (!isOpen && !hasInteracted) { showNotif(autoPrompts[autoIdx % autoPrompts.length]); autoIdx++; autoTimer = setTimeout(loop, 6000); }
    }, 6000);
  }
  function stopAutoPrompts() { clearTimeout(autoTimer); if (notif) notif.classList.remove('show'); }
  startAutoPrompts();

  // hide chat button while the dark footer block is on screen (same as other pages)
  const darkBlock = document.querySelector('.dark-footer-block');
  if (darkBlock) {
    let chatHidden = false;
    const chatScrollObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !chatHidden) {
          chatHidden = true;
          btn.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          btn.style.opacity = '0'; btn.style.transform = 'scale(0.7)'; btn.style.pointerEvents = 'none';
          if (notif) { notif.style.opacity = '0'; notif.style.pointerEvents = 'none'; }
        } else if (!entry.isIntersecting && chatHidden) {
          chatHidden = false;
          btn.style.opacity = '1'; btn.style.transform = ''; btn.style.pointerEvents = '';
          if (notif) { notif.style.opacity = ''; notif.style.pointerEvents = ''; }
        }
      });
    }, { threshold: 0.05 });
    chatScrollObs.observe(darkBlock);
  }
}
window.initChatbot = initChatbot;
