/**
 * Study Grid Prep – Universal Native App Pull to Refresh Engine (pull-to-refresh.js)
 * Self-initializing touch and gesture-driven pull-to-refresh for web & PWA.
 * Seamlessly integrates right below sticky/top headers across all user pages.
 */

(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.__sgp_ptr_initialized) return;
  window.__sgp_ptr_initialized = true;

  let startY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const PULL_THRESHOLD = 55; // pixels to trigger refresh
  const MAX_PULL = 90;

  let overlayEl = null;
  let pillEl = null;
  let iconBoxEl = null;
  let textEl = null;

  function getHeaderOffset() {
    // Detect sticky, fixed or top header height on the page
    const headerSelectors = [
      'header.hub-header',
      'header.header',
      '.dash-header',
      '.top-header',
      'header',
      '.top-bar',
      '.top-nav',
      '.pwa-header',
      '#topHeader',
      '.header'
    ];

    for (const sel of headerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.height > 20 && rect.top <= 12 && rect.bottom > 20 && rect.bottom < 200) {
          return Math.round(rect.bottom + 8);
        }
      }
    }
    return 16;
  }

  function createPtrElements() {
    if (document.getElementById('sgpPtrOverlay')) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'sgp-ptr-overlay';
    overlayEl.id = 'sgpPtrOverlay';

    overlayEl.innerHTML = `
      <div class="sgp-ptr-pill" id="sgpPtrPill">
        <div class="sgp-ptr-icon-box" id="sgpPtrIconBox">
          <i class="fa-solid fa-arrow-down" id="sgpPtrIcon"></i>
        </div>
        <span class="sgp-ptr-text" id="sgpPtrText">Pull down to refresh</span>
      </div>
    `;

    document.body.prepend(overlayEl);

    pillEl = document.getElementById('sgpPtrPill');
    iconBoxEl = document.getElementById('sgpPtrIconBox');
    textEl = document.getElementById('sgpPtrText');
  }

  function isModalOpen() {
    const openModals = document.querySelectorAll(
      '.modal-overlay.open, .modal.open, .drawer.open, dialog[open], .app-modal-overlay.open, .notif-drawer.open, #timeLimitOverlay.open, #composerModal.open, .pwa-sidebar.open'
    );
    return openModals.length > 0;
  }

  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') {
      return true;
    }
    return !!target.closest('input, textarea, select, button, a, [contenteditable="true"]');
  }

  function onTouchStart(e) {
    if (isRefreshing || isModalOpen()) return;
    if (isInteractiveTarget(e.target)) return;

    // Only allow when scroll is at the very top
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollTop <= 1) {
      startY = e.touches[0].clientY;
      isPulling = true;
    } else {
      isPulling = false;
    }
  }

  function onTouchMove(e) {
    if (!isPulling || isRefreshing) return;

    const touchY = e.touches[0].clientY;
    const diff = touchY - startY;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollTop > 0) {
      isPulling = false;
      resetPtr();
      return;
    }

    if (diff > 8) {
      // Damped pull distance
      const pullDist = Math.min(MAX_PULL, Math.pow(diff, 0.82) * 1.35);
      const topOffset = getHeaderOffset();

      overlayEl.classList.add('sgp-ptr-pulling');
      overlayEl.style.transform = `translateY(${topOffset + pullDist}px)`;
      overlayEl.style.opacity = String(Math.min(1, pullDist / 35));

      if (pullDist >= PULL_THRESHOLD) {
        iconBoxEl.classList.add('flipped');
        textEl.textContent = 'Release to refresh';
      } else {
        iconBoxEl.classList.remove('flipped');
        textEl.textContent = 'Pull down to refresh';
      }
    } else if (diff < 0) {
      resetPtr();
    }
  }

  function onTouchEnd() {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    if (iconBoxEl && iconBoxEl.classList.contains('flipped')) {
      triggerRefresh();
    } else {
      resetPtr();
    }
  }

  // Pointer / Mouse emulation for desktop testing
  let isPointerDown = false;
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return; // Handled by touch events
    if (e.button !== 0 || isRefreshing || isModalOpen() || isInteractiveTarget(e.target)) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollTop <= 1 && e.clientY < 180) {
      startY = e.clientY;
      isPointerDown = true;
    }
  }

  function onPointerMove(e) {
    if (!isPointerDown || isRefreshing) return;
    const diff = e.clientY - startY;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollTop > 0) {
      isPointerDown = false;
      resetPtr();
      return;
    }
    if (diff > 12) {
      const pullDist = Math.min(MAX_PULL, Math.pow(diff, 0.82) * 1.35);
      const topOffset = getHeaderOffset();
      overlayEl.classList.add('sgp-ptr-pulling');
      overlayEl.style.transform = `translateY(${topOffset + pullDist}px)`;
      overlayEl.style.opacity = String(Math.min(1, pullDist / 35));

      if (pullDist >= PULL_THRESHOLD) {
        iconBoxEl.classList.add('flipped');
        textEl.textContent = 'Release to refresh';
      } else {
        iconBoxEl.classList.remove('flipped');
        textEl.textContent = 'Pull down to refresh';
      }
    } else if (diff < 0) {
      resetPtr();
    }
  }

  function onPointerUp() {
    if (!isPointerDown || isRefreshing) return;
    isPointerDown = false;
    if (iconBoxEl && iconBoxEl.classList.contains('flipped')) {
      triggerRefresh();
    } else {
      resetPtr();
    }
  }

  async function triggerRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    const topOffset = getHeaderOffset();
    const restingY = topOffset + 20;

    overlayEl.classList.remove('sgp-ptr-pulling');
    overlayEl.classList.add('sgp-ptr-refreshing');
    overlayEl.style.transform = `translateY(${restingY}px)`;
    overlayEl.style.opacity = '1';

    const icon = document.getElementById('sgpPtrIcon');
    if (icon) icon.className = 'fa-solid fa-arrows-rotate fa-spin';
    if (textEl) textEl.textContent = 'Refreshing content…';
    if (iconBoxEl) iconBoxEl.classList.remove('flipped');

    // Subtle vibration on supported mobile devices
    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }

    try {
      // 1. Check if the current page registered a custom pull-to-refresh handler
      if (typeof window.onPullToRefresh === 'function') {
        await window.onPullToRefresh();
      }
      // 2. Otherwise check for known applet reload / sync functions
      else if (typeof window.syncUserData === 'function') {
        await window.syncUserData();
      } else if (typeof window.triggerManualRefresh === 'function') {
        await window.triggerManualRefresh();
      } else if (typeof window.loadLeaderboard === 'function') {
        await window.loadLeaderboard();
      } else if (typeof window.loadFromFirebase === 'function') {
        await window.loadFromFirebase();
      } else if (typeof window.loadFirebase === 'function') {
        await window.loadFirebase();
      } else {
        // Fallback: smooth page reload after short indicator animation
        await new Promise(r => setTimeout(r, 600));
        window.location.reload();
        return;
      }
    } catch (err) {
      console.warn('[PTR] Refresh error:', err);
    }

    // Success feedback
    if (icon) icon.className = 'fa-solid fa-check';
    if (iconBoxEl) iconBoxEl.style.color = '#10B981';
    if (textEl) textEl.textContent = 'Updated just now ✓';

    setTimeout(() => {
      overlayEl.style.transform = `translateY(${topOffset - 20}px)`;
      overlayEl.style.opacity = '0';

      setTimeout(() => {
        resetPtr();
        isRefreshing = false;
      }, 250);
    }, 550);
  }

  function resetPtr() {
    if (!overlayEl) return;
    overlayEl.classList.remove('sgp-ptr-pulling', 'sgp-ptr-refreshing');
    overlayEl.style.transform = '';
    overlayEl.style.opacity = '0';
    if (iconBoxEl) {
      iconBoxEl.classList.remove('flipped');
      iconBoxEl.style.color = '';
    }
    const icon = document.getElementById('sgpPtrIcon');
    if (icon) icon.className = 'fa-solid fa-arrow-down';
    if (textEl) textEl.textContent = 'Pull down to refresh';
  }

  function init() {
    createPtrElements();

    // Attach touch listeners to window
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Pointer events for desktop
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // Expose programmatic trigger globally
    window.triggerGlobalPullToRefresh = triggerRefresh;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
