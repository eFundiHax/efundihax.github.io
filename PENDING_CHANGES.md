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

### Planned (added 2026-09-14, not yet built)
- [ ] **Drive folder listing via manifest** — user drops files into the Drive folder manually; static dashboard can't list Drive (no auth/CORS). Plan: backend adds a `[DRIVE_FOLDER]` section to each worksite's manifest on sync, listing ALL files in the folder (id/name/mimeType/modifiedDate). Frontend Drive Preview reads the section → shows every folder file, incl. ones the user added. See DESIGN_DOC.md item 5.
- [ ] **Master doc splitting (NotebookLM limit)** — NotebookLM's published per-source limit is **500,000 words / 200 MB per source** (NOT 50K characters — no such public cap exists; the 50K figure was the user's guess). **Automatic rolling when near limit:** before writing a synced doc, the backend estimates `current_master_length + incoming_doc_length`; if the sum lands **within 95% of the limit**, it does NOT append — it creates a **new master doc** with same base name + numeric suffix (`(MASTER) {title}`, `{title} 2`, …) and continues there. Old parts never deleted/merged (system keeps running), each part stays under the limit. **SAVE FOR LATER — do not implement now.** See DESIGN_DOC.md item 4.

---

## 2026-09-16 — INGM122 lesson sync FIXED (root cause → deployed → verified end-to-end)

### What was broken
Apps Script backend `sync_resources` handler had a **`ReferenceError: lessons is not defined`** at L631 (stale-purge block referencing undefined `lessons`). Every `sync_resources` call crashed → no lessons synced for INGM122 → NotebookLM couldn't find lab info.

### Fixes (all live & verified)
1. **Backend (Apps Script v75, deployed)** — removed the dead stale-purge block (L626-641) that referenced undefined `lessons`. New deployment: `AKfycbwYf2Z2DfnJ7WBwG7w7nlwn_b1XsZqpO9NyFiDuXDUBAHg8WU54JOQE3tJbFUvaCC0`. sync_resources now returns ok (breadcrumb confirmed).
2. **Userscript v4.0.19** (live on raw GitHub + jsDelivr) — three fixes:
   - **U106 dedup key** now includes `payload.lessonUrl`/`siteId` so each lesson POST has a unique key (was: all 19 share one key → 18 blocked as "duplicate").
   - **Serialized lesson POSTs** (sequential chain instead of `Promise.all`) — backend LockService (20s) made parallel POSTs hit "busy" and time out; sequential posts each get the lock cleanly.
   - **Resilient chain**: a failed lesson no longer kills the batch; it logs `Failed lesson: … (continuing)` and moves on. Also `post()` now rejects non-ok responses so `onerror` retry logic engages.

### End-to-end verification (live browser, CDP)
- Before: manifest had 3 lesson hashes, master doc had NO lesson content (2.9KB).
- After: **18/19 lessons appended to master doc (484KB)**, 1 failed (Assessment Information — huge page, network timed out; auto-retries next page load since hash not saved).
- Master doc now contains: Practical Administration ×15, Practical Activities ×12, Study Units ×18+, 144 "lab" mentions.
- All 29 manifests updated with SYNCED lesson entries.
- Sync completes cleanly: "Module sync complete, continuing full sync..." → full site sweep.

### Remaining
- [ ] Assessment Information lesson (only 1 of 19 failed) — will auto-retry on next page load.
- [ ] Sync status indicator (user-requested) — now UNBLOCKED since backend fix is verified working, but still NOT implemented (per earlier instruction).

---

## 2026-09-14 — INGM122 NotebookLM failure: root cause + new feature request

### Root cause investigation (INGM122 "Practical Administration" missing from master doc)

**Problem reported:** INGM122 NotebookLM couldn't find the lab info, even though the lesson ("Practical Administration" on eFundi) clearly states it.

**Findings (verified against live eFundi via CDP on Chrome debug):**

1. The INGM122 manifest LESSON HASHES contain only 3 itemIds: `23818437` (Module Assistance), `23818438` (Assessment Info), `23818513` (Module Orientation). **Missing:** 12+ pages including Practical Administration (`23818508`), Practical Activities (`23818509`), Study Units 1-8, Welcome, Getting Started, FAQs.
2. Master doc export confirms "Lab schedule" text is **absent**.
3. Replaying `extractLessonContent` on the live page → content IS present (31KB clean text, lab text survives GARBAGE_SELECTORS removal). The extraction logic is sound.
4. Live eFundi console `window.__efhConsole` shows: **`ReferenceError: lessons is not defined`** thrown during `sync_resources` for INGM122 (at 08:10:33 and 08:11:21). The sync version running on eFundi is **v4.0.14** (stale — disk is v4.0.16).
5. The `parseLessonPages` enumeration (DOM + subnav fallback) DOES correctly list all 19 pages including Practical Admin. The problem is NOT enumeration — it's that the server-side `sync_resources` handler crashes before processing lesson data.

**Root cause:** Apps Script backend `sync_resources` handler references an undefined `lessons` variable (server-side `ReferenceError`), causing every `sync_resources` call to fail silently. The 12+ missing INGM122 lessons were added to eFundi after the last successful lesson sync, and every subsequent sync crashes before it can capture them.

**Fix required (backend, not userscript):**
1. Update the Apps Script backend to fix the undefined `lessons` variable in the `sync_resources` handler.
2. Redeploy the backend (currently pinned to an old version via deployment; update requires Deploy → New version).
3. Trigger a manual sync for INGM122 to backfill the 12 missing lessons.

**Action needed from user:** Re-auth the Apps Script backend, fix the `lessons` variable reference in `sync_resources`, redeploy, and verify via `window.__efhConsole` that the error no longer appears.

---

### Sync status indicator (user-requested 2026-09-14, not yet implemented)

**Request:** On the worksite dashboard page, add a small indicator (like the announcement sync indicator already present) to show whether each lesson page has been synced. For embedded resources, show a **red border** if not synced, and display their status on hover.

**Details to implement (NOT STARTED, pending backend fix above):**
- Each lesson in the dashboard gets a small status icon: ✅ synced (green/checked), ⚠️ unsynced (red), 🔄 in-progress.
- Embedded resources (links/images in lessons) show a red border when their backing file is not in the Drive folder; hover tooltip shows: `Not synced — file not found in Drive folder` or `Synced — <filename>` or `Partial — images synced, text not extracted`.
- Status is driven by comparing the lesson's last-sync hash (from manifest LESSON HASHES) against the live DOM, and checking embedded resources against the manifest's FILE REGISTRY / DRIVE FOLDER sections.
- Implementation depends on the backend fix above (without a working `sync_resources` + lesson sync, status data is stale/meaningless).