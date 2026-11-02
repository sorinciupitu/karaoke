FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg build-essential pkg-config libopus-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app

# CPU-only PyTorch, pinned. torch 2.4.1 gates its CUDA deps to x86_64,
# so on arm64 (Apple Silicon) it stays CPU-only and skips the ~3 GB CUDA
# toolkit that torch>=2.15 pulls on all Linux platforms.
RUN pip install --no-cache-dir torch==2.4.1 torchaudio==2.4.1

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "python -m app.jobs.worker & exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
