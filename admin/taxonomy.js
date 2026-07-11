/**
 * ============================================================
 *  Study Grid Prep Admin Panel — taxonomy.js
 *  Categories + Authors management (simple CRUD).
 *
 *  Import in studygridadmin.html:
 *    <script type="module" src="taxonomy.js"></script>
 * ============================================================
 */

import {
  db, collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy
} from "../firebase.js";

const $ = id => document.getElementById(id);
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function txToast(message, type = "info") {
  if (typeof window.toast === "function") { window.toast(message, type); return; }
  console.log(`[${type}]`, message);
}
function slugify(text) {
  return (text || "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}

const TX = { categories: [], authors: [] };

// ============================================================
//  CATEGORIES
// ============================================================
async function txLoadCategories() {
  try {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
    TX.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "categories"));
    TX.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    TX.categories.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  txRenderCategories();
}

function txRenderCategories() {
  const wrap = $("txCategoryList");
  if (!wrap) return;
  if (!TX.categories.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-text">No categories yet.</div></div>`;
    return;
  }
  wrap.innerHTML = TX.categories.map(c => `
    <div class="tx-row">
      <div>
        <strong>${escHtml(c.name)}</strong>
        <span style="color:var(--text-muted);font-size:12px;margin-left:8px;">/${escHtml(c.slug)}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="txEditCategory('${c.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-outline btn-sm" onclick="txDeleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join("");
}

async function txSaveCategory() {
  const name = $("txCategoryName").value.trim();
  if (!name) { txToast("Category name required", "error"); return; }
  const slug = $("txCategorySlug").value.trim() || slugify(name);
  const editingId = $("txCategoryForm").dataset.editingId;

  try {
    if (editingId) {
      await updateDoc(doc(db, "categories", editingId), { name, slug });
      txToast("Category updated", "success");
    } else {
      await addDoc(collection(db, "categories"), { name, slug });
      txToast("Category added", "success");
    }
    txResetCategoryForm();
    txLoadCategories();
  } catch (e) {
    console.error(e);
    txToast("Save failed — check Firestore rules", "error");
  }
}

function txEditCategory(id) {
  const c = TX.categories.find(x => x.id === id);
  if (!c) return;
  $("txCategoryName").value = c.name || "";
  $("txCategorySlug").value = c.slug || "";
  $("txCategoryForm").dataset.editingId = id;
  $("txCategorySaveBtn").innerHTML = `<i class="fa-solid fa-check"></i> Update Category`;
}

function txResetCategoryForm() {
  $("txCategoryName").value = "";
  $("txCategorySlug").value = "";
  delete $("txCategoryForm").dataset.editingId;
  $("txCategorySaveBtn").innerHTML = `<i class="fa-solid fa-plus"></i> Add Category`;
}

async function txDeleteCategory(id) {
  if (!confirm("Delete this category?")) return;
  await deleteDoc(doc(db, "categories", id));
  txToast("Deleted", "success");
  txLoadCategories();
}

// ============================================================
//  AUTHORS
// ============================================================
async function txLoadAuthors() {
  try {
    const snap = await getDocs(query(collection(db, "authors"), orderBy("name")));
    TX.authors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "authors"));
    TX.authors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    TX.authors.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  txRenderAuthors();
}

function txRenderAuthors() {
  const wrap = $("txAuthorList");
  if (!wrap) return;
  if (!TX.authors.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-text">No authors yet.</div></div>`;
    return;
  }
  wrap.innerHTML = TX.authors.map(a => `
    <div class="tx-row">
      <div>
        <strong>${escHtml(a.name)}</strong>
        ${a.bio ? `<div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${escHtml(a.bio)}</div>` : ""}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="txEditAuthor('${a.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-outline btn-sm" onclick="txDeleteAuthor('${a.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join("");
}

async function txSaveAuthor() {
  const name = $("txAuthorName").value.trim();
  if (!name) { txToast("Author name required", "error"); return; }
  const bio = $("txAuthorBio").value.trim();
  const editingId = $("txAuthorForm").dataset.editingId;

  try {
    if (editingId) {
      await updateDoc(doc(db, "authors", editingId), { name, bio });
      txToast("Author updated", "success");
    } else {
      await addDoc(collection(db, "authors"), { name, bio });
      txToast("Author added", "success");
    }
    txResetAuthorForm();
    txLoadAuthors();
  } catch (e) {
    console.error(e);
    txToast("Save failed — check Firestore rules", "error");
  }
}

function txEditAuthor(id) {
  const a = TX.authors.find(x => x.id === id);
  if (!a) return;
  $("txAuthorName").value = a.name || "";
  $("txAuthorBio").value = a.bio || "";
  $("txAuthorForm").dataset.editingId = id;
  $("txAuthorSaveBtn").innerHTML = `<i class="fa-solid fa-check"></i> Update Author`;
}

function txResetAuthorForm() {
  $("txAuthorName").value = "";
  $("txAuthorBio").value = "";
  delete $("txAuthorForm").dataset.editingId;
  $("txAuthorSaveBtn").innerHTML = `<i class="fa-solid fa-plus"></i> Add Author`;
}

async function txDeleteAuthor(id) {
  if (!confirm("Delete this author?")) return;
  await deleteDoc(doc(db, "authors", id));
  txToast("Deleted", "success");
  txLoadAuthors();
}

// ============================================================
//  INIT
// ============================================================
window.txSaveCategory = txSaveCategory;
window.txEditCategory = txEditCategory;
window.txDeleteCategory = txDeleteCategory;
window.txResetCategoryForm = txResetCategoryForm;
window.txSaveAuthor = txSaveAuthor;
window.txEditAuthor = txEditAuthor;
window.txDeleteAuthor = txDeleteAuthor;
window.txResetAuthorForm = txResetAuthorForm;

window.initTaxonomy = function () {
  txLoadCategories();
  txLoadAuthors();
};
