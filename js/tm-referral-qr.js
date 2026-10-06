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
    render: render
  };
})(window);
