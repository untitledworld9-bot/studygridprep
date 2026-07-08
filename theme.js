// Load theme
(function(){
  const saved = localStorage.getItem("theme");

  // ✅ FIX: "system" is a MODE the user picked (from the dashboard's 3-way
  // Light/Dark/System selector), not an actual theme value. Previously
  // `if(saved)` treated "system" as truthy and set data-theme="system"
  // literally — which matches no CSS rule. Since this script loads near the
  // END of <body> on dashboard-home.html / profile.html / subscription.html,
  // it ran AFTER those pages' own early head-init script had already
  // correctly resolved the theme, and silently overwrote it back to the
  // broken value — this was the real reason "System" mode looked unstable
  // across every refresh or page navigation.
  if(saved && saved !== "system"){
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute("data-theme", systemDark ? "dark" : "light");
  }
})();

// Toggle
function toggleTheme(){
  let current = document.documentElement.getAttribute("data-theme");

  let newTheme = current === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

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