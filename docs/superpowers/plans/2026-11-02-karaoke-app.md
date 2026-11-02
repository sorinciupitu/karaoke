# Karaoke App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-hosted, mobile-ready karaoke web app: paste a YouTube URL → instrumental + Romanian-default synced lyrics (editable, re-syncable), playlists with crossfade, per-account auth, one-line Docker install on port 7777.

**Architecture:** Docker Compose with two services — `web` (Nginx serving the React SPA, proxying `/api` and `/media`) and `app` (FastAPI: REST API, SQLite persistence, a single background worker running the yt-dlp → Demucs → Whisper/LRCLIB pipeline, and media streaming with ownership + Range). Frontend is a React + Vite + Tailwind + Framer Motion SPA with a Web Audio crossfade player.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.x, Pydantic v2, PyJWT, passlib[bcrypt], yt-dlp, demucs, faster-whisper, httpx, uvicorn, ffmpeg; React 18, Vite 5, TypeScript, Tailwind CSS 3, Framer Motion, react-router-dom 6, lucide-react, vitest; Docker Compose, Nginx.

**Spec:** `docs/superpowers/specs/2026-11-02-karaoke-app-design.md`

## Global Constraints

- App UI language is **Romanian** (all labels/buttons/messages).
- Lyrics transcription **defaults to Romanian** (`language="ro"`), overridable per track.
- Per-user isolation: every track, playlist, and media file is scoped to its owning user; cross-user access returns 404 (not 403, to avoid leaking existence).
- Port **7777**; media is served only through the API with ownership check + HTTP Range.
- Whisper model default `medium`, configurable via settings; CPU-only.
- Docker images are **multi-arch** (`linux/amd64` + `linux/arm64`).
- Every git commit message ends with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

1. **Per-user isolation leak:** user B must not read/list/play user A's track, playlist, or media (return 404). → Task 5 (tracks ownership), Task 6 (media ownership), Task 7 (playlists ownership).
2. **Range request past EOF:** a seek to/ past the end must return `206` with a correct, non-empty `Content-Range`/`Content-Length`, not 416 or a hang. → Task 6.
3. **Partial success:** if Demucs succeeds but lyrics fail, the track must still be `ready`/playable, with `lyrics_status=failed` and a retry path. → Task 4 (pipeline).
4. **Playlist reorder corruption:** a reorder payload with duplicate or unknown track ids must be rejected without corrupting stored order. → Task 7.
5. **Worker restart mid-job:** a track interrupted after separation must resume at the encoding stage, not redo download/separation. → Task 4.

---

### Task 1: Repo scaffold, backend config, DB models

**Files:**
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/models.py`
- Create: `backend/tests/conftest.py`, `backend/tests/test_models.py`
- Create: `.gitignore`, `.env.example`
- Init git repo (if not already) and make the initial commit.

**Interfaces:**
- Produces: `Settings` (pydantic BaseSettings) with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SECRET_KEY`, `DATABASE_URL`, `MEDIA_DIR`, `MODELS_DIR`, `WHISPER_MODEL="medium"`, `WHISPER_LANGUAGE="ro"`; SQLAlchemy `Base`, `SessionLocal`, `get_db()` dependency; models `User`, `Track`, `Playlist`, `PlaylistTrack`, `UserSettings` with the exact columns from the spec.

- [ ] **Step 1: Write failing tests** in `tests/test_models.py` — create a `User`, a `Track` (with `status="queued"`, `lyrics_status="pending"`, `lyrics` JSON = `[{"text":"hai","start":0.0,"end":1.0}]`), a `Playlist` and a `PlaylistTrack` with a float `position`, assert round-trips and that `Track.lyrics` deserializes to a list of dicts with `text/start/end`.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_models.py -q` → FAIL (imports missing).

- [ ] **Step 3: Implement `config.py`, `db.py`, `models.py`** — SQLAlchemy 2.0 declarative models with a JSON `lyrics` column (default `[]`), a `user_id` FK on Track/Playlist, and a float `position` on PlaylistTrack. `db.py` exposes an engine bound to `DATABASE_URL`, a `SessionLocal`, and a `get_db` generator. `create_all` runs on startup (no Alembic).

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_models.py -q` → PASS.

- [ ] **Step 5: Commit** — `git init && git add -A && git commit -m "chore: scaffold backend, config, and data models"`.

### Task 2: Auth (hashing, JWT cookie, deps, endpoints, admin seed)

**Files:**
- Create: `backend/app/auth.py`, `backend/app/schemas.py`, `backend/app/routers/__init__.py`, `backend/app/routers/auth.py`, `backend/app/main.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `User`, `SessionLocal`, `Settings`.
- Produces: `hash_password(pw) -> str`, `verify_password(pw, hash) -> bool`, `create_access_token(user_id) -> str`, `decode_token(token) -> int|None`; dependencies `get_current_user`, `require_admin`; routes `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. `main.py` adds middleware that rejects any mutating request (`POST/PUT/PATCH/DELETE`) lacking the `X-Requested-With` header with 403 (CSRF defense alongside the `SameSite=Lax` cookie).

- [ ] **Step 1: Write failing tests** — `POST /auth/login` with the seeded admin credentials sets an `httpOnly` cookie and returns `{id, username, is_admin}`; wrong password → 401; `GET /auth/me` with the cookie returns the user; `GET /auth/me` without → 401; `POST /auth/logout` clears it.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_auth.py -q` → FAIL.

- [ ] **Step 3: Implement** — bcrypt via passlib, PyJWT token (sub=user_id, exp=7 days) set as an `httpOnly, SameSite=Lax` cookie. `main.py` wires the auth router, runs `create_all`, and seeds the admin from `Settings` on startup (idempotent).

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_auth.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: auth with JWT cookie and admin seed"`.

### Task 3: Lyrics domain logic (LRC parse + word grouping)

**Files:**
- Create: `backend/app/pipeline/__init__.py`, `backend/app/pipeline/lyrics.py`
- Test: `backend/tests/test_lyrics.py`

**Interfaces:**
- Produces: `Line` dataclass `(text: str, start: float, end: float)`; `Word` dataclass `(start: float, end: float, text: str)`; `parse_lrc(lrc: str) -> list[Line]`; `group_words(words: list[Word], *, max_gap: float = 1.0, max_chars: int = 60) -> list[Line]`.

- [ ] **Step 1: Write failing tests** — `parse_lrc` on `"[00:12.34]primul vers\n[00:15.00]al doilea"` → two lines with `start` 12.34 and 15.0 and `end` = next line's start (last line `end` = start + 3.0). `group_words` on words `[(0,0.5,"a"),(0.6,1.0,"b"),(1.8,2.2,"c")]` with `max_gap=1.0` → two lines (`"a b"` and `"c"`), because the 0.8s gap exceeds `max_gap`.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_lyrics.py -q` → FAIL.

- [ ] **Step 3: Implement both functions** — `parse_lrc` handles `[mm:ss.xx]` timestamps, metadata tags (`[ar:...]` etc.) skipped; `group_words` merges consecutive words whose inter-word gap ≤ `max_gap` and whose line length ≤ `max_chars`.

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_lyrics.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: LRC parser and word-to-line grouping"`.

### Task 4: Pipeline runner + status machine + worker

**Files:**
- Create: `backend/app/pipeline/download.py`, `separate.py`, `transcribe.py`, `encode.py`, `runner.py`
- Create: `backend/app/jobs/__init__.py`, `backend/app/jobs/worker.py`
- Test: `backend/tests/test_pipeline.py`

**Interfaces:**
- Consumes: `Track`, `Line`/`Word`, `Settings`.
- Produces: `run_track(track_id: int)` — advances `status` `queued → downloading → separating → encoding → ready` and `lyrics_status` `pending → ready|failed`; sets `instrumental_path/original_path/vocals_path`, `lyrics`, `lyrics_source`, `duration`, `error`. External tool calls (`yt-dlp`, `demucs`, `faster-whisper`, LRCLIB `httpx`) are module-level functions that tests monkeypatch. Worker loop `start_worker()` polls for the next `queued`/`pending` track and runs `run_track`.

- [ ] **Step 1: Write failing tests** (monkeypatch download/separate/transcribe/encode): a full successful run ends `status=ready, lyrics_status=ready`; when transcription raises, the track still ends `status=ready, lyrics_status=failed` with `error` set (Review Focus #3); a run interrupted after `separate` (encode raises once) and re-run resumes by calling `separate` **not** again, using recorded stage (Review Focus #5); LRCLIB hit → `lyrics_source="lrclib"`, miss → whisper → `"whisper"`.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_pipeline.py -q` → FAIL.

- [ ] **Step 3: Implement** — each stage persists its output path + sets the next status *before* the heavy work; the runner reads the current stage and resumes. `transcribe.py` uses `faster-whisper` with `language="ro"` and word timestamps → `group_words` → `Line` list; LRCLIB fetch happens first.

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_pipeline.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: audio pipeline runner and resumable worker"`.

### Task 5: Tracks API (CRUD, cancel, retry, lyrics endpoints)

**Files:**
- Create: `backend/app/routers/tracks.py`
- Test: `backend/tests/test_tracks.py`

**Interfaces:**
- Consumes: `get_current_user`, `run_track`/worker enqueue, `Track`, `Line`.
- Produces: `POST /api/tracks` (body `{youtube_url}`), `GET /api/tracks`, `GET/PATCH/DELETE /api/tracks/{id}`, `POST /api/tracks/{id}/cancel`, `POST /api/tracks/{id}/retry`, `PUT /api/tracks/{id}/lyrics` (body `{lines:[{text,start,end}]}`), `POST /api/tracks/{id}/lyrics/resync`, `POST /api/tracks/{id}/lyrics/refetch`, `POST /api/tracks/{id}/lyrics/retry`.

- [ ] **Step 1: Write failing tests** — create a track as user A, then assert user B gets **404** on `GET/DELETE/PATCH` of it (Review Focus #1); `PUT /lyrics` stores edited lines and returns them; `PATCH` title/artist persists; `DELETE` removes it; `GET /api/tracks` returns only the caller's tracks.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_tracks.py -q` → FAIL.

- [ ] **Step 3: Implement** — ownership scoping via `Track.user_id == current_user.id` else 404; `cancel`/`retry` flip status and (re)enqueue; `resync`/`refetch`/`retry` enqueue the appropriate lyrics-only job.

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_tracks.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: tracks API with ownership and lyrics actions"`.

### Task 6: Media streaming (auth + ownership + Range)

**Files:**
- Create: `backend/app/media.py`, `backend/app/routers/media.py`
- Test: `backend/tests/test_media.py`

**Interfaces:**
- Consumes: `get_current_user`, `Track`.
- Produces: `GET /media/{track_id}/{stream}` where `stream ∈ {instrumental, original, vocals}`, returning the file bytes with `Content-Range`/`206` support.

- [ ] **Step 1: Write failing tests** — owner gets `200` and full bytes for a file; owner gets `206` with correct `Content-Range: bytes 0-9/…` and 10 bytes for `Range: bytes=0-9`; a `Range` starting past EOF returns `206` with `Content-Range: bytes */<size>` and empty body (Review Focus #2); user B gets **404** on user A's track (Review Focus #1).

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_media.py -q` → FAIL.

- [ ] **Step 3: Implement** — resolve `{stream}` to the track's stored path, enforce ownership, then serve via a manual `Range` header parse + `StreamingResponse` (or `FileResponse` for full range) with the correct status/headers.

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_media.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: authenticated media streaming with Range"`.

### Task 7: Playlists + Settings + Users (admin) APIs

**Files:**
- Create: `backend/app/routers/playlists.py`, `backend/app/routers/settings.py`, `backend/app/routers/users.py`
- Test: `backend/tests/test_playlists.py`, `backend/tests/test_settings_users.py`

**Interfaces:**
- Consumes: `get_current_user`, `require_admin`, `Track`, `Playlist`, `UserSettings`.
- Produces: `GET/POST /api/playlists`, `GET/PATCH/DELETE /api/playlists/{id}`, `POST/DELETE /api/playlists/{id}/tracks`, `PUT /api/playlists/{id}/tracks/order` (body `{track_ids:[...]}`); `GET/PATCH /api/settings` (`crossfade_enabled`, `crossfade_seconds`, `whisper_model`); `GET/POST /api/users`, `DELETE /api/users/{id}`.

- [ ] **Step 1: Write failing tests** — reorder persists the given order (assert `position` sequence matches `track_ids` order); reorder with a duplicate id → 422 and unchanged order (Review Focus #4); playlist of user A is 404 for user B; non-admin hitting `/api/users` → 403, admin can create/delete a user; `PATCH /api/settings` updates crossfade seconds and reads back.

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_playlists.py tests/test_settings_users.py -q` → FAIL.

- [ ] **Step 3: Implement** — float `position` reorder (assign `position = index`); validate `track_ids` are unique, non-empty, and all belong to a playlist of the caller; settings are upserted per `user_id`.

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_playlists.py tests/test_settings_users.py -q` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: playlists, settings, and admin users APIs"`.

### Task 8: Frontend scaffold + auth flow (Romanian UI)

**Files:**
- Create: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/api/client.ts`, `src/auth/AuthContext.tsx`, `src/pages/Login.tsx`, `src/lib/theme.ts`
- Test: `frontend/src/lib/theme.test.ts`

**Interfaces:**
- Consumes: auth endpoints from Task 2.
- Produces: an authenticated `fetch` client (sends the session cookie and sets `X-Requested-With: fetch` on all mutating requests), `AuthProvider` with `user`, `login`, `logout`; a `Login` page (Romanian labels) and a route guard redirecting unauthenticated users to `/login`.

- [ ] **Step 1: Write failing test** — `src/lib/theme.test.ts` (vitest): a `formatDuration(95)` → `"1:35"` and `formatDuration(3605)` → `"1:00:05"` helper (used across the player).

- [ ] **Step 2: Run to verify fail** — `cd frontend && npx vitest run` → FAIL.

- [ ] **Step 3: Implement** — scaffold Vite + React + TS + Tailwind + Framer Motion + react-router; implement `client.ts`, `AuthContext`, `Login`, and the route guard. All visible strings in Romanian.

- [ ] **Step 4: Run to verify pass** — `cd frontend && npx vitest run && npm run build` → PASS (test green, build succeeds).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: frontend scaffold and Romanian auth flow"`.

### Task 9: Library page (add URL, list, progress)

**Files:**
- Create: `frontend/src/pages/Library.tsx`, `frontend/src/components/TrackCard.tsx`, `frontend/src/components/AddTrackForm.tsx`, `frontend/src/api/tracks.ts`
- Test: `frontend/src/lib/library.test.ts`

**Interfaces:**
- Consumes: tracks endpoints from Task 5.
- Produces: an `AddTrackForm` (YouTube URL input + submit), a `Library` list that polls `GET /api/tracks` every 2s while any track is not `ready`/`failed`, and a per-track status label in Romanian (`în așteptare`, `se descarcă`, `se separă vocea`, `se transcriu versurile`, `gata`, `eroare`).

- [ ] **Step 1: Write failing test** — `src/lib/library.test.ts`: `statusLabel(status, lyrics_status)` maps the six statuses to the exact Romanian labels above.

- [ ] **Step 2: Run to verify fail** — `cd frontend && npx vitest run` → FAIL.

- [ ] **Step 3: Implement** — the three components + polling hook; statuses shown with animated progress (Framer Motion).

- [ ] **Step 4: Run to verify pass** — `cd frontend && npx vitest run && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: library page with add-track and progress"`.

### Task 10: Player engine (Web Audio crossfade) + bottom bar

**Files:**
- Create: `frontend/src/audio/player.ts`, `frontend/src/audio/lyricsSync.ts`, `frontend/src/components/PlayerBar.tsx`
- Test: `frontend/src/audio/lyricsSync.test.ts`, `frontend/src/audio/player.test.ts`

**Interfaces:**
- Consumes: `/media/{track_id}/{stream}`, settings from Task 7.
- Produces: `findActiveLineIndex(lines, time)` → active line index or -1; `crossfadeTiming(duration, fadeSeconds)` → `{fadeOutAt, startNextAt}`; a `PlayerEngine` class managing two `<audio>` elements with gain nodes, `play(track)`, `next()`, `setCrossfade(enabled, seconds)`, `toggleInstrumental()` (switch `instrumental`/`original` stream).

- [ ] **Step 1: Write failing tests** — `findActiveLineIndex` returns the line whose `start<=time<end`, `-1` before the first and after the last; `crossfadeTiming(180, 5)` → `{fadeOutAt:175, startNextAt:175}` (fade begins `fadeSeconds` before end).

- [ ] **Step 2: Run to verify fail** — `cd frontend && npx vitest run` → FAIL.

- [ ] **Step 3: Implement** — `PlayerEngine` uses Web Audio `GainNode`s: on `next()` it schedules a gain ramp down of the current source and a ramp up of the next over `fadeSeconds` when crossfade is enabled, else a clean stop/start. `PlayerBar` renders now-playing, prev/next, seek, crossfade toggle + seconds, instrumental/original toggle.

- [ ] **Step 4: Run to verify pass** — `cd frontend && npx vitest run && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Web Audio crossfade player and bottom bar"`.

### Task 11: Track detail — synced lyrics + editor

**Files:**
- Create: `frontend/src/pages/TrackDetail.tsx`, `frontend/src/components/LyricsView.tsx`, `frontend/src/components/LyricsEditor.tsx`

**Interfaces:**
- Consumes: `findActiveLineIndex`, tracks lyrics endpoints from Task 5.
- Produces: a `LyricsView` that highlights the active line (Framer Motion spring) as the player progresses; a `LyricsEditor` to edit each line's text, add/remove lines, nudge start times, edit title/artist, and buttons `Re-sincronizează`, `Recaută versuri`, `Reîncearcă transcrierea` wired to the three lyrics endpoints.

- [ ] **Step 1: Write failing test** — `src/lib/lyricsEdit.test.ts`: `applyLineEdit(lines, index, {text})`, `removeLine(lines, index)`, and `nudgeLine(lines, index, delta)` produce the expected `Line[]` (pure helpers used by the editor).

- [ ] **Step 2: Run to verify fail** — `cd frontend && npx vitest run` → FAIL.

- [ ] **Step 3: Implement** — the three components; the editor edits local state and saves via `PUT /lyrics`; the three action buttons call the corresponding endpoints and poll until `lyrics_status` settles.

- [ ] **Step 4: Run to verify pass** — `cd frontend && npx vitest run && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: synced lyrics view and editor"`.

### Task 12: Playlists page (drag-and-drop reorder)

**Files:**
- Create: `frontend/src/pages/Playlists.tsx`, `frontend/src/components/PlaylistEditor.tsx`

**Interfaces:**
- Consumes: playlists endpoints from Task 7.
- Produces: create/rename/delete playlists, add tracks (from library) to a playlist, and reorder via Framer Motion `Reorder` (drag-and-drop) that persists via `PUT /api/playlists/{id}/tracks/order`.

- [ ] **Step 1: Write failing test** — `src/lib/reorder.test.ts`: `reorderIds(ids, from, to)` returns the array with the item moved (pure helper for optimistic reorder).

- [ ] **Step 2: Run to verify fail** — `cd frontend && npx vitest run` → FAIL.

- [ ] **Step 3: Implement** — the two components with drag-and-drop and optimistic update + rollback on failure.

- [ ] **Step 4: Run to verify pass** — `cd frontend && npx vitest run && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: playlists with drag-and-drop reorder"`.

### Task 13: Admin users page

**Files:**
- Create: `frontend/src/pages/Admin.tsx`

**Interfaces:**
- Consumes: users endpoints from Task 7.
- Produces: an admin-only page to list, create (username + password), and delete accounts, shown in the nav only when `user.is_admin`.

- [ ] **Step 1: Implement** — the page with Romanian labels and a confirmation dialog before delete.

- [ ] **Step 2: Verify** — `cd frontend && npm run build` → PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: admin users page"`.

### Task 14: Docker, Nginx, install script, README

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `nginx/nginx.conf`, `docker-compose.yml`, `install.sh`, `README.md`

**Interfaces:**
- Consumes: all of the above.
- Produces: a `docker compose up` that serves the SPA on port 7777 with `/api` and `/media` proxied to the app; an `install.sh` that on Linux installs Docker+Compose if missing, on macOS detects Docker Desktop/Colima (guides if missing), writes `.env` from `.env.example`, and runs `docker compose up -d`; a Romanian README with the one-line install command and the model-download note.

- [ ] **Step 1: Implement** — `backend/Dockerfile` (Python 3.11-slim, ffmpeg, pip install with CPU torch/demucs/faster-whisper), `frontend/Dockerfile` (node build → static), `nginx.conf` (SPA fallback, `/api`+`/media` proxy), `docker-compose.yml` (volumes `data`/`media`/`models`, `PORT=7777`), `install.sh`, `README.md`. Use `docker buildx` for `linux/amd64` + `linux/arm64`.

- [ ] **Step 2: Verify** — `docker compose config -q` passes; `bash -n install.sh` passes; `bash install.sh` (dry run) prints the plan without erroring.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: docker compose, nginx, and one-line installer"`.

### Task 15: Push to GitHub (create `karaoke` repo)

**Files:**
- None (git remote + push).

- [ ] **Step 1: Create remote** — `gh repo create karaoke --public --source=. --push` (or add remote `https://github.com/sorinciupitu/karaoke.git` and push `main`).

- [ ] **Step 2: Verify** — `git remote -v` shows the repo and `git push -u origin main` succeeds; repo is public.

- [ ] **Step 3: Confirm install URL** — the README's `curl -fsSL https://raw.githubusercontent.com/sorinciupitu/karaoke/main/install.sh | bash` resolves.
