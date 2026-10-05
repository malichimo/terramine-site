/* Portal Day / Dusk / Mine theme toggle. Persists via TMPrefs (tmPrefs cookie). */
(function (w, d) {
  'use strict';
  var KEY = 'terramine.portal.theme';
  var THEMES = ['day', 'dusk', 'mine'];
  var LABELS = { day: 'Day', dusk: 'Dusk', mine: 'Mine' };
  // Theme pill + Mine headlamp miner (data-tip); mouse-follow, not native title
  var TIP_SEL = '.theme-toggle-btn[data-tip], .mine-headlamp-miner[data-tip]';

  function normalize(t) {
    t = String(t || '').toLowerCase();
    if (t === 'coal') t = 'mine';
    return THEMES.indexOf(t) >= 0 ? t : 'day';
  }
  function current() {
    var fromDom = d.documentElement.getAttribute('data-theme');
    if (fromDom === 'coal') fromDom = 'mine';
    if (THEMES.indexOf(fromDom) >= 0) return fromDom;
    try {
      if (w.TMPrefs) {
        var v = TMPrefs.get(KEY, null);
        if (v == null) v = TMPrefs.getItem(KEY);
        return normalize(v);
      }
    } catch (e) {}
    return 'day';
  }
  function syncHeadlamp(theme) {
    try {
      if (w.MineHeadlamp && typeof w.MineHeadlamp.sync === 'function') {
        w.MineHeadlamp.sync(theme);
      }
    } catch (e) {}
  }
  function apply(theme, persist) {
    theme = normalize(theme);
    d.documentElement.setAttribute('data-theme', theme);
    d.querySelectorAll('.theme-toggle-btn[data-theme-set]').forEach(function (btn) {
      var on = btn.getAttribute('data-theme-set') === theme;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
      btn.removeAttribute('title');
    });
    if (persist !== false) {
      try { if (w.TMPrefs) TMPrefs.set(KEY, theme); } catch (e) {}
    }
    syncHeadlamp(theme);
  }

  /* ── Mouse-follow tips (same pattern as map-pin / share tips) ───────────── */
  var tipEl = null, tipTarget = null, tipShowTimer = null, tipHideTimer = null;
  var tipX = 0, tipY = 0, tipTouchAt = 0;
  function tipOf(t) {
    return t && t.nodeType === 1 && t.closest ? t.closest(TIP_SEL) : null;
  }
  function ensureTip() {
    if (!tipEl) {
      tipEl = d.createElement('div');
      tipEl.className = 'toolbar-follow-tip theme-follow-tip';
      tipEl.setAttribute('role', 'tooltip');
      d.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function placeTip() {
    var tip = ensureTip(), gap = 14, edge = 8;
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = tipX + gap, top = tipY + gap;
    if (left + tw > w.innerWidth - edge) left = tipX - gap - tw;
    if (top + th > w.innerHeight - edge) top = tipY - gap - th;
    if (left < edge) left = edge;
    if (top < edge) top = edge;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.visibility = 'visible';
  }
  function hideTip() {
    if (tipShowTimer) { clearTimeout(tipShowTimer); tipShowTimer = null; }
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    tipTarget = null;
    if (tipEl) tipEl.style.display = 'none';
  }
  function bindTips() {
    if (d.documentElement.dataset.themeTipsBound === '1') return;
    d.documentElement.dataset.themeTipsBound = '1';
    d.addEventListener('touchstart', function () { tipTouchAt = Date.now(); }, { passive: true, capture: true });
    d.addEventListener('mouseover', function (e) {
      var el = tipOf(e.target);
      if (!el || el === tipTarget) return;
      hideTip();
      var fromTap = Date.now() - tipTouchAt < 1000;
      tipTarget = el;
      tipX = e.clientX; tipY = e.clientY;
      var tip = ensureTip();
      tip.textContent = (el.getAttribute('data-tip') || '').trim();
      tip.style.display = 'none';
      tipShowTimer = setTimeout(function () {
        tipShowTimer = null;
        if (tipTarget !== el || !el.isConnected) return;
        placeTip();
        if (fromTap) tipHideTimer = setTimeout(function () { if (tipTarget === el) hideTip(); }, 1500);
      }, 200);
    }, true);
    d.addEventListener('mousemove', function (e) {
      if (!tipTarget) return;
      tipX = e.clientX; tipY = e.clientY;
      if (tipEl && tipEl.style.display === 'block' && !tipShowTimer) placeTip();
    }, { passive: true, capture: true });
    d.addEventListener('mouseout', function (e) {
      if (!tipTarget) return;
      var to = e.relatedTarget;
      if (tipOf(e.target) === tipTarget && !(to && tipTarget.contains(to))) {
        if (Date.now() - tipTouchAt < 1000) return;
        hideTip();
      }
    }, true);
    d.addEventListener('click', function (e) {
      if (tipTarget && tipOf(e.target) === tipTarget && Date.now() - tipTouchAt >= 1000) hideTip();
    }, true);
    w.addEventListener('scroll', function () {
      if (tipTarget && Date.now() - tipTouchAt >= 1000) hideTip();
    }, { passive: true, capture: true });
  }

  function bind() {
    d.querySelectorAll('.theme-toggle').forEach(function (wrap) {
      if (wrap.dataset.themeBound === '1') return;
      wrap.dataset.themeBound = '1';
      wrap.querySelectorAll('.theme-toggle-btn[data-theme-set]').forEach(function (btn) {
        btn.removeAttribute('title');
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          apply(btn.getAttribute('data-theme-set'), true);
        });
      });
    });
    bindTips();
    apply(current(), true);
  }
  w.PortalTheme = { KEY: KEY, THEMES: THEMES, LABELS: LABELS, apply: apply, current: current, bind: bind };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window, document);
