# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Production Runtime
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# Copy application source code into /app/services/api to support module resolution
COPY . /app/services/api/
ENV PYTHONPATH=/app

# Create non-root user for principle of least privilege
RUN useradd -m -u 1001 -s /bin/bash palmora && \
    chown -R palmora:palmora /app

USER palmora

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
