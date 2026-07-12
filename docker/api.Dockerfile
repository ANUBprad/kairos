FROM python:3.11-slim AS builder
RUN adduser --disabled-password --gecos "" kairos
WORKDIR /app
COPY --chown=kairos:kairos requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt fastapi uvicorn pydantic-settings
COPY --chown=kairos:kairos . .
ENV PYTHONPATH=/app/intelligence:/app/generated/python
USER kairos
EXPOSE 8000
ENTRYPOINT ["python", "-u", "-m", "uvicorn", "intelligence.api.app:create_app()", "--host", "0.0.0.0", "--port", "8000"]
