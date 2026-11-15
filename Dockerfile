# syntax=docker/dockerfile:1
# Multi-stage build for RNTBCI backend (FastAPI / uvicorn)

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    HOST=0.0.0.0 \
    PORT=8000 \
    HOME=/home/appuser

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 appgroup \
    && useradd --system --uid 10001 --gid appgroup --create-home --home-dir /home/appuser appuser

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

COPY --chown=appuser:appgroup alembic.ini ./
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup backend ./backend
COPY --chown=appuser:appgroup run.py fix_db.py ./

RUN mkdir -p /app/backend/data /app/backend/logs \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["sh", "-c", "python fix_db.py; exec python run.py"]
