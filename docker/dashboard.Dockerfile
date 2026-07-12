FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" kairos
WORKDIR /app
COPY --chown=kairos:kairos requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt streamlit plotly altair
COPY --chown=kairos:kairos . .
ENV PYTHONPATH=/app/apps/internal-dashboard:/app/intelligence:/app/generated/python
USER kairos
EXPOSE 8501
ENTRYPOINT ["streamlit", "run", "apps/internal-dashboard/dashboard/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
