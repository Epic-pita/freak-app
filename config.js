/*
 * FREAK צוות — the two values that switch the sign-in on. Both are public by design (they are not secrets):
 *   api      — the address of the sign-in service's web app;
 *   clientId — the app's client id from Google ("Sign in with Google").
 * While both are empty the page is part A: buttons only, no sign-in, nothing is sent anywhere.
 * They are filled in only after the app is registered with Google and the service's permission screen is approved.
 */
(function (root) {
  'use strict';
  var CONFIG = { api: '', clientId: '' };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.FREAK_CONFIG = CONFIG;
})(typeof self !== 'undefined' ? self : this);
