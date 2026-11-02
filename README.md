# Karaoke

Aplicație web self-hosted de karaoke. Introduci un link YouTube → obții
**negativul** (instrumental, fără voce) și **versurile** sincronizate, pe care
le poți corecta și re-sincroniza. Redare karaoke cu versuri evidențiate linie
cu linie, playlisturi cu ordine personalizată și crossfade între piese.

## Instalare (o singură comandă)

Rulează pe orice server Linux sau macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/sorinciupitu/karaoke/main/install.sh | bash
```

Ce face scriptul:
- instalează Docker (pe Linux; pe macOS te îndrumă spre Docker Desktop sau Colima dacă lipsește);
- generează `.env` cu un `SECRET_KEY` aleator;
- pornește totul cu `docker compose up -d --build`.

Aplicația va fi disponibilă pe **http://localhost:7777** (portul e configurabil
în `.env`, cheia `PORT`).

> **Atenție:** la prima pornire se descarcă modelele AI (~3 GB: Demucs pentru
> separarea vocii + Whisper pentru transcriere). Următoarele porniri sunt rapide
> (modelele sunt păstrate într-un volum Docker).

## Conturi

La prima pornire se creează contul de administrator din `.env`
(`ADMIN_USERNAME` / `ADMIN_PASSWORD` — schimbă-le înainte de prima pornire).

Din ecranul **Conturi** (vizibil doar pentru admin) poți crea alte conturi.
Fiecare cont are **biblioteca și playlisturile lui proprii**, complet izolate.

## Cum funcționează

1. **Bibliotecă** → lipești un link YouTube.
2. Aplicația descarcă audio-ul, separă vocea (Demucs), caută versurile
   originale (LRCLIB) și, dacă nu le găsește, le transcrie cu AI (Whisper,
   română implicit).
3. Deschizi piesa → o redai cu versurile sincronizate.
4. **Editează versurile** → corectezi textul, adaugi/ștergi versuri, ajustezi
   momentele; „Re-sincronizează" realiniază textul cu vocea.
5. **Playlisturi** → ordonezi piesele prin drag-and-drop; butonul **Crossfade**
   face trecerea fără pauză între piese.

## Configurare

| Variabilă | Implicit | Descriere |
|-----------|----------|-----------|
| `PORT` | `7777` | Portul pe care e expusă aplicația |
| `ADMIN_USERNAME` | `admin` | Utilizatorul de administrator |
| `ADMIN_PASSWORD` | `admin` | Parola de administrator |
| `WHISPER_MODEL` | `medium` | Modelul Whisper (`small` / `medium` / `large-v3`) |
| `WHISPER_LANGUAGE` | `ro` | Limba implicită a transcrierii |

## Expunere publică (port forwarding)

Aplicația rulează pe HTTP (portul 7777). Pentru a o expune pe internet,
folosește un tunel precum:

```bash
cloudflared tunnel --url http://localhost:7777
```

sau un port-forwarding de la routerul tău. Recomandat: expune prin
HTTPS (Cloudflare Tunnel, Tailscale etc.), fiindcă autentificarea se face
printr-un cookie de sesiune.

## Notă legală

Această aplicație este destinată **uzului strict personal**. Descărcarea de
conținut de pe YouTube poate încălca termenii de utilizare YouTube; nu
distribui conținutul procesat.

## Dezvoltare

```bash
# backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -e . pytest
.venv/bin/python -m pytest

# frontend
cd frontend && npm install && npm run test && npm run build
```
