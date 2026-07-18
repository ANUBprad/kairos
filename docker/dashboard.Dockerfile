FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-compile --default-timeout=1000 -r requirements.txt streamlit plotly altair

FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" kairos
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=kairos:kairos . .
ENV PYTHONPATH=/app/apps/internal-dashboard:/app/intelligence:/app/generated/python \
    PYTHONPYCACHEPREFIX=/tmp/pycache \
    PYTHONDONTWRITEBYTECODE=1
USER kairos
EXPOSE 8501
ENTRYPOINT ["streamlit", "run", "apps/internal-dashboard/dashboard/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
