/*
 * FREAK צוות — pure logic (no DOM, no storage, no network), shared by the page and by the Node tests.
 * Everything a person can type or that comes back from this phone's storage passes through here before it is shown.
 */
(function (root) {
  'use strict';

  var LIVE_HOST = 'epic-pita.github.io';
  var MAX_MY = 12, MAX_NAME = 24, MAX_URL = 600;

  /** A catalog path → the address to open. On the live origin it stays a same-origin path (so the installed app keeps
   *  the page in its own window); anywhere else (a local preview) it points at the live origin. */
  function hrefFor(path, host, origin) {
    var p = String(path || '');
    if (!/^\/(freak-schedule|freak-pos)\/[A-Za-z0-9._\/-]*$/.test(p) || /\.\.|\/\//.test(p)) return '';
    return host === LIVE_HOST ? path : (origin || 'https://' + LIVE_HOST) + path;
  }

  /** A typed button name: trimmed, control characters out, cut to MAX_NAME. '' when nothing is left. */
  function cleanName(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }

  /** A typed address: https only, parsed by the platform, no user:password part. '' when it is not acceptable. */
  function cleanUrl(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t || t.length > MAX_URL || /[\s<>"'`\\]/.test(t)) return '';
    var u;
    try { u = new URL(t); } catch (e) { return ''; }
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return '';
    return u.href;
  }

  /** A pasted slot address is accepted only when it has the shape of that kind of page. */
  function slotUrl(kinds, kind, s) {
    var k = kinds && kinds[kind];
    var u = cleanUrl(s);
    return k && u && k.re.test(u) ? u : '';
  }

  /** The stored list of personal buttons, checked item by item (storage is not trusted). */
  function cleanMy(list) {
    var out = [], seen = {};
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < MAX_MY; i++) {
      var it = list[i] || {};
      var he = cleanName(it.he), url = cleanUrl(it.url);
      if (!he || !url || seen[url]) continue;
      seen[url] = 1;
      out.push({ he: he, url: url });
    }
    return out;
  }

  /** The stored slot addresses, kept only for slots that exist in the catalog and only in the right shape. */
  function cleanSlots(catalog, obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    eachButton(catalog, function (b) {
      if (!b.slot) return;
      var u = slotUrl(catalog.slotKinds, b.slot, obj[b.id]);
      if (u) out[b.id] = u;
    });
    return out;
  }

  /** The stored group picks, kept only for optional groups that exist. null = never chosen (first run). */
  function cleanPicks(catalog, list) {
    if (!Array.isArray(list)) return null;
    var ok = Object.create(null);                               // no inherited keys: 'constructor' is not a group
    catalog.groups.forEach(function (g) { if (!g.fixed) ok[g.id] = 1; });
    var out = [];
    list.forEach(function (id) { if (typeof id === 'string' && ok[id] && out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  /** Groups to show, in catalog order: the fixed ones, and the optional ones this phone picked. */
  function shownGroups(catalog, picks) {
    var p = picks || [];
    return catalog.groups.filter(function (g) { return g.fixed || p.indexOf(g.id) >= 0; });
  }

  function optionalGroups(catalog) {
    return catalog.groups.filter(function (g) { return !g.fixed; });
  }

  /** First run: tick a group when this phone already holds that group's own key (presence only, never the value). */
  function firstPicks(catalog, has) {
    var out = [];
    if (has && (has.l1_key || has.fs_key)) out.push('owner');
    return cleanPicks(catalog, out) || [];
  }

  function addMy(list, he, url) {
    var cur = cleanMy(list);
    var n = cleanName(he), u = cleanUrl(url);
    if (!n) return { ok: false, why: 'name', list: cur };
    if (!u) return { ok: false, why: 'url', list: cur };
    if (cur.length >= MAX_MY) return { ok: false, why: 'full', list: cur };
    if (cur.some(function (x) { return x.url === u; })) return { ok: false, why: 'dup', list: cur };
    return { ok: true, list: cur.concat([{ he: n, url: u }]) };
  }

  function eachButton(catalog, fn) {
    catalog.groups.forEach(function (g) { g.buttons.forEach(function (b) { fn(b, g); }); });
  }

  /* ---------- part B: the sign-in ---------- */
  /** A short label for the sessions list, made here and never typed: "iPhone, Safari", "Android, Chrome app". */
  function deviceLabel(ua, standalone) {
    var u = String(ua || '');
    var os = /iPhone|iPad|iPod/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : 'Other';
    var br = /Edg\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'Other';
    return os + ', ' + br + (standalone ? ' app' : '');
  }

  /** The person's schedule key, from the key itself or from their personal schedule link. '' when it is neither. */
  function scheduleKeyFrom(text) {
    var t = String(text == null ? '' : text).trim();
    if (/^[A-Za-z0-9_-]{16,100}$/.test(t)) return t;
    var u;
    try { u = new URL(t); } catch (e) { return ''; }
    var k = u.searchParams.get('k') || '';
    return /^[A-Za-z0-9_-]{16,100}$/.test(k) ? k : '';
  }

  /** What to do with the stored session after an answer: only an explicit finding drops it; anything else keeps it. */
  function sessionFate(ans) {
    if (ans && ans.ok === true) return 'ok';
    var code = ans && ans.code;
    return code === 'signed_out' || code === 'not_active' ? 'drop' : 'keep';
  }

  /** The service's answer, checked field by field before anything is shown or stored (the network is not trusted). */
  function cleanAnswer(catalog, ans) {
    if (!ans || ans.ok !== true || !ans.me || typeof ans.me !== 'object') return null;
    var out = { name: typeof ans.me.name === 'string' ? cleanName(ans.me.name) : '', manager: ans.me.manager === true, dm: ans.me.dm === true, owner: ans.me.owner === true,
      groups: cleanPicks(catalog, ans.groups) || [], slots: {}, extra: [] };
    var slotKind = Object.create(null), taken = Object.create(null);
    eachButton(catalog, function (b) { taken[b.id] = 1; if (b.slot) slotKind[b.id] = b.slot; });
    (Array.isArray(ans.links) ? ans.links : []).slice(0, 20).forEach(function (l) {
      if (!l || typeof l.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(l.id)) return;
      if (slotKind[l.id]) {
        var su = slotUrl(catalog.slotKinds, slotKind[l.id], l.url);
        if (su) out.slots[l.id] = su;
        return;
      }
      if (taken[l.id]) return;                                   // a link may fill a slot, never replace a fixed button
      var he = cleanName(l.he), url = cleanUrl(l.url);
      if (!he || !url) return;
      taken[l.id] = 1;
      out.extra.push({ id: l.id, he: he, sub: cleanName(l.sub), url: url });
    });
    return out;
  }

  /** The nonce written inside a Google token (read, not checked: the service checks the token). '' when unreadable. */
  function tokenNonce(token) {
    var parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return '';
    try {
      var c = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return c && typeof c.nonce === 'string' ? c.nonce : '';
    } catch (e) { return ''; }
  }

  /** A stored or received session id: the shape the service gives, or ''. */
  function cleanSid(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(s) ? s : ''; }

  /** The checked answer as it was kept on this phone, checked again on the way back (storage is not trusted). */
  function cleanKept(catalog, k) {
    if (!k || typeof k !== 'object' || Array.isArray(k)) return null;
    var extra = [], seen = Object.create(null);
    eachButton(catalog, function (b) { seen[b.id] = 1; });
    (Array.isArray(k.extra) ? k.extra : []).slice(0, 20).forEach(function (x) {
      if (!x || typeof x.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(x.id) || seen[x.id]) return;
      var he = cleanName(x.he), url = cleanUrl(x.url);
      if (!he || !url) return;
      seen[x.id] = 1;
      extra.push({ id: x.id, he: he, sub: cleanName(x.sub), url: url });
    });
    return { name: typeof k.name === 'string' ? cleanName(k.name) : '', manager: k.manager === true, dm: k.dm === true, owner: k.owner === true,
      groups: cleanPicks(catalog, k.groups) || [], slots: cleanSlots(catalog, k.slots), extra: extra };
  }

  /** The usage table as the service sent it: rows checked one by one, newest week first, then the busiest, 300 at most. */
  function cleanUsage(rows) {
    if (!Array.isArray(rows)) return null;
    var out = [];
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object' || typeof r.week !== 'string' || typeof r.page !== 'string') return;
      if (!/^\d{4}-\d\d-\d\d$/.test(r.week) || !/^[a-z0-9_]{1,24}$/.test(r.page)) return;
      var n = Number(r.count);
      if (!isFinite(n) || n < 0) return;
      out.push({ week: r.week, page: r.page, role: typeof r.role === 'string' ? r.role : '', count: Math.floor(n) });
    });
    out.sort(function (a, b) { return a.week === b.week ? b.count - a.count : (a.week < b.week ? 1 : -1); });
    return out.slice(0, 300);
  }

  var API = {
    LIVE_HOST: LIVE_HOST, MAX_MY: MAX_MY, MAX_NAME: MAX_NAME,
    hrefFor: hrefFor, cleanName: cleanName, cleanUrl: cleanUrl, slotUrl: slotUrl,
    cleanMy: cleanMy, cleanSlots: cleanSlots, cleanPicks: cleanPicks,
    shownGroups: shownGroups, optionalGroups: optionalGroups, firstPicks: firstPicks, addMy: addMy, eachButton: eachButton,
    deviceLabel: deviceLabel, scheduleKeyFrom: scheduleKeyFrom, sessionFate: sessionFate, cleanAnswer: cleanAnswer,
    cleanSid: cleanSid, cleanKept: cleanKept, cleanUsage: cleanUsage, tokenNonce: tokenNonce
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FreakLogic = API;
})(typeof self !== 'undefined' ? self : this);
