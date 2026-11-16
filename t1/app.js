/*
 * FREAK צוות — the page.
 * Part A: buttons to the existing pages. Part B (only when config.js carries the service's address and Google's client
 * id): one sign-in with Google, buttons by role from the sign-in service, a count of presses with no names.
 * What a person types, what is read back from storage and what the service answers is checked in logic.js before it is
 * shown or kept; nodes are built with createElement / textContent only (never from an HTML string).
 * Rule: a failed call never signs anyone out and never says "wrong"; only the service's explicit finding does.
 */
(function () {
  'use strict';
  // GitHub Pages sets no headers, so the page itself refuses to run inside another site's frame.
  if (window.top !== window.self) return;
  var L = window.FreakLogic, CAT = window.FREAK_PAGES, CFG = window.FREAK_CONFIG || {};
  var SIGNIN = !!(CFG.api && CFG.clientId);
  // Own storage keys, all with one prefix. Other pages on this origin keep theirs.
  var LS = { picks: 'freak_app_groups', slots: 'freak_app_slots', my: 'freak_app_my', sid: 'freak_app_session', me: 'freak_app_me' };
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function show(id, on) { $(id).classList.toggle('hide', !on); }
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function has(key) { try { return localStorage.getItem(key) !== null; } catch (e) { return false; } }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) { /* nothing to remove */ } }
  function write(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; }
    catch (e) { say('הטלפון לא שומר הגדרות (אולי גלישה פרטית). הכפתורים עובדים, אבל הבחירה לא תישמר.'); return false; }
  }
  function say(text) { var m = $('msg'); m.textContent = text || ''; m.classList.toggle('hide', !text); }
  /** A text from a fixed table by a key that came from outside: own keys only. */
  function pick(table, k, fallback) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(table, k) ? table[k] : fallback; }

  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var state = {
    picks: L.cleanPicks(CAT, read(LS.picks)),      // null = first run
    slots: L.cleanSlots(CAT, read(LS.slots)),
    my: L.cleanMy(read(LS.my)),
    sid: SIGNIN ? L.cleanSid(read(LS.sid)) : '',
    me: null                                       // the service's last good answer, checked
  };
  if (state.sid) state.me = L.cleanKept(CAT, read(LS.me));
  var firstRun = state.picks === null;
  if (firstRun) state.picks = L.firstPicks(CAT, { l1_key: has('l1_key'), fs_key: has('fs_key') });

  function signedIn() { return !!(state.sid && state.me); }
  // b1.6 (decided 16/11/2026, card L15-GUEST): once the sign-in is on, a phone that is not signed in gets no buttons, only the sign-in
  // box and the guides. Otherwise nobody has a reason to sign in and the use cannot be read. This hides the buttons on
  // this page; it does not lock the pages behind them (each still opens with its own link or code until it joins the
  // sign-in). With the sign-in off (config.js empty) nothing changes.
  function waiting() { return SIGNIN && !signedIn(); }
  function picksNow() { return signedIn() ? state.me.groups : state.picks; }
  function slotUrlNow(id) { return (signedIn() && state.me.slots[id]) || state.slots[id] || ''; }

  /* ---------- the service ---------- */
  function post(body) {
    var tries = 0;
    function once() {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, 30000);
      return fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: ctl.signal })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          // Google sometimes hands the POST over as a bare GET (the service then never saw the body): send it again.
          if (j && j.code === 'GET_NOT_POST' && ++tries < 3) return once();
          return j && typeof j === 'object' && !Array.isArray(j) ? j : { ok: false, code: 'retry' };
        })
        .catch(function () { return { ok: false, code: 'retry' }; })
        .finally(function () { clearTimeout(t); });
    }
    return once();
  }
  function countTap(page) {
    if (!SIGNIN || !navigator.sendBeacon) return;
    try { navigator.sendBeacon(CFG.api, new Blob([JSON.stringify({ a: 'tap', sid: state.sid, page: page })], { type: 'text/plain;charset=utf-8' })); }
    catch (e) { /* a count that is not sent changes nothing */ }
  }

  /* ---------- the buttons ---------- */
  function linkNode(page, title, sub, href, sameOrigin) {
    var a = el('a', 'btn' + (sameOrigin ? '' : ' out'));
    a.href = href;
    if (!sameOrigin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.appendChild(el('span', 't', title));
    if (sub) a.appendChild(el('span', 's', sub));
    a.addEventListener('click', function () { countTap(page); });
    return a;
  }
  function buttonNode(b) {
    if (b.path) {
      var href = L.hrefFor(b.path, location.hostname, CAT.origin);
      return href ? linkNode(b.id, b.he, b.sub, href, location.hostname === L.LIVE_HOST) : null;
    }
    var url = slotUrlNow(b.id);
    if (url) return linkNode(b.id, b.he, b.sub, url, false);
    var e = el('button', 'btn empty');
    e.type = 'button';
    e.appendChild(el('span', 't', b.he));
    e.appendChild(el('span', 's', 'להדביק את הקישור פעם אחת'));
    e.addEventListener('click', function () { openSetup(true); var i = $('slot_' + b.id); if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); } });
    return e;
  }
  function groupNode(g) {
    var box = el(g.folded ? 'details' : 'section', 'group');
    box.appendChild(el(g.folded ? 'summary' : 'h2', null, g.he));
    var grid = el('div', 'grid' + (g.folded ? ' list' : ''));
    g.buttons.forEach(function (b) { var n = buttonNode(b); if (n) grid.appendChild(n); });
    box.appendChild(grid);
    return box;
  }
  function plainGroup(title, items) {
    var box = el('section', 'group');
    box.appendChild(el('h2', null, title));
    var grid = el('div', 'grid');
    items.forEach(function (m) { grid.appendChild(linkNode(m.page, m.he, m.sub || '', m.url, false)); });
    box.appendChild(grid);
    return box;
  }
  function renderGroups() {
    var main = $('groups');
    clear(main);
    var shown = L.shownGroups(CAT, picksNow());
    if (!waiting()) {
      shown.filter(function (g) { return !g.folded; }).forEach(function (g) { main.appendChild(groupNode(g)); });
      if (signedIn() && state.me.extra.length) main.appendChild(plainGroup('עוד', state.me.extra.map(function (x) { return { page: x.id, he: x.he, sub: x.sub, url: x.url }; })));
      if (state.my.length) main.appendChild(plainGroup('הכפתורים שלי', state.my.map(function (m) { return { page: 'my', he: m.he, url: m.url }; })));
    }
    // the guides (the folded group) are help pages: they stay for everyone
    shown.filter(function (g) { return g.folded; }).forEach(function (g) { main.appendChild(groupNode(g)); });
  }

  /* ---------- the setup panel ---------- */
  function renderPicks() {
    var box = $('picks');
    clear(box);
    L.optionalGroups(CAT).forEach(function (g) {
      var row = el('label', 'pick');
      var c = el('input');
      c.type = 'checkbox';
      c.checked = state.picks.indexOf(g.id) >= 0;
      c.addEventListener('change', function () {
        var p = state.picks.filter(function (x) { return x !== g.id; });
        if (c.checked) p.push(g.id);
        state.picks = L.cleanPicks(CAT, p) || [];
        write(LS.picks, state.picks);
        renderGroups(); renderSlots();
      });
      row.appendChild(c);
      row.appendChild(el('span', null, g.he));
      box.appendChild(row);
    });
  }
  function renderSlots() {
    var box = $('slots');
    clear(box);
    var any = false;
    L.shownGroups(CAT, picksNow()).forEach(function (g) {
      g.buttons.forEach(function (b) {
        if (!b.slot || (signedIn() && state.me.slots[b.id])) return;   // an address that came with the sign-in needs no pasting
        any = true;
        var row = el('div', 'slot');
        row.appendChild(el('div', 'name', b.he));
        var saved = !!state.slots[b.id];
        row.appendChild(el('div', 'state' + (saved ? ' on' : ''), saved ? 'יש קישור שמור בטלפון הזה' : 'עוד אין קישור'));
        var lab = el('label', null, CAT.slotKinds[b.slot].hint);
        lab.htmlFor = 'slot_' + b.id;
        var inp = el('input');
        inp.type = 'url'; inp.id = 'slot_' + b.id; inp.dir = 'ltr'; inp.autocomplete = 'off'; inp.placeholder = 'https://';
        var msg = el('div', 'formmsg');
        msg.setAttribute('role', 'status');
        var btns = el('div', 'rowbtns');
        var saveB = el('button', 'primary small', 'לשמור'); saveB.type = 'button';
        saveB.addEventListener('click', function () {
          var u = L.slotUrl(CAT.slotKinds, b.slot, inp.value);
          if (!u) { msg.textContent = 'זה לא נראה כמו הקישור של הדף הזה. להעתיק אותו שוב, כולו.'; return; }
          state.slots[b.id] = u;
          write(LS.slots, state.slots);
          renderGroups(); renderSlots();
        });
        btns.appendChild(saveB);
        if (saved) {
          var del = el('button', 'small', 'להסיר'); del.type = 'button';
          del.addEventListener('click', function () {
            delete state.slots[b.id];
            write(LS.slots, state.slots);
            renderGroups(); renderSlots();
          });
          btns.appendChild(del);
        }
        row.appendChild(lab); row.appendChild(inp); row.appendChild(btns); row.appendChild(msg);
        box.appendChild(row);
      });
    });
    if (!any) box.appendChild(el('p', 'dim', 'אין כאן כרגע.'));
  }
  function renderMy() {
    var box = $('myList');
    clear(box);
    state.my.forEach(function (m, i) {
      var row = el('div', 'myrow');
      row.appendChild(el('span', null, m.he));
      var del = el('button', 'small', 'להסיר'); del.type = 'button';
      del.addEventListener('click', function () {
        state.my = state.my.filter(function (_, j) { return j !== i; });
        write(LS.my, state.my);
        renderMy(); renderGroups();
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  }
  var WHY = { name: 'צריך שם לכפתור.', url: 'צריך קישור מלא שמתחיל ב-https.', full: 'יש כבר ' + L.MAX_MY + ' כפתורים. להסיר אחד קודם.', dup: 'הקישור הזה כבר קיים.' };
  function addMy() {
    var r = L.addMy(state.my, $('myName').value, $('myUrl').value);
    if (!r.ok) { $('myMsg').textContent = pick(WHY, r.why, 'לא נשמר.'); return; }
    state.my = r.list;
    write(LS.my, state.my);
    $('myName').value = ''; $('myUrl').value = ''; $('myMsg').textContent = '';
    renderMy(); renderGroups();
  }
  function openSetup(open) {
    show('setup', open);
    $('gear').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open && firstRun) { firstRun = false; write(LS.picks, state.picks); }
  }
  function renderAll() {
    var inn = signedIn();
    show('signin', SIGNIN && !inn);
    // nothing to adjust before the sign-in: the adjust button and its panel wait with the buttons
    show('gear', !waiting());
    if (waiting()) { show('setup', false); $('gear').setAttribute('aria-expanded', 'false'); }
    show('pickBox', !inn); show('roleBox', inn); show('outBox', inn); show('ownerBox', inn && state.me.owner);
    var hello = $('hello');
    hello.textContent = inn && state.me.name ? 'שלום, ' + state.me.name : '';
    hello.classList.toggle('hide', !hello.textContent);
    if (!waiting()) { renderPicks(); renderSlots(); renderMy(); }   // the panel is hidden while waiting: nothing to build
    renderGroups();
  }

  /* ---------- the sign-in (part B) ---------- */
  var SIGN_TEXT = {
    google: 'גוגל לא אישר את הכניסה. לנסות שוב.',
    no_row: 'המייל של החשבון הזה לא מופיע ברשימת העובדים. לפנות למנהל.',
    not_active: 'הכניסה סגורה כרגע. לפנות למנהל.',
    ambiguous: 'המייל הזה מופיע אצל יותר מעובד אחד. לפנות למנהל.',
    bound_other: 'לעובד הזה כבר מחובר חשבון גוגל אחר. לפנות למנהל.',
    second_proof: 'בפעם הראשונה צריך אישור נוסף: להדביק למטה את הקישור האישי של הסידור, ואז ללחוץ שוב על הכניסה.',
    retry: 'לא הצלחתי להתחבר כרגע. לנסות שוב בעוד רגע.'
  };
  var ROLE_HE = { owner: 'בעלים', manager: 'מנהל', dm: 'מנחה', worker: 'עובד', guest: 'לא מחובר' };
  var nonce = '', issued = [], busy = false;

  function newNonce() {
    var b = new Uint8Array(18);
    crypto.getRandomValues(b);
    var s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  /** Keep the service's answer: only its checked form is shown and stored. */
  function keepAnswer(ans) {
    var clean = L.cleanAnswer(CAT, ans);
    if (!clean) return false;
    state.me = clean;
    write(LS.me, clean);
    return true;
  }
  /** The one place that removes the session from this phone: the person's own sign-out, or the service's finding. */
  function forget(text) {
    state.sid = ''; state.me = null;
    drop(LS.sid); drop(LS.me);
    renderAll();
    if (SIGNIN) armGoogle();
    $('signMsg').textContent = text || '';
  }
  function armGoogle() {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    nonce = newNonce();                                               // one nonce per attempt: a token is good once
    issued = issued.concat(nonce).slice(-4);
    google.accounts.id.initialize({ client_id: CFG.clientId, callback: onCredential, nonce: nonce, ux_mode: 'popup', auto_select: false, itp_support: true });
    clear($('gbtn'));
    google.accounts.id.renderButton($('gbtn'), { type: 'standard', theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'he', width: 280 });
  }
  function onCredential(resp) {
    if (busy || !resp || typeof resp.credential !== 'string') return;
    busy = true;
    $('signMsg').textContent = 'נכנס…';
    var pasted = L.scheduleKeyFrom($('proofIn').value);
    var key = pasted || L.scheduleKeyFrom((function () { try { return localStorage.getItem('freak_schedule_key'); } catch (e) { return ''; } })());
    // A token asked for a moment before the button was re-armed carries the nonce of that moment: it is sent with the
    // nonce it was made for, as long as this page issued it. Any other nonce is not ours and the service refuses it.
    var made = L.tokenNonce(resp.credential);
    var body = { a: 'google', credential: resp.credential, nonce: issued.indexOf(made) >= 0 ? made : nonce, device: L.deviceLabel(navigator.userAgent, standalone) };
    if (!$('proof').classList.contains('hide') && key) body.key = key;   // sent only when the service asked for a second proof
    post(body).then(function (ans) {
      busy = false;
      var sid = ans && ans.ok === true ? L.cleanSid(ans.sid) : '';
      if (sid && keepAnswer(ans)) {
        var old = state.sid;
        state.sid = sid;
        write(LS.sid, state.sid);
        if (old && old !== sid) post({ a: 'signout', sid: old, everywhere: false });   // the session this phone held before
        $('proofIn').value = ''; show('proof', false); $('signMsg').textContent = '';
        renderAll();
        return;
      }
      var code = ans && ans.code;
      var again = code === 'second_proof' && !!body.key && !!pasted;   // the person pasted a link and it was not theirs
      if (code === 'second_proof') show('proof', true);
      $('signMsg').textContent = again ? 'הקישור הזה לא התאים. להדביק את הקישור האישי של הסידור, כולו, וללחוץ שוב על הכניסה.' : pick(SIGN_TEXT, code, SIGN_TEXT.retry);
      armGoogle();
    });
  }
  function refresh() {
    var asked = state.sid;
    // A phone that holds a session but no stored answer has no buttons to show yet (b1.6): it says what it is doing.
    if (!state.me) $('signMsg').textContent = 'בודק את הכניסה השמורה בטלפון…';
    return post({ a: 'me', sid: asked }).then(function (ans) {
      if (state.sid !== asked) return;                                 // signed out or signed in again meanwhile: not about us
      var fate = L.sessionFate(ans);
      if (fate === 'ok') { if (keepAnswer(ans)) { $('signMsg').textContent = ''; renderAll(); } return; }
      if (fate === 'drop') { forget(ans.code === 'not_active' ? SIGN_TEXT.not_active : 'צריך להיכנס שוב.'); return; }
      // anything else (no signal, a slow answer): the phone keeps its session and the buttons it had
      if (!state.me) $('signMsg').textContent = 'לא הצלחתי לבדוק את הכניסה כרגע. לבדוק קליטה ולפתוח שוב.';
    });
  }
  function signOut(everywhere) {
    var sid = state.sid;
    if (!everywhere) {                                                 // this phone: out at once, the service is told
      forget('היציאה בוצעה.');
      openSetup(false);
      return post({ a: 'signout', sid: sid, everywhere: false });
    }
    // every device (a lost phone): only the service's own yes counts, so the session is kept until it says so
    $('outMsg').textContent = 'סוגר בכל המכשירים…';
    return post({ a: 'signout', sid: sid, everywhere: true }).then(function (ans) {
      if (state.sid !== sid) return;
      if (ans && ans.ok === true) { $('outMsg').textContent = ''; forget('היציאה בוצעה בכל המכשירים.'); openSetup(false); }
      else if (L.sessionFate(ans) === 'drop') {
        // this phone's own session was already closed: nothing was closed elsewhere, and the page must not say it was
        $('outMsg').textContent = ''; forget('הכניסה בטלפון הזה כבר נסגרה. כדי לסגור את שאר המכשירים צריך להיכנס שוב ואז לצאת מכולם.'); openSetup(false);
      } else $('outMsg').textContent = 'לא הצלחתי לסגור בשאר המכשירים. לנסות שוב.';
    });
  }
  function showUsage() {
    var box = $('usage');
    clear(box);
    box.appendChild(el('p', 'dim', 'טוען…'));
    var names = { my: 'כפתור אישי' };
    L.eachButton(CAT, function (b) { names[b.id] = b.he; });
    var asked = state.sid;
    return post({ a: 'usage', sid: asked }).then(function (ans) {
      if (state.sid !== asked) return;
      clear(box);
      if (L.sessionFate(ans) === 'drop') { forget(ans.code === 'not_active' ? SIGN_TEXT.not_active : 'צריך להיכנס שוב.'); return; }
      if (ans && ans.code === 'not_allowed') { box.appendChild(el('p', 'dim', 'הטבלה פתוחה רק למי שמסומן כבעלים.')); return; }
      var rows = ans && ans.ok === true ? L.cleanUsage(ans.rows) : null;
      if (!rows) { box.appendChild(el('p', 'dim', SIGN_TEXT.retry)); return; }
      if (!rows.length) { box.appendChild(el('p', 'dim', 'עוד אין לחיצות.')); return; }
      var t = el('table', 'usage');
      var h = el('tr');
      ['שבוע', 'כפתור', 'תפקיד', 'לחיצות'].forEach(function (x) { h.appendChild(el('th', null, x)); });
      t.appendChild(h);
      rows.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', null, r.week.slice(8, 10) + '/' + r.week.slice(5, 7)));
        tr.appendChild(el('td', null, pick(names, r.page, r.page)));
        tr.appendChild(el('td', null, pick(ROLE_HE, r.role, '')));
        tr.appendChild(el('td', null, String(r.count)));
        t.appendChild(tr);
      });
      box.appendChild(t);
    });
  }
  function startSignin() {
    $('outHere').addEventListener('click', function () { signOut(false); });
    $('outAll').addEventListener('click', function () { signOut(true); });
    $('usageBtn').addEventListener('click', showUsage);
    var s = document.createElement('script');
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    s.src = (local && CFG.gsi) || 'https://accounts.google.com/gsi/client';   // CFG.gsi: the local bench only
    s.async = true;
    s.onload = function () { if (!signedIn()) armGoogle(); };
    s.onerror = function () { if (!signedIn()) $('signMsg').textContent = 'הכפתור של גוגל לא נטען. לבדוק קליטה ולפתוח שוב.'; };
    document.head.appendChild(s);
    // A stored session is never dropped here, even when the stored answer is missing or old: the service decides.
    if (state.sid) refresh();
  }

  /* ---------- install ---------- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (!standalone) show('install', true);
  });
  $('install').addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt(); deferred = null;
    show('install', false);
  });
  if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) show('iosHint', true);

  /* ---------- start ---------- */
  $('gear').addEventListener('click', function () { openSetup($('setup').classList.contains('hide')); });
  $('setupDone').addEventListener('click', function () { openSetup(false); window.scrollTo(0, 0); });
  $('myAdd').addEventListener('click', addMy);
  $('build').textContent = 'גרסה ' + CAT.version;
  if (SIGNIN) startSignin();
  renderAll();
  if (firstRun && !SIGNIN) openSetup(true);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () { /* the page works without it */ }); });
  }
})();
