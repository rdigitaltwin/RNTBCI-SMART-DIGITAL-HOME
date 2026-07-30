FROM python:3.11-slim AS requirements-stage

WORKDIR /tmp

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/
RUN pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /tmp/wheels -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built wheels and install them
COPY --from=requirements-stage /tmp/wheels /tmp/wheels
COPY requirements.txt /app/
RUN pip install --no-cache-dir /tmp/wheels/* && rm -rf /tmp/wheels

# Copy application code
COPY . /app/

# Environment variables
ENV PYTHONPATH=/app
ENV PORT=8000

# Expose the application port
EXPOSE 8000

# Run the application
CMD ["python", "run.py"]
