/*
 * FREAK צוות — the two values that switch the sign-in on. Both are public by design (they are not secrets):
 *   api      — the address of the sign-in service's web app;
 *   clientId — the app's client id from Google ("Sign in with Google").
 * While both are empty the page is part A: buttons only, no sign-in, nothing is sent anywhere.
 * A test copy (a page whose `api` is the TEST sheet's service) adds a third value in its own copy of this file,
 * `test: true`: the page then says that it is a test copy (b1.8). The real page never carries it.
 * They are filled in only after the app is registered with Google and the service's permission screen is approved.
 */
(function (root) {
  'use strict';
  var CONFIG = { api: 'https://script.google.com/macros/s/AKfycbyFl51NOb7BCmngZGamwe4Hn7xkoJjQBn9dvkBPswMOZa3yrPazmSYye3BDLEV5Xa7icA/exec', clientId: '257565221124-sorn1evkp2mp7je995u80teb3893tfbc.apps.googleusercontent.com' };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.FREAK_CONFIG = CONFIG;
})(typeof self !== 'undefined' ? self : this);
