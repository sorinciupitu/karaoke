FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg build-essential pkg-config libopus-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch, pinned. torch 2.4.1 gates its CUDA deps to x86_64,
# so on arm64 (Apple Silicon) it stays CPU-only and skips the ~3 GB CUDA
# toolkit that torch>=2.15 pulls on all Linux platforms.
RUN pip install --no-cache-dir torch==2.4.1 torchaudio==2.4.1

# Install the heavy Python dependencies in their own cacheable layer, BEFORE
# the app code. demucs pulls sphn, which compiles native Rust on arm64 — a
# multi-GB build. Keeping it here means app-code changes don't re-run it.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
        "fastapi>=0.111" \
        "uvicorn[standard]>=0.30" \
        "sqlalchemy>=2.0" \
        "pydantic>=2.7" \
        "pydantic-settings>=2.2" \
        "PyJWT>=2.8" \
        "bcrypt>=4.0" \
        "httpx>=0.27" \
        "python-multipart>=0.0.9" \
        "yt-dlp>=2024.0.0" \
        "demucs>=4.0.0" \
        "faster-whisper>=1.0.0" \
        "soundfile>=0.12.0"

# Install only our own package (pure Python, no deps) — fast to rebuild.
COPY app ./app
RUN pip install --no-cache-dir --no-deps .

EXPOSE 8000

CMD ["sh", "-c", "python -m app.jobs.worker & exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
