/* Portal Day / Dusk / Coal Mine theme toggle. Persists via TMPrefs (tmPrefs cookie). */
(function (w, d) {
  'use strict';
  var KEY = 'terramine.portal.theme';
  var THEMES = ['day', 'dusk', 'coal'];
  var LABELS = { day: 'Day', dusk: 'Dusk', coal: 'Coal Mine' };

  function normalize(t) {
    t = String(t || '').toLowerCase();
    return THEMES.indexOf(t) >= 0 ? t : 'day';
  }
  function current() {
    var fromDom = d.documentElement.getAttribute('data-theme');
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
  function apply(theme, persist) {
    theme = normalize(theme);
    d.documentElement.setAttribute('data-theme', theme);
    d.querySelectorAll('.theme-toggle-btn[data-theme-set]').forEach(function (btn) {
      var on = btn.getAttribute('data-theme-set') === theme;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    });
    if (persist !== false) {
      try { if (w.TMPrefs) TMPrefs.set(KEY, theme); } catch (e) {}
    }
  }
  function bind() {
    d.querySelectorAll('.theme-toggle').forEach(function (wrap) {
      if (wrap.dataset.themeBound === '1') return;
      wrap.dataset.themeBound = '1';
      wrap.querySelectorAll('.theme-toggle-btn[data-theme-set]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          apply(btn.getAttribute('data-theme-set'), true);
        });
      });
    });
    apply(current(), true);
  }
  w.PortalTheme = { KEY: KEY, THEMES: THEMES, LABELS: LABELS, apply: apply, current: current, bind: bind };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window, document);
