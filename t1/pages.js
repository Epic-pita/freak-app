/*
 * FREAK צוות — the buttons catalog.
 *
 * PUBLIC FILE (GitHub Pages). Rules for every line here:
 *   - a button points only at a page that is already public on this origin (/freak-schedule/, /freak-pos/);
 *   - no key, token, code, deployment id, sheet id, name, phone or e-mail, ever;
 *   - a page whose address is not public (the D&D apps on Google's address, the management's claude.ai pages) is a SLOT:
 *     the button exists, the address is pasted once on the phone and stays on that phone only. With the sign-in
 *     (part B) those addresses come from the sign-in service by role, still never from this file.
 * tests/part_a.test.js holds these rules as a contract.
 */
(function (root) {
  'use strict';

  var CATALOG = {
    version: 'b1.5',
    origin: 'https://epic-pita.github.io',
    groups: [
      { id: 'all', he: 'לכל הצוות', fixed: true, buttons: [
        { id: 'schedule', he: 'סידור, שעון ומשימות', sub: 'המשמרות שלי, החתמת שעון ומשימות הצוות', path: '/freak-schedule/' },
        { id: 'count', he: 'ספירת מלאי', sub: 'סריקה, ספירה ומשימות מלאי', path: '/freak-pos/count.html' },
        { id: 'till', he: 'קופת הדוכן', sub: 'מכירות בדוכן ובאירועים', path: '/freak-pos/' },
        { id: 'dnd_staff', he: 'חוגים · צוות החנות', sub: 'תשלומים, שיבוצים ושחקנים', slot: 'gas' }
      ] },
      { id: 'dm', he: 'מנחים', buttons: [
        { id: 'dnd_dm', he: 'אפליקציית המנחים', sub: 'נוכחות, שעות והופעות', slot: 'gas' }
      ] },
      { id: 'mgr', he: 'מנהלים', buttons: [
        { id: 'count_report', he: 'דוח הספירה', sub: 'התקדמות ופערים', path: '/freak-pos/count-report.html' },
        { id: 'count_print', he: 'משימות מלאי להדפסה', sub: 'דף להדפסה', path: '/freak-pos/count-tasks-print.html' },
        { id: 'event_report', he: 'סיכום האירוע', sub: 'סיכום, החזרות וביטולים', path: '/freak-pos/report.html' }
      ] },
      { id: 'owner', he: 'ניהול העסק', buttons: [
        { id: 'home', he: 'מסך הבית', sub: 'כל החנות בדף אחד', path: '/freak-pos/home.html' },
        { id: 'suppliers', he: 'משימות הספקים', sub: 'מה להזמין ומה בדרך', path: '/freak-pos/suppliers.html' },
        { id: 'order', he: 'הזמנה מספק', sub: 'דף ההזמנה', path: '/freak-pos/order.html' },
        { id: 'board', he: 'הלוח', sub: 'מצב הפרויקט', slot: 'claude' },
        { id: 'questions', he: 'שאלות ומשימות', sub: 'מה מחכה לך', slot: 'claude' }
      ] },
      { id: 'guides', he: 'מדריכים', fixed: true, folded: true, buttons: [
        { id: 'g_schedule', he: 'מדריך הסידור', path: '/freak-schedule/guide.html' },
        { id: 'g_schedule_q', he: 'הסידור בקצרה', path: '/freak-schedule/quickstart.html' },
        { id: 'g_till', he: 'מדריך הקופה', path: '/freak-pos/guide.html' },
        { id: 'g_till_q', he: 'הקופה בקצרה', path: '/freak-pos/quickstart.html' },
        { id: 'g_count', he: 'מדריך הספירה', path: '/freak-pos/count-guide.html' },
        { id: 'g_count_q', he: 'הספירה בקצרה', path: '/freak-pos/count-quickstart.html' }
      ] }
    ],
    // What a pasted slot address must look like. Anything else is refused on save and again on every render.
    slotKinds: {
      gas: { re: /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,120}\/exec(\?[A-Za-z0-9_=&.-]{1,80})?$/,
             hint: 'הקישור של האפליקציה, כמו שהוא התקבל (מתחיל ב-https://script.google.com)' },
      claude: { re: /^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9_-]{6,80}$/,
                hint: 'הקישור של הדף (מתחיל ב-https://claude.ai/artifact)' }
    },
    // Left out on purpose (v1): the joint order page (people who are not staff take part in it) and form 101.
    leftOut: ['joint-order.html', 'onboarding-101']
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else root.FREAK_PAGES = CATALOG;
})(typeof self !== 'undefined' ? self : this);
