FROM python:3.11-slim AS builder
RUN adduser --disabled-password --gecos "" keiro
WORKDIR /app
COPY --chown=keiro:keiro requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt fastapi uvicorn pydantic-settings
COPY --chown=keiro:keiro . .
ENV PYTHONPATH=/app/intelligence:/app/generated/python
USER keiro
EXPOSE 8000
ENTRYPOINT ["python", "-u", "-m", "uvicorn", "intelligence.api.app:create_app()", "--host", "0.0.0.0", "--port", "8000"]
