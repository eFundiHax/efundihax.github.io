# eFundiHax Architectural Design Document

## Overview
eFundiHax is an autonomous synchronization bridge between NWU eFundi (Sakai LMS) and Google Drive/Sheets/Calendar, coupled with a GitHub Pages AI Command Center dashboard (`efundihax.github.io`) and static web tools.

---

## Architecture Components

### 1. Userscript (`userscript.txt`) — Tampermonkey
- **Role**: Runs inside active eFundi sessions.
- **Discovery**: Automatically collects enrolled worksites from the portal (`/portal/site/...`).
- **Crawling (iframe-based)**:
  - **Announcements**: Extracts titles, dates, author, and HTML body snippets.
  - **Resources**: Crawls folders, sniffs file magic bytes (real extensions over URL guesses), downloads files, compresses images (max 800px, quality 0.85), and packages attachments.
  - **Lessons**: Crawls all lesson pages, traverses Docstream AST, extracts text, images, and now **embedded links and PDFs** as first-class resources (background fetch, text extraction, image packaging).
  - **Calendar**: Gathers assessment dates, assignments, and test schedules.
- **Sync**: Posts payload via `GM_xmlhttpRequest` to the Apps Script `/exec` backend.

### 2. Google Apps Script Backend (`AKfycbz49mtRkKKOaLdMryWrHAaTX7yR5cZ71_xOnUPgWQywi6lRWkszOhCsf_U4_NcONz9q/exec`)
- **Role**: Receives sync payloads authenticated via secret (`trackmania_is_peak`).
- **Google Drive Storage**:
  - Creates/updates `(MASTER) {siteTitle}` Google Docs for course notes and lesson content.
  - Creates/updates `(SCHEDULE) {siteTitle}` Google Sheets for Announcements and Calendar Events.
  - Maintains a file manifest text file and course folder structure.
- **Google Calendar**: Creates or updates dedicated Google Calendars for course schedules, syncing all events with color coding (assignments=red, quizzes=orange).
- **Static Hosting Support**: Generates `worksites.json` and manifest files read by the frontend.

### 3. GitHub Pages Dashboard (`index.html` & `worksite.html`)
- **AI Command Center**: Terminal-style search hub (`efundihax.github.io`).
- **Search & Filter**: Instant client-side search across all synced worksites (A-Z or Popular by views).
- **Multi-Select & NotebookLM Export**: Select multiple worksites and copy spreadsheet URLs in one click.
- **Worksite Detail (`worksite.html`)**: Rich per-module view showing announcements, upcoming dates (auto-scrolled to current date), synced resource directory, Google Calendar embed, and `.ics` download.
- **Campus Map & Schedule AI**: Live OpenStreetMap embed of Potchefstroom campus and interactive schedule query assistant.

---

## Optimization & Roadmap
1. **Embedded Resource Harvesting**: Automatically follow links and PDFs inside lesson pages, treat them as downloadable course resources in the manifest.
2. **Parallel Stream Compression**: Batch image compression and parallel downloads to prevent browser throttling.
3. **Smart Caching**: Skip re-uploading unchanged resources via content hashing.
4. **Master Doc Splitting (PENDING, NotebookLM limit):** A single master doc must stay under NotebookLM's **per-source limit of 500,000 words / 200 MB** (per Google's published limits — there is NO 50K-character cap; the user's 50K figure was a guess). When a course's content exceeds this, split the master doc into numbered parts (e.g. `(MASTER) {title} — Part 1`, `Part 2`, …) so each part fits as its own NotebookLM source. Implement in the Apps Script backend at write time (log current word/char count per part, roll to a new part on overflow, keep a manifest entry mapping parts). Frontend Drive Preview should list each part as its own row.
5. **Build Drive listing into the manifest (PENDING):** The static dashboard can't query a Google Drive folder (no auth/CORS), so files the user drops directly into the Drive folder never appear. Fix: the Apps Script **backend** (runs as efundihax@gmail.com, has Drive access) adds a **`[DRIVE_FOLDER]` section to each worksite's manifest** on every sync — listing every file currently in that folder (id, name, mimeType, modifiedDate). The frontend Drive Preview then reads this same-origin manifest section to show ALL Drive folder files (core 3 + anything the user added), each with Copy/Open. This also survives on the static site because it's baked into the committed manifest.
