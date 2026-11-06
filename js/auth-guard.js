/**
 * auth-guard.js
 *
 * Runs AFTER app.js is loaded. Responsibilities:
 * 1. Full session verification against CloudBase on page load
 * 2. Re-verify on every play / sentence switch action
 * 3. Wire up the logout button
 *
 * Uses Auth module (auth.js) and hooks into the app via event patching.
 */
(function () {
  'use strict';

  // ---- 1. Full verify on page load ----
  Auth.guard();

  // ---- 2. Intercept play / sentence switch ----
  // Strategy: wrap the buttons' click handlers with a guard check.
  // We patch after the DOM is ready (scripts run in order after app.js).

  function withAuthGuard(fn) {
    return function (e) {
      // Run the guard asynchronously; if it fails, redirect and abort
      Auth.guard().then(function (valid) {
        if (valid && typeof fn === 'function') fn(e);
      });
    };
  }

  function guardButton(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    // Clone to remove old listeners, then re-attach guarded click
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    // Re-attach the same visual/audio actions via a guarded dispatch
    clone.addEventListener('click', function (e) {
      Auth.guard().then(function (valid) {
        if (!valid) return;
        // Dispatch a custom event so app.js can listen (or we fire a native click on the original)
        // Since we replaced the element, dispatch a named event
        clone.dispatchEvent(new CustomEvent('guardedClick', { bubbles: false }));
      });
    });

    return clone;
  }

  // Patch play-related buttons
  var PLAY_BUTTON_IDS = ['btnPlay', 'btnPrev', 'btnNext', 'btnMiniPlay', 'btnMiniPrev', 'btnMiniNext'];

  // Instead of cloning (which loses app.js listeners), we simply pre-intercept
  // by wrapping via a capturing listener — if auth fails we stop propagation.
  PLAY_BUTTON_IDS.forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      var session = Auth.getSession();
      if (!session) {
        e.stopImmediatePropagation();
        Auth.redirectToLogin();
        return;
      }
      // Async re-verify (non-blocking for UX; if it fails mid-play, guard catches it)
      Auth.verifySession && Auth.verifySession().then(function (valid) {
        if (!valid) {
          if (Auth.clearSession) Auth.clearSession();
          if (Auth.showAuthToastAndRedirect) Auth.showAuthToastAndRedirect();
          else Auth.redirectToLogin();
        }
      }).catch(function () {});
    }, true); // capture phase — runs before app.js listeners
  });

  // Also guard sentence list clicks (and the wide-layout current-line panel) via delegation
  ['sentenceList', 'nowPanel'].forEach(function (id) {
    var container = document.getElementById(id);
    if (!container) return;
    container.addEventListener('click', function (e) {
      var session = Auth.getSession();
      if (!session) {
        e.stopImmediatePropagation();
        Auth.redirectToLogin();
      }
    }, true);
  });

  // ---- 3. Logout button ----
  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function (e) {
      e.preventDefault();
      var originalHtml = btnLogout.innerHTML;
      btnLogout.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
      btnLogout.style.pointerEvents = 'none';
      
      // Small delay to allow spinner to render, avoiding the "frozen" feeling
      setTimeout(function () {
        Auth.logout();
      }, 150);
    });
  }
})();
