/**
 * sync.js — keeps the learner's data the same on every device they sign in on.
 *
 * Synced (one row per account in the CloudBase table public.user_data, column `data`):
 *   wordbook   lp_wordbook    saved words
 *   stats      lp_stats       listening time, streak days, lines heard
 *   positions  lp_positions   where the learner stopped in each topic
 * Preferences (speed, theme, font size, ...) stay on the device.
 *
 * The app keeps working from localStorage; this module only reconciles it with the cloud:
 *   - app.js calls Sync.touch(name) after it saves one of the synced keys.
 *   - A push is a full "read cloud, merge, write both sides" round, so two devices never
 *     overwrite each other blindly. It runs a few seconds after the last change, when the
 *     page is hidden, and when the tab comes back or the network returns.
 *   - When the merge changes local data, 'lp:synced' fires so app.js can refresh what is on screen.
 *     Just before merging, 'lp:presync' fires so app.js can write any unsaved in-memory stats.
 *
 * Merge rules
 *   stats      combined, never lost: max of the counters, per-day max, union of heard lines.
 *   wordbook   the newer edit wins (so removing a word sticks). If both sides were edited since
 *              the last sync, the two lists are merged so no word is lost.
 *   positions  same as the wordbook, merged per topic.
 *   First sync of an account on a device that already holds data: local and cloud are combined.
 *   Signing in as a different account: the previous account's local data is dropped.
 */
(function () {
  'use strict';

  var TABLE = 'user_data';
  var META_KEY = 'lp_sync';        // { uid, dirty, at: {name: ms}, base: {name: ms} }
  // Each sync is two requests, and the free plan has a monthly budget, so keep them sparse.
  var WORDBOOK_DELAY = 5 * 1000;   // a saved or removed word goes up soon
  var PROGRESS_DELAY = 3 * 60 * 1000; // listening time and position change all the time; batch them
  var PULL_INTERVAL = 60 * 1000;   // re-check the cloud when the tab comes back after this long
  var MAX_BACKOFF = 10 * 60 * 1000;

  var ITEMS = {
    wordbook: { key: 'lp_wordbook' },
    stats: { key: 'lp_stats' },
    positions: { key: 'lp_positions' }
  };
  var NAMES = Object.keys(ITEMS);

  // ---- helpers ----
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ':' + stable(v[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(v);
  }

  function emptyValue(name) {
    if (name === 'wordbook') return [];
    if (name === 'stats') return { listenedSec: 0, days: {}, heard: [], sentencesPlayed: 0 };
    return {};
  }

  // Bring any stored value into the exact shape the app uses, so comparisons are reliable.
  function normalize(name, v) {
    if (name === 'wordbook') {
      return Array.isArray(v) ? v.filter(function (w) { return typeof w === 'string'; }) : [];
    }
    if (name === 'stats') {
      v = v && typeof v === 'object' ? v : {};
      var seen = {};
      (Array.isArray(v.heard) ? v.heard : []).forEach(function (id) { seen[String(id)] = true; });
      return {
        listenedSec: Number(v.listenedSec) || 0,
        days: v.days && typeof v.days === 'object' && !Array.isArray(v.days) ? v.days : {},
        heard: Object.keys(seen).sort(),
        sentencesPlayed: Number(v.sentencesPlayed) || 0
      };
    }
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function same(name, a, b) {
    return stable(normalize(name, a)) === stable(normalize(name, b));
  }

  // combine(older, newer): used when both sides changed. The newer side wins ties.
  function combine(name, older, newer) {
    older = normalize(name, older);
    newer = normalize(name, newer);
    if (name === 'wordbook') {
      var out = older.slice();
      newer.forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); });
      return out;
    }
    if (name === 'positions') return Object.assign({}, older, newer);
    // stats
    var days = {};
    [older.days, newer.days].forEach(function (d) {
      Object.keys(d).forEach(function (k) { days[k] = Math.max(days[k] || 0, Number(d[k]) || 0); });
    });
    var heard = {};
    older.heard.concat(newer.heard).forEach(function (id) { heard[id] = true; });
    return {
      listenedSec: Math.max(older.listenedSec, newer.listenedSec),
      days: days,
      heard: Object.keys(heard).sort(),
      sentencesPlayed: Math.max(older.sentencesPlayed, newer.sentencesPlayed)
    };
  }

  // ---- local storage ----
  function readLocal(name) {
    try {
      var raw = localStorage.getItem(ITEMS[name].key);
      return normalize(name, raw ? JSON.parse(raw) : null);
    } catch (_) {
      return emptyValue(name);
    }
  }

  function writeLocal(name, value) {
    localStorage.setItem(ITEMS[name].key, JSON.stringify(value));
  }

  function readMeta() {
    try {
      var m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (!m || typeof m !== 'object') m = {};
      m.at = m.at || {};
      m.base = m.base || {};
      return m;
    } catch (_) {
      return { at: {}, base: {} };
    }
  }

  // Always read-modify-write so a change made while a sync was in flight is never lost.
  function updateMeta(fn) {
    var m = readMeta();
    fn(m);
    localStorage.setItem(META_KEY, JSON.stringify(m));
    return m;
  }

  function currentUid() {
    var s = window.Auth && Auth.getSession();
    return s ? (s.uid || s.username) : '';
  }

  // Call right after a successful sign-in, before the app opens: if the device last belonged to a
  // different account, remove that account's data so it is never shown to or merged into this one.
  function prepareFor(uid) {
    var m = readMeta();
    if (m.uid && uid && m.uid !== uid) {
      NAMES.forEach(function (n) { localStorage.removeItem(ITEMS[n].key); });
      localStorage.removeItem(META_KEY);
    }
  }

  // ---- change tracking ----
  var touchSeq = 0;
  var pushTimer = null;
  var pushDue = 0;

  function touch(name) {
    if (!ITEMS[name]) return;
    touchSeq++;
    updateMeta(function (m) {
      // Never earlier than the version we last saw in the cloud, so an edit made here still wins
      // there even when this device's clock runs behind another device's.
      m.at[name] = Math.max(Date.now(), (Number(m.base[name]) || 0) + 1);
      m.dirty = true;
    });
    schedule(name === 'wordbook' ? WORDBOOK_DELAY : PROGRESS_DELAY);
  }

  // Keep the earliest pending sync; a later request never pushes it back.
  function schedule(delay) {
    var due = Date.now() + delay;
    if (pushTimer && pushDue <= due) return;
    clearTimeout(pushTimer);
    pushDue = due;
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushDue = 0;
      syncNow();
    }, delay);
  }

  // ---- one sync round ----
  var running = null;
  var rerun = false;
  var failCount = 0;
  var lastSyncAt = 0;

  function syncNow() {
    if (running) {
      rerun = true;
      return running;
    }
    running = doSync()
      .then(function () {
        failCount = 0;
        lastSyncAt = Date.now();
      }, function (err) {
        failCount++;
        console.warn('[sync] failed (will retry):', err && (err.message || err.code || err));
        schedule(Math.min(30000 * Math.pow(2, failCount - 1), MAX_BACKOFF));
        return handleAuthError(err);
      })
      .then(function () {
        running = null;
        if (rerun) {
          rerun = false;
          return syncNow();
        }
      });
    return running;
  }

  // If the server rejects our token, find out whether the session is really gone.
  function handleAuthError(err) {
    var code = err && String(err.code || err.status || '');
    if (code === 'PGRST301' || code === 'PGRST302' || code === '401') {
      return Auth.verifySession(true).then(function (ok) {
        if (!ok) Auth.showAuthToastAndRedirect();
      });
    }
  }

  function doSync() {
    if (!window.Auth || !Auth.getSession()) return Promise.resolve();
    if (navigator.onLine === false) return Promise.resolve();

    var uid = currentUid();
    var db;

    return Auth.getApp()
      .then(function (app) {
        db = app.rdb();
        return db.from(TABLE).select('owner_id, data').limit(1);
      })
      .then(function (res) {
        if (res.error) throw res.error;
        var row = res.data && res.data[0];
        var remoteDoc = row && row.data && typeof row.data === 'object' ? row.data : {};
        // Changes made up to this point are part of the merge; later ones keep the dirty flag.
        var seq = touchSeq;
        var plan = merge(uid, remoteDoc);
        return push(db, row, remoteDoc, plan, seq);
      });
  }

  /**
   * Everything from "app writes pending stats" to "local storage updated" runs in one go with no
   * waiting in between, so the page cannot change local data halfway through a merge.
   */
  function merge(uid, remoteDoc) {
    window.dispatchEvent(new Event('lp:presync'));

    var meta = readMeta();
    var mode = !meta.uid ? 'first' : (meta.uid !== uid ? 'switch' : 'normal');
    var now = Date.now();
    var plan = { values: {}, at: {}, localChanged: [], needPush: false };

    NAMES.forEach(function (name) {
      var local = readLocal(name);
      var item = remoteDoc[name];
      var hasRemote = item && typeof item === 'object' && 'v' in item;
      var remote = hasRemote ? normalize(name, item.v) : emptyValue(name);
      var rAt = hasRemote ? Number(item.at) || 0 : 0;
      var lAt = Number(meta.at[name]) || 0;
      var base = Number(meta.base[name]) || 0;
      var value;
      var at;

      if (mode === 'switch') {
        value = remote;
        at = rAt;
      } else if (name === 'stats' || mode === 'first') {
        value = combine(name, local, remote);
        at = same(name, value, remote) ? rAt : now;
      } else if (lAt === rAt) {
        value = local;
        at = lAt;
      } else {
        var bothChanged = lAt > base && rAt > base;
        if (rAt > lAt) {
          value = bothChanged ? combine(name, local, remote) : remote;
        } else {
          value = bothChanged ? combine(name, remote, local) : local;
        }
        if (same(name, value, remote)) at = rAt;
        else if (same(name, value, local)) at = lAt;
        else at = now;
      }

      plan.values[name] = value;
      plan.at[name] = at;
      if (!same(name, value, local)) {
        writeLocal(name, value);
        plan.localChanged.push(name);
      }
      if (!same(name, value, remote)) plan.needPush = true;
    });

    updateMeta(function (m) {
      m.uid = uid;
      NAMES.forEach(function (name) { m.at[name] = plan.at[name]; });
    });

    if (plan.localChanged.length) {
      window.dispatchEvent(new CustomEvent('lp:synced', { detail: { changed: plan.localChanged } }));
    }
    return plan;
  }

  function push(db, row, remoteDoc, plan, seq) {
    function finish() {
      updateMeta(function (m) {
        NAMES.forEach(function (name) { m.base[name] = plan.at[name]; });
        if (touchSeq === seq) m.dirty = false;
      });
    }

    if (!plan.needPush) {
      // Nothing to upload, but the cloud copy and ours now agree, so move the baseline.
      finish();
      return Promise.resolve();
    }

    var doc = Object.assign({}, remoteDoc, { v: 1 });
    NAMES.forEach(function (name) {
      doc[name] = { v: plan.values[name], at: plan.at[name] };
    });
    var stamp = new Date().toISOString();

    var request = row
      ? db.from(TABLE).update({ data: doc, updated_at: stamp }).eq('owner_id', row.owner_id).select('owner_id')
      : db.from(TABLE).insert({ data: doc });

    return request.then(function (res) {
      if (res.error) {
        // Another device created the row between our read and write: run again as an update.
        if (!row && res.error.code === '23505') {
          rerun = true;
          return;
        }
        throw res.error;
      }
      if (row && (!res.data || res.data.length === 0)) {
        throw new Error('cloud row was not updated');
      }
      finish();
    });
  }

  // ---- public API ----
  function isDirty() {
    return !!readMeta().dirty;
  }

  /** Resolve once unsynced changes have been pushed (or immediately if there are none). */
  function flush() {
    clearTimeout(pushTimer);
    pushTimer = null;
    pushDue = 0;
    return isDirty() ? syncNow() : Promise.resolve();
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;

    // Let the app render first; the SDK download and the first round trip can wait a moment.
    setTimeout(syncNow, 800);

    function pushIfDirty() {
      if (isDirty() && !running) syncNow();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pushIfDirty();
      else if (Date.now() - lastSyncAt > PULL_INTERVAL) syncNow();
    });
    window.addEventListener('online', function () { syncNow(); });
    window.addEventListener('pagehide', pushIfDirty);
  }

  window.Sync = {
    start: start,
    touch: touch,
    flush: flush,
    syncNow: syncNow,
    prepareFor: prepareFor
  };
})();
