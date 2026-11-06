/**
 * auth.js — Authentication module for ListenPro
 *
 * Accounts live in Tencent CloudBase (Authentication → username + password).
 * The page talks to CloudBase directly with the browser SDK; there is no server of our own.
 *
 *  - Accounts are created by the admin in the CloudBase console (no self-registration).
 *  - Login: auth.signInWithPassword. The SDK keeps the session (access + refresh token) in
 *    localStorage and refreshes it on its own, so the learner stays signed in until logout.
 *  - lp_auth (localStorage) is only a UI hint { username, uid } so pages can decide
 *    synchronously whether to show the app or the login page. It holds no secret; real
 *    access is decided by the SDK session and the database's row-level security.
 *  - The SDK (js/vendor/cloudbase.js, ~460KB) is loaded on demand, so the first paint of
 *    the app does not wait for it. See tools/cloudbase-sdk to rebuild it.
 *
 * The public API is unchanged from the old users.json version:
 * login, logout, guard, verifySession, getSession, clearSession, redirect helpers.
 */

(function () {
  'use strict';

  // ---- CloudBase environment ----
  // The Publishable Key is meant to ship in browser code. Never put a Secret Key here.
  var CLOUDBASE = {
    env: 'comparative-whippet-d4bdd5bb44f2',
    region: 'ap-shanghai', // use 'ap-singapore' if the environment was created in Singapore
    accessKey: 'PASTE_PUBLISHABLE_KEY_HERE'
  };

  var AUTH_KEY = 'lp_auth';
  var VERIFY_TTL = 30 * 1000; // a good verdict is reused for 30s so rapid taps do not hit the SDK each time
  var lastOkAt = 0;           // when the session was last confirmed good

  // Base URL of the js/ folder (works for file paths, localhost and GitHub Pages sub-paths).
  var SCRIPT_BASE = (function () {
    var cs = document.currentScript;
    if (cs && cs.src) return cs.src.replace(/[^/]*(\?.*)?$/, '');
    return new URL('js/', window.location.href).href;
  })();

  // The old version kept the plaintext password in sessionStorage. Make sure none is left behind.
  try { sessionStorage.removeItem(AUTH_KEY); } catch (_) {}

  // ---- UI hint: who is signed in ----
  function getSession() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      var s = raw ? JSON.parse(raw) : null;
      return s && s.username ? s : null;
    } catch (_) {
      return null;
    }
  }

  function setSession(info) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ username: info.username, uid: info.uid || '' }));
  }

  function clearSession() {
    lastOkAt = 0;
    try { localStorage.removeItem(AUTH_KEY); } catch (_) {}
  }

  // ---- SDK loading ----
  var appPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(el);
    });
  }

  /**
   * Resolve to the initialised CloudBase app (loads the SDK on first use).
   */
  function getApp() {
    if (appPromise) return appPromise;
    appPromise = Promise.resolve()
      .then(function () {
        if (window.cloudbase) return;
        return loadScript(SCRIPT_BASE + 'vendor/cloudbase.js');
      })
      .then(function () {
        if (!window.cloudbase) throw new Error('CloudBase SDK did not load');
        if (!CLOUDBASE.accessKey || /^PASTE_/.test(CLOUDBASE.accessKey)) {
          throw new Error('CloudBase Publishable Key is not set in js/auth.js');
        }
        return window.cloudbase.init({
          env: CLOUDBASE.env,
          region: CLOUDBASE.region,
          accessKey: CLOUDBASE.accessKey
        });
      })
      .catch(function (err) {
        appPromise = null; // allow a retry, e.g. after the network comes back
        throw err;
      });
    return appPromise;
  }

  // ---- Error classification ----
  var BAD_CREDENTIAL_CATEGORIES = ['INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'USER_STATUS_ABNORMAL', 'INVALID_PARAMS'];
  var BAD_CREDENTIAL_CODES = ['invalid_password', 'user_not_found', 'invalid_argument', 'wrong_password'];
  var SESSION_GONE_CODES = ['unauthenticated', 'invalid_token', 'token_expired', 'invalid_grant', 'invalid_refresh_token'];

  function isBadCredentials(err) {
    if (!err) return false;
    return BAD_CREDENTIAL_CATEGORIES.indexOf(err.category) !== -1 ||
      BAD_CREDENTIAL_CODES.indexOf(err.code) !== -1;
  }

  // True when the server says the session is no longer valid (as opposed to "could not reach the server").
  function isSessionGone(err) {
    if (!err) return false;
    return err.category === 'INVALID_CREDENTIALS' ||
      err.category === 'USER_NOT_FOUND' ||
      err.category === 'USER_STATUS_ABNORMAL' ||
      SESSION_GONE_CODES.indexOf(err.code) !== -1;
  }

  /**
   * Attempt login. Resolves true on success, false for a wrong account or password.
   * Rejects for everything else (network, rate limit, misconfiguration) so the page can say so.
   */
  function login(username, password) {
    username = String(username || '').trim();
    return getApp()
      .then(function (app) {
        return app.auth.signInWithPassword({ username: username, password: password });
      })
      .then(function (res) {
        var err = res && res.error;
        if (err) {
          console.warn('[auth] sign-in failed:', err.category, err.code, err.message);
          if (isBadCredentials(err)) return false;
          if (err.category === 'RATE_LIMITED') {
            var limited = new Error('Too many attempts');
            limited.code = 'rate_limited';
            throw limited;
          }
          throw err;
        }
        var user = res && res.data && res.data.user;
        var meta = (user && user.user_metadata) || {};
        var uid = (user && user.id) || username;
        // If another account used this device before, drop its local data before the app opens.
        if (window.Sync) window.Sync.prepareFor(uid);
        setSession({ username: meta.username || username, uid: uid });
        lastOkAt = Date.now();
        return true;
      });
  }

  /**
   * Verify the current session. Resolves true if usable, false if the learner must sign in again.
   * A network failure counts as usable (offline tolerance), as before.
   */
  function verifySession(force) {
    if (!getSession()) return Promise.resolve(false);
    if (!force && Date.now() - lastOkAt < VERIFY_TTL) return Promise.resolve(true);
    return getApp()
      .then(function (app) { return app.auth.getSession(); })
      .then(function (res) {
        var err = res && res.error;
        if (err) {
          if (isSessionGone(err)) return false;
          console.warn('[auth] could not verify session, keeping it:', err.category, err.code, err.message);
          return true;
        }
        var session = res && res.data && res.data.session;
        if (!session) return false;
        lastOkAt = Date.now();
        return true;
      })
      .catch(function (err) {
        console.warn('[auth] could not verify session, keeping it:', err && err.message);
        return true;
      });
  }

  /**
   * Sign out of CloudBase, clear the hint and go to the login page.
   * Unsynced progress is pushed first; a slow network never keeps the learner waiting more than a moment.
   */
  function logout() {
    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      clearSession();
      redirectToLogin();
    }
    setTimeout(done, 2500);
    var flush = window.Sync && typeof window.Sync.flush === 'function'
      ? window.Sync.flush().catch(function () {})
      : Promise.resolve();
    flush
      .then(function () { return getApp(); })
      .then(function (app) { return app.auth.signOut(); })
      .catch(function (err) { console.warn('[auth] sign-out failed:', err && err.message); })
      .then(done);
  }

  /**
   * Redirect to the login page.
   * Preserves the GitHub Pages sub-path.
   */
  function redirectToLogin() {
    const base = window.location.href.replace(/[^/]*(\?.*)?$/, '');
    window.location.replace(base + 'login.html');
  }

  /**
   * Redirect to main page (index.html).
   */
  function redirectToHome() {
    const base = window.location.href.replace(/[^/]*(\?.*)?$/, '');
    window.location.replace(base + 'index.html');
  }

  var authToastShown = false;

  function showAuthToastAndRedirect() {
    if (window.location.href.includes('login.html')) {
      redirectToLogin();
      return;
    }
    // Several checks can fail at once (page load + a play tap); show one toast, redirect once.
    if (authToastShown) return;
    authToastShown = true;

    var currentLang = localStorage.getItem('lp_lang') || 'en';
    var msg = currentLang === 'en'
      ? 'Login expired or password changed.'
      : '登录已过期或密码已修改。';

    var toast = document.createElement('div');
    toast.innerHTML = '<i class="ri-error-warning-line" style="margin-right: 8px; font-size: 18px; color: var(--accent2); display: flex; align-items: center;"></i>' +
                      '<span>' + msg + '</span>';
    toast.style.position = 'fixed';
    toast.style.top = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'var(--surface)';
    toast.style.color = 'var(--text)';
    toast.style.border = '1px solid var(--border)';
    toast.style.backdropFilter = 'blur(20px)';
    toast.style.WebkitBackdropFilter = 'blur(20px)';
    toast.style.padding = '12px';
    toast.style.minWidth = '300px';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.borderRadius = 'var(--radius-sm, 12px)';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = 'var(--card-shadow, 0 8px 32px rgba(0,0,0,0.2))';
    toast.style.fontFamily = 'var(--font, "Inter", -apple-system, sans-serif)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    // Start slightly higher
    toast.style.transform = 'translate(-50%, -20px)';

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
    });

    // Give the learner a moment to read why, then go to the login page.
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
      setTimeout(function() {
        redirectToLogin();
      }, 300);
    }, 2000);
  }

  /**
   * Guard function: call on every protected page load and on play/switch.
   * If session is invalid, redirects to login.
   * Returns a Promise<boolean>.
   */
  function guard(onFail) {
    return verifySession().then(function (valid) {
      if (!valid) {
        clearSession();
        if (typeof onFail === 'function') onFail();
        else showAuthToastAndRedirect();
      }
      return valid;
    });
  }

  // Expose globally
  window.Auth = {
    login: login,
    logout: logout,
    clearSession: clearSession,
    guard: guard,
    verifySession: verifySession,
    getSession: getSession,
    getApp: getApp,
    redirectToLogin: redirectToLogin,
    showAuthToastAndRedirect: showAuthToastAndRedirect,
    redirectToHome: redirectToHome
  };
})();
