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
- [ ] **Copy All Links** button → should copy ONLY the folder link (currently copies folder + spreadsheet + manifest + source files). Fix to copy just `folderUrl`.
- [ ] **Drive Preview** panel — never added. Add a panel previewing the synced Drive docs (from manifest/`folderUrl`).

### Backend / account (user-requested)
- [ ] Add `resources` handler to Apps Script backend (store embedded lesson links/PDFs + extract PDF text/images into master doc).
- [ ] Verify the Apps Script project is ALSO owned by efundihax@gmail.com (not personal). If the deployment runs as personal account, re-deploy as efundihax.

### Standing
- [ ] Add scheduled/standing "sync everything incl. lesson pages" coverage.