FROM python:3.11-slim

WORKDIR /app

# System deps for paramiko + healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libffi-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--timeout-keep-alive", "2", "--no-server-header"]
