// ==UserScript==
// @name         eFundiHax AutoLogin
// @namespace    https://efundihax.github.io
// @version      3.9
// @description  Captures your login once, then re-logs you in silently in the background. No UI, backs off on failure.
// @author       eFundiHax
// @match        https://efundi.nwu.ac.za/*
// @match        https://casprd.nwu.ac.za/cas/login*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      casprd.nwu.ac.za
// @connect      efundi.nwu.ac.za
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function() {
    if (window.top !== window.self) { return; }
    var VERSION = '3.9';
    var K_USER = 'efh_al_user';
    var K_PASS = 'efh_al_pass';
    var K_FAILS = 'efh_al_fails';
    var K_BACKOFF = 'efh_al_backoff_until';
    var HB_MS = 5 * 60 * 1000;
    var MAX_FAILS = 3;
    var BACKOFF_MS = 24 * 60 * 60 * 1000;
    var CAS_LOGIN = 'https://casprd.nwu.ac.za/cas/login?service=https://efundi.nwu.ac.za/sakai-login-tool/container';

    var diag = { version: VERSION, polls: 0, last: 'init', ev: [] };
    function mark(s) {
        diag.last = s;
        try { diag.ev.push(Math.round(performance.now()) + ':' + s); if (diag.ev.length > 24) { diag.ev.shift(); } } catch (e) {}
        try { unsafeWindow.__efhAL = diag; } catch (e) {}
    }

    function stamp() {
        try {
            var d = new Date();
            function p(n) { return (n < 10 ? '0' : '') + n; }
            return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
        } catch (e) { return ''; }
    }

    function log(msg) {
        try { console.log('[AutoLogin ' + stamp() + '] ' + msg); } catch (e) {}
        mark(msg);
    }

    function getVal(k, d) {
        try { var v = GM_getValue(k, d); return (v === undefined || v === null) ? d : v; } catch (e) { return d; }
    }

    function setVal(k, v) { try { GM_setValue(k, v); } catch (e) {} }

    function backedOff() { return Date.now() < (Number(getVal(K_BACKOFF, 0)) || 0); }

    function backoff(why) {
        setVal(K_BACKOFF, Date.now() + BACKOFF_MS);
        log('backing off 24h (' + why + ') - sign in normally');
    }

    function isCasPage() { return location.hostname.indexOf('casprd') !== -1; }

    function efundiLoggedOut() {
        var lo = document.querySelector('a[href$="/portal/logout"], a[href*="/portal/logout"]');
        if (lo && lo.offsetParent !== null) { return false; }
        var sites = document.querySelectorAll('#linkNav a, .Mrphs-sitesNav a');
        if (sites.length > 0) { return false; }
        var ll = document.getElementById('loginLink1');
        if (ll && ll.offsetParent !== null && /login/i.test(ll.textContent || '')) { return true; }
        return !lo;
    }

    function htmlLoggedOut(html) {
        if (!html) { return true; }
        if (html.indexOf('/portal/logout') !== -1) { return false; }
        if (html.indexOf('loginLink1') !== -1) { return true; }
        return false;
    }

    function heartbeat() {
        if (backedOff()) { return; }
        var xhr = new XMLHttpRequest();
        try {
            xhr.open('GET', '/portal?t=' + Date.now(), true);
            xhr.setRequestHeader('Accept', 'text/html');
            xhr.timeout = 25000;
            xhr.onload = function() {
                if (htmlLoggedOut(xhr.responseText || '')) { onLoggedOut('hb'); }
                else { log('Session check: still signed in.'); }
            };
            xhr.onerror = function() {};
            xhr.ontimeout = function() {};
            xhr.send();
        } catch (e) {}
    }

    function onLoggedOut(src) {
        var fails = Number(getVal(K_FAILS, 0)) || 0;
        if (backedOff()) { log('Automatic sign-in is paused after repeated failures — please sign in normally.'); return; }
        if (fails >= MAX_FAILS) { log('Automatic sign-in did not work — please sign in normally.'); return; }
        var u = getVal(K_USER, ''), p = getVal(K_PASS, '');
        if (!u || !p) { log('Signed out, and I have nothing saved yet — please sign in once.'); return; }
        relogin(u, p, fails);
    }

    function relogin(u, p, fails) {
        log('You were signed out — signing you back in…');
        GM_xmlhttpRequest({
            method: 'GET',
            url: CAS_LOGIN + '&t=' + Date.now(),
            onload: function(r) {
                var html = r.responseText || '';
                var lt = (html.match(/name="lt"\s+value="([^"]+)"/) || [])[1] || '';
                var ex = (html.match(/name="execution"\s+value="([^"]+)"/) || [])[1] || 'e1s1';
                var m = html.match(/<form[^>]*id="fm1"[^>]*action="([^"]+)"/) || html.match(/<form[^>]*action="([^"]+)"[^>]*id="fm1"/);
                var act = (m || [])[1] || '/cas/login';
                if (!lt) { return relogFail(fails, 'no lt'); }
                if (act.charAt(0) === '/') { act = 'https://casprd.nwu.ac.za' + act; }
                var body = 'username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(p) + '&lt=' + encodeURIComponent(lt) + '&execution=' + encodeURIComponent(ex) + '&_eventId=submit&submit=LOGIN';
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: act,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: body,
                    onload: function(r2) {
                        var h2 = r2.responseText || '';
                        if (/Invalid credentials|did not recognize|Username or password/i.test(h2)) {
                            setVal(K_FAILS, (Number(fails) || 0) + 1);
                            if ((Number(getVal(K_FAILS, 0)) || 0) >= 2) { backoff('bad creds - password changed?'); return; }
                            log('re-login rejected, fails=' + getVal(K_FAILS, 0));
                            return;
                        }
                        var xhr = new XMLHttpRequest();
                        try {
                            xhr.open('GET', '/portal?t=' + Date.now(), true);
                            xhr.onload = function() {
                                if (!htmlLoggedOut(xhr.responseText || '')) {
                                    setVal(K_FAILS, 0);
                                    log('Signed back in. Welcome back.');
                                    // eFundiHax Task 1 hook: tell the
                                    // cookie lender we re-logged in
                                    // (attribute contract — separate
                                    // Tampermonkey sandboxes cannot
                                    // share window events).
                                    try { document.documentElement.setAttribute('data-efh-relogin', String(Date.now())); } catch (e) {}
                                    if (isCasPage()) { try { location.href = 'https://efundi.nwu.ac.za/portal'; } catch (e) {} }
                                } else { relogFail(fails, 'did not stick'); }
                            };
                            xhr.onerror = function() { relogFail(fails, 'verify net err'); };
                            xhr.send();
                        } catch (e) { relogFail(fails, 'verify fail'); }
                    },
                    onerror: function() { relogFail(fails, 'post err'); }
                });
            },
            onerror: function() { relogFail(fails, 'get err'); }
        });
    }

    function relogFail(f, why) {
        setVal(K_FAILS, (Number(f) || 0) + 1);
        log('re-login failed (' + why + ')');
    }

    function armCapture() {
        var f = document.getElementById('fm1');
        if (!f) { log('cas: no form'); return; }
        log('Please sign in once so I can keep you signed in from now on.');
        f.addEventListener('submit', function() {
            try {
                var u = document.getElementById('username'), p = document.getElementById('password');
                if (u && u.value) { setVal(K_USER, u.value); }
                if (p && p.value) { setVal(K_PASS, p.value); }
                setVal(K_FAILS, 0);
                setVal(K_BACKOFF, 0);
                log('Got it — I will sign you in automatically from now on.');
            } catch (e) {}
        });
    }

    try { unsafeWindow.__efhAL = diag; } catch (e) {}

    function vis(el) {
        try {
            if (!el) { return false; }
            if (el.getClientRects().length === 0) { return false; }
            var cs = null;
            try { cs = getComputedStyle(el); } catch (e) {}
            if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0)) { return false; }
            return true;
        } catch (e) { return false; }
    }

    function checkTimeoutDialog() {
        try {
            var dlg = document.getElementById('timeout_alert_body');
            if (!vis(dlg)) { return; }
            var btns = dlg.querySelectorAll('button, input[type=button], input[type=submit], a');
            for (var i = 0; i < btns.length; i++) {
                var t = ((btns[i].textContent || btns[i].value || '') + '').toLowerCase();
                if (/stay|extend|continue|keep|yes|remain/i.test(t)) {
                    log('Answered the "stay signed in" popup for you: ' + t.slice(0, 40));
                    btns[i].click();
                    return;
                }
            }
            if (btns.length > 0) { log('timeout dialog: clicking first button'); btns[0].click(); }
            else { log('timeout dialog visible, no buttons found'); }
        } catch (e) {}
    }

    if (isCasPage()) { log('on cas page'); armCapture(); onLoggedOut('cas-load'); return; }
    if (efundiLoggedOut()) { log('portal shows logged out'); onLoggedOut('load'); return; }
    log('Session alive. I will keep it that way and sign you back in if it expires.');
    setInterval(heartbeat, HB_MS);
    setInterval(checkTimeoutDialog, 20000);
})();
