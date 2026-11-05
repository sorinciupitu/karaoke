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
- **alege varianta de sistem** (CPU sau NVIDIA GPU);
- pornește totul cu `docker compose up -d --build`.

Aplicația va fi disponibilă pe **http://localhost:7777** (portul e configurabil
în `.env`, cheia `PORT`).

### Varianta de sistem (CPU / GPU)

Scriptul detectează singur dacă ai un GPU NVIDIA și descarcă doar ce e necesar.
Poți forța varianta cu un argument:

```bash
curl -fsSL https://raw.githubusercontent.com/sorinciupitu/karaoke/main/install.sh | bash -s -- --gpu
# sau, fără GPU:
curl -fsSL https://raw.githubusercontent.com/sorinciupitu/karaoke/main/install.sh | bash -s -- --cpu
```

- **CPU** — imagine mai mică, rulează oriunde (inclusiv Apple Silicon). Transcrierea `large-v3` e lentă (~20-40 min/piesă), dar piesa e redabilă imediat.
- **GPU (NVIDIA)** — folosește CUDA (Demucs + Whisper pe placă, mult mai rapid). Necesită driverul NVIDIA și [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) pe server.

> **Atenție:** la prima pornire se descarcă modelele AI (Demucs + Whisper
> `large-v3`, câteva GB). Următoarele porniri sunt rapide (modelele sunt
> păstrate într-un volum Docker).

## Conturi

La prima pornire se creează contul de administrator din `.env`
(`ADMIN_USERNAME` / `ADMIN_PASSWORD` — schimbă-le înainte de prima pornire).

Din ecranul **Conturi** (vizibil doar pentru admin) poți crea alte conturi.
Fiecare cont are **biblioteca și playlisturile lui proprii**, complet izolate.

## Cum funcționează

1. **Bibliotecă** → lipești un link YouTube.
2. Aplicația descarcă audio-ul și separă vocea (Demucs). Piesa
   devine **redabilă imediat**, chiar înainte de versuri.
3. În fundal caută versurile originale (LRCLIB); dacă nu le găsește, le
   transcrie cu AI (Whisper `large-v3`, doar pe voce) și, opțional, le
   corectează ortografia/diacriticele printr-un LLM local (Ollama). Versurile
   **apar singure** când sunt gata.
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
| `WHISPER_MODEL` | `large-v3` | Modelul Whisper (`small` / `medium` / `large-v3`) |
| `WHISPER_LANGUAGE` | `ro` | Limba implicită a transcrierii |
| `DEVICE` | `auto` | Dispozitiv de calcul: `auto` / `cuda` / `cpu` |
| `WHISPER_COMPUTE_TYPE` | `auto` | Precizia Whisper: `auto` / `float16` / `int8_float16` / `int8` |
| `DEMUCS_MODEL` | `htdemucs` | Modelul implicit de separare a vocii (`htdemucs` / `htdemucs_ft` / `mdx23c` / `ensemble`) — schimbabil și din **Setări** |
| `OLLAMA_ENABLED` | `true` | Corectează versurile printr-un LLM local (Ollama) |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Adresa Ollama |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Modelul Ollama folosit la corectare |
| `TORCH` | `cpu` | Varianta PyTorch: `cpu` / `cuda` (setată automat de install.sh) |

### Corectarea versurilor cu Ollama (opțional)

Dacă pe mașină rulează [Ollama](https://ollama.com), aplicația trece automat
versurile transcrise printr-un LLM local care corectează ortografia și
diacriticele (fără să adauge cuvinte). Dacă Ollama nu e instalat, se sare peste
— versurile rămân cum le-a scris Whisper.

```bash
ollama pull qwen2.5:7b   # sau alt model, apoi setează OLLAMA_MODEL în .env
```

### Alegerea modelului de separare

Din **Setări** poți alege modelul folosit la scoaterea vocii pentru piesele noi.
Dacă o piesă deja procesată sună prost, deschide pagina piesei și folosește
**„Re-procesează instrumentalul”** ca să refaci separarea cu alt model:

- **Demucs (original)** — `htdemucs`, rapid, general.
- **Demucs FT (fine-tuned)** — `htdemucs_ft`, bun la aranjamente acustice complexe.
- **MDX23C-InstVoc-HQ** — `mdx23c`, instrumental natural, fără „găuri” (necesită descărcarea modelului ~2 GB la prima folosire; lent pe CPU, recomandat pe GPU).
- **Ensemble** — `ensemble`, combină MDX23C + Demucs FT (algoritm Max Spec) pentru calitate maximă (procesare dublă, mai lent).

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
