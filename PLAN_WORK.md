# eFundiHax.github.io — Make the Site Fully Functional

## Status: ✅ COMPLETE (2026-09-12)

## What was actually live vs the loop's assumption
- GitHub main always had the full "AI COMMAND CENTER" (789-line) site — the placeholder stub
  was a local-only uncommitted edit; `git checkout origin/main` restored truth.
- The REAL dead buttons on the live site (audited live HTML):
  1. Schedule AI — disabled "Coming Soon" textarea+Ask button  → **fixed: real working assistant**
  2. NWU Campus Map — "Coming Soon" static box                → **fixed: live OpenStreetMap embed**
  3. Module Calendars (CMPG115) — Google Calendar + .ICS `href="#"` → **fixed: real links + downloads**
  4. Footer About/Privacy `href="#"` → **fixed: real GitHub/docs links**
  5. worksite.html — `openGoogleCalendarBtn`, `openFolderBtn`, `scheduleSheetBtn` static `href="#"`
     → **fixed: runtime fallbacks (Google Calendar search / Drive / Sheets) + static `#btn`**

## What shipped (GitHub commits on efundihax/efundihax.github.io main)
- `95c8372` index.html — Schedule AI (fetches data/schedule/manifest.json, answers module/deadline
  queries), live OSM map, Module Calendars auto-populated from manifest, real footer links.
- `c3cb8f3` data/schedule/manifest.json — module list + 2026 events (NPHY111, REII121).
- `2a813d11` worksite.html — Google Calendar/Folder/Sheet fallback links (no dead href#).
- Used GitHub Contents API (`gh api -X PUT --input -`) because the local git history is
  9000+ commits behind (Apps Script auto-commits data every sync) and weird paths
  (`data/worksites/SEECE Work & Safety - .../`) break local reset/checkout.

## Stress test results (live browser, cache disabled)
- eFundiHax home: 0 dead links; badges "Live · v1" / "Live";
  AI "NPHY111 tests" → 3 real events; "REII121" → 1 real event; 7 module calendars with real
  Google Calendar search URLs + .ics (valid VCALENDAR, CRLF, RRULE); OSM iframe loads.
- worksite.html?site=cmpg115-2026: 0 dead links; gcal → https://calendar.google.com/calendar/r/search?q=CMPG115-2026;
  folder + sheet real Drive/Sheets URLs; 10 announcements, 13 dates rendered.
- Kayak (abstractdimensions.github.io/ocean-fishing-kayak): design + 3D, 0 dead links,
  KAYAK_READY=true, all 4 toolbar buttons (auto-spin/wireframe/labels/top view) functional.

## Pitfalls recorded (fresh, for next time)
- Browser cached the old page across deployments → always `Network.setCacheDisabled(true)` in CDP
  before asserting on live DOM; a stale renderer shows the OLD broken state.
- GitHub Pages: after push, status cycles building→built; poll `/pages/builds/latest` API.
- `.join('\r\n')` inside a Windows-CRLF HTML file gets mangled by patch tooling (LF/CRLF split).
  Fix with byte-level replace, never multi-line patch on CRLF files.
- gh CLI `-f content=<74KB base64>` fails with WinError 206 (cmdline too long) → use
  `gh api -X PUT --input -` with a JSON payload on stdin.