/**
 * auth.js — Authentication module for ListenPro
 *
 * Strategy (pure frontend, GitHub Pages compatible):
 *  - users.json is the source-of-truth "cloud" password store (manually maintained)
 *  - On login: fetch users.json, verify credentials, store in sessionStorage
 *  - On protected pages: re-fetch users.json and verify stored creds match
 *  - sessionStorage is cleared on tab close (session-scoped, as required)
 */

(function () {
  'use strict';

  const AUTH_KEY = 'lp_auth';

  // Resolve the path to users.json relative to the script base
  // Works for both local file:// and GitHub Pages sub-path deployments
  function getUsersJsonUrl() {
    // Find auth.js script tag to derive base path
    const scripts = document.querySelectorAll('script[src]');
    let base = '';
    for (const s of scripts) {
      if (s.src && s.src.includes('auth.js')) {
        // Go up one directory from js/
        base = s.src.replace(/js\/auth\.js.*$/, '');
        break;
      }
    }
    if (!base) {
      // Fallback: use current page location
      base = window.location.href.replace(/[^/]*$/, '');
    }
    return base + 'users.json';
  }

  /**
   * Fetch the users list from users.json.
   * Returns a Promise<Array<{username, password}>>.
   */
  function fetchUsers() {
    const url = getUsersJsonUrl();
    return fetch(url + '?_=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load users.json: ' + res.status);
        return res.json();
      });
  }

  /**
   * Attempt login. Returns Promise<boolean>.
   */
  function login(username, password) {
    return fetchUsers().then(function (users) {
      const match = users.find(function (u) {
        return u.username === username.trim() && u.password === password;
      });
      if (match) {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({
          username: match.username,
          password: match.password
        }));
        return true;
      }
      return false;
    });
  }

  /**
   * Get stored session credentials (or null).
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Verify current session against users.json.
   * Resolves to true if valid, false otherwise.
   */
  function verifySession() {
    const session = getSession();
    if (!session) return Promise.resolve(false);
    return fetchUsers().then(function (users) {
      return users.some(function (u) {
        return u.username === session.username && u.password === session.password;
      });
    }).catch(function () {
      // Network error: keep session alive (offline tolerance)
      return true;
    });
  }

  /**
   * Clear session and redirect to login page.
   */
  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    redirectToLogin();
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

  function clearSession() {
    sessionStorage.removeItem(AUTH_KEY);
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
    redirectToLogin: redirectToLogin,
    showAuthToastAndRedirect: showAuthToastAndRedirect,
    redirectToHome: redirectToHome
  };
})();
