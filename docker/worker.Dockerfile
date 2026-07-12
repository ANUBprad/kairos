FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" kairos
WORKDIR /app
COPY --chown=kairos:kairos requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt
COPY --chown=kairos:kairos . .
ENV PYTHONPATH=/app/intelligence:/app/generated/python
USER kairos
ENTRYPOINT ["python", "-u", "-m", "intelligence.worker"]
