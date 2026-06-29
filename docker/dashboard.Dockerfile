FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" keiro
WORKDIR /app
COPY --chown=keiro:keiro requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt streamlit plotly altair
COPY --chown=keiro:keiro . .
ENV PYTHONPATH=/app/apps/internal-dashboard:/app/intelligence:/app/generated/python
USER keiro
EXPOSE 8501
ENTRYPOINT ["streamlit", "run", "apps/internal-dashboard/dashboard/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
