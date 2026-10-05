/* TerraMine page settings, kept in ONE first-party cookie: tmPrefs (Oct 5, 2026).
 *
 * Value = JSON object with short keys (see ALIAS), URL-encoded; Max-Age 1 year,
 * Path=/, SameSite=Lax (+ Secure on https). Every write re-reads the cookie first,
 * so two open tabs do not wipe each other's settings.
 *
 * Size: browsers allow ~4 KB per cookie. The settings are small (a few hundred
 * bytes; the longest value is the 100-character bulk greeting). If the encoded
 * cookie ever passes SPILL_AT bytes, the largest values move to localStorage
 * (tmPrefs.spill) and the cookie lists their keys under "~"; reads merge them back.
 * If cookies are blocked, values fall back to localStorage under their own keys.
 *
 * API (string-compatible with the old sessionStorage calls):
 *   TMPrefs.getItem(key)  -> string | null     TMPrefs.setItem(key, string)
 *   TMPrefs.get(key, def) -> any               TMPrefs.set(key, value)   TMPrefs.remove(key)
 * Old per-tab sessionStorage / localStorage values under the same key are moved
 * into the cookie on first read (once), then the cookie wins.
 *
 * Also binds, on any page that has them, the Bulk Rename checkboxes (last used
 * state, not the name text) and the Bulk Greeting text (last typed greeting).
 */
(function (w, d) {
  'use strict';
  var NAME = 'tmPrefs';
  var MAX_AGE = 31536000;          // 1 year
  var SPILL_AT = 3800;             // bytes of encoded cookie value
  var SPILL_KEY = 'tmPrefs.spill';
  var ALIAS = {
    'terramine.mines.typeOrderFlipped': 'mf',   // mines + dashboard: Reverse (type group order)
    'terramine.mines.ungrouped': 'mu',          // mines: all mines in 1 group
    'terramine.mines.filterTypes': 'mt',        // mines: type filter buttons
    'terramine.mines.typesVer': 'tv',           // one-time heal for type-filter defaults
    'terramine.mines.filterShowcase': 'ms',     // mines: visitor pinned image filter
    'terramine.mines.filterUnnamed': 'mn',      // mines: Unnamed filter
    'terramine.mines.sort': 'mo',               // mines: sort key + direction
    'terramine.mines.search': 'mq',             // mines: search box
    'terramine.mines.display': 'md',            // gear: Production Calculations Display (mines + dashboard)
    'terramine.mines.compare': 'mc',            // dashboard: compare pill
    'terramine.visitors.filterTypes': 'vt',     // visitors + activity: type filter (shared, as before)
    'terramine.visitors.sort': 'vo',
    'terramine.visitors.search': 'vq',
    'terramine.activity.sort': 'ao',
    'terramine.activity.search': 'aq',
    'terramine.inventory.search': 'iq',
    'terramine.mineMap.zoom': 'pz',             // pop-up / full map: zoom
    'terramine.mineMap.buildings': 'pb',        //   Buildings on/off
    'terramine.mineMap.labels': 'pl',           //   Labels on/off
    'terramine.mineMap.radius': 'pr',           //   Load Area radius (miles)
    'terramine.mineMap.reach': 'px',            //   full map: Reach on/off
    'terramine.bulkRename.checks': 'br',        // Bulk Rename checkboxes
    'terramine.bulkGreet.text': 'bg'            // Bulk Greeting text
  };
  function code(key) { return ALIAS[key] || String(key); }
  function store(kind) { try { return w[kind]; } catch (e) { return null; } }

  // Fully encode the JSON (quotes, commas, braces). Partial decode of {}[]: made
  // some browsers/proxies mangle values; full encodeURIComponent is safe in document.cookie.
  function encode(obj) {
    return encodeURIComponent(JSON.stringify(obj));
  }
  function rawCookie() {
    var m = String(d.cookie || '').match(new RegExp('(?:^|;\\s*)' + NAME + '=([^;]*)'));
    return m ? m[1] : null;
  }
  function readAll() {
    var obj = {};
    var raw = rawCookie();
    if (raw) {
      try {
        var o = JSON.parse(decodeURIComponent(raw));
        if (o && typeof o === 'object' && !Array.isArray(o)) obj = o;
      } catch (e) {}
    }
    if (Array.isArray(obj['~'])) {
      var spill = {};
      try { spill = JSON.parse((store('localStorage') || { getItem: function () { return null; } }).getItem(SPILL_KEY) || '{}') || {}; } catch (e) {}
      obj['~'].forEach(function (k) { if (Object.prototype.hasOwnProperty.call(spill, k)) obj[k] = spill[k]; });
    }
    delete obj['~'];
    return obj;
  }
  function writeCookie(value, maxAge) {
    var secure = (w.location && w.location.protocol === 'https:') ? '; Secure' : '';
    d.cookie = NAME + '=' + value + '; Max-Age=' + maxAge + '; Path=/; SameSite=Lax' + secure;
  }
  function writeAll(obj) {
    var keep = {}, spill = {}, k;
    for (k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) keep[k] = obj[k];
    var enc = encode(keep);
    if (enc.length > SPILL_AT) {
      var keys = Object.keys(keep).sort(function (a, b) { return JSON.stringify(keep[b]).length - JSON.stringify(keep[a]).length; });
      var moved = [];
      while (enc.length > SPILL_AT && keys.length) {
        k = keys.shift();
        spill[k] = keep[k]; delete keep[k]; moved.push(k);
        keep['~'] = moved;
        enc = encode(keep);
      }
    }
    var ls = store('localStorage');
    try { if (ls) { if (Object.keys(spill).length) ls.setItem(SPILL_KEY, JSON.stringify(spill)); else ls.removeItem(SPILL_KEY); } } catch (e) {}
    writeCookie(enc, MAX_AGE);
    return rawCookie() === enc;
  }
  function cookiesWork() {
    try { return navigator.cookieEnabled !== false; } catch (e) { return true; }
  }

  function get(key, def) {
    var c = code(key);
    var all = readAll();
    if (Object.prototype.hasOwnProperty.call(all, c)) return all[c];
    // One-time migration: old per-tab (sessionStorage) or localStorage value under the same key.
    var kinds = ['sessionStorage', 'localStorage'];
    for (var i = 0; i < kinds.length; i++) {
      var s = store(kinds[i]);
      if (!s) continue;
      var raw = null;
      try { raw = s.getItem(key); } catch (e) {}
      if (raw == null) continue;
      var v = parse(raw);
      if (set(key, v)) { try { s.removeItem(key); } catch (e) {} }
      return v;
    }
    return def === undefined ? null : def;
  }
  function set(key, value) {
    var c = code(key);
    var all = readAll();
    all[c] = value;
    var ok = cookiesWork() && writeAll(all);
    if (!ok) { // cookies blocked: keep the setting working in localStorage
      var ls = store('localStorage');
      try { if (ls) ls.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {}
    }
    return ok;
  }
  function remove(key) {
    var all = readAll();
    delete all[code(key)];
    if (Object.keys(all).length) writeAll(all); else writeCookie('', 0);
  }
  function parse(raw) {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  // String-compatible wrappers: '1' / '[...]' / '{...}' are stored as JSON values (compact),
  // and come back as the same strings.
  function getItem(key) {
    var v = get(key, null);
    if (v === null || v === undefined) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  function setItem(key, str) { return set(key, parse(String(str))); }

  // ── Bulk Rename checkboxes + Bulk Greeting text (mines, visitors, activity, full map) ──
  var BR_IDS = { r: 'mine-map-bulk-rename-random', t: 'mine-map-bulk-rename-append-type', s: 'mine-map-bulk-rename-seq', p: 'mine-map-bulk-rename-pad', d: 'mine-map-bulk-rename-bydate' };
  var BR_KEY = 'terramine.bulkRename.checks', BG_KEY = 'terramine.bulkGreet.text';
  function el(id) { return d.getElementById(id); }
  function saveBulkRenameChecks() {
    var o = {};
    Object.keys(BR_IDS).forEach(function (k) { var e = el(BR_IDS[k]); o[k] = e && e.checked ? 1 : 0; });
    set(BR_KEY, o);
  }
  function restoreBulkRenameChecks() {
    var o = get(BR_KEY, null);
    if (!o || typeof o !== 'object') return;
    // Order matters: Random, Append type, Numbering (reveals Pad / Purchase order), then those two.
    ['r', 't', 's', 'p', 'd'].forEach(function (k) {
      var e = el(BR_IDS[k]);
      if (!e || e.disabled) return;
      var want = !!o[k];
      if (e.checked === want) return;
      e.checked = want;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function restoreBulkGreetText() {
    var ta = el('mine-map-bulk-greet-input');
    if (!ta || ta.value) return;
    var t = get(BG_KEY, null);
    if (typeof t !== 'string' || !t) return;
    var max = Number(ta.getAttribute('maxlength')) || 100;
    ta.value = t.slice(0, max);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Restore right after the page opens a dialog (it clears the fields first, then un-hides it).
  function onShown(dlg, fn) {
    if (!dlg || typeof MutationObserver !== 'function') return;
    var wasHidden = dlg.hidden;
    new MutationObserver(function () {
      if (wasHidden && !dlg.hidden) fn();
      wasHidden = dlg.hidden;
    }).observe(dlg, { attributes: true, attributeFilter: ['hidden'] });
  }
  function bindBulkTools() {
    var renameDlg = el('mine-map-bulk-rename');
    if (renameDlg && renameDlg.dataset.tmPrefsBound !== '1') {
      renameDlg.dataset.tmPrefsBound = '1';
      Object.keys(BR_IDS).forEach(function (k) {
        var e = el(BR_IDS[k]);
        // after the page's own change handlers (Numbering off also clears Pad / Purchase order)
        if (e) e.addEventListener('change', function () { setTimeout(saveBulkRenameChecks, 0); });
      });
      onShown(renameDlg, restoreBulkRenameChecks);
    }
    var greetDlg = el('mine-map-bulk-greet');
    var ta = el('mine-map-bulk-greet-input');
    if (greetDlg && ta && greetDlg.dataset.tmPrefsBound !== '1') {
      greetDlg.dataset.tmPrefsBound = '1';
      ta.addEventListener('input', function () { set(BG_KEY, String(ta.value || '')); });
      onShown(greetDlg, restoreBulkGreetText);
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bindBulkTools);
  else bindBulkTools();

  // Mine type filter chips: all four ON when unset. tv=1 marks the one-time heal after
  // the first cookie launch (partial mt lists without "diamond" were sticky for 1 year).
  var MINE_TYPES = ['diamond', 'gold', 'coal', 'rock'];
  var TYPES_VER = 1;
  function healMineTypeFilters() {
    var ver = get('terramine.mines.typesVer', null);
    if (ver === TYPES_VER) return;
    // Reset mt to all four once so a leftover session/cookie subset cannot hide Diamond.
    set('terramine.mines.filterTypes', MINE_TYPES.slice());
    set('terramine.mines.typesVer', TYPES_VER);
  }
  try { healMineTypeFilters(); } catch (e) {}

  w.TMPrefs = {
    NAME: NAME, ALIAS: ALIAS, MINE_TYPES: MINE_TYPES,
    get: get, set: set, remove: remove, getItem: getItem, setItem: setItem,
    all: readAll, size: function () { return (rawCookie() || '').length; },
    bindBulkTools: bindBulkTools, healMineTypeFilters: healMineTypeFilters
  };
})(window, document);
