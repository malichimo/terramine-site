/*
 * Map pin follow tip — mine / Visitor / Activity cards (mines.html, visitors.html, activity.html).
 * Any <button class="vo-pin|gps-pin" data-tip="…"> gets the site's mouse-follow tooltip
 * (.toolbar-follow-tip style, 200 ms delay, follows the cursor) instead of a native title.
 * Delegated on the document, so cards rendered later need no binding.
 * Touch: a tap shows the tip briefly (hidden after 1.5 s) while the pin's own action still runs.
 * Mouse click hides it so it never sits on top of the map that opens.
 */
(function () {
  if (window.__tmMapPinTip) return;
  window.__tmMapPinTip = true;
  var SEL = 'button.vo-pin[data-tip], button.gps-pin[data-tip]';
  var tipEl = null, target = null, showTimer = null, hideTimer = null, x = 0, y = 0, touchAt = 0;
  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'toolbar-follow-tip map-pin-follow-tip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function place() {
    var tip = ensureTip(), gap = 14, edge = 8;
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + gap, top = y + gap;
    if (left + w > window.innerWidth - edge) left = x - gap - w;
    if (top + h > window.innerHeight - edge) top = y - gap - h;
    if (left < edge) left = edge;
    if (top < edge) top = edge;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.visibility = 'visible';
  }
  function hide() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    target = null;
    if (tipEl) tipEl.style.display = 'none';
  }
  function pinOf(t) { return t && t.nodeType === 1 && t.closest ? t.closest(SEL) : null; }
  document.addEventListener('touchstart', function () { touchAt = Date.now(); }, { passive: true, capture: true });
  document.addEventListener('mouseover', function (e) {
    var pin = pinOf(e.target);
    if (!pin || pin === target) return;
    hide();
    var fromTap = Date.now() - touchAt < 1000;   // emulated mouseover of a tap
    target = pin;
    x = e.clientX; y = e.clientY;
    var tip = ensureTip();
    tip.textContent = (pin.getAttribute('data-tip') || '').trim();
    tip.style.display = 'none';
    showTimer = setTimeout(function () {
      showTimer = null;
      if (target !== pin || !pin.isConnected) return;
      place();
      if (fromTap) hideTimer = setTimeout(function () { if (target === pin) hide(); }, 1500);
    }, 200);
  }, true);
  document.addEventListener('mousemove', function (e) {
    if (!target) return;
    x = e.clientX; y = e.clientY;
    if (tipEl && tipEl.style.display === 'block' && !showTimer) place();
  }, { passive: true, capture: true });
  document.addEventListener('mouseout', function (e) {
    if (!target) return;
    var to = e.relatedTarget;
    if (pinOf(e.target) === target && !(to && target.contains(to))) {
      if (Date.now() - touchAt < 1000) return;   // tap: the timer hides it
      hide();
    }
  }, true);
  document.addEventListener('click', function (e) {
    if (target && pinOf(e.target) === target && Date.now() - touchAt >= 1000) hide();
  }, true);
  window.addEventListener('scroll', function () { if (target && Date.now() - touchAt >= 1000) hide(); }, { passive: true, capture: true });
})();
