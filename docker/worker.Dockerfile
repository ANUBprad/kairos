FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-compile --default-timeout=1000 -r requirements.txt

FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" kairos
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=kairos:kairos . .
ENV PYTHONPATH=/app/intelligence:/app/generated/python \
    PYTHONPYCACHEPREFIX=/tmp/pycache \
    PYTHONDONTWRITEBYTECODE=1
USER kairos
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import sys; sys.exit(0 if __import__('intelligence.worker', fromlist=['']).Worker is not None else 1)"
ENTRYPOINT ["python", "-u", "-m", "intelligence.worker"]
