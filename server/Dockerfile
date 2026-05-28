FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY server/README.md server/DEPLOY.md server/RECOVERY.md ./
COPY README.md SECURITY.md CONTRIBUTING.md /repo_docs/
COPY .github /repo_docs/.github
COPY docs/SERVER_AUTH_POLICY.md /docs/SERVER_AUTH_POLICY.md
COPY docs/PHASE1_RELEASE_CHECKLIST.md /docs/PHASE1_RELEASE_CHECKLIST.md
COPY docs/OPEN_SOURCE_RELEASE.md /docs/OPEN_SOURCE_RELEASE.md
COPY docs/LICENSE_DECISION.md /docs/LICENSE_DECISION.md
COPY now_app/docs/google_play_release_checklist.md /play_docs/google_play_release_checklist.md
COPY now_app/docs/google_play_console_values_ko.md /play_docs/google_play_console_values_ko.md
COPY now_app/docs/google_play_paste_ready_ko.md /play_docs/google_play_paste_ready_ko.md
COPY now_app/docs/google_play_step_by_step_ko.md /play_docs/google_play_step_by_step_ko.md
COPY now_app/docs/privacy_policy_draft_ko.md /play_docs/privacy_policy_draft_ko.md
COPY now_app/docs/nownote_site/index.html /play_docs/nownote_site/index.html
COPY now_app/docs/play_assets/*.png /play_docs/play_assets/

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
