FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY server/README.md server/DEPLOY.md server/RECOVERY.md ./
COPY README.md SECURITY.md CONTRIBUTING.md LICENSE /repo_docs/
COPY .github /repo_docs/.github
COPY docs/SERVER_AUTH_POLICY.md /docs/SERVER_AUTH_POLICY.md
COPY docs/OPEN_SOURCE_RELEASE.md /docs/OPEN_SOURCE_RELEASE.md
COPY now_app/docs/mobile_runtime_checklist_ko.md /now_app/docs/mobile_runtime_checklist_ko.md
COPY now_app/docs/google_play_release_checklist.md /play_docs/google_play_release_checklist.md
COPY now_app/docs/google_play_step_by_step_ko.md /play_docs/google_play_step_by_step_ko.md
COPY web/index.html web/app.js web/styles.css web/help.html web/manifest.webmanifest web/sw.js /web_app/
COPY web/icons /web_app/icons

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
