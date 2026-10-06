/* TerraMine referral QR with centered miner logo (Oct 6, 2026).
 * Depends on js/vendor/qrcode.min.js (davidshimjs, CorrectLevel.H).
 * Logo overlays the center with a white pad (~20% of QR) for scanability.
 */
(function (w) {
  var SIZE = 220;
  var FRAME_PAD = 12; // inner gutter so border-radius does not clip QR corners
  var LOGO_SRC = '/images/mine-icons/miner-theme.png';
  var JOIN_BASE = 'https://terramine.app/join?ref=';

  function joinUrl(code) {
    return JOIN_BASE + encodeURIComponent(String(code || '').trim());
  }

  function activeCode(ud) {
    ud = ud || {};
    var vanity = String(ud.vanityCode || '').trim();
    if (vanity) return vanity;
    return String(ud.referralCode || '').trim();
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  /**
   * Render QR into hostEl (emptied first). Adds miner logo overlay.
   * Returns { code, url } or null if no code / QRCode missing.
   */
  function render(hostEl, ud) {
    if (!hostEl) return null;
    clear(hostEl);
    var code = activeCode(ud);
    if (!code) {
      hostEl.hidden = true;
      return null;
    }
    hostEl.hidden = false;
    if (typeof w.QRCode !== 'function') {
      hostEl.textContent = 'QR unavailable';
      return null;
    }

    var wrap = document.createElement('div');
    wrap.className = 'vc-qr-frame';
    var outer = SIZE + FRAME_PAD * 2;
    wrap.style.width = outer + 'px';
    wrap.style.height = outer + 'px';
    wrap.style.padding = FRAME_PAD + 'px';
    wrap.style.boxSizing = 'border-box';

    var qrHost = document.createElement('div');
    qrHost.className = 'vc-qr-canvas';
    wrap.appendChild(qrHost);

    var logoPad = document.createElement('div');
    logoPad.className = 'vc-qr-logo-pad';
    logoPad.setAttribute('aria-hidden', 'true');
    var logo = document.createElement('img');
    logo.src = LOGO_SRC;
    logo.alt = '';
    logo.width = 48;
    logo.height = 48;
    logo.decoding = 'async';
    logoPad.appendChild(logo);
    wrap.appendChild(logoPad);

    hostEl.appendChild(wrap);

    var url = joinUrl(code);
    // Recreate: QRCode appends into qrHost
    // eslint-disable-next-line no-new
    new w.QRCode(qrHost, {
      text: url,
      width: SIZE,
      height: SIZE,
      colorDark: '#0D1B2A',
      colorLight: '#ffffff',
      correctLevel: w.QRCode.CorrectLevel.H
    });

    // Prefer canvas sizing; hide duplicate img if library made both
    try {
      var canvases = qrHost.getElementsByTagName('canvas');
      var imgs = qrHost.getElementsByTagName('img');
      if (canvases[0]) {
        canvases[0].style.display = 'block';
        canvases[0].style.width = SIZE + 'px';
        canvases[0].style.height = SIZE + 'px';
      }
      if (imgs[0]) imgs[0].style.display = 'none';
    } catch (e) {}

    hostEl.setAttribute('data-ref-code', code);
    hostEl.setAttribute('data-join-url', url);
    return { code: code, url: url };
  }

  w.TMReferralQR = {
    SIZE: SIZE,
    FRAME_PAD: FRAME_PAD,
    joinUrl: joinUrl,
    activeCode: activeCode,
    render: render
  };
})(window);
