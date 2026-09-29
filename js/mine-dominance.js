/*
 * Portal Dashboard — "Mine Dominance" card (Sep 29, 2026).
 *
 * Shows ONLY the user's Reach outline (same polygon + green style as the
 * full-map.html "Reach on" layer) on a muted Google Map, and the outline's
 * geodesic area in the title bar ("123.4 sq mi · 319.6 km²").
 *
 *  - Points: every owned mine's parcel corners (properties doc / _raw /
 *    propertyDetails `corners`, or nw/ne/se/sw, or a bounds box); mines with
 *    no corners contribute their center (centerLat/centerLng, lat/lng, …).
 *  - Outline: window.TerraMineReachHull.compute() (js/reach-hull.js, same
 *    defaults as full-map), convex-hull fallback.
 *  - Area: spherical polygon area on the WGS84 equatorial-radius sphere
 *    (R = 6,378,137 m, same model as google.maps.geometry.spherical.computeArea):
 *      A = |Σ (λ₂ − λ₁)(2 + sin φ₁ + sin φ₂)| · R² / 2
 *    sq mi = m² / 2,589,988.110336;  km² = m² / 1e6.
 *  - Map: loaded once (shared promise), disableDefaultUI + zoom buttons only,
 *    no markers/labels/mines. Initial fit: outline spans ~50% of the map box
 *    (fitBounds with 25% padding on each side, fractional zoom); re-fits
 *    whenever the map container's size changes.
 *
 * Exposes window.TerraMineDominance { render, geodesicAreaM2, formatArea, collectPoints }.
 */
(function (root) {
  'use strict';

  var GOOGLE_MAPS_API_KEY = 'AIzaSyC9jTXIb-HR9qvYueh8cBIs5EFenNPkX4Y'; // same key as full-map.html
  var EARTH_R = 6378137;
  var M2_PER_SQMI = 2589988.110336;
  var FIT_PAD_FRACTION = 0.25; // per side -> outline spans ~50% of the box
  var REACH_STYLE = {
    strokeColor: '#85bb65', strokeOpacity: 0.95, strokeWeight: 3,
    fillColor: '#85bb65', fillOpacity: 0.20, clickable: false, zIndex: 50
  };
  // full-map.html MINE_MAP_BASE_STYLE + labels off + buildings off (its defaults)
  var MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#e6e6e6' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f2f2f2' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b0b0b0' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e6e6e6' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#d9d9d9' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#d4d4d4' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8c8c8' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ebebeb' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#b8b8b8' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b0b8c0' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', elementType: 'geometry', stylers: [{ visibility: 'off' }] }
  ];

  var $ = function (id) { return document.getElementById(id); };

  // ── points ──
  function num(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function validLL(lat, lng) { return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0); }
  function asPoint(v) {
    if (v == null) return null;
    if (typeof v.lat === 'function' && typeof v.lng === 'function') {
      var a = num(v.lat()), b = num(v.lng());
      return validLL(a, b) ? { lat: a, lng: b } : null;
    }
    if (Array.isArray(v) && v.length >= 2) {
      var x = num(v[0]), y = num(v[1]);
      if (x != null && y != null && Math.abs(x) > 90 && validLL(y, x)) return { lat: y, lng: x };
      return validLL(x, y) ? { lat: x, lng: y } : null;
    }
    if (typeof v === 'object') {
      var lat = num(v.lat != null ? v.lat : (v.latitude != null ? v.latitude : (v._lat != null ? v._lat : v._latitude)));
      var lng = num(v.lng != null ? v.lng : (v.lon != null ? v.lon : (v.longitude != null ? v.longitude : (v._long != null ? v._long : v._longitude))));
      return validLL(lat, lng) ? { lat: lat, lng: lng } : null;
    }
    return null;
  }
  function pointList(raw) {
    if (raw == null) return null;
    var arr = raw;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { return null; } }
    if (!Array.isArray(arr)) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) { var p = asPoint(arr[i]); if (p) out.push(p); }
    return out.length >= 3 ? out : null;
  }
  function namedCorners(o) {
    var sets = [['nw', 'ne', 'se', 'sw'], ['NW', 'NE', 'SE', 'SW'], ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']];
    for (var i = 0; i < sets.length; i++) {
      var pts = sets[i].map(function (k) { return asPoint(o[k]); });
      if (pts.every(Boolean)) return pts;
    }
    return null;
  }
  function boundsCorners(o) {
    var b = o.bounds || o.boundingBox || o.bbox || o.geoBox;
    if (!b || typeof b !== 'object') return null;
    var s = num(b.minLat != null ? b.minLat : b.south), n = num(b.maxLat != null ? b.maxLat : b.north);
    var w = num(b.minLng != null ? b.minLng : b.west), e = num(b.maxLng != null ? b.maxLng : b.east);
    if (s == null || n == null || w == null || e == null || !(n > s) || w === e) return null;
    return [{ lat: n, lng: w }, { lat: n, lng: e }, { lat: s, lng: e }, { lat: s, lng: w }];
  }
  function centerOf(o) {
    var pairs = [['centerLat', 'centerLng'], ['centerLatitude', 'centerLongitude'], ['latitude', 'longitude'], ['lat', 'lng'], ['gpsLatitude', 'gpsLongitude']];
    for (var i = 0; i < pairs.length; i++) {
      var a = num(o[pairs[i][0]]), b = num(o[pairs[i][1]]);
      if (validLL(a, b)) return { lat: a, lng: b };
    }
    var nests = ['location', 'center', 'gps', 'position', 'coordinates', 'geo', 'latLng'];
    for (i = 0; i < nests.length; i++) { var p = o[nests[i]] && asPoint(o[nests[i]]); if (p) return p; }
    return null;
  }
  /** -> { points:[{lat,lng}], siteCount, located, total } */
  function collectPoints(props) {
    var points = [], sites = new Set(), located = 0;
    (props || []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var srcs = [m._raw, m, m._details].filter(function (x) { return x && typeof x === 'object'; });
      var corners = null, i;
      for (i = 0; i < srcs.length && !corners; i++) corners = pointList(srcs[i].corners) || namedCorners(srcs[i]) || boundsCorners(srcs[i]);
      for (i = 0; i < srcs.length && !corners; i++) {
        var loc = srcs[i].location || srcs[i].geometry || srcs[i].parcel;
        if (loc && typeof loc === 'object') corners = pointList(loc.corners) || (Array.isArray(loc) ? pointList(loc) : null);
      }
      var pts = corners;
      if (!pts) { var c = null; for (i = 0; i < srcs.length && !c; i++) c = centerOf(srcs[i]); if (c) pts = [c]; }
      if (!pts) return;
      located++;
      var la = 0, ln = 0;
      pts.forEach(function (p) { points.push(p); la += p.lat; ln += p.lng; });
      sites.add((la / pts.length).toFixed(7) + ',' + (ln / pts.length).toFixed(7));
    });
    return { points: points, siteCount: sites.size, located: located, total: (props || []).length };
  }

  // ── area ──
  function geodesicAreaM2(path) {
    if (!path || path.length < 3) return 0;
    var rad = Math.PI / 180, sum = 0;
    for (var i = 0, n = path.length; i < n; i++) {
      var p1 = path[i], p2 = path[(i + 1) % n];
      var dl = (p2.lng - p1.lng) * rad;
      if (dl > Math.PI) dl -= 2 * Math.PI; else if (dl < -Math.PI) dl += 2 * Math.PI;
      sum += dl * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad));
    }
    return Math.abs(sum * EARTH_R * EARTH_R / 2);
  }
  function fmtNum(v) {
    if (!(v > 0)) return '0';
    if (v < 0.01) return '<0.01';
    var d = v >= 1000 ? 0 : (v >= 10 ? 1 : 2);
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function formatArea(m2) {
    return fmtNum(m2 / M2_PER_SQMI) + ' sq mi \u00b7 ' + fmtNum(m2 / 1e6) + ' km\u00b2';
  }

  // ── Maps (loaded once) ──
  var mapsPromise = null;
  function loadMaps() {
    if (root.google && root.google.maps && root.google.maps.Map) return Promise.resolve();
    if (mapsPromise) return mapsPromise;
    mapsPromise = new Promise(function (resolve, reject) {
      var prev = root.__tmDominanceMapInit;
      root.__tmDominanceMapInit = function () {
        if (typeof prev === 'function') { try { prev(); } catch (e) {} }
        resolve();
      };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY)
        + '&callback=__tmDominanceMapInit&loading=async';
      s.async = true;
      s.defer = true;
      s.onerror = function () { mapsPromise = null; reject(new Error('Failed to load Google Maps')); };
      document.head.appendChild(s);
    });
    return mapsPromise;
  }

  var state = { map: null, poly: null, path: null, userMoved: false, fitting: false, ro: null, token: 0, fitW: 0, fitH: 0, roTimer: 0 };

  function setMsg(text, isError) {
    var el = $('dash-dominance-msg');
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ''; el.classList.remove('is-error'); return; }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
  }
  function setArea(text) { var el = $('dash-dominance-area'); if (el) el.textContent = text; }

  function fitToPath() {
    var map = state.map, path = state.path, el = $('dash-dominance-map');
    if (!map || !path || !el) return;
    var w = el.clientWidth, h = el.clientHeight;
    if (!(w > 0 && h > 0)) return;
    state.fitW = w; state.fitH = h;
    var b = new google.maps.LatLngBounds();
    path.forEach(function (p) { b.extend(p); });
    var pad = { top: Math.round(h * FIT_PAD_FRACTION), bottom: Math.round(h * FIT_PAD_FRACTION), left: Math.round(w * FIT_PAD_FRACTION), right: Math.round(w * FIT_PAD_FRACTION) };
    state.fitting = true;
    map.fitBounds(b, pad);
    google.maps.event.addListenerOnce(map, 'idle', function () { state.fitting = false; });
  }

  function ensureMap() {
    var el = $('dash-dominance-map');
    if (!el) throw new Error('Mine Dominance map element missing');
    if (state.map) return state.map;
    var map = new google.maps.Map(el, {
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: google.maps.ControlPosition ? { position: google.maps.ControlPosition.RIGHT_BOTTOM } : undefined,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false,
      scaleControl: false,
      cameraControl: false,
      panControl: false,
      keyboardShortcuts: false,
      clickableIcons: false,
      gestureHandling: 'cooperative', // page keeps scrolling; ctrl/two-finger to zoom
      isFractionalZoomEnabled: true,  // lets fitBounds hit ~50% instead of snapping
      tilt: 0,
      styles: MAP_STYLE,
      backgroundColor: '#e6e6e6',
      center: { lat: 39.5, lng: -98.35 },
      zoom: 4
    });
    map.addListener('dragstart', function () { state.userMoved = true; });
    map.addListener('zoom_changed', function () { if (!state.fitting) state.userMoved = true; });
    state.map = map;
    // Re-fit (outline back to ~50% of the box) whenever the map container's
    // size actually changes — breakpoint changes, rotation, window resize.
    if (typeof ResizeObserver === 'function') {
      state.ro = new ResizeObserver(function () {
        if (el.clientWidth === state.fitW && el.clientHeight === state.fitH) return;
        clearTimeout(state.roTimer);
        state.roTimer = setTimeout(function () {
          try { google.maps.event.trigger(map, 'resize'); } catch (e) {}
          fitToPath();
        }, 120);
      });
      state.ro.observe(el);
    } else {
      // no ResizeObserver: fall back to window resize / rotation
      var onWin = function () {
        clearTimeout(state.roTimer);
        state.roTimer = setTimeout(function () {
          if (el.clientWidth === state.fitW && el.clientHeight === state.fitH) return;
          try { google.maps.event.trigger(map, 'resize'); } catch (e) {}
          fitToPath();
        }, 150);
      };
      window.addEventListener('resize', onWin);
      window.addEventListener('orientationchange', onWin);
    }
    return map;
  }

  /** render(props, {preview}) — safe to call again (e.g. on reload). */
  async function render(props, opts) {
    opts = opts || {};
    var token = ++state.token;
    if (state.poly) { try { state.poly.setMap(null); } catch (e) {} state.poly = null; }
    state.path = null; state.userMoved = false;
    setArea('\u2014');
    setMsg('Loading map\u2026');
    var list = Array.isArray(props) ? props : [];
    if (!list.length) { setArea('0 sq mi \u00b7 0 km\u00b2'); setMsg('No mines yet'); return { state: 'empty' }; }

    var c = collectPoints(list);
    var path = null, method = null;
    try {
      var H = root.TerraMineReachHull;
      if (H && c.points.length) {
        var res = H.compute(c.points, { siteCount: c.siteCount });
        if (res && res.path && res.path.length >= 3) { path = res.path; method = res.method; }
        if (!path && H.convexHull) { path = H.convexHull(c.points); method = path ? 'convex' : null; }
      }
    } catch (e) { console.warn('Mine Dominance outline failed', e); path = null; }
    if (!path) {
      setArea('0 sq mi \u00b7 0 km\u00b2');
      setMsg(c.located ? 'Not enough mine locations to outline an area yet' : (opts.preview ? 'Preview: sample mines have no locations' : 'No mine locations found'));
      return { state: 'no-area', located: c.located };
    }
    var m2 = geodesicAreaM2(path);
    setArea(formatArea(m2));
    state.path = path;

    try {
      await loadMaps();
    } catch (e) {
      if (token === state.token) setMsg('Map unavailable right now \u2014 please try again later.', true);
      return { state: 'maps-error', areaM2: m2, method: method };
    }
    if (token !== state.token) return { state: 'stale' };
    try {
      var map = ensureMap();
      state.poly = new google.maps.Polygon(Object.assign({ paths: path, map: map }, REACH_STYLE));
      setMsg('');
      fitToPath();
    } catch (e) {
      console.warn('Mine Dominance map error', e);
      setMsg('Map unavailable right now \u2014 please try again later.', true);
      return { state: 'map-error', areaM2: m2, method: method };
    }
    return { state: 'ok', areaM2: m2, method: method, vertices: path.length };
  }

  root.TerraMineDominance = { render: render, geodesicAreaM2: geodesicAreaM2, formatArea: formatArea, collectPoints: collectPoints, _state: state };
}(typeof window !== 'undefined' ? window : this));
