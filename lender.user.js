// ==UserScript==
// @name         eFundiHax Cookie Lender
// @namespace    https://efundihax.local/
// @version      1.1.0
// @description  Lends your live eFundi session cookie to the shared eFundiHax backend every 30 min, at install, and after every silent re-login. JSESSIONID is HttpOnly — GM_cookie is the only way to read it. WARNING: lending shares your FULL session powers with the communal backend (accepted and disclosed — SPEC §6). Revoke anytime: the backend revoke_lender action, the Tampermonkey menu, or simply change your eFundi password.
// @author       eFundiHax
// @match        https://efundi.nwu.ac.za/*
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      script.google.com
// @connect      efundi.nwu.ac.za
// @run-at       document-idle
// ==/UserScript==

(function() {
    if (window.top !== window.self) { return; }
    var VERSION = '1.1.0';
    var EXEC_URL = 'https://script.google.com/macros/s/AKfycbwYf2Z2DfnJ7WBwG7w7nlwn_b1XsZqpO9NyFiDuXDUBAHg8WU54JOQE3tJbFUvaCC0/exec';
    var SECRET = 'trackmania_is_peak';
    var COOKIE_URL = 'https://efundi.nwu.ac.za/';
    var LEND_MS = 30 * 60 * 1000;      // lend every 30 min
    var RELOGIN_POLL_MS = 60 * 1000;   // poll the data-efh-relogin attribute
    var K_CONSENT = 'efh_lender_consent';
    var K_LAST_LEND = 'efh_lender_last';
    var K_LAST_RELOGIN = 'efh_lender_last_relogin';
    // Sync-driver cadences. Apps Script triggers CANNOT be installed
    // for this project (the script.scriptapp scope is not granted, and
    // granting it needs an interactive consent screen — see
    // SPEC §9 trigger-install note). The browser is therefore the
    // scheduler: while the operator is on eFundi with lending enabled,
    // these intervals drive the server lanes over HTTP. No triggers
    // required, and every action is idempotent server-side.
    var DRIVER_FAST_MS     = 60 * 1000;        // 1 min  -> fast_lane
    var DRIVER_DRAIN_MS    = 5 * 60 * 1000;    // 5 min  -> drainQueue
    var DRIVER_HARD_MS     = 5 * 60 * 1000;    // 5 min  -> drainHardFiles
    var DRIVER_QUAR_MS     = 7 * 24 * 3600e3;  // weekly -> quarantineSweep
    var DRIVER_AUDIT_MS    = 7 * 24 * 3600e3;  // weekly -> auditLog
    var K_DRIVER       = 'efh_sync_driver';
    var K_LAST_FAST    = 'efh_drv_fast';
    var K_LAST_DRAIN   = 'efh_drv_drain';
    var K_LAST_HARD    = 'efh_drv_hard';
    var K_LAST_QUAR    = 'efh_drv_quar';
    var K_LAST_AUDIT   = 'efh_drv_audit';
    var K_DRIVER_STATS = 'efh_drv_stats';

    function log(m) { try { console.log('[eFundiHax Lender ' + VERSION + '] ' + m); } catch (e) {} }
    function getVal(k, d) { try { var v = GM_getValue(k, d); return (v === undefined || v === null) ? d : v; } catch (e) { return d; } }
    function setVal(k, v) { try { GM_setValue(k, v); } catch (e) {} }
    function consented() { return getVal(K_CONSENT, false) === true; }

    // Hash bootstrap: visit any eFundi page with
    // #efh-lender-enable / #efh-lender-disable to
    // flip consent without the Tampermonkey menu.
    function checkHashBootstrap() {
        try {
            var h = location.hash || '';
            if (h.indexOf('#efh-lender-enable') !== -1) {
                setVal(K_CONSENT, true);
                log('Consent ENABLED via #efh-lender-enable — lending started.');
                try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
                return true;
            }
            if (h.indexOf('#efh-lender-disable') !== -1) {
                setVal(K_CONSENT, false);
                log('Consent DISABLED via #efh-lender-disable — lending stopped.');
                try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Student id from the live session (same-origin
    // fetch — credentials are sent automatically).
    function readStudentId(cb) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/direct/user/current.json', true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var b = JSON.parse(xhr.responseText || '{}');
                    cb(b.eid || b.displayId || null);
                } catch (e) { cb(null); }
            };
            xhr.onerror = function() { cb(null); };
            xhr.ontimeout = function() { cb(null); };
            xhr.send();
        } catch (e) { cb(null); }
    }

    // GM_cookie.list reads HttpOnly cookies (the
    // only way to see JSESSIONID — document.cookie
    // cannot). Promise-style in current Tampermonkey.
    function listCookies(cb) {
        try {
            if (typeof GM_cookie === 'undefined' || typeof GM_cookie.list !== 'function') { cb(null); return; }
            var p = GM_cookie.list({ url: COOKIE_URL });
            if (p && typeof p.then === 'function') {
                p.then(function(list) { cb(list || []); }).catch(function() { cb(null); });
            } else {
                cb(null);
            }
        } catch (e) { cb(null); }
    }

    function lend() {
        if (!consented()) { return; }
        listCookies(function(list) {
            if (!list) { log('GM_cookie unavailable — cannot lend.'); return; }
            var parts = [];
            for (var i = 0; i < list.length; i++) {
                var c = list[i];
                if (c && c.name && c.value !== undefined) parts.push(c.name + '=' + c.value);
            }
            var cookieStr = parts.join('; ');
            if (cookieStr.indexOf('JSESSIONID') === -1) {
                log('No JSESSIONID in the cookie jar — not signed in? Not lending.');
                return;
            }
            readStudentId(function(eid) {
                var body = {
                    action: 'lend_cookies',
                    secret: SECRET,
                    cookies: [{
                        user: eid || 'unknown',
                        cookie: cookieStr,
                        lentAt: new Date().toISOString(),
                        pledgeAllowed: false // Task 4: true only with explicit pledge opt-in
                    }]
                };
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: EXEC_URL,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(body),
                    timeout: 30000,
                    onload: function(r) {
                        try {
                            var b = JSON.parse(r.responseText || '{}');
                            setVal(K_LAST_LEND, Date.now());
                            log('Lent cookie (accepted: ' + (b.lenders || 0) + ', rejected: ' + (b.rejected || 0) + ', users: ' + ((b.users || []).join(',')) + ').');
                        } catch (e) { log('Lend response unparseable.'); }
                    },
                    onerror: function() { log('Lend POST failed (network).'); },
                    ontimeout: function() { log('Lend POST timed out.'); }
                });
            });
        });
    }

    // ============================================================
    // SYNC DRIVER — the browser IS the scheduler.
    // Apps Script triggers CANNOT be installed for this project
    // (the script.scriptapp scope is not granted; granting it needs an
    // interactive consent screen). The browser is therefore the
    // scheduler: while the operator is on eFundi with lending enabled,
    // these intervals drive the server lanes over HTTP. No triggers
    // required, and every action is idempotent server-side (the drain
    // is fenced + cursor-checkpointed), so a browser-driven cadence
    // keeps the same guarantees a trigger-driven one would.
    // ============================================================
    var driverBusy = {};

    function driverOn() { return getVal(K_DRIVER, true) === true; }

    function postAction(action, onDone) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: EXEC_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ action: action, secret: SECRET }),
            timeout: 300000, // a drain can legitimately run long
            onload: function(r) {
                var processed = 0, note = '';
                try {
                    var b = JSON.parse(r.responseText || '{}');
                    processed = Number(b.processed || 0);
                    note = String(b.status || '');
                } catch (e) { note = 'unparseable'; }
                if (onDone) onDone(note, processed);
            },
            onerror: function() { if (onDone) onDone('network', 0); },
            ontimeout: function() { if (onDone) onDone('timeout', 0); }
        });
    }

    // Fire `action` at most once per everyMs, never overlapping.
    function driverTick(key, action, everyMs, label) {
        if (!driverOn() || !consented()) return;
        if (driverBusy[action]) return;              // previous run still going
        var now = Date.now();
        if (now - (Number(getVal(key, 0)) || 0) < everyMs) return;
        setVal(key, now);
        driverBusy[action] = true;
        var t0 = Date.now();
        postAction(action, function(note, processed) {
            driverBusy[action] = false;
            bumpStats(action, note, processed, Date.now() - t0);
            if (processed > 0) {
                log('[driver] ' + label + ': ' + note + ' processed=' + processed +
                    ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
            }
        });
    }

    function bumpStats(action, note, processed, ms) {
        try {
            var s = JSON.parse(getVal(K_DRIVER_STATS, '{}') || '{}');
            if (!s[action]) s[action] = { runs: 0, ok: 0, files: 0, ms: 0, last: '', lastNote: '' };
            s[action].runs++;
            if (note === 'ok' || note === 'degraded') s[action].ok++;
            s[action].files += (processed || 0);
            s[action].ms += (ms || 0);
            s[action].last = new Date().toISOString();
            s[action].lastNote = note;
            setVal(K_DRIVER_STATS, JSON.stringify(s));
        } catch (e) {}
    }

    function driverSweep() {
        driverTick(K_LAST_FAST,  'fast_lane',        DRIVER_FAST_MS,  'fast lane');
        driverTick(K_LAST_DRAIN, 'drain',            DRIVER_DRAIN_MS, 'slow lane');
        driverTick(K_LAST_HARD,  'drainHard',        DRIVER_HARD_MS,  'hard lane');
        driverTick(K_LAST_QUAR,  'quarantine_sweep', DRIVER_QUAR_MS,  'quarantine');
        driverTick(K_LAST_AUDIT, 'storage_audit',    DRIVER_AUDIT_MS, 'audit');
    }

    // Re-login hook: the keepalive sets
    // <html data-efh-relogin=<ts>> after a silent
    // re-login (attribute contract — separate
    // Tampermonkey sandboxes cannot share window
    // events). A fresher value means the session
    // changed — re-lend immediately.
    function pollRelogin() {
        try {
            var ts = document.documentElement.getAttribute('data-efh-relogin');
            if (ts) {
                var last = Number(getVal(K_LAST_RELOGIN, 0)) || 0;
                var t = Number(ts) || 0;
                if (t > last) {
                    setVal(K_LAST_RELOGIN, t);
                    log('Silent re-login detected — re-lending cookie.');
                    lend();
                }
            }
        } catch (e) {}
    }

    try {
        GM_registerMenuCommand('eFundiHax: Enable cookie lending', function() {
            setVal(K_CONSENT, true); log('Consent ENABLED — lending started.'); lend();
        });
        GM_registerMenuCommand('eFundiHax: Disable cookie lending', function() {
            setVal(K_CONSENT, false); log('Consent DISABLED — lending stopped.');
        });
        GM_registerMenuCommand('eFundiHax: Sync driver ON', function() {
            setVal(K_DRIVER, true); log('Sync driver ENABLED (fast 1m / drain 5m / hard 5m / quarantine+audit weekly).');
            driverSweep();
        });
        GM_registerMenuCommand('eFundiHax: Sync driver OFF', function() {
            setVal(K_DRIVER, false); log('Sync driver DISABLED.');
        });
        GM_registerMenuCommand('eFundiHax: Sync driver stats', function() {
            var s = JSON.parse(getVal(K_DRIVER_STATS, '{}') || '{}');
            var names = Object.keys(s);
            if (!names.length) { log('Sync driver: no runs yet.'); return; }
            names.forEach(function(k) {
                log('  ' + k + ': runs=' + s[k].runs + ' ok=' + s[k].ok +
                    ' files=' + s[k].files + ' last=' + s[k].last + ' note=' + s[k].lastNote);
            });
        });
    } catch (e) {}

    // Immediate lend at install (when consented),
    // then every 30 min; re-login attribute poll
    // every 60 s; sync-driver sweep every 30 s
    // (each tick self-limits to its own cadence).
    checkHashBootstrap();
    if (consented()) {
        log('Lender armed — lending now and every 30 min.');
        lend();
        if (driverOn()) {
            log('Sync driver armed — fast lane 1m, slow lane 5m, hard lane 5m, quarantine+audit weekly.');
        }
    } else {
        log('Lender installed — consent NOT yet given. Enable via the Tampermonkey menu or visit any eFundi page with #efh-lender-enable. Nothing is lent until you opt in.');
    }
    setInterval(lend, LEND_MS);
    setInterval(driverSweep, 30 * 1000);
    setInterval(pollRelogin, RELOGIN_POLL_MS);
})();
