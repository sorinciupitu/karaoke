FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg build-essential pkg-config libopus-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Deno JS runtime — needed by yt-dlp's EJS solver for YouTube's "n challenge".
RUN set -eux; \
    case "$(uname -m)" in \
      x86_64) DARCH="x86_64-unknown-linux-gnu" ;; \
      aarch64) DARCH="aarch64-unknown-linux-gnu" ;; \
      *) echo "unsupported arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-${DARCH}.zip" -o /tmp/deno.zip; \
    python -c "import zipfile; zipfile.ZipFile('/tmp/deno.zip').extract('deno', '/usr/local/bin')"; \
    chmod +x /usr/local/bin/deno; \
    rm /tmp/deno.zip; \
    deno --version

WORKDIR /app

# PyTorch, pinned. The build arg TORCH selects the wheel flavour:
#   cpu  -> CPU-only wheels (small, works everywhere; no CUDA deps)
#   cuda -> CUDA 12.1 wheels (NVIDIA GPU support, requires nvidia runtime)
ARG TORCH=cpu
RUN if [ "$TORCH" = "cuda" ]; then \
      pip install --no-cache-dir torch==2.4.1 torchaudio==2.4.1 \
        --index-url https://download.pytorch.org/whl/cu121; \
    else \
      pip install --no-cache-dir torch==2.4.1 torchaudio==2.4.1 \
        --index-url https://download.pytorch.org/whl/cpu; \
    fi

# MDX-Net / MDX23C separation via audio-separator (ONNX). The runtime variant
# (CPU onnxruntime vs GPU onnxruntime-gpu) matches the torch variant above.
RUN if [ "$TORCH" = "cuda" ]; then \
      pip install --no-cache-dir "audio-separator[gpu]==0.48.0"; \
    else \
      pip install --no-cache-dir "audio-separator[cpu]==0.48.0"; \
    fi

# audio-separator may pull a different torch/torchaudio, which leaves
# libtorchaudio.so mismatched with libtorch (breaks demucs). Re-pin the exact
# pair after it so torch and torchaudio always match.
RUN if [ "$TORCH" = "cuda" ]; then \
      pip install --no-cache-dir --force-reinstall --no-deps torch==2.4.1 torchaudio==2.4.1 \
        --index-url https://download.pytorch.org/whl/cu121; \
    else \
      pip install --no-cache-dir --force-reinstall --no-deps torch==2.4.1 torchaudio==2.4.1 \
        --index-url https://download.pytorch.org/whl/cpu; \
    fi

# Heavy dependencies in their own cacheable layer, BEFORE the app code.
#
# demucs is installed WITHOUT its `sphn` dependency: sphn compiles native Rust
# on arm64 (multi-GB, and it fills Docker's disk), but it is only used by
# demucs's CLI audio loader (demucs.api). Our separation (pipeline/separate.py)
# loads audio with torchaudio directly, so sphn is never needed at runtime.
COPY pyproject.toml ./
RUN pip install --no-cache-dir --no-deps demucs==4.1.0 \
    && pip install --no-cache-dir \
        "fastapi>=0.111" \
        "uvicorn[standard]>=0.30" \
        "sqlalchemy>=2.0" \
        "pydantic>=2.7" \
        "pydantic-settings>=2.2" \
        "PyJWT>=2.8" \
        "bcrypt>=4.0" \
        "httpx>=0.27" \
        "python-multipart>=0.0.9" \
        "yt-dlp[default]>=2024.0.0" \
        "faster-whisper>=1.0.0" \
        "soundfile>=0.12.0" \
        einops huggingface-hub "julius>=0.2.3" "lameenc>=1.2" pyyaml safetensors tqdm

# Install only our own package (pure Python, no deps) — fast to rebuild.
COPY app ./app
RUN pip install --no-cache-dir --no-deps .

EXPOSE 8000

CMD ["sh", "-c", "python -m app.jobs.worker & exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
