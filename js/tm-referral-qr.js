/* TerraMine referral QR with centered character logo (Oct 6, 2026).
 * Depends on js/vendor/qrcode.min.js (davidshimjs, CorrectLevel.H).
 * Regular QR: miner-theme.png. Vanity QR: terrawife.png (only when claimed).
 */
(function (w) {
  var SIZE = 210;
  var FRAME_PAD = 12;
  var LOGO_MINER = '/images/mine-icons/miner-theme.png';
  var LOGO_TERRAWIFE = '/images/mine-icons/terrawife.png';
  var JOIN_BASE = 'https://terramine.app/join?ref=';

  function joinUrl(code) {
    return JOIN_BASE + encodeURIComponent(String(code || '').trim());
  }

  function regularCode(ud) {
    return String((ud && ud.referralCode) || '').trim();
  }

  function vanityCode(ud) {
    return String((ud && ud.vanityCode) || '').trim();
  }

  function resolveCode(udOrCode) {
    if (typeof udOrCode === 'string') return String(udOrCode || '').trim();
    return regularCode(udOrCode);
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  /**
   * Render QR into hostEl (emptied first).
   * opts.logo: image URL for center (default miner).
   * opts.size: QR module size (default SIZE).
   * Returns { code, url } or null.
   */
  function render(hostEl, udOrCode, opts) {
    if (!hostEl) return null;
    clear(hostEl);
    opts = opts || {};
    var size = Number(opts.size) > 0 ? Math.round(opts.size) : SIZE;
    var pad = FRAME_PAD;
    var logoSrc = opts.logo || LOGO_MINER;
    var code = resolveCode(udOrCode);
    if (!code) {
      hostEl.hidden = true;
      hostEl.removeAttribute('data-ref-code');
      hostEl.removeAttribute('data-join-url');
      return null;
    }
    hostEl.hidden = false;
    if (typeof w.QRCode !== 'function') {
      hostEl.textContent = 'QR unavailable';
      return null;
    }

    var wrap = document.createElement('div');
    wrap.className = 'vc-qr-frame';
    var outer = size + pad * 2;
    wrap.style.width = outer + 'px';
    wrap.style.height = outer + 'px';
    wrap.style.padding = pad + 'px';
    wrap.style.boxSizing = 'border-box';

    var qrHost = document.createElement('div');
    qrHost.className = 'vc-qr-canvas';
    wrap.appendChild(qrHost);

    var logoPad = document.createElement('div');
    logoPad.className = 'vc-qr-logo-pad';
    logoPad.setAttribute('aria-hidden', 'true');
    var logo = document.createElement('img');
    logo.src = logoSrc;
    logo.alt = '';
    logo.width = 48;
    logo.height = 48;
    logo.decoding = 'async';
    logoPad.appendChild(logo);
    wrap.appendChild(logoPad);

    hostEl.appendChild(wrap);

    var url = joinUrl(code);
    // eslint-disable-next-line no-new
    new w.QRCode(qrHost, {
      text: url,
      width: size,
      height: size,
      colorDark: '#0D1B2A',
      colorLight: '#ffffff',
      correctLevel: w.QRCode.CorrectLevel.H
    });

    try {
      var canvases = qrHost.getElementsByTagName('canvas');
      var imgs = qrHost.getElementsByTagName('img');
      if (canvases[0]) {
        canvases[0].style.display = 'block';
        canvases[0].style.width = size + 'px';
        canvases[0].style.height = size + 'px';
      }
      // Hide QRCode lib's duplicate img; keep our logo img inside .vc-qr-logo-pad
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].closest || !imgs[i].closest('.vc-qr-logo-pad')) {
          imgs[i].style.display = 'none';
        }
      }
    } catch (e) {}

    hostEl.setAttribute('data-ref-code', code);
    hostEl.setAttribute('data-join-url', url);
    return { code: code, url: url };
  }


  // ── Copy QR image (Oct 6, 2026) ─────────────────────────────────────────
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('logo load failed: ' + src)); };
      im.src = src; // same-origin → canvas stays untainted
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /**
   * Build a PNG blob of the rendered QR in hostEl: white rounded frame + 12px
   * gutter, QR modules, centered logo on its white pad, and the
   * "Scan to join · CODE" caption underneath.
   */
  function toPngBlob(hostEl, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (!hostEl) return reject(new Error('no QR host'));
      var qrCanvas = hostEl.querySelector('.vc-qr-canvas canvas');
      var logoEl = hostEl.querySelector('.vc-qr-logo-pad img');
      if (!qrCanvas) return reject(new Error('QR not rendered'));
      var code = hostEl.getAttribute('data-ref-code') || '';
      var logoSrc = (logoEl && logoEl.getAttribute('src')) || opts.logo || LOGO_MINER;
      var caption = opts.caption || (code ? ('Scan to join \u00b7 ' + code) : 'Scan to join');

      loadImg(logoSrc).then(function (logo) {
        var S = 3;                       // export scale (crisp modules)
        var qr = SIZE, pad = FRAME_PAD;
        var frame = qr + pad * 2;        // 234
        var margin = 10, capH = 28;
        var W = frame + margin * 2, H = frame + margin * 2 + capH;
        var c = document.createElement('canvas');
        c.width = W * S; c.height = H * S;
        var ctx = c.getContext('2d');
        ctx.scale(S, S);

        // card background (white, rounded)
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 0, 0, W, H, 14); ctx.fill();
        // frame border
        ctx.strokeStyle = '#d7dee8'; ctx.lineWidth = 1;
        roundRect(ctx, margin + 0.5, margin + 0.5, frame - 1, frame - 1, 12); ctx.stroke();

        // QR modules (no smoothing)
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrCanvas, margin + pad, margin + pad, qr, qr);
        ctx.imageSmoothingEnabled = true;

        // logo pad (52px white rounded box, 5px padding, +3px white halo)
        var lp = 52, lpad = 5;
        var cx = margin + frame / 2, cy = margin + frame / 2;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, cx - lp / 2 - 3, cy - lp / 2 - 3, lp + 6, lp + 6, 12); ctx.fill();
        var box = lp - lpad * 2;
        var ratio = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
        var lw = logo.naturalWidth * ratio, lh = logo.naturalHeight * ratio;
        ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);

        // caption
        ctx.fillStyle = '#334155';
        ctx.font = '700 12px "DM Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(caption, W / 2, margin + frame + capH / 2 + 2);

        c.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('toBlob failed'));
        }, 'image/png');
      }).catch(reject);
    });
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name || 'terramine-qr.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /** Copy QR PNG to clipboard; falls back to download. Resolves 'copied' | 'downloaded'. */
  function copyImage(hostEl, opts) {
    opts = opts || {};
    var code = (hostEl && hostEl.getAttribute('data-ref-code')) || 'qr';
    var fileName = 'terramine-' + String(code).toLowerCase().replace(/[^a-z0-9-]/g, '') + '-qr.png';
    var blobP = toPngBlob(hostEl, opts);
    var canClip = !!(navigator.clipboard && navigator.clipboard.write && w.ClipboardItem);
    if (canClip) {
      var item;
      try { item = new w.ClipboardItem({ 'image/png': blobP }); } catch (e) { item = null; }
      if (item) {
        return navigator.clipboard.write([item]).then(function () { return 'copied'; })
          .catch(function () {
            return blobP.then(function (b) { downloadBlob(b, fileName); return 'downloaded'; });
          });
      }
    }
    return blobP.then(function (b) { downloadBlob(b, fileName); return 'downloaded'; });
  }

  w.TMReferralQR = {
    SIZE: SIZE,
    FRAME_PAD: FRAME_PAD,
    LOGO_MINER: LOGO_MINER,
    LOGO_TERRAWIFE: LOGO_TERRAWIFE,
    joinUrl: joinUrl,
    regularCode: regularCode,
    vanityCode: vanityCode,
    activeCode: regularCode,
    resolveCode: resolveCode,
    render: render,
    toPngBlob: toPngBlob,
    copyImage: copyImage
  };
})(window);
