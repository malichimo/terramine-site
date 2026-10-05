/* Mine theme headlamp: viewport-locked miner + cone light (Easy Mine style). */
(function (w, d) {
  'use strict';

  var ROOT_ID = 'mine-headlamp-root';
  var DELAY_MS = 500;
  var HALF_ANGLE = 0.62; // ~35.5° half → ~71° full cone
  var MINER_H = 140;
  // Headlamp local offset from miner center (sprite faces +X / right)
  var LAMP_OX = 18;
  var LAMP_OY = -42;

  var root = null;
  var darkEl = null;
  var coneGlow = null;
  var apexGlow = null;
  var miner = null;
  var delayTimer = null;
  var raf = 0;
  var active = false;
  var ptrX = null;
  var ptrY = null;
  var angle = 0;
  var targetAngle = 0;
  var vw = 0;
  var vh = 0;
  var PTR_OPTS = { passive: true };

  function ensureDom() {
    if (root && root.isConnected) return;
    root = d.getElementById(ROOT_ID);
    if (!root) {
      root = d.createElement('div');
      root.id = ROOT_ID;
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML =
        '<div class="mine-headlamp-cone-glow"></div>' +
        '<div class="mine-headlamp-apex-glow"></div>' +
        '<div class="mine-headlamp-dark"></div>' +
        '<img class="mine-headlamp-miner" src="/images/mine-icons/miner-theme.png?v=20261005-2" alt="" width="120" height="140" draggable="false" decoding="async">';
      d.body.appendChild(root);
    }
    darkEl = root.querySelector('.mine-headlamp-dark');
    coneGlow = root.querySelector('.mine-headlamp-cone-glow');
    apexGlow = root.querySelector('.mine-headlamp-apex-glow');
    miner = root.querySelector('.mine-headlamp-miner');
  }

  function size() {
    vw = w.innerWidth || d.documentElement.clientWidth || 0;
    vh = w.innerHeight || d.documentElement.clientHeight || 0;
  }

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function lerpAngle(a, b, t) {
    return a + normAngle(b - a) * t;
  }

  function conePoints(ax, ay, ang) {
    var reach = Math.sqrt(vw * vw + vh * vh) + 80;
    var a1 = ang - HALF_ANGLE;
    var a2 = ang + HALF_ANGLE;
    return {
      ax: ax, ay: ay,
      x1: ax + Math.cos(a1) * reach,
      y1: ay + Math.sin(a1) * reach,
      x2: ax + Math.cos(a2) * reach,
      y2: ay + Math.sin(a2) * reach
    };
  }

  function paint() {
    if (!root || !active) return;
    size();
    var cx = vw * 0.5;
    var cy = vh * 0.5;

    if (ptrX != null && ptrY != null) {
      targetAngle = Math.atan2(ptrY - cy, ptrX - cx);
    }
    angle = lerpAngle(angle, targetAngle, 0.22);

    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var mh = (miner && miner.getBoundingClientRect) ? miner.getBoundingClientRect().height : MINER_H;
    if (!mh || mh < 1) mh = MINER_H;
    var scale = mh / MINER_H;
    var ox = LAMP_OX * scale;
    var oy = LAMP_OY * scale;
    var ax = cx + ox * cos - oy * sin;
    var ay = cy + ox * sin + oy * cos;

    var c = conePoints(ax, ay, angle);
    // CSS path evenodd: full rect minus cone → only darkness remains (and receives hits)
    var path =
      'M0,0H' + vw + 'V' + vh + 'H0Z' +
      'M' + c.ax + ',' + c.ay +
      'L' + c.x1 + ',' + c.y1 +
      'L' + c.x2 + ',' + c.y2 + 'Z';
    if (darkEl) {
      darkEl.style.clipPath = 'path(evenodd, "' + path + '")';
      darkEl.style.webkitClipPath = 'path(evenodd, "' + path + '")';
    }

    // Warm cone wash (visual only) — triangle clipped
    if (coneGlow) {
      var conePath =
        'M' + c.ax + ',' + c.ay +
        'L' + c.x1 + ',' + c.y1 +
        'L' + c.x2 + ',' + c.y2 + 'Z';
      coneGlow.style.clipPath = 'path("' + conePath + '")';
      coneGlow.style.webkitClipPath = 'path("' + conePath + '")';
    }
    if (apexGlow) {
      apexGlow.style.left = ax + 'px';
      apexGlow.style.top = ay + 'px';
    }
    if (miner) {
      miner.style.transform =
        'translate(-50%, -50%) rotate(' + (angle * 180 / Math.PI) + 'deg)';
    }
  }

  function loop() {
    if (!active) return;
    paint();
    raf = w.requestAnimationFrame(loop);
  }

  function onPointer(e) {
    if (e.touches && e.touches.length) {
      ptrX = e.touches[0].clientX;
      ptrY = e.touches[0].clientY;
    } else if (typeof e.clientX === 'number') {
      ptrX = e.clientX;
      ptrY = e.clientY;
    }
  }

  function onResize() { size(); paint(); }

  function bindPointer(on) {
    var method = on ? 'addEventListener' : 'removeEventListener';
    w[method]('pointermove', onPointer, PTR_OPTS);
    w[method]('mousemove', onPointer, PTR_OPTS);
    w[method]('touchstart', onPointer, PTR_OPTS);
    w[method]('touchmove', onPointer, PTR_OPTS);
    w[method]('resize', onResize, PTR_OPTS);
  }

  function show() {
    if (active) return;
    ensureDom();
    size();
    active = true;
    d.documentElement.classList.add('mine-headlamp-on');
    root.classList.remove('is-visible');
    void root.offsetWidth;
    bindPointer(true);
    if (ptrX == null) {
      ptrX = vw * 0.85;
      ptrY = vh * 0.5;
      targetAngle = 0;
      angle = 0;
    }
    paint();
    raf = w.requestAnimationFrame(loop);
    w.requestAnimationFrame(function () {
      if (root) root.classList.add('is-visible');
    });
  }

  function start() {
    if (active || delayTimer) return;
    delayTimer = w.setTimeout(function () {
      delayTimer = null;
      if ((d.documentElement.getAttribute('data-theme') || '') === 'mine') {
        show();
      }
    }, DELAY_MS);
  }

  function stop() {
    if (delayTimer) {
      w.clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (raf) {
      w.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (active) bindPointer(false);
    active = false;
    d.documentElement.classList.remove('mine-headlamp-on');
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    darkEl = null;
    coneGlow = null;
    apexGlow = null;
    miner = null;
  }

  function sync(theme) {
    if (theme === 'mine') start();
    else stop();
  }

  w.MineHeadlamp = {
    start: start,
    stop: stop,
    sync: sync,
    isActive: function () { return active; }
  };
})(window, document);
