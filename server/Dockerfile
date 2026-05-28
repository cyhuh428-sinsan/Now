FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY server/README.md server/DEPLOY.md server/RECOVERY.md ./
COPY docs/SERVER_AUTH_POLICY.md /docs/SERVER_AUTH_POLICY.md
COPY docs/PHASE1_RELEASE_CHECKLIST.md /docs/PHASE1_RELEASE_CHECKLIST.md

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
