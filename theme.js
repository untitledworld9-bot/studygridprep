// Sync theme-color meta for native OS status bar blending
function syncThemeColorMeta(theme) {
  const isDark = theme === "dark";
  const color = isDark ? "#0D1120" : "#F0F2F8";
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

// Load theme
(function(){
  const saved = localStorage.getItem("theme");
  let theme = "light";

  if(saved && saved !== "system"){
    theme = saved;
  } else {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = systemDark ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
})();

// Toggle
function toggleTheme(){
  let current = document.documentElement.getAttribute("data-theme");
  let newTheme = current === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  syncThemeColorMeta(newTheme);
  updateThemeIcon();
}

// Icon
function updateThemeIcon(){
  const icon = document.getElementById("themeToggleIcon");
  if(!icon) return;

  let current = document.documentElement.getAttribute("data-theme");
  icon.innerHTML = current === "dark" ? "🌙" : "✨";
}

window.addEventListener("DOMContentLoaded", updateThemeIcon);