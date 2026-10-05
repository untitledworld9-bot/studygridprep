/**
 * Study Grid Prep – Admin Community Moderation System
 * Shared across SGPAdmin-main.html and sub-admin.html
 */

import { db, collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "../firebase.js";

let adminPosts = [];
let activeAdminExam = "all";
let activeAdminCat = "all";
let adminSearchQuery = "";
let currentModalPostId = null;

const SEED_FALLBACK = [
  {
    id: "post_seed_1",
    exam: "JEE Main",
    category: "doubts",
    authorName: "Aman Verma",
    authorUid: "usr_aman_102",
    createdAt: Date.now() - 3600000 * 2,
    title: "How to tackle difficult Rotational Motion questions in Physics?",
    body: "Whenever I get mixed questions of rolling without slipping on an inclined wedge combined with angular impulse, my signs get confused. Does anyone have a systematic 3-step checklist to avoid negative marking in JEE Main?",
    likes: ["usr_demo_1", "usr_demo_2", "usr_demo_3"],
    dislikes: [],
    views: ["usr_seed_1", "usr_seed_2", "usr_seed_3", "usr_seed_4"],
    reported: false,
    replies: [
      {
        id: "rep_1",
        authorName: "Priya Sharma",
        authorUid: "usr_priya",
        createdAt: Date.now() - 3600000,
        text: "Always take torque about the instantaneous axis of zero velocity (IAOR). It eliminates the normal and friction forces directly! Saves 2 mins."
      }
    ]
  },
  {
    id: "post_seed_2",
    exam: "JEE Main",
    category: "strategy",
    authorName: "Rohan Kulkarni",
    authorUid: "usr_rohan",
    createdAt: Date.now() - 3600000 * 5,
    title: "Coordinate Geometry short formula revision sheet ready 🔥",
    body: "Shared key tangents conditions for Parabola, Ellipse & Hyperbola. Remember that the product of perpendiculars from foci onto any tangent is always b^2 for ellipse! Keep revising daily.",
    likes: ["usr_demo_1", "usr_demo_4"],
    dislikes: [],
    views: ["usr_seed_1", "usr_seed_3"],
    reported: false,
    replies: []
  },
  {
    id: "post_seed_3",
    exam: "JEE Main",
    category: "news",
    authorName: "Ayush Gupta",
    authorUid: "usr_ayush",
    createdAt: Date.now() - 3600000 * 9,
    title: "Official NTA Session updates & center instructions verified",
    body: "Make sure your Aadhaar card details match your application form exactly. Do not carry any metal items or electronic calculators. Best of luck everyone!",
    likes: ["usr_demo_2"],
    dislikes: [],
    views: ["usr_seed_1", "usr_seed_2"],
    reported: false,
    replies: []
  },
  {
    id: "post_seed_4",
    exam: "NEET",
    category: "doubts",
    authorName: "Simran Kaur",
    authorUid: "usr_simran",
    createdAt: Date.now() - 3600000 * 4,
    title: "Genetics pedigree chart doubt from NCERT Exemplar",
    body: "In autosomal recessive traits with unaffected parents having an affected child, what is the probability that an unaffected sibling is a carrier? It should be 2/3 and not 1/2 right?",
    likes: ["usr_demo_3"],
    dislikes: [],
    views: ["usr_seed_2"],
    reported: true,
    reportReason: "Wrong NCERT page reference quoted in comments",
    reportedBy: "Aman",
    reportedAt: Date.now() - 1800000,
    replies: [
      {
        id: "rep_2",
        authorName: "Dr. Ananya",
        authorUid: "usr_ananya",
        createdAt: Date.now() - 3600000 * 2,
        text: "Yes, exactly 2/3! Because we already know the child is unaffected (aa is ruled out, leaving only AA, Aa, Aa)."
      }
    ]
  },
  {
    id: "post_seed_5",
    exam: "B.Tech",
    category: "doubts",
    authorName: "Harsh Vardhan",
    authorUid: "usr_harsh",
    createdAt: Date.now() - 3600000 * 3,
    title: "Time complexity analysis for recursive binary tree traversal",
    body: "Working on Invert Binary Tree in C++. Is the auxiliary recursion stack space O(h) or O(n) in the worst case skew tree?",
    code: "TreeNode* invertTree(TreeNode* root) {\n    if (!root) return nullptr;\n    swap(root->left, root->right);\n    invertTree(root->left);\n    invertTree(root->right);\n    return root;\n}",
    codeLang: "cpp",
    likes: ["usr_demo_1"],
    dislikes: [],
    views: ["usr_seed_1"],
    reported: false,
    replies: [
      {
        id: "rep_3",
        authorName: "Devansh",
        authorUid: "usr_devansh",
        createdAt: Date.now() - 3600000,
        text: "In worst case skewed tree height h = n, so O(n). In balanced tree it is O(log n)."
      }
    ]
  }
];

export async function loadAdminCommunity(){
  try {
    let posts = [];
    const localRaw = localStorage.getItem("sgp_community_posts_v2");
    if (localRaw) {
      try { posts = JSON.parse(localRaw); } catch(e){}
    }

    if (!posts || posts.length === 0) {
      posts = SEED_FALLBACK;
      localStorage.setItem("sgp_community_posts_v2", JSON.stringify(posts));
    }

    // Try Firestore sync if available
    try {
      const snap = await getDocs(collection(db, "communityPosts"));
      if (!snap.empty) {
        const firestoreList = [];
        snap.forEach(d => firestoreList.push({ id: d.id, ...d.data() }));
        if (firestoreList.length > 0) {
          // Merge with local storage
          const map = new Map();
          posts.forEach(p => map.set(p.id, p));
          firestoreList.forEach(p => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
          posts = Array.from(map.values());
          localStorage.setItem("sgp_community_posts_v2", JSON.stringify(posts));
        }
      }
    } catch(err) {
      console.warn("Firestore community load fallback to local", err);
    }

    adminPosts = posts;
    renderAdminCommunity();
    updateAdminStatsAndBadge();
  } catch(e) {
    console.error("loadAdminCommunity error", e);
  }
}

export function updateAdminStatsAndBadge(){
  const reportedCount = adminPosts.filter(p => p.reported === true).length;
  const badge = document.getElementById("commReportBadge");
  if (badge) {
    if (reportedCount > 0) {
      badge.textContent = reportedCount;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }

  const reportedChipBadge = document.getElementById("reportedCountBadge");
  if (reportedChipBadge) reportedChipBadge.textContent = reportedCount;

  const totalEl = document.getElementById("adminCommTotalPosts");
  if (totalEl) totalEl.textContent = adminPosts.length;

  const doubtsEl = document.getElementById("adminCommDoubtsCount");
  if (doubtsEl) doubtsEl.textContent = adminPosts.filter(p => p.category === "doubts").length;

  const repEl = document.getElementById("adminCommReportedCount");
  if (repEl) repEl.textContent = reportedCount;
}

export function renderAdminCommunity(){
  const container = document.getElementById("adminCommPostsContainer");
  if (!container) return;

  let filtered = [...adminPosts];

  // 1. Exam Filter
  if (activeAdminExam !== "all") {
    filtered = filtered.filter(p => (p.exam || "").toLowerCase().includes(activeAdminExam.toLowerCase()));
  }

  // 2. Category & Reported Filter
  if (activeAdminCat === "reported") {
    filtered = filtered.filter(p => p.reported === true);
  } else if (activeAdminCat === "trending") {
    filtered.sort((a,b) => ((b.likes?.length || 0) + (b.replies?.length || 0) + (b.views?.length || 0)) - ((a.likes?.length || 0) + (a.replies?.length || 0) + (a.views?.length || 0)));
  } else if (activeAdminCat !== "all") {
    filtered = filtered.filter(p => p.category === activeAdminCat);
  } else {
    // Sort recent first
    filtered.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // 3. Search query
  if (adminSearchQuery) {
    const q = adminSearchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.body && p.body.toLowerCase().includes(q)) ||
      (p.authorName && p.authorName.toLowerCase().includes(q)) ||
      (p.exam && p.exam.toLowerCase().includes(q)) ||
      (p.reportReason && p.reportReason.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:48px 20px;text-align:center;">
        <i class="fa-solid fa-comments" style="font-size:36px;color:var(--text-muted);margin-bottom:12px;display:block;"></i>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">No posts match these filters</div>
        <p style="font-size:12.5px;color:var(--text-secondary);">Try changing the exam filter, clearing search, or selecting 'All Posts'.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const replyCount = p.replies ? p.replies.length : 0;
    const viewsCount = p.views ? p.views.length : 0;
    const likesCount = p.likes ? p.likes.length : 0;
    const isReported = p.reported === true;

    return `
      <div class="admin-comm-card ${isReported ? 'is-reported' : ''}" id="adm_post_${p.id}">
        ${isReported ? `
          <div class="admin-reported-banner">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-flag" style="color:var(--accent-red);"></i>
              <span><b>REPORTED ISSUE:</b> "${escapeHtml(p.reportReason || 'User Reported')}"</span>
              <span style="font-size:10.5px;color:var(--text-muted);">(By ${escapeHtml(p.reportedBy || 'Student')})</span>
            </div>
            <button class="btn btn-sm btn-outline" style="border-color:var(--border);color:var(--text-secondary);padding:3px 8px;font-size:11px;" onclick="window.dismissPostReport('${p.id}')">
              <i class="fa-solid fa-check"></i> Dismiss Flag
            </button>
          </div>
        ` : ''}

        <div class="admin-comm-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="admin-comm-avatar">${escapeHtml((p.authorName || 'U').charAt(0).toUpperCase())}</div>
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                ${escapeHtml(p.authorName || 'Student')}
                <span class="exam-pill">${escapeHtml(p.exam || 'General')}</span>
                <span class="cat-pill ${escapeHtml(p.category)}">${escapeHtml(p.category || 'General')}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                ${formatAdminTime(p.createdAt)} · ID: <code>${p.id}</code>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="window.openPostCommentsModal('${p.id}')" title="Read and moderate all comments">
              <i class="fa-solid fa-comments"></i> Comments (${replyCount})
            </button>
            <button class="btn btn-sm btn-danger" onclick="window.deleteCommunityPostAdmin('${p.id}')" title="Delete post permanently">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>

        <div class="admin-comm-title">${escapeHtml(p.title || 'Untitled Post')}</div>
        <div class="admin-comm-body">${escapeHtml(p.body || '')}</div>

        ${p.code ? `
          <div style="background:#090D18;border:1px solid #1E293B;border-radius:10px;padding:10px;margin:8px 0;font-family:'DM Mono',monospace;font-size:11.5px;color:#E2E8F0;max-height:140px;overflow-y:auto;">
            <div style="font-size:9.5px;color:#94A3B8;margin-bottom:4px;text-transform:uppercase;">${escapeHtml(p.codeLang || 'CODE')}</div>
            <pre style="margin:0;"><code>${escapeHtml(p.code)}</code></pre>
          </div>` : ''}

        <div class="admin-comm-footer">
          <div class="admin-comm-metrics">
            <span><i class="fa-regular fa-eye"></i> ${viewsCount} views</span>
            <span><i class="fa-regular fa-heart"></i> ${likesCount} likes</span>
            <span><i class="fa-regular fa-comment-dots"></i> ${replyCount} comments</span>
          </div>
          <div>
            <a href="/community.html#${p.id}" target="_blank" class="admin-view-live-link">
              View on Live Community <i class="fa-solid fa-up-right-from-square" style="font-size:10px;"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

export function filterAdminCommunity(){
  const inp = document.getElementById("adminCommSearch");
  adminSearchQuery = inp ? inp.value.trim() : "";
  renderAdminCommunity();
}

export function setAdminExamFilter(exam, btn){
  activeAdminExam = exam;
  document.querySelectorAll(".adm-exam-chip").forEach(c => c.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderAdminCommunity();
}

export function setAdminCatFilter(cat, btn){
  activeAdminCat = cat;
  document.querySelectorAll(".adm-cat-chip").forEach(c => c.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderAdminCommunity();
}

export async function deleteCommunityPostAdmin(postId){
  if (!confirm("Are you sure you want to permanently delete this post and all its replies?")) return;

  try {
    adminPosts = adminPosts.filter(p => p.id !== postId);
    localStorage.setItem("sgp_community_posts_v2", JSON.stringify(adminPosts));

    try {
      await deleteDoc(doc(db, "communityPosts", postId));
    } catch(e){}

    renderAdminCommunity();
    updateAdminStatsAndBadge();
    showToast("Post deleted successfully", "success");
  } catch(err) {
    console.error("delete post error", err);
    showToast("Could not delete post", "error");
  }
}

export async function dismissPostReport(postId){
  const post = adminPosts.find(p => p.id === postId);
  if (!post) return;

  post.reported = false;
  post.reportDismissedAt = Date.now();
  localStorage.setItem("sgp_community_posts_v2", JSON.stringify(adminPosts));

  try {
    await updateDoc(doc(db, "communityPosts", postId), { reported: false });
  } catch(e){}

  renderAdminCommunity();
  updateAdminStatsAndBadge();
  showToast("Issue report dismissed", "info");
}

/* ─── COMMENTS MODERATION MODAL ─── */
export function openPostCommentsModal(postId){
  currentModalPostId = postId;
  const post = adminPosts.find(p => p.id === postId);
  if (!post) return;

  const modal = document.getElementById("adminCommentsModal");
  if (!modal) return;

  document.getElementById("admModalPostTitle").textContent = post.title;
  document.getElementById("admModalPostAuthor").textContent = `By ${post.authorName} (${post.exam})`;

  const list = document.getElementById("admModalRepliesList");
  const replies = post.replies || [];

  if (replies.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:26px 0;color:var(--text-muted);font-size:12.5px;">No comments on this post yet.</div>`;
  } else {
    list.innerHTML = replies.map(r => {
      const isDeleted = r.isDeletedByAdmin || r.text.includes("[Deleted by Admin");
      return `
        <div class="adm-comment-item ${isDeleted ? 'deleted-comment' : ''}" id="adm_rep_${r.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span>${escapeHtml(r.authorName || 'Student')}</span>
              <span style="font-size:10px;color:var(--text-muted);">${formatAdminTime(r.createdAt)}</span>
              ${isDeleted ? `<span class="badge badge-danger" style="font-size:9.5px;padding:2px 6px;">Deleted by Admin</span>` : ''}
            </div>
            <div>
              ${!isDeleted ? `
                <button class="btn btn-sm btn-danger" style="font-size:11px;padding:3px 8px;" onclick="window.deleteCommentAdmin('${post.id}', '${r.id}')" title="Replace with 'Deleted by Admin'">
                  <i class="fa-solid fa-ban"></i> Delete
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" style="font-size:11px;padding:3px 8px;border-color:var(--border);" onclick="window.purgeCommentAdmin('${post.id}', '${r.id}')" title="Completely remove comment record">
                  <i class="fa-solid fa-trash"></i> Purge
                </button>
              `}
            </div>
          </div>
          <div style="font-size:12.5px;color:${isDeleted ? 'var(--text-muted)' : 'var(--text-secondary)'};font-style:${isDeleted ? 'italic' : 'normal'};line-height:1.5;">
            ${escapeHtml(r.text)}
          </div>
        </div>
      `;
    }).join("");
  }

  modal.classList.add("open");
}

export function closePostCommentsModal(){
  const modal = document.getElementById("adminCommentsModal");
  if (modal) modal.classList.remove("open");
  currentModalPostId = null;
}

export async function deleteCommentAdmin(postId, replyId){
  const post = adminPosts.find(p => p.id === postId);
  if (!post || !post.replies) return;

  const reply = post.replies.find(r => r.id === replyId);
  if (!reply) return;

  // Set message to [Deleted by Admin] as requested by user
  reply.text = "[Deleted by Admin: Inappropriate / Policy violation]";
  reply.isDeletedByAdmin = true;
  reply.deletedAt = Date.now();

  localStorage.setItem("sgp_community_posts_v2", JSON.stringify(adminPosts));

  try {
    await updateDoc(doc(db, "communityPosts", postId), { replies: post.replies });
  } catch(e){}

  openPostCommentsModal(postId);
  renderAdminCommunity();
  showToast("Comment replaced with 'Deleted by Admin'", "success");
}

export async function purgeCommentAdmin(postId, replyId){
  const post = adminPosts.find(p => p.id === postId);
  if (!post || !post.replies) return;

  post.replies = post.replies.filter(r => r.id !== replyId);
  localStorage.setItem("sgp_community_posts_v2", JSON.stringify(adminPosts));

  try {
    await updateDoc(doc(db, "communityPosts", postId), { replies: post.replies });
  } catch(e){}

  openPostCommentsModal(postId);
  renderAdminCommunity();
  showToast("Comment permanently purged", "info");
}

/* ─── UTILITIES ─── */
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function formatAdminTime(ms){
  if (!ms) return "recently";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function showToast(msg, type = "info"){
  if (window.toast) {
    window.toast(msg, type);
  } else {
    console.log(`[Admin Community] ${type}: ${msg}`);
  }
}

// Expose globally on window for inline event handlers
window.loadAdminCommunity = loadAdminCommunity;
window.filterAdminCommunity = filterAdminCommunity;
window.setAdminExamFilter = setAdminExamFilter;
window.setAdminCatFilter = setAdminCatFilter;
window.deleteCommunityPostAdmin = deleteCommunityPostAdmin;
window.dismissPostReport = dismissPostReport;
window.openPostCommentsModal = openPostCommentsModal;
window.closePostCommentsModal = closePostCommentsModal;
window.deleteCommentAdmin = deleteCommentAdmin;
window.purgeCommentAdmin = purgeCommentAdmin;

// Auto-init when DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAdminCommunity);
} else {
  loadAdminCommunity();
}
