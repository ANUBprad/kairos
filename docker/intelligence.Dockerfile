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
EXPOSE 28080 8001
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=5 \
    CMD python3 -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('localhost',28080)); s.close()"
ENTRYPOINT ["python", "-u", "intelligence/main.py"]
