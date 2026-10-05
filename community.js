/**
 * Study Grid Prep – Community Hub Logic (community.js)
 * Live Firestore Sync (Zero Dummy Data), Real-time Updates,
 * Native-grade Pull to Refresh, Mobile/Tab/Desktop Optimized,
 * App-Like Custom Modals & Toasts (Zero Chrome Alerts),
 * Smart Canonical Exam Mapping & Keyword Fuzzy Matcher.
 */

import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  onAuthStateChanged
} from "./firebase.js";

/* ─── 0. SMART CANONICAL EXAM MAPPING & KEYWORD NORMALIZATION ─── */
const EXAM_CANONICAL_MAP = [
  {
    canonical: "B.Tech / Engineering",
    shortName: "B.Tech",
    icon: "fa-laptop-code",
    keywords: [
      "btech", "b.tech", "b-tech", "engineering", "engeneering", "engg",
      "b.e", "be", "cse", "computer science", "btech exam", "engineering exam",
      "it", "ece", "mechanical", "civil engg", "software"
    ]
  },
  {
    canonical: "JEE Main & Advanced",
    shortName: "JEE Main",
    icon: "fa-atom",
    keywords: [
      "jee", "jee main", "jee mains", "jee advanced", "iit", "iit jee",
      "jee exam", "jeemain", "jeeadv", "joint entrance", "iitjee"
    ]
  },
  {
    canonical: "NEET (Medical)",
    shortName: "NEET",
    icon: "fa-stethoscope",
    keywords: [
      "neet", "neet ug", "neet exam", "medical", "aiims", "mbbs",
      "neetpg", "bds", "biology neet", "doctor"
    ]
  },
  {
    canonical: "CUET (UG)",
    shortName: "CUET",
    icon: "fa-graduation-cap",
    keywords: [
      "cuet", "cuet ug", "cuet exam", "common university entrance",
      "cuet 2025", "cuet 2026", "cuet general test"
    ]
  },
  {
    canonical: "UPSC Civil Services",
    shortName: "UPSC",
    icon: "fa-landmark",
    keywords: [
      "upsc", "upsc exam", "ias", "ips", "civil services", "cse upsc",
      "upsc prelims", "upsc mains", "nda/upsc", "union public service"
    ]
  },
  {
    canonical: "GATE (Engineering)",
    shortName: "GATE",
    icon: "fa-microchip",
    keywords: ["gate", "gate exam", "psu", "gate cse", "gate ece"]
  },
  {
    canonical: "Class 12 Boards",
    shortName: "Boards",
    icon: "fa-book-open",
    keywords: [
      "board", "boards", "class 12", "class 12th", "cbse", "12th boards",
      "board exam", "state board", "hsc", "isc", "12th exam"
    ]
  },
  {
    canonical: "SSC & Govt Exams",
    shortName: "SSC",
    icon: "fa-building-columns",
    keywords: ["ssc", "ssc cgl", "ssc chsl", "cgl", "chsl", "govt exam", "sarkari"]
  },
  {
    canonical: "NDA & Defence",
    shortName: "NDA",
    icon: "fa-shield-halved",
    keywords: ["nda", "nda exam", "cds", "defence", "afcat", "navy", "airforce"]
  }
];

function getCanonicalExam(rawName) {
  if (!rawName) return { canonical: "General", shortName: "General", icon: "fa-graduation-cap" };
  const cleanStr = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const group of EXAM_CANONICAL_MAP) {
    if (group.shortName.toLowerCase() === cleanStr || group.canonical.toLowerCase() === cleanStr) {
      return group;
    }
    for (const kw of group.keywords) {
      const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanStr === cleanKw || cleanStr.startsWith(cleanKw) || cleanKw.startsWith(cleanStr) || cleanStr.includes(cleanKw) || cleanKw.includes(cleanStr)) {
        return group;
      }
    }
  }

  // Fallback to formatted raw string
  return { canonical: rawName.trim(), shortName: rawName.trim(), icon: "fa-graduation-cap" };
}

function isSameExamGroup(examA, examB) {
  if (!examA || !examB) return false;
  const groupA = getCanonicalExam(examA);
  const groupB = getCanonicalExam(examB);

  if (groupA.shortName === groupB.shortName || groupA.canonical === groupB.canonical) {
    return true;
  }

  const sA = String(examA).toLowerCase().replace(/[^a-z0-9]/g, '');
  const sB = String(examB).toLowerCase().replace(/[^a-z0-9]/g, '');
  return sA === sB || sA.includes(sB) || sB.includes(sA);
}

/* ─── APP STATE & STORAGE INITIALIZATION ─── */
let SGP_USER_NAME = localStorage.getItem("userName") || "Student";
let SGP_USER_EMAIL = localStorage.getItem("userEmail") || "";
let SGP_USER_UID = localStorage.getItem("userUID") || localStorage.getItem("uwUid") || localStorage.getItem("userUid") || SGP_USER_EMAIL || "usr_" + Math.random().toString(36).slice(2, 9);
const TODAY_STR = new Date().toISOString().slice(0, 10);

let currentExam = localStorage.getItem("goal") || "JEE Main";
if (currentExam === "Custom" && localStorage.getItem("customExamName")) {
  currentExam = localStorage.getItem("customExamName");
}
const initialCanonical = getCanonicalExam(currentExam);
currentExam = initialCanonical.shortName;

// Automatically sync auth user credentials once initialized
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      SGP_USER_UID = user.uid;
      localStorage.setItem("userUID", user.uid);
      if (user.displayName) {
        SGP_USER_NAME = user.displayName;
        localStorage.setItem("userName", user.displayName);
      }
      if (user.email) {
        SGP_USER_EMAIL = user.email;
        localStorage.setItem("userEmail", user.email);
      }
    }
  });
}

let activeFilter = "all";
let currentTab = "community"; // 'community' | 'myPosts'
let dailyCommunitySeconds = parseInt(localStorage.getItem("sgp_comm_sec_" + TODAY_STR) || "0", 10);
let timerInterval = null;

// Real Live Community Posts (Loaded dynamically from Firestore, cached in localStorage for instant launch)
let communityPostsList = [];
try {
  const cached = localStorage.getItem("sgp_comm_posts_cache");
  if (cached) {
    communityPostsList = JSON.parse(cached);
  }
} catch (e) {
  communityPostsList = [];
}

let isRefreshing = false;
let unsubscribeCommunity = null;

/* ─── 1. APP-LIKE CUSTOM MODALS & TOASTS (NATIVE APP FEEL) ─── */
let appModalConfirmCallback = null;

function showAppAlert(message, title = "Notice", iconClass = "fa-solid fa-circle-exclamation", type = "warn") {
  const overlay = document.getElementById("appModalOverlay");
  const titleEl = document.getElementById("appModalTitle");
  const msgEl = document.getElementById("appModalMessage");
  const iconWrap = document.getElementById("appModalIcon");
  const actionsEl = document.getElementById("appModalActions");

  if (!overlay) return;

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  if (iconWrap) {
    iconWrap.className = `app-modal-icon-wrap ${type}`;
    iconWrap.innerHTML = `<i class="${iconClass}"></i>`;
  }

  if (actionsEl) {
    actionsEl.innerHTML = `<button class="app-modal-btn app-modal-btn-confirm" onclick="window.closeAppModal()">Got It</button>`;
  }

  appModalConfirmCallback = null;
  overlay.style.display = "flex";
  overlay.classList.add("open");
}

function showAppConfirm(message, title = "Confirm Action", onConfirm = null, confirmText = "Confirm", iconClass = "fa-solid fa-triangle-exclamation") {
  const overlay = document.getElementById("appModalOverlay");
  const titleEl = document.getElementById("appModalTitle");
  const msgEl = document.getElementById("appModalMessage");
  const iconWrap = document.getElementById("appModalIcon");
  const actionsEl = document.getElementById("appModalActions");

  if (!overlay) return;

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  if (iconWrap) {
    iconWrap.className = `app-modal-icon-wrap danger`;
    iconWrap.innerHTML = `<i class="${iconClass}"></i>`;
  }

  appModalConfirmCallback = onConfirm;

  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="app-modal-btn app-modal-btn-cancel" onclick="window.closeAppModal()">Cancel</button>
      <button class="app-modal-btn app-modal-btn-danger" id="appModalExecuteBtn">${escapeHtml(confirmText)}</button>
    `;
    const execBtn = document.getElementById("appModalExecuteBtn");
    if (execBtn) {
      execBtn.onclick = () => {
        closeAppModal();
        if (typeof appModalConfirmCallback === "function") {
          appModalConfirmCallback();
        }
      };
    }
  }

  overlay.style.display = "flex";
  overlay.classList.add("open");
}

function closeAppModal() {
  const overlay = document.getElementById("appModalOverlay");
  if (overlay) {
    overlay.classList.remove("open");
    overlay.style.display = "none";
  }
  appModalConfirmCallback = null;
}

let toastTimeout = null;
function showAppToast(message, iconClass = "fa-solid fa-circle-check") {
  const toast = document.getElementById("appToast");
  const iconEl = document.getElementById("appToastIcon");
  const textEl = document.getElementById("appToastText");

  if (!toast) return;

  if (iconEl) iconEl.className = iconClass;
  if (textEl) textEl.textContent = message;

  toast.style.display = "inline-flex";
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
    }, 250);
  }, 2600);
}

/* ─── 2. REAL-TIME FIRESTORE DATA SYNC (ZERO DUMMY DATA) ─── */
function listenToCommunityFirestore() {
  try {
    const q = query(collection(db, "communityPosts"), orderBy("createdAt", "desc"));
    unsubscribeCommunity = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Preserve any local pending posts that haven't synced yet
      const serverIds = new Set(list.map(d => d.id));
      const pendingPosts = communityPostsList.filter(p =>
        p.id && (p.id.startsWith("post_") || !serverIds.has(p.id)) && (Date.now() - (p.createdAt || 0) < 60000)
      );

      const merged = [...pendingPosts];
      list.forEach(item => {
        const alreadyInPending = pendingPosts.some(p =>
          p.id === item.id ||
          (p.title === item.title && p.authorUid === item.authorUid && Math.abs((p.createdAt || 0) - (item.createdAt || 0)) < 15000)
        );
        if (!alreadyInPending) {
          merged.push(item);
        }
      });

      communityPostsList = merged;
      try {
        localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(merged));
      } catch (e) {}
      renderCommunity();
      if (currentTab === "myPosts") renderMyPosts();
      stopPullToRefresh(true);
    }, (err) => {
      console.warn("Firestore onSnapshot error, falling back to one-time fetch:", err);
      fetchCommunityOnce();
    });
  } catch (e) {
    console.warn("Firestore setup error, attempting one-time fetch:", e);
    fetchCommunityOnce();
  }
}

async function fetchCommunityOnce() {
  try {
    const snap = await getDocs(collection(db, "communityPosts"));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const serverIds = new Set(list.map(d => d.id));
    const pendingPosts = communityPostsList.filter(p =>
      p.id && (p.id.startsWith("post_") || !serverIds.has(p.id)) && (Date.now() - (p.createdAt || 0) < 60000)
    );

    const merged = [...pendingPosts];
    list.forEach(item => {
      const alreadyInPending = pendingPosts.some(p =>
        p.id === item.id ||
        (p.title === item.title && p.authorUid === item.authorUid && Math.abs((p.createdAt || 0) - (item.createdAt || 0)) < 15000)
      );
      if (!alreadyInPending) {
        merged.push(item);
      }
    });

    communityPostsList = merged;
    try {
      localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(merged));
    } catch (e) {}
    renderCommunity();
    if (currentTab === "myPosts") renderMyPosts();
    stopPullToRefresh(true);
  } catch (err) {
    console.error("fetchCommunityOnce error:", err);
    stopPullToRefresh(false);
  }
}

/* ─── 3. PULL TO REFRESH & MANUAL REFRESH (TOUCH & GESTURE) ─── */
let touchStartY = 0;
let isPulling = false;

function initPullToRefresh() {
  const container = document.getElementById("pullRefreshIndicator");
  const spinner = document.getElementById("pullSpinner");
  const icon = document.getElementById("pullIcon");
  const text = document.getElementById("pullText");
  if (!container) return;

  window.addEventListener("touchstart", (e) => {
    if (window.scrollY <= 2 && !isRefreshing && currentTab === "community") {
      touchStartY = e.touches[0].clientY;
      isPulling = true;
    } else {
      isPulling = false;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isPulling || isRefreshing) return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;

    if (diff > 8 && window.scrollY <= 0) {
      const pullDist = Math.min(75, Math.pow(diff, 0.82) * 1.3);
      container.classList.add("pulling");
      container.style.height = `${pullDist}px`;
      container.style.maxHeight = `${pullDist}px`;
      container.style.opacity = String(Math.min(1, pullDist / 35));

      if (pullDist >= 52) {
        if (spinner) spinner.classList.add("flipped");
        if (text) text.textContent = "Release to refresh";
      } else {
        if (spinner) spinner.classList.remove("flipped");
        if (text) text.textContent = "Pull down to refresh";
      }
    } else if (diff < 0) {
      container.style.height = "0px";
      container.style.maxHeight = "0px";
      container.style.opacity = "0";
      container.classList.remove("pulling");
    }
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    const curHeight = parseFloat(container.style.height || "0");
    if (curHeight >= 50) {
      triggerRefreshUI();
    } else {
      container.style.height = "0px";
      container.style.maxHeight = "0px";
      container.style.opacity = "0";
      container.classList.remove("pulling");
      if (spinner) spinner.classList.remove("flipped");
    }
  });
}

function triggerRefreshUI() {
  if (isRefreshing) return;
  isRefreshing = true;

  const container = document.getElementById("pullRefreshIndicator");
  const spinner = document.getElementById("pullSpinner");
  const icon = document.getElementById("pullIcon");
  const text = document.getElementById("pullText");
  const subbarIcon = document.getElementById("refreshBtnIcon");

  if (container) {
    container.classList.remove("pulling");
    container.classList.add("refreshing");
    container.style.height = "48px";
    container.style.maxHeight = "48px";
    container.style.opacity = "1";
  }
  if (icon) icon.className = "fa-solid fa-arrows-rotate fa-spin";
  if (text) text.textContent = "Refreshing discussions…";
  if (subbarIcon) subbarIcon.classList.add("fa-spin");

  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }

  fetchCommunityOnce();
}

function stopPullToRefresh(success) {
  const container = document.getElementById("pullRefreshIndicator");
  const spinner = document.getElementById("pullSpinner");
  const icon = document.getElementById("pullIcon");
  const text = document.getElementById("pullText");
  const subbarIcon = document.getElementById("refreshBtnIcon");

  if (subbarIcon) subbarIcon.classList.remove("fa-spin");

  if (!container) return;
  if (isRefreshing) {
    if (text) text.textContent = success ? "Updated just now ✓" : "Sync completed";
    if (icon) icon.className = success ? "fa-solid fa-check" : "fa-solid fa-arrow-down";
    setTimeout(() => {
      container.classList.remove("refreshing");
      container.classList.remove("pulling");
      container.style.height = "0px";
      container.style.maxHeight = "0px";
      container.style.opacity = "0";
      if (spinner) spinner.classList.remove("flipped");
      if (icon) icon.className = "fa-solid fa-arrow-down";
      if (text) text.textContent = "Pull down to refresh";
      isRefreshing = false;
    }, 600);
  } else {
    container.classList.remove("refreshing");
    container.classList.remove("pulling");
    container.style.height = "0px";
    container.style.maxHeight = "0px";
    container.style.opacity = "0";
  }
}

/* ─── 4. NOTIFICATIONS ─── */
function loadNotifications() {
  try {
    const raw = localStorage.getItem("sgp_comm_notifs_" + SGP_USER_UID);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveNotifications(list) {
  try {
    localStorage.setItem("sgp_comm_notifs_" + SGP_USER_UID, JSON.stringify(list));
    updateNotifBadge();
  } catch (e) {}
}

function addNotification(n) {
  const list = loadNotifications();
  list.unshift({
    id: "notif_" + Date.now(),
    time: Date.now(),
    read: false,
    ...n
  });
  saveNotifications(list);
}

function updateNotifBadge() {
  const list = loadNotifications();
  const unread = list.filter(n => !n.read).length;
  const badge = document.getElementById("notifBadgeDot");
  if (badge) badge.classList.toggle("show", unread > 0);

  const container = document.getElementById("notifList");
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:26px 16px;font-size:12px;color:var(--text3);"><i class="fa-regular fa-bell" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.5;"></i>No notifications yet</div>`;
    return;
  }
  container.innerHTML = list.map(n => `
    <div class="notif-item" onclick="window.jumpToPost('${n.postId}')">
      <div class="notif-ico"><i class="fa-regular fa-comment"></i></div>
      <div>
        <div class="notif-text"><b>${escapeHtml(n.title)}</b>: ${escapeHtml(n.body || '')}</div>
        <div class="notif-time">${formatTimeAgo(n.time)}</div>
      </div>
    </div>
  `).join("");
}

function toggleNotifDrawer() {
  const d = document.getElementById("notifDrawer");
  if (d) d.classList.toggle("open");
  updateNotifBadge();
}

function markAllNotifsRead() {
  const list = loadNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(list);
  updateNotifBadge();
  showAppToast("All notifications marked as read");
}

function jumpToPost(postId) {
  const d = document.getElementById("notifDrawer");
  if (d) d.classList.remove("open");
  switchMainTab("community");
  setTimeout(() => {
    const el = document.getElementById(postId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-pulse");
      setTimeout(() => el.classList.remove("highlight-pulse"), 2600);
    }
  }, 100);
}

/* ─── 5. CLEAN INTRO (ZERO FAKE AI TEXT) ─── */
function runPersonalizedIntro() {
  const ov = document.getElementById("introOverlay");
  const title = document.getElementById("introTitle");
  const sub = document.getElementById("introSub");
  const fill = document.getElementById("introProgressFill");

  if (!ov) return;
  const canonical = getCanonicalExam(currentExam);
  if (title) title.innerHTML = `Building Your <span>${escapeHtml(canonical.shortName)} Community</span>`;

  const steps = [
    { t: 0, text: `Connecting verified ${escapeHtml(canonical.shortName)} peer aspirants & solvers…`, pct: "25%" },
    { t: 900, text: `Structuring ${escapeHtml(canonical.shortName)} syllabus doubt streams & strategies…`, pct: "55%" },
    { t: 1900, text: "Configuring distraction-free student discussions…", pct: "85%" },
    { t: 2800, text: `${escapeHtml(canonical.shortName)} Community Hub Ready! 🚀`, pct: "100%" }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      if (ov.classList.contains("fade-out")) return;
      if (sub) sub.textContent = step.text;
      if (fill) fill.style.width = step.pct;
    }, step.t);
  });

  setTimeout(() => {
    skipIntro();
  }, 3200);
}

function skipIntro() {
  const ov = document.getElementById("introOverlay");
  if (!ov) return;
  ov.classList.add("fade-out");
  setTimeout(() => { ov.style.display = "none"; }, 400);
}

/* ─── 6. DAILY 60-MINUTE STUDY RESTRICTION TIMER ─── */
function startStudyTimer() {
  clearInterval(timerInterval);
  updateTimerUI();

  timerInterval = setInterval(() => {
    dailyCommunitySeconds++;
    localStorage.setItem("sgp_comm_sec_" + TODAY_STR, String(dailyCommunitySeconds));
    updateTimerUI();

    if (dailyCommunitySeconds >= 3600) { // 60 minutes
      showTimeLimitModal();
      clearInterval(timerInterval);
    }
  }, 1000);
}

function updateTimerUI() {
  const mins = Math.floor(dailyCommunitySeconds / 60);
  const pill = document.getElementById("timeLimitPill");
  const txt = document.getElementById("timeLimitText");
  if (!pill || !txt) return;

  txt.textContent = `${mins}m / 60m`;

  if (mins >= 50 && mins < 60) {
    pill.className = "time-limit-pill warn";
  } else if (mins >= 60) {
    pill.className = "time-limit-pill danger";
    showTimeLimitModal();
  }
}

function showTimeLimitModal() {
  const ov = document.getElementById("timeLimitOverlay");
  if (ov) ov.classList.add("open");
}

/* ─── 7. STRICT CONTENT SECURITY CHECKS (ZERO LINKS / NO CONTACT INFO) ─── */
function checkContentSecurity(text) {
  const clean = String(text || "");

  // 1. Link & URL pattern detection
  const linkRegex = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|org|net|io|edu|gov|co|app|xyz|me|link|ai|tech|online)\b|t\.me|wa\.me|discord\.gg|bit\.ly|tinyurl)/i;
  if (linkRegex.test(clean)) {
    return {
      allowed: false,
      reason: "link",
      title: "Link Sharing Blocked",
      desc: "External links, websites, Telegram, and WhatsApp links are strictly prohibited to maintain a clean study environment."
    };
  }

  // 2. Phone numbers & Consecutive numbers detection
  const phoneRegex = /(\+?91[\s-]?)?[6789]\d{9}|\b\d{5}[\s-]?\d{5}\b|\b\d{6,}\b/;
  if (phoneRegex.test(clean.replace(/\s+/g, ' '))) {
    return {
      allowed: false,
      reason: "contact",
      title: "Contact Info Blocked",
      desc: "Sharing phone numbers, contact info, or consecutive digit sequences is strictly prohibited for student safety and privacy."
    };
  }

  // 3. Social platform handles
  const socialRegex = /(@[a-zA-Z0-9_]{3,}|insta|instagram|snapchat|telegram|whatsapp|wa\s*no|dm\s*me)/i;
  if (socialRegex.test(clean)) {
    if (/(instagram|insta\s*:|telegram\s*:|snapchat|wa\s*number|dm\s*on\s*insta)/i.test(clean)) {
      return {
        allowed: false,
        reason: "social",
        title: "Social Handles Blocked",
        desc: "Sharing social media usernames (Instagram, Telegram, Snapchat) is not allowed. Keep discussions focused on exam preparation."
      };
    }
  }

  return { allowed: true };
}

function showSecurityAlert(title, desc) {
  const titleEl = document.getElementById("secAlertTitle");
  const descEl = document.getElementById("secAlertDesc");
  const box = document.getElementById("securityAlertBox");
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (box) box.classList.add("show");
}

function closeSecurityAlert() {
  const box = document.getElementById("securityAlertBox");
  if (box) box.classList.remove("show");
}

/* ─── 8. RENDERING POSTS WITH SMART FUZZY EXAM MATCHING ─── */
function renderCommunity() {
  const allPosts = communityPostsList;
  const canonicalCurrent = getCanonicalExam(currentExam);

  // Filter posts matching this canonical exam group (e.g. btech matches engineering, engg, etc.)
  let examPosts = allPosts.filter(p => {
    return isSameExamGroup(p.exam, currentExam) ||
           isSameExamGroup(p.examCanonical, canonicalCurrent.shortName) ||
           isSameExamGroup(p.exam, canonicalCurrent.shortName);
  });

  // Filter by category
  if (activeFilter !== "all") {
    if (activeFilter === "trending") {
      examPosts = [...examPosts].sort((a, b) =>
        ((b.likes?.length || 0) + (b.replies?.length || 0) + (b.views?.length || 0)) -
        ((a.likes?.length || 0) + (a.replies?.length || 0) + (a.views?.length || 0))
      );
    } else {
      examPosts = examPosts.filter(p => p.category === activeFilter);
    }
  } else {
    examPosts = [...examPosts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // Count Stat
  const countEl = document.getElementById("postCountStat");
  if (countEl) {
    countEl.innerHTML = `<i class="fa-solid fa-comments"></i> <span>${examPosts.length} discussions in ${escapeHtml(canonicalCurrent.shortName)}</span>`;
  }

  // Render cards
  const container = document.getElementById("postsFeedContainer");
  if (!container) return;

  if (examPosts.length === 0) {
    container.innerHTML = `
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:24px;padding:46px 24px;text-align:center;margin-top:20px;box-shadow:var(--shadow-xs);">
        <div style="width:58px;height:58px;border-radius:20px;background:var(--accent-light);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:14px;">
          <i class="fa-solid fa-comments"></i>
        </div>
        <div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:6px;">No discussions in ${escapeHtml(canonicalCurrent.shortName)} yet</div>
        <p style="font-size:13px;color:var(--text2);max-width:380px;margin:0 auto 18px;line-height:1.55;">Be the first aspirant to ask a doubt or share a concept query in this exam community!</p>
        <button class="tl-btn-primary" style="display:inline-flex;align-items:center;gap:8px;width:auto;padding:11px 24px;margin:0 auto;font-weight:700;" onclick="window.openComposer()">
          <i class="fa-solid fa-plus"></i> Ask First Question
        </button>
      </div>`;
    return;
  }

  container.innerHTML = examPosts.map(p => createPostCardHtml(p)).join("");

  // Record unique view for current user
  recordUniqueViews(examPosts);
}

function createPostCardHtml(p) {
  const isLiked = p.likes && p.likes.includes(SGP_USER_UID);
  const isDisliked = p.dislikes && p.dislikes.includes(SGP_USER_UID);
  const isMyPost = p.authorUid === SGP_USER_UID;
  const uniqueViewsCount = p.views ? p.views.length : 1;
  const replyCount = p.replies ? p.replies.length : 0;
  const timeAgo = formatTimeAgo(p.createdAt);

  const postCanonical = getCanonicalExam(p.exam);

  let codeHtml = "";
  if (p.code) {
    codeHtml = `
      <div class="post-code-block">
        <div class="code-header">
          <span>${escapeHtml(p.codeLang || 'CODE')}</span>
          <button class="copy-code-btn" onclick="window.copyCode(this, '${p.id}')"><i class="fa-regular fa-copy"></i> Copy</button>
        </div>
        <pre><code id="code_${p.id}">${escapeHtml(p.code)}</code></pre>
      </div>`;
  }

  return `
    <div class="post-card" id="${p.id}">
      <div class="post-header">
        <div class="post-author-wrap">
          <div class="post-avatar">${escapeHtml((p.authorName || 'U').charAt(0).toUpperCase())}</div>
          <div class="post-meta">
            <div class="post-author-name">
              ${escapeHtml(p.authorName || 'Peer Aspirant')}
              <span class="author-badge">Student</span>
            </div>
            <div class="post-time-exam">
              <span>${timeAgo}</span> · 
              <span class="cat-tag ${escapeHtml(p.category || 'doubts')}">${escapeHtml(postCanonical.shortName)} · ${escapeHtml(p.category || 'doubts')}</span>
            </div>
          </div>
        </div>
        ${isMyPost ? `
          <button style="background:none;border:none;color:var(--text2);cursor:pointer;padding:6px;font-size:15px;" onclick="window.deletePost('${p.id}')" title="Delete post">
            <i class="fa-regular fa-trash-can"></i>
          </button>` : ''}
      </div>

      ${p.reported ? `
        <div class="post-reported-badge">
          <i class="fa-solid fa-flag"></i> Flagged for Admin Review (${escapeHtml(p.reportReason || 'Reported')})
        </div>
      ` : ''}

      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-body">${formatPostBody(p.body)}</div>
      ${codeHtml}

      <!-- ENGAGEMENT ACTIONS -->
      <div class="post-actions">
        <div class="post-actions-left">
          <button class="action-btn ${isLiked ? 'active-like' : ''}" onclick="window.toggleLike('${p.id}')">
            <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
            <span>${p.likes?.length || 0}</span>
          </button>
          <button class="action-btn ${isDisliked ? 'active-dislike' : ''}" onclick="window.toggleDislike('${p.id}')">
            <i class="fa-${isDisliked ? 'solid' : 'regular'} fa-thumbs-down"></i>
          </button>
          <button class="action-btn" onclick="window.toggleReplies('${p.id}')">
            <i class="fa-regular fa-comment-dots"></i>
            <span>${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}</span>
          </button>
          <button class="action-btn flag-btn" onclick="window.openReportModal('${p.id}')" title="Report Issue to Admin" style="color:var(--text2);">
            <i class="fa-regular fa-flag"></i>
            <span>Report</span>
          </button>
          <button class="action-btn" onclick="window.sharePost('${p.id}')" title="Share Post">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        </div>
        <!-- Unique Views Count -->
        <div class="views-pill">
          <i class="fa-regular fa-eye"></i> ${uniqueViewsCount} ${uniqueViewsCount === 1 ? 'view' : 'views'}
        </div>
      </div>

      <!-- INLINE REPLIES SECTION -->
      <div class="replies-wrap" id="replies_${p.id}">
        <div class="reply-list" id="replyList_${p.id}">
          ${(p.replies || []).map(r => `
            <div class="reply-item">
              <div class="reply-avatar">${escapeHtml((r.authorName || 'P').charAt(0).toUpperCase())}</div>
              <div class="reply-content">
                <div class="reply-head">
                  <span class="reply-author">${escapeHtml(r.authorName)}</span>
                  <span class="reply-time">${formatTimeAgo(r.createdAt)}</span>
                </div>
                <div class="reply-text">${formatReplyText(r.text)}</div>
                <div class="reply-actions">
                  <button class="reply-sub-btn" onclick="window.mentionUserInReply('${p.id}', '${escapeHtml(r.authorName)}')">Reply @${escapeHtml(r.authorName)}</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Reply Input Bar -->
        <div class="reply-input-bar">
          <input type="text" id="replyInput_${p.id}" placeholder="Reply or answer this doubt..." onkeydown="if(event.key==='Enter') window.submitReply('${p.id}')">
          <button class="reply-send-btn" onclick="window.submitReply('${p.id}')" title="Send Reply">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ─── 9. UNIQUE VIEWS PER USER ─── */
async function recordUniqueViews(posts) {
  const updates = [];
  posts.forEach(p => {
    if (!p.views) p.views = [];
    if (!p.views.includes(SGP_USER_UID)) {
      p.views.push(SGP_USER_UID);
      updates.push(p);
    }
  });

  if (updates.length > 0) {
    try {
      localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
    } catch (e) {}

    for (const p of updates) {
      try {
        await updateDoc(doc(db, "communityPosts", p.id), { views: p.views });
      } catch (e) {}
    }
  }
}

/* ─── 10. INTERACTIONS: LIKE / DISLIKE ─── */
async function toggleLike(postId) {
  const post = communityPostsList.find(p => p.id === postId);
  if (!post) return;
  if (!post.likes) post.likes = [];
  if (!post.dislikes) post.dislikes = [];

  const idx = post.likes.indexOf(SGP_USER_UID);
  if (idx > -1) {
    post.likes.splice(idx, 1);
  } else {
    post.likes.push(SGP_USER_UID);
    const dIdx = post.dislikes.indexOf(SGP_USER_UID);
    if (dIdx > -1) post.dislikes.splice(dIdx, 1);

    if (post.authorUid && post.authorUid !== SGP_USER_UID) {
      addNotification({
        title: `${SGP_USER_NAME} liked your post`,
        body: post.title,
        postId: post.id
      });
    }
  }

  renderCommunity();
  try {
    localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
  } catch (e) {}

  try {
    await updateDoc(doc(db, "communityPosts", postId), {
      likes: post.likes,
      dislikes: post.dislikes
    });
  } catch (e) {
    console.warn("Firestore like update error:", e);
  }
}

async function toggleDislike(postId) {
  const post = communityPostsList.find(p => p.id === postId);
  if (!post) return;
  if (!post.likes) post.likes = [];
  if (!post.dislikes) post.dislikes = [];

  const idx = post.dislikes.indexOf(SGP_USER_UID);
  if (idx > -1) {
    post.dislikes.splice(idx, 1);
  } else {
    post.dislikes.push(SGP_USER_UID);
    const lIdx = post.likes.indexOf(SGP_USER_UID);
    if (lIdx > -1) post.likes.splice(lIdx, 1);
  }

  renderCommunity();
  try {
    localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
  } catch (e) {}

  try {
    await updateDoc(doc(db, "communityPosts", postId), {
      likes: post.likes,
      dislikes: post.dislikes
    });
  } catch (e) {
    console.warn("Firestore dislike update error:", e);
  }
}

/* ─── 11. REPLIES & @MENTIONS ─── */
function toggleReplies(postId) {
  const wrap = document.getElementById("replies_" + postId);
  if (wrap) wrap.classList.toggle("open");
}

function mentionUserInReply(postId, authorName) {
  const inp = document.getElementById("replyInput_" + postId);
  if (inp) {
    inp.value = `@${authorName} ` + inp.value.replace(/@\w+\s*/g, '');
    inp.focus();
  }
}

async function submitReply(postId) {
  const inp = document.getElementById("replyInput_" + postId);
  const text = (inp ? inp.value : "").trim();
  if (!text) return;

  const check = checkContentSecurity(text);
  if (!check.allowed) {
    showSecurityAlert(check.title, check.desc);
    return;
  }

  const post = communityPostsList.find(p => p.id === postId);
  if (!post) return;
  if (!post.replies) post.replies = [];

  const newReply = {
    id: "rep_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    authorName: SGP_USER_NAME,
    authorUid: SGP_USER_UID,
    createdAt: Date.now(),
    text
  };

  post.replies.push(newReply);
  inp.value = "";
  renderCommunity();
  const wrap = document.getElementById("replies_" + postId);
  if (wrap) wrap.classList.add("open");

  showAppToast("Reply posted successfully");

  if (post.authorUid && post.authorUid !== SGP_USER_UID) {
    addNotification({
      title: `${SGP_USER_NAME} replied to your post`,
      body: text.length > 60 ? text.slice(0, 60) + '…' : text,
      postId: post.id
    });
  }

  const mentions = text.match(/@([a-zA-Z0-9_]+)/g);
  if (mentions) {
    mentions.forEach(m => {
      addNotification({
        title: `${SGP_USER_NAME} mentioned you in a comment`,
        body: text,
        postId: post.id
      });
    });
  }

  try {
    localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
  } catch (e) {}

  try {
    await updateDoc(doc(db, "communityPosts", postId), {
      replies: post.replies
    });
  } catch (e) {
    console.warn("Firestore reply update error:", e);
  }
}

/* ─── 12. COMPOSER & SUBMIT POST (WITH IN-APP VALIDATION) ─── */
let selectedCategory = "doubts";

function openComposer() {
  const titleInp = document.getElementById("postTitleInput");
  const bodyInp = document.getElementById("postBodyInput");
  const codeInp = document.getElementById("postCodeInput");
  const codeChk = document.getElementById("codeSnippetChk");
  const codeBox = document.getElementById("codeSnippetBox");
  const modal = document.getElementById("composerModal");

  if (titleInp) titleInp.value = "";
  if (bodyInp) bodyInp.value = "";
  if (codeInp) codeInp.value = "";
  if (codeChk) codeChk.checked = false;
  if (codeBox) codeBox.classList.remove("show");
  if (modal) modal.classList.add("open");
}

function closeComposer() {
  const modal = document.getElementById("composerModal");
  if (modal) modal.classList.remove("open");
}

function selectCatChoice(el) {
  document.querySelectorAll(".cat-choice").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  selectedCategory = el.getAttribute("data-cat") || "doubts";
}

function toggleCodeBox(show) {
  const b = document.getElementById("codeSnippetBox");
  if (b) {
    if (show) b.classList.add("show"); else b.classList.remove("show");
  }
}

function insertEmoji(em) {
  const ta = document.getElementById("postBodyInput");
  if (ta) {
    ta.value += em;
    ta.focus();
  }
}

async function submitPost() {
  const title = (document.getElementById("postTitleInput")?.value || "").trim();
  const body = (document.getElementById("postBodyInput")?.value || "").trim();
  const hasCode = document.getElementById("codeSnippetChk")?.checked;
  const code = hasCode ? (document.getElementById("postCodeInput")?.value || "").trim() : null;
  const codeLang = hasCode ? document.getElementById("codeLangSelect")?.value : null;

  if (!title) {
    showAppAlert("Please write a question or topic title before publishing.", "Missing Question Title", "fa-solid fa-pen-nib", "warn");
    return;
  }
  if (!body && !code) {
    showAppAlert("Please describe your doubt or query in the body text.", "Missing Content", "fa-solid fa-align-left", "warn");
    return;
  }

  const checkCombined = checkContentSecurity(title + " " + body + " " + (code || ""));
  if (!checkCombined.allowed) {
    showSecurityAlert(checkCombined.title, checkCombined.desc);
    return;
  }

  const canonical = getCanonicalExam(currentExam);
  const activeUid = (auth && auth.currentUser && auth.currentUser.uid)
    ? auth.currentUser.uid
    : (localStorage.getItem("userUID") || localStorage.getItem("uwUid") || SGP_USER_UID);

  const postData = {
    exam: currentExam,
    examCanonical: canonical.shortName,
    category: selectedCategory,
    authorName: localStorage.getItem("userName") || SGP_USER_NAME || "Student",
    authorUid: activeUid,
    createdAt: Date.now(),
    title,
    body,
    code: code || null,
    codeLang: codeLang || null,
    likes: [],
    dislikes: [],
    views: [activeUid],
    reported: false,
    replies: []
  };

  // Immediate optimistic local render
  const tempId = "post_" + Date.now();
  const optimisticPost = { id: tempId, ...postData };
  communityPostsList.unshift(optimisticPost);
  closeComposer();
  renderCommunity();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showAppToast("Post published successfully!");

  try {
    localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
  } catch (e) {}

  // Save to Firestore
  try {
    const docRef = await addDoc(collection(db, "communityPosts"), postData);
    optimisticPost.id = docRef.id;
    const idx = communityPostsList.findIndex(p => p.id === tempId);
    if (idx !== -1) {
      communityPostsList[idx].id = docRef.id;
    }
    try {
      localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
    } catch (e) {}
    console.log("[Community] Post saved with Firestore ID:", docRef.id);
  } catch (e) {
    console.warn("Firestore post creation notice:", e);
  }
}

function deletePost(postId) {
  showAppConfirm(
    "Are you sure you want to permanently delete this discussion post?",
    "Delete Post",
    async () => {
      communityPostsList = communityPostsList.filter(p => p.id !== postId);
      renderCommunity();
      if (currentTab === "myPosts") renderMyPosts();
      showAppToast("Post deleted");

      try {
        localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
      } catch (e) {}

      try {
        await deleteDoc(doc(db, "communityPosts", postId));
      } catch (e) {
        console.warn("Firestore delete post error:", e);
      }
    },
    "Delete Post",
    "fa-solid fa-trash-can"
  );
}

/* ─── 13. REPORT / ISSUE FLAGGING SYSTEM ─── */
let currentReportingPostId = null;

function openReportModal(postId) {
  currentReportingPostId = postId;
  const modal = document.getElementById("reportIssueModal");
  if (modal) modal.classList.add("open");
}

function closeReportModal() {
  const modal = document.getElementById("reportIssueModal");
  if (modal) modal.classList.remove("open");
  currentReportingPostId = null;
}

async function submitPostReport() {
  if (!currentReportingPostId) return;
  const sel = document.querySelector('input[name="reportReason"]:checked');
  const details = (document.getElementById("reportDetailsInput")?.value || "").trim();
  const reason = (sel ? sel.value : "Reported Issue") + (details ? ` (${details})` : "");

  const post = communityPostsList.find(p => p.id === currentReportingPostId);
  if (post) {
    post.reported = true;
    post.reportReason = reason;
    post.reportedBy = SGP_USER_NAME;
    post.reportedAt = Date.now();
  }

  const postIdToUpdate = currentReportingPostId;
  closeReportModal();
  renderCommunity();

  try {
    localStorage.setItem("sgp_comm_posts_cache", JSON.stringify(communityPostsList));
  } catch (e) {}

  try {
    await updateDoc(doc(db, "communityPosts", postIdToUpdate), {
      reported: true,
      reportReason: reason,
      reportedBy: SGP_USER_NAME,
      reportedAt: Date.now()
    });
  } catch (e) {
    console.warn("Firestore report error:", e);
  }

  const ov = document.getElementById("reportSuccessOverlay");
  if (ov) ov.classList.add("show");
}

function closeReportSuccess() {
  const ov = document.getElementById("reportSuccessOverlay");
  if (ov) ov.classList.remove("show");
}

/* ─── 14. MY POSTS TAB ─── */
function switchMainTab(tab) {
  currentTab = tab;
  const commTab = document.getElementById("navCommunityTab");
  const myPostsTab = document.getElementById("navMyPostsTab");
  if (commTab) commTab.classList.toggle("active", tab === "community");
  if (myPostsTab) myPostsTab.classList.toggle("active", tab === "myPosts");

  const commView = document.getElementById("communityView");
  const myPostsView = document.getElementById("myPostsView");

  if (tab === "community") {
    if (commView) commView.style.display = "block";
    if (myPostsView) myPostsView.style.display = "none";
    renderCommunity();
  } else {
    if (commView) commView.style.display = "none";
    if (myPostsView) myPostsView.style.display = "block";
    renderMyPosts();
  }
}

function renderMyPosts() {
  const allPosts = communityPostsList;
  const myPosts = allPosts.filter(p =>
    p.authorUid === SGP_USER_UID ||
    (auth && auth.currentUser && p.authorUid === auth.currentUser.uid) ||
    p.authorName === SGP_USER_NAME
  );

  let totalViews = 0, totalLikes = 0;
  myPosts.forEach(p => {
    totalViews += p.views?.length || 0;
    totalLikes += p.likes?.length || 0;
  });

  const postsEl = document.getElementById("myTotalPostsCount");
  const viewsEl = document.getElementById("myTotalViewsCount");
  const likesEl = document.getElementById("myTotalLikesCount");
  if (postsEl) postsEl.textContent = myPosts.length;
  if (viewsEl) viewsEl.textContent = totalViews;
  if (likesEl) likesEl.textContent = totalLikes;

  const cont = document.getElementById("myPostsFeedContainer");
  if (!cont) return;

  if (myPosts.length === 0) {
    cont.innerHTML = `
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:24px;padding:46px 24px;text-align:center;margin-top:20px;box-shadow:var(--shadow-xs);">
        <div style="width:58px;height:58px;border-radius:20px;background:var(--accent-light);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:14px;">
          <i class="fa-solid fa-pen-fancy"></i>
        </div>
        <div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:6px;">You haven't posted any questions yet</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:18px;">Ask a doubt in the ${escapeHtml(currentExam)} community to get peer answers!</p>
        <button class="tl-btn-primary" style="display:inline-flex;align-items:center;gap:8px;width:auto;padding:11px 24px;margin:0 auto;font-weight:700;" onclick="window.openComposer()">
          <i class="fa-solid fa-plus"></i> Ask a Question
        </button>
      </div>`;
    return;
  }

  cont.innerHTML = myPosts.map(p => createPostCardHtml(p)).join("");
}

/* ─── 15. FILTERS & SEARCH ─── */
function setCategoryFilter(cat, el) {
  activeFilter = cat;
  document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
  if (el) el.classList.add("active");
  renderCommunity();
}

function filterPostsBySearch(query) {
  const term = query.toLowerCase().trim();
  const cards = document.querySelectorAll("#postsFeedContainer .post-card");
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = (!term || text.includes(term)) ? "block" : "none";
  });
}

/* ─── 16. EXAM SWITCHER & CUSTOM KEYWORD NORMALIZER ─── */
function openExamSwitcher() {
  const modal = document.getElementById("examSwitcherModal");
  if (modal) modal.classList.add("open");
  const inp = document.getElementById("customExamInput");
  if (inp) {
    inp.value = "";
    setTimeout(() => inp.focus(), 150);
  }
}

function closeExamSwitcher() {
  const modal = document.getElementById("examSwitcherModal");
  if (modal) modal.classList.remove("open");
}

function selectExamGoal(goal) {
  const canonical = getCanonicalExam(goal);
  currentExam = canonical.shortName;
  localStorage.setItem("goal", currentExam);

  const examNameEl = document.getElementById("headerExamName");
  if (examNameEl) examNameEl.textContent = currentExam;

  closeExamSwitcher();
  showAppToast(`Switched to ${canonical.shortName} Track`);
  runPersonalizedIntro();
  renderCommunity();
}

function applyCustomExam() {
  const inp = document.getElementById("customExamInput");
  const val = (inp?.value || "").trim();
  if (!val) {
    showAppAlert("Please enter an exam name, keyword, or degree (e.g. btech, engineering, upsc).", "Enter Exam Name", "fa-solid fa-graduation-cap", "warn");
    return;
  }

  const canonical = getCanonicalExam(val);
  selectExamGoal(canonical.shortName);
}

/* ─── 17. UTILITIES ─── */
function sharePost(postId) {
  const url = window.location.origin + window.location.pathname + "#" + postId;
  if (navigator.share) {
    navigator.share({
      title: "Study Grid Prep – Community Post",
      text: "Check out this discussion on Study Grid Prep Community:",
      url
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showAppToast("Post link copied to clipboard!");
    });
  }
}

function copyCode(btn, postId) {
  const code = document.getElementById("code_" + postId);
  if (!code) return;
  navigator.clipboard.writeText(code.innerText).then(() => {
    btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
    showAppToast("Code snippet copied to clipboard!", "fa-solid fa-code");
    setTimeout(() => {
      btn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
    }, 2000);
  });
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "dashboard-home.html";
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function formatPostBody(str) {
  const esc = escapeHtml(str);
  return esc.replace(/@([a-zA-Z0-9_]+)/g, '<span class="reply-tag">@$1</span>');
}

function formatReplyText(str) {
  return formatPostBody(str);
}

function formatTimeAgo(ms) {
  if (!ms) return "just now";
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ─── EXPOSE GLOBALLY FOR INLINE DOM HANDLERS ─── */
window.openComposer = openComposer;
window.closeComposer = closeComposer;
window.selectCatChoice = selectCatChoice;
window.toggleCodeBox = toggleCodeBox;
window.insertEmoji = insertEmoji;
window.submitPost = submitPost;
window.deletePost = deletePost;
window.toggleLike = toggleLike;
window.toggleDislike = toggleDislike;
window.toggleReplies = toggleReplies;
window.submitReply = submitReply;
window.mentionUserInReply = mentionUserInReply;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.submitPostReport = submitPostReport;
window.closeReportSuccess = closeReportSuccess;
window.switchMainTab = switchMainTab;
window.setCategoryFilter = setCategoryFilter;
window.filterPostsBySearch = filterPostsBySearch;
window.openExamSwitcher = openExamSwitcher;
window.closeExamSwitcher = closeExamSwitcher;
window.selectExamGoal = selectExamGoal;
window.applyCustomExam = applyCustomExam;
window.sharePost = sharePost;
window.copyCode = copyCode;
window.goBack = goBack;
window.toggleNotifDrawer = toggleNotifDrawer;
window.markAllNotifsRead = markAllNotifsRead;
window.jumpToPost = jumpToPost;
window.skipIntro = skipIntro;
window.closeSecurityAlert = closeSecurityAlert;
window.triggerManualRefresh = triggerRefreshUI;
window.showAppAlert = showAppAlert;
window.showAppConfirm = showAppConfirm;
window.showAppToast = showAppToast;
window.closeAppModal = closeAppModal;

/* ─── BOOTSTRAP ─── */
function initCommunity() {
  const canonical = getCanonicalExam(currentExam);
  currentExam = canonical.shortName;

  const examNameEl = document.getElementById("headerExamName");
  if (examNameEl) examNameEl.textContent = currentExam;

  const avatarSmall = document.getElementById("userAvatarSmall");
  if (avatarSmall) avatarSmall.textContent = SGP_USER_NAME.charAt(0).toUpperCase();

  if (window.location.hash) {
    skipIntro();
  } else {
    runPersonalizedIntro();
  }

  renderCommunity();
  updateNotifBadge();
  startStudyTimer();
  initPullToRefresh();
  listenToCommunityFirestore();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCommunity);
} else {
  initCommunity();
}
