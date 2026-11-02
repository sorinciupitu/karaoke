# Karaoke App — Design Document

Date: 2026-11-02
Status: Final (awaiting owner approval)

## Intent & Why

A self-hosted, mobile-ready web app for personal karaoke. The owner pastes a
YouTube URL; the app downloads the best-quality audio, produces an
instrumental (vocal removal), obtains the lyrics (original, synced, from a
lyrics database when possible; otherwise AI transcription the owner can
correct), and plays the track with karaoke-style synchronized lyrics.

**Strictly personal use**: accounts exist to keep strangers out of a
publicly-exposed instance. No public registration, no distribution of any
processed content, no uploading of the owner's audio to any third party.

## Goals

- Paste a YouTube URL → automatic pipeline → a playable karaoke track
  (instrumental + synchronized, editable lyrics), with visible progress.
- Lyrics editing after detection: fix text, add/remove lines, adjust line
  timing, and re-synchronize edited text to the audio.
- Playlists with manually arranged, persisted track order (drag-and-drop).
- A crossfade toggle in the player (seamless DJ-style transition between
  tracks), with adjustable duration.
- User/password authentication; admin creates accounts.
- Mobile-ready, modern UI with professional micro-animations.
- One-line install on any Linux/macOS server (Docker), exposed on port 7777.

### Localization

- **App UI language is Romanian** (all labels, buttons, and messages).
- **Lyrics transcription defaults to Romanian** (overridable per track).

## Non-goals

- No distribution or sharing of songs or processed content.
- No public registration or social/OAuth login.
- No multi-tenant / SaaS; single self-hosted instance.
- No streaming from services other than YouTube download.

## Anti-goals (what would make this a failure)

- Uploading the owner's audio anywhere (only LRCLIB is queried, with track
  metadata text — never audio).
- Requiring a GPU (must run on a plain CPU server).
- An install that doesn't actually work "anywhere" (Linux + macOS).
- Anyone other than the owning account being able to read another account's
  tracks, playlists, or audio files.

## Constraints

- CPU-only processing: Demucs and Whisper run on CPU. Slow is acceptable
  (background jobs); it must not block the UI.
- Docker for portability and reproducibility. Images built multi-arch
  (linux/amd64 + linux/arm64); the owner's primary target is a home Mac
  (Apple Silicon), exposed via port forwarding.
- On macOS, Docker Desktop or Colima is a prerequisite (the install script
  cannot cleanly auto-install Docker there; it guides the owner, and
  auto-installs Docker only on Linux).
- Single host, SQLite for storage (sufficient for personal scale).
- Port 7777 (HTTP); TLS is the owner's responsibility via their port
  forwarding / tunnel.
- First run downloads ~3 GB of AI models (cached in a Docker volume).

## Approaches considered

1. **Docker + Python (FastAPI) + React (chosen).** Audio pipeline in Python
   (yt-dlp, Demucs, Whisper, LRCLIB); React SPA frontend; Nginx serving the
   SPA and proxying `/api` and `/media` to the API. One-line install script
   that installs Docker (Linux) / guides the owner (macOS) and runs
   `docker compose up`.
2. **No-Docker monolith Python.** Same backend serving a compiled frontend;
   install script provisions Python/ffmpeg/deps natively. Smaller footprint,
   but fragile across Linux distros and macOS (ffmpeg/PyTorch), so it can't
   guarantee "one command that works anywhere". Rejected for that reason.
3. **Node full-stack + Python CLI workers.** Two runtimes orchestrated
   awkwardly. Rejected.

## Architecture

Docker Compose services:

- **`web` (Nginx)** — serves the built React SPA and reverse-proxies `/api`
  and `/media` to the API. (Media is not served directly from the volume:
  see Security.)
- **`app` (FastAPI)** — REST API, auth, jobs, the audio pipeline, media
  streaming, and a single background worker (concurrency 1, CPU-bound). Jobs
  are persisted in SQLite so they survive restarts.
- Shared volumes: `media` (audio outputs), `models` (cached AI models),
  `data` (SQLite).

### Data model (SQLite)

- `users` — id, username, password_hash (bcrypt/argon2), is_admin, created_at.
- `tracks` — id, user_id, title, artist, youtube_url, youtube_id,
  status, lyrics_status, error, duration, instrumental_path, original_path,
  vocals_path, lyrics (JSON lines), lyrics_source, language, created_at.
- `playlists` — id, user_id, name, created_at.
- `playlist_tracks` — id, playlist_id, track_id, position (float for stable
  reordering), added_at.
- `settings` — user_id, crossfade_enabled, crossfade_seconds, whisper_model,
  created/updated.

**Per-user isolation (owner decision: private per account).** Every track,
playlist, and media file belongs to exactly one user. Every query and every
media request is scoped to the authenticated user; a user can never see,
play, or enumerate another user's data. The admin is just a user with the
additional ability to create/delete accounts — they do not see other users'
libraries.

Lyrics are stored as a JSON list of lines: `{ "text": str, "start": float,
"end": float }` (line-level sync; word-level kept when available for finer
display).

### Authentication & Security

- JWT in an httpOnly, SameSite=Lax cookie (so `<audio src="/media/...">`
  streams are authenticated by the browser automatically). Mutating requests
  carry a CSRF token.
- bcrypt (or argon2) password hashing. On first boot the admin account is
  seeded from env vars (`ADMIN_USERNAME`, `ADMIN_PASSWORD`). Admin
  creates/deletes users. No public registration.
- **Media is served through the API (not the raw volume)** with an
  ownership check on every request and HTTP Range support for seeking. This
  is what enforces the anti-goal above: an authenticated-but-unrelated user
  cannot pull another account's files.
- The API is exposed on port 7777. Login rate-limiting / lockout is applied.
  HTTPS is the owner's responsibility via their tunnel.

### Audio pipeline (per track)

1. **Download** — `yt-dlp` fetches best audio; extract title/artist/duration.
   Keep the original (compressed) and produce a PCM WAV for processing.
   Optional `cookies.txt` (via env/volume) for age/region-restricted videos;
   failures produce a clear error + retry.
2. **Vocal separation** — Demucs `htdemucs` two-stems (vocals / no_vocals),
   CPU. Outputs instrumental + vocals.
3. **Lyrics** —
   a. Query LRCLIB (`/api/get`, by track_name/artist/duration). If synced
      lyrics exist, parse the LRC into lines (exact original lyrics, already
      timed).
   b. Otherwise transcribe the vocals with Whisper (faster-whisper, word
      timestamps). **Language defaults to Romanian** (`language="ro"`),
      overridable per track (with auto-detect available).
4. **Encode & store** — instrumental and original as AAC/m4a (or Opus) for
   streaming; keep the vocals (compressed) for the re-sync feature.

### Job lifecycle (status machine)

Track `status` (`queued → downloading → separating → encoding → ready`
| `failed`) tracks the *audio* result, and `lyrics_status` tracks the
*lyrics* result independently, so a track can be `ready` (playable
instrumental) even when lyrics failed.

- **Cancel** and **retry** endpoints exist for tracks.
- **Resume on restart:** the current stage is recorded and intermediate
  artifacts are kept, so a restart resumes at the current stage instead of
  redoing Demucs.
- **Lyrics-only actions:** `retry lyrics` (re-transcribe), and `refetch`
  (re-query LRCLIB after the owner edits title/artist) — neither re-runs the
  audio pipeline.

### Lyrics editor & re-sync

The editor lets the owner edit line text, add/remove lines, adjust each
line's start time, and edit title/artist (then `refetch`). A "re-sync" action
force-aligns the (possibly edited) text to the vocals audio (stable-ts
`align` or whisperx forced alignment, CPU) and rewrites the timestamps. Re-sync
is a queued async job with progress (serialized on the same single worker).

### Frontend (React + Vite + Tailwind + Framer Motion)

- **Screens:** Library (add via YouTube URL, search/filter); Track detail
  (player + lyrics editor + re-sync + refetch); Playlists (create/rename/
  delete, drag-and-drop reorder, add tracks); Login; Admin (users).
- **Persistent bottom player:** now-playing, prev/next, seek, original vs
  instrumental toggle, crossfade toggle + duration, and the current
  playlist/queue.
- **Audio engine (Web Audio API):** two `Audio` elements with gain nodes;
  crossfade ramps gain between the current and next track over the configured
  duration; auto-advance follows the current playlist's order.
- **Playback queue = the selected playlist order** (persisted). Playing from
  the Library generates an ephemeral client-side order; there is no separate
  server-side queue table.
- **Micro-animations:** Framer Motion for page transitions, the active lyric
  line (spring highlight), hover/active states, skeleton loaders, and
  animated drag-and-drop reordering. Responsive and touch-friendly
  (mobile-first).

### API surface (summary)

- Auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- Tracks: `POST /api/tracks` (from URL), `GET /api/tracks`,
  `GET/PATCH/DELETE /api/tracks/{id}`, `POST /api/tracks/{id}/cancel`,
  `POST /api/tracks/{id}/retry`, `PUT /api/tracks/{id}/lyrics`,
  `POST /api/tracks/{id}/lyrics/resync`, `POST /api/tracks/{id}/lyrics/refetch`,
  `POST /api/tracks/{id}/lyrics/retry`.
- Playlists: `GET/POST/PATCH/DELETE /api/playlists`,
  `POST/DELETE /api/playlists/{id}/tracks`,
  `PUT /api/playlists/{id}/tracks/order`.
- Users (admin): `GET/POST/DELETE /api/users`.
- Settings: `GET/PATCH /api/settings` (crossfade, whisper model).
- Media: `GET /media/{track_id}/...` (auth + ownership + Range).

### One-line install

`install.sh` at the repo root. The single command:

```
curl -fsSL https://raw.githubusercontent.com/sorinciupitu/karaoke/main/install.sh | bash
```

It: installs Docker + Compose on Linux (on macOS it detects Docker
Desktop/Colima and, if missing, guides the owner to install one), writes
`.env` (admin credentials, `PORT=7777`, `SECRET_KEY`, data dir), then
`docker compose up -d`. The owner then exposes port 7777 via their port
forwarding / tunnel.

## What's left to the builder

- Exact Python libraries and versions (e.g., `demucs` via `torch.hub` vs pip;
  `faster-whisper` vs `stable-ts`; alignment model choice) and the Dockerfile
  details, including multi-arch build setup.
- Whisper model default `medium` (configurable via settings; `small` available
  for low-RAM hosts).
- Precise API request/response schemas and error format.
- Frontend component structure and animation details (informed by the
  frontend-design skill).
- SQLite migrations approach (e.g., SQLAlchemy + Alembic, or a minimal
  schema-bootstrap).
