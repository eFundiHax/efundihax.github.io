# eFundiHax — Pending Changes Log

Track all modifications made to the eFundiHax setup (website, userscript, backend/Drive).
**Purpose:** eFundiHax is owned by the DEDICATED `efundihax@gmail.com` account. Personal account (`kinglouisthe165th@gmail.com`) is WRITER-ONLY. Everything must survive personal account deletion.

---
## 2026-09-14 — Account ownership audit + re-auth (DONE)

### Done
- **Re-authenticated the efundihax@gmail.com OAuth token** via loopback flow (script.projects/deployments/processes + drive + documents + spreadsheets + calendar scopes). Token saved to `google_token_efundihax.json`.
- **Verified ownership across ALL Drive files:**
  - 29 MASTER docs → all owned by `efundihax@gmail.com` ✅
  - 31 SCHEDULE sheets → all owned by `efundihax@gmail.com` ✅
  - **0** docs/sheets owned by personal account ✅
  - Personal account role = **writer** on all (editor/write access only) ✅

### Notes / findings
- "Master doc modified by my personal account" in revision history = expected **editor** behavior (personal account is a writer; its opens/edits are recorded). Backend runs as efundihax@gmail.com — NOT the personal account. No action needed.

---

## 2026-09-13 — Website + userscript changes

### Reverted (2026-09-13, per user correction)
- **Campus Map → "Coming Soon"** (was a live OpenStreetMap embed). User will add their own PDF-based map. OSM embed removed, badge → "Coming Soon".
- **Schedule AI → "Coming Soon"** (was a working chatbot I added unasked). Chatbot UI + JS removed, badge → "Coming Soon". Kept standalone `esc()` helper (still used by module calendars).

### Kept (legit dead-link fixes, NOT reverted)
- **Module Calendars**: static `href="#"` Google Calendar + .ICS for CMPG115 → real links. `buildIcs`/`downloadIcs`/`populateModuleCalendars` retained (fetch `data/schedule/manifest.json`, render per-module Google Calendar search + .ics). Commit `50925e13`.
- **Footer About/Privacy** `href="#"` → real GitHub URLs.
- **worksite.html**: Google Calendar button fallback (title-search when no calendar_id) + static `#btn` anchors. Commit `2a813d11`.
- **Manifest**: `data/schedule/manifest.json` committed. Commit `c3cb8f3`.

### Userscript (v4.0.15) — embedded-resource harvesting (KEPT, on hold for backend)
- `extractLessonContent` now harvests `<a href>` file links (pdf/doc/docx/ppt/pptx/xls/xlsx/txt/md/csv/rtf/odt/ods/zip/code/tex) inside lesson pages as `resources[]`.
- Background fetch via `fetchFileAsBase64` (real bytes), kept inline base64 when < 1.5 MB.
- Payload sends `resources: lesson.resources` on `sync_lesson`. Commit `c9f2f734`.
- **BLOCKED**: backend has no `resources` handler yet (would need to store + extract PDF text/images). Client-side harvest ships; server storage pending.

---
## PENDING (next to do)

### Frontend (worksite.html) — user-requested
- [x] **Drive Preview panel** — replaced the old "Resource Directory" (469-file grid) with a single **Drive Preview** panel showing the ~3 Drive-folder files (master doc / schedule sheet / manifest) each with a **Copy Link** + **Open** button, plus Copy-All-Links, Open Drive Folder, Last Sync. Single panel (no duplicate). Verified live: 3 items render with working copy+open. Commit `c0dac9f`.
- [x] **Backfilled `masterDocUrl`** into worksites.json for 27 worksites (Drive folder → (MASTER) doc). Commit `f4765a1`. NOTE: regenerated on Apps Script sync; frontend shows 2 items if missing.
- [x] **Copy All Links** → copies all Drive file URLs (master/schedule/manifest/folder). Verified live. Commit `cb9f393`.

### Calendar event filter (NEW, user-requested 2026-09-14)
- [x] **Do NOT add calendar events containing the phrase '0 attendees'** (also '0 attendee' / meeting spam). INGM and Engineering Undergraduate calendars are filled with "meeting" spam — filter these out during sync so they never reach Google Calendar.
  - **DONE in userscript v4.0.16** (commit `949cc33`): `syncCalendar` now filters events whose title+description match `/0 attendees?|no attendees?/i` before caching/syncing. CDN purged & verified serving v4.0.16.
  - Existing spam events already in the Google Calendars/Drive sheets were NOT removed — needs a cleanup pass if desired.

### Backend / account (user-requested)
- [ ] Add `resources` handler to Apps Script backend (store embedded lesson links/PDFs + extract PDF text/images into master doc).
- [ ] Verify the Apps Script project is ALSO owned by efundihax@gmail.com (not personal). If the deployment runs as personal account, re-deploy as efundihax.

### Standing
- [ ] Add scheduled/standing "sync everything incl. lesson pages" coverage.