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
  { q: "Can I study with friends on this platform?", a: "Yes! The Smart Focus Timer lets you join live study rooms with other students. You can see who's studying, wave 👋, chat and compete on the leaderboard — making solo study feel like a group session." },
  { q: "What is the Student Community and how does it help?", a: "The Student Community connects you with peers preparing for the same target exam (JEE, NEET, CUET, or Boards). You can share handwritten notes, PYQ solutions, discuss tricky questions, ask academic doubts, and keep each other motivated in a focused, collaborative study space." },
  { q: "What can I access in the Content Hub?", a: "The Content Hub is your central library for curated chapter notes, past year papers (PYQs), college admission cutoff guides, syllabus alerts, and educational articles — keeping all essential learning resources organized in one tap." }
];
window.SGP_SITE_FAQ = SGP_SITE_FAQ;

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
// HERO ACCENT COLOR — maps a content's chosen accent
// (from Content Studio) to the hero glow CSS variables.
// Used by content-render.html and the Content Studio preview.
// ═══════════════════════════════════════════════
const SGP_ACCENT_MAP = {
  primary: ["rgba(99,102,241,0.11)", "rgba(6,182,212,0.06)", "rgba(124,58,237,0.06)"],
  accent:  ["rgba(6,182,212,0.13)",  "rgba(99,102,241,0.05)", "rgba(13,148,136,0.06)"],
  teal:    ["rgba(13,148,136,0.13)", "rgba(6,182,212,0.05)",  "rgba(16,185,129,0.06)"],
  violet:  ["rgba(124,58,237,0.13)", "rgba(99,102,241,0.06)", "rgba(225,29,72,0.05)"],
  orange:  ["rgba(234,88,12,0.13)",  "rgba(217,119,6,0.06)",  "rgba(124,58,237,0.05)"],
  rose:    ["rgba(225,29,72,0.13)",  "rgba(124,58,237,0.05)", "rgba(217,119,6,0.05)"],
  amber:   ["rgba(217,119,6,0.13)",  "rgba(234,88,12,0.06)",  "rgba(124,58,237,0.05)"]
};
function heroAccentStyle(accentColor) {
  const [g1, g2, g3] = SGP_ACCENT_MAP[accentColor] || SGP_ACCENT_MAP.primary;
  return `--hero-glow-1:${g1};--hero-glow-2:${g2};--hero-glow-3:${g3};`;
}
window.heroAccentStyle = heroAccentStyle;

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
  const defaultChips = ['Mock Tests', 'Focus Timer', 'Community', 'Content Hub', 'Study Playlist', 'Pricing'];
  const defaultReply = 'Hmm, yeh mujhe exactly samajh nahi aaya 🤔 Lekin platform ke baare mein kuch bhi poochh sakte ho — mock tests, community, content hub, study playlist, focus timer, pricing, sign up. Ya chahein toh team ko directly message kar deta hoon?';

  const KB = [
    // Mock Tests & Exam Prep
    { k: ['mock test','mock tests','mocks','test series','test paper','full test','mock'], r: '📝 We have <strong>100+ full-length mock tests</strong> for JEE Main, NEET UG, CUET UG & Boards! Each mock includes detailed AI-powered analysis — topic-wise weak areas, time management insights, and step-by-step improvement tips. <a href="mock-home.html" style="color:#4F46E5;font-weight:600;">Browse Mock Tests →</a>' },
    { k: ['jee main','jee mains','jee mock','jee test','jee advanced','jee adv','jee prep','jee 2026','jee kya','jee ke liye','jee pattern','jee syllabus','jee subject','jee physics','jee chemistry','jee maths','about jee','jee kaise','jee ki prep','main jee','jee'], r: '⚛️ <strong>JEE Main 2026</strong> ke liye Study Grid Prep mein:\n\n📋 <strong>Exam Pattern:</strong> 90 Questions (30 Physics + 30 Chemistry + 30 Maths), 3 Hours, 300 Marks. MCQ: +4/-1, Numerical: +4/0.\n\n✅ <strong>Platform pe kya milega:</strong>\n• Full-length JEE Main mock tests (NTA pattern)\n• Subject-wise tests — sirf Physics, sirf Chemistry, sirf Maths\n• AI Analysis — weak topics, time per question, accuracy %\n• Time-Bound Solver — speed practice\n• Study Playlist — Physics/Chem/Maths videos organized\n• Content Hub — Chapter notes & PYQ archives\n\n💡 Consistent mock practice + AI feedback = rank improvement guaranteed! <a href="mock-home.html" style="color:#4F46E5;font-weight:600;">Start JEE Mocks →</a>' },
    { k: ['neet mock','neet test','neet prep','neet 2026','neet ug','neet kya','neet ke liye','neet pattern','neet syllabus','neet biology','neet physics','neet chemistry','about neet','neet kaise','neet ki prep','main neet','neet score','neet rank','720','neet'], r: '🔬 <strong>NEET UG 2026</strong> ke liye Study Grid Prep mein:\n\n📋 <strong>Exam Pattern:</strong> 180 Questions, 720 Marks, 3.5 Hours.\n• Physics: 45 Q (35+10), Chemistry: 45 Q (35+10)\n• Botany: 45 Q (35+10), Zoology: 45 Q (35+10)\n• MCQ: +4/-1 | Assertion-Reason: +4/-1\n\n✅ <strong>Platform pe kya milega:</strong>\n• Full-length NEET mock tests — NTA pattern\n• Section-wise tests — Biology (Bot+Zoo), Physics, Chemistry\n• AI Analysis — subject-wise weak areas identify karo\n• Study Playlist — NCERT-based Biology/Physics/Chem videos\n• Focus Timer — roz consistent padhai ke liye\n• Content Hub — High-yield NCERT notes & PYQs\n\n💡 NEET mein Biology ka weight 360/720 hai — usse strong karo! Sign up free karo. 🎯 <a href="mock-home.html" style="color:#4F46E5;font-weight:600;">Explore NEET Mocks →</a>' },
    { k: ['cuet','cuet mock','cuet test','cuet prep','cuet ug','cuet 2026','cuet kya','cuet ke liye','cuet pattern','cuet domain','cuet language','cuet general test','cuet subjects','about cuet','cuet kaise'], r: '📚 <strong>CUET UG 2026</strong> ke liye Study Grid Prep mein:\n\n📋 <strong>Exam Structure:</strong>\n• Section IA/IB: Language (13 Indian + Foreign languages)\n• Section II: Domain Subjects (27 subjects — pick your combination)\n• Section III: General Test (optional, needed for some universities)\n• MCQ format, 40/50 questions per section, 45 min each\n\n✅ <strong>Platform pe kya milega:</strong>\n• Domain subject-wise mock tests (choose your subjects)\n• General Test practice sets\n• NTA pattern follow karti hain sabhi tests\n• AI Analysis — section-wise weak areas\n• Study Playlist — NCERT + CUET specific content\n\n💡 CUET mein domain subjects ka weightage highest hai — unhe prioritize karo! <a href="mock-home.html" style="color:#4F46E5;font-weight:600;">Start CUET Mocks →</a>' },
    { k: ['board exam','boards mock','cbse','class 12','class 11','boards prep','12th boards','11th boards','cbse pattern','board kya','boards ke liye','boards kaise','board result','board marks','term exam','cbse mock','state board','boards 2026','about boards','boards','board'], r: '🎓 <strong>Board Exam 2026</strong> ke liye Study Grid Prep mein:\n\n📋 <strong>Coverage:</strong>\n• CBSE Class 11 & 12 — all major subjects\n• State board patterns ke according practice\n• Science stream (PCM/PCB) focus\n• Chapter-wise & full-length mock tests\n\n✅ <strong>Platform pe kya milega:</strong>\n• Subject-wise mock tests — Physics, Chemistry, Maths, Biology\n• AI Analysis — chapter-wise weak topics identify karo\n• Study Playlist — NCERT chapter videos organized subject-wise\n• Todo Planner — syllabus track karo chapter by chapter\n• Focus Timer — boards ki padhai ke liye consistent sessions\n\n💡 Boards mein 90%+ laane ke liye NCERT thorough karo aur past papers regularly practice karo! <a href="mock-home.html" style="color:#4F46E5;font-weight:600;">Start Board Practice →</a>' },
    { k: ['pyq','previous year','past papers','old paper','previous papers'], r: '📋 <strong>PYQs (Previous Year Questions)</strong> for JEE, NEET & CUET are integrated inside both the Mock Test platform and the Content Hub. Practice real exam questions with full AI analysis and step-by-step solutions! <a href="content-hub.html" style="color:#4F46E5;font-weight:600;">Access PYQs →</a>' },
    { k: ['ai analysis','mock analysis','performance analysis','result','score','score card','weak area','weak topic','accuracy'], r: '📊 After every mock test, our <strong>AI Analysis</strong> gives you: topic-wise weak areas, time management insights, question-wise accuracy breakdown, and actionable improvement tips to boost your score.' },

    // Student Community & Content Hub
    { k: ['community','student community','peers','peer','friends','study partner','group study','same exam','share notes','doubt discussion','student group','dost','discussion'], r: '🤝 <strong>Student Community:</strong> Connect with peers preparing for the same exams (JEE, NEET, CUET, Boards). Share handwritten notes, discuss difficult questions, solve doubts together, and stay motivated in a distraction-free student network! <a href="community.html" style="color:#4F46E5;font-weight:600;">Join Community →</a>' },
    { k: ['content hub','contenthub','notes','chapter notes','formula sheet','study material','materials','college cutoffs','cutoff','cutoffs','syllabus','exam update','updates','handwritten notes'], r: '📚 <strong>Content Hub:</strong> Your one-stop academic library for curated chapter-wise notes, previous year question papers (PYQs), college cutoffs (IITs, NITs, AIIMS, DU), admissions guides, syllabus alerts, and educational articles. <a href="content-hub.html" style="color:#4F46E5;font-weight:600;">Explore Content Hub →</a>' },

    // Careers & Hiring
    { k: ['career','careers','hiring','job','internship','join team','work with us','apply','recruitment','developer','creator','ambassador','contribute'], r: '💼 <strong>Join the Study Grid Prep Team:</strong> We are hiring student ambassadors, content creators, UI/UX designers, and developers! Check open roles and submit your application at <a href="careers.html" style="color:#4F46E5;font-weight:600;">Careers Page →</a> or <a href="hiring-portal.html" style="color:#4F46E5;font-weight:600;">Hiring Portal →</a>' },

    // Focus Timer & Live Study Rooms
    { k: ['focus timer','pomodoro','study timer','timer','focus'], r: '⏱️ The <strong>Smart Focus Timer</strong> uses Pomodoro-based sessions to keep you productive. You can: join live study rooms with other students, earn XP for every session, build study streaks, and see your rank on the leaderboard!' },
    { k: ['study room','live room','study with friends','group study room','live study'], r: '👥 <strong>Live Study Rooms:</strong> Study alongside real students in real time! See who\'s studying, wave 👋, send reactions, chat, and compete on the leaderboard — makes solo study feel like a collaborative study group.' },
    { k: ['xp','experience points','earn xp','points'], r: '🏅 You earn <strong>XP (Experience Points)</strong> by: completing Focus Timer sessions, finishing mock tests, and maintaining daily streaks. More XP = higher leaderboard rank!' },
    { k: ['streak','daily streak','study streak'], r: '🔥 Build a <strong>daily study streak</strong> by studying every day with the Focus Timer! Your streak is shown on your profile and on the leaderboard. Consistent students rise to the top.' },
    { k: ['leaderboard','rank','ranking','compete','top rank'], r: '🏆 The <strong>Global Leaderboard</strong> ranks students across India by XP earned from Focus Timer sessions and mock tests. The more consistent you are, the higher you rank. It is updated daily!' },

    // Study Playlist & AI Tools
    { k: ['study playlist','playlist','youtube','yt playlist','video','lecture'], r: '▶️ <strong>Study Playlist:</strong> Lets you organise YouTube lectures subject-wise and watch distraction-free (no ads, no recommendations). Features:\n• <strong>Ask AI</strong> — ask doubts while watching\n• <strong>Chat with AI</strong> — get deeper explanations\n• <strong>Create Quiz</strong> — generate a timed quiz from any video instantly!' },
    { k: ['ask ai','ask doubt','doubt','question'], r: '💡 While watching any video in Study Playlist, tap <strong>Ask AI</strong> to instantly ask doubts about the video content. The AI understands the video context and gives you clear, relevant answers in English or Hindi!' },
    { k: ['chat with ai','ai chat','ai tutor'], r: '🤖 <strong>Chat with AI</strong> inside Study Playlist lets you have a full conversation with AI about any topic from the video — like having a personal tutor beside you 24/7!' },
    { k: ['create quiz','ai quiz','quiz from video','generate quiz'], r: '🧠 <strong>Create Quiz with AI</strong> generates a timed quiz from any YouTube video — pick the number of questions (5, 8, or 10), set the timer, and choose marks per question. AI creates it instantly from the video content!' },
    { k: ['ai feature','ai tools','ai powered','artificial intelligence','study with ai'], r: '✨ <strong>AI across Study Grid Prep:</strong>\n• 📊 Mock AI Analysis — detailed performance breakdown\n• 💡 Ask AI — doubt solving while watching videos\n• 🤖 Chat with AI — full AI tutor conversations\n• 🧠 Create Quiz — instant quiz from any video\n\nIt is your personal AI study partner, always available!' },

    // Todo, Progress, Solver
    { k: ['todo','to-do','task','planner','schedule','timetable'], r: '✅ The <strong>Todo Planner</strong> helps you plan your day with a smart task list. Set daily goals, get reminders, and track your task completion rate to stay on top of your syllabus.' },
    { k: ['progress','progress tracking','analytics','weekly report','report'], r: '📊 <strong>Performance Analysis</strong> shows your: weekly study hours chart, XP growth over time, leaderboard rank history, and subject-wise progress. All in one clean dashboard.' },
    { k: ['solver','time bound','timed problem','speed'], r: '🧮 The <strong>Time-Bound Solver</strong> gives you timed problem-solving challenges to sharpen your speed — critical for JEE, NEET & CUET where time management is everything.' },

    // Pricing & Access
    { k: ['free','cost','price','pricing','paid','subscription','plan','trial','1 rupee','29'], r: '💰 <strong>Transparent Pricing:</strong>\n• <strong>100% Free:</strong> Focus Timer & Study Rooms, Study Playlist with AI, Todo Planner, Leaderboard, Progress Tracking, Content Hub notes & Community.\n• <strong>Pro Plan:</strong> ₹1 7-day trial, then ₹29/month for 100+ full-length mock tests & AI performance analysis. No credit card needed to sign up! <a href="subscription.html" style="color:#4F46E5;font-weight:600;">View Subscription →</a>' },
    { k: ['sign up','signup','register','create account','get started'], r: '🚀 Signing up takes <strong>10 seconds</strong> — just click "Get Started" and sign in with Google. No forms, no passwords, no hassle. Your data is saved automatically! <a href="login.html" style="color:#4F46E5;font-weight:600;">Sign Up Free →</a>' },
    { k: ['login','log in','sign in'], r: '🔑 Login is simple — click <strong>"Login"</strong> and sign in with your Google account. One tap and you are in. <a href="login.html" style="color:#4F46E5;font-weight:600;">Login Here →</a>' },
    { k: ['study plan','exam date','target','goal','countdown'], r: '📅 After signing up, set your <strong>target exam and exam date</strong>. You will get a personalised live countdown and can organise your study schedule around your goal.' },

    // Support, FAQ & Channels
    { k: ['contact','email','reach','support','team','helpdesk'], r: '📧 Reach us at <strong>support@studygridprep.online</strong> or use the <a href="contact.html" style="color:#4F46E5;font-weight:600;">Contact Us page</a> on the website.' },
    { k: ['blogs','blog','article','articles','guide','guides'], r: '📰 Read exam preparation strategies, syllabus breakdowns, and study guides on the <a href="blogs.html" style="color:#4F46E5;font-weight:600;">Study Grid Prep Blog →</a>' },
    { k: ['instagram','youtube channel','telegram','social','twitter','x'], r: '📱 Follow Study Grid Prep on:\n• <a href="https://www.youtube.com/@studygridprep" target="_blank">YouTube</a> — study tips & updates\n• <a href="https://www.instagram.com/studygridprep" target="_blank">Instagram</a> — daily motivation\n• <a href="https://t.me/studygridprep" target="_blank">Telegram</a> — announcements & notes\n• <a href="https://x.com/studygridprep" target="_blank">X (Twitter)</a> — latest news' },
    { k: ['pwa','app','install app','download app','apk','mobile app','phone'], r: '📲 Study Grid Prep works as an installable <strong>Progressive Web App (PWA)</strong> — install it directly from your browser on Android, iOS, Windows, and Mac for a native app feel!' },
    { k: ['distraction','focus','no distraction','clean'], r: '🎯 Study Grid Prep is built to be <strong>completely distraction-free</strong> — no social feed, no ads, no noise. Just you, your study tools, and your goals.' },
    { k: ['safe','secure','data','privacy','information'], r: '🔒 Aapka data bilkul safe hai. Hum Google Sign-In use karte hain — koi password store nahi hota. Read our <a href="privacy.html" style="color:#4F46E5;font-weight:600;">Privacy Policy →</a>.' },
    { k: ['not loading','error','issue','bug','problem','kaam nahi kar raha','crash'], r: '🛠️ Agar koi feature load nahi ho raha toh: 1. Page refresh karein. 2. Browser cache clear karein. 3. Internet check karein. Fir bhi issue rahe toh <strong>support@studygridprep.online</strong> par likhein!' },

    // General & Hindi casual
    { k: ['hello','hi there','hey','hii','helo','namaste','hola','sup','wassup'], r: 'Hello! 👋 I\'m your <strong>Study Assistant</strong> for Study Grid Prep. Ask me anything about mock tests, AI tools, focus timer, study playlist, community, content hub, features, or pricing — I\'m here to help in English or Hindi!' },
    { k: ['help','kya hai','what is this','kaise use','how to use','bata','batao'], r: '🙋 Sure! I can help you with:\n• 📝 Mock Tests (JEE, NEET, CUET, Boards)\n• 🤝 Student Community & Doubt Solving\n• 📚 Content Hub (Notes, PYQs, Cutoffs)\n• ⏱️ Focus Timer & Live Study Rooms\n• ▶️ Study Playlist with AI\n• 🧠 Create Quiz from Videos\n• 💼 Careers & Hiring Portal\n• 💰 Pricing & Free Features\n\nWhat do you need help with?' },
    { k: ['features','all features','kya milega','kya hai platform','platform kya hai','tools'], r: '🌟 <strong>Study Grid Prep</strong> is a complete study platform with:\n• 📝 100+ Mock Tests (JEE/NEET/CUET/Boards) with AI Analysis\n• 🤝 Student Community for notes & peer doubt solving\n• 📚 Content Hub with notes, PYQs & college cutoffs\n• ⏱️ Smart Focus Timer + Live Study Rooms\n• ▶️ Study Playlist (YouTube + AI Doubt Solving)\n• 🧠 Create Quiz from any video\n• 🧮 Time-Bound Solver\n• 📊 Performance Tracking\n• ✅ Todo Planner\n• 🏆 Global Leaderboard\n\nSab kuch ek jagah, distraction-free. Most features are free!' },
    { k: ['padhai','study kaise','kaise padhun','study tips','topper','toppers'], r: '📚 Padhai ke liye kuch tips:\n• Roz ek fixed time set karo study ke liye\n• Mock tests dete raho — real exam jaisa practice hoga\n• Focus Timer use karo — Pomodoro se concentration badhti hai\n• Playlist me videos organise karo subject-wise\n• Community me doubts discuss karo\n\nConsistency hi key hai! 💪' },
    { k: ['thak gaya','bore ho gaya','motivation','motivate','tired','demotivated','nahi ho raha','nhi ho rha'], r: '💪 Arey mat thako! Har topper ka ek waqt aisa aata hai. Bas ek kaam karo — abhi Study Grid Prep kholo, ek chhota Focus Timer lao aur 25 min de do. Ek session, bas. Shuru karne ke baad momentum khud aa jaata hai! 🔥' },
    { k: ['accha hai','good platform','nice','best platform','bahut accha','bahut accha hai'], r: '😊 Thank you so much! Hum students ke liye best experience banana chahte hain. Koi bhi suggestion ho toh zaroor batao — har feedback kaam aata hai!' },
    { k: ['how many students','kitne students','students','users'], r: '🎓 Abhi <strong>1000+ active students</strong> Study Grid Prep use kar rahe hain aur ye number roz badh raha hai! Community ke saath padho — Study Rooms join karo aur leaderboard pe aao! 🏆' },
    { k: ['thank you','thanks','shukriya','dhanyawad','thankyou','ty'], r: 'Aapka swagat hai! 😊 Koi aur sawaal ho toh bilkul poocho. Padhai me best of luck! 🎯' },
    { k: ['bye','goodbye','alvida','ok bye','chal bye'], r: 'Alvida! 👋 Best of luck apni padhai mein. Jab bhi koi sawaal ho — main yahaan hoon. Keep studying! 📚✨' },
    { k: ['ok','okay','hmm','achha','acha','kkk','alright'], r: 'Perfect! Aur kuch jaanna hai? Koi bhi question ho freely poochh sakte ho 😊' },
    { k: ['who are you','tum kaun ho','aap kaun','what are you','bot hai','ai hai'], r: 'Main Study Grid Prep ka <strong>Study Assistant</strong> hoon 🎓 — ek AI chatbot jo platform ke baare mein aapko guide karta hai. Mock tests, community, content hub, features, pricing — sab pooch sakte ho!' },
    { k: ['pressure','tension','stress','stressed','anxiety','dar lag raha','darr','ghabra','exam ka dar','nervous'], r: '😮‍💨 Exam pressure feel hona bilkul normal hai — har student isse guzarta hai. Ek kaam karo: abhi sab kuch bhool ke sirf ek 25-min Focus Timer session karo. Ek chhota step, bas. Pressure tab hatega jab preparation strong hogi — aur uske liye hum yahaan hain! 💪' },
    { k: ['fail ho gaya','fail ho jaaunga','fail ho jayega','fail','flunk','zero marks','bahut bura marks','marks kam','kam marks','low score','bahut bura','result kharab'], r: '🙏 Ek baar ka result tum nahi ho. Seriously. Topper bhi kabhi test mein kam score karte hain. Asli cheez yeh hai ki ab kya karte ho — AI Analysis use karo, weak topics dhundo, aur wahan se focus shuru karo. Recovery possible hai! 💪' },
    { k: ['mushkil hai','difficult','tough','hard hai','bohot hard','bahut mushkil','samajh nahi aata','samajh nhi aata','concept clear nahi','nahi samjha'], r: '🤔 Mushkil lagta hai toh matlab hai ki growth ho rahi hai! 😄 Study Playlist mein us topic ki video dhundho aur "Ask AI" se seedha doubt poochho — instant explanation milega! Community mein bhi doubt daal sakte ho.' },
    { k: ['time management','time nahi milta','time nahi hai','schedule','din mein kitna time','kitna padhna chahiye','daily routine','routine'], r: '⏰ Ek simple daily routine jo kaam karti hai:\n• Subah: 2 ghante concept study\n• Dopahar: 1 mock test ya practice\n• Sham: AI Analysis padho, weak topics fix karo\n• Raat: 30 min revision + Todo Planner se next day plan\n\nFocus Timer se sessions track hote hain — app khud batata hai kitna padhe! 📊' },
    { k: ['college','university','iit','nit','bits','aiims','du','delhi university','admission','konsa college'], r: '🎓 Target college ke cutoffs and admission insights Content Hub mein available hain! Check out <a href="content-hub.html" style="color:#4F46E5;font-weight:600;">Content Hub →</a>' }
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
