# NowNote 2.3 서버 및 API 작업지시서

## 목적

서버는 NowNote 2.3에서 Web, 설치형 프로그램, 앱이 안정적으로 접속하고 동기화할 수 있는 운영 기반을 담당한다.

## 담당 범위

- 인증 API
- 앱/설치형 접속 토큰 검증
- 사용자별 데이터 격리
- 동기화 API
- 메신저 room/message/participant API
- 메신저 첨부 업로드/다운로드 API
- 첨부 저장소와 정책
- 운영 점검 API와 운영 화면
- 서버 문서와 배포 문서

## 현재 확인된 상태

- `/api/v1/auth/web-login` 유지
- `/api/v1/auth/web-session` 유지
- `/api/v1/auth/token-login` 유지
- `X-Now-User-Token` 기반 앱/설치형 데이터 API 검증 유지
- `NOW_API_TOKEN`은 구형 개인 서버 호환/운영 보호용으로만 유지
- 서버 preflight 로컬 검증 통과 기록 있음
- 메신저 첨부 정책과 운영 점검 항목 1차 반영 완료
- 운영 URL health/ready와 `/api/v1/server`는 정상 확인

## 남은 작업

1. 운영 서버 `~/deploy/Now`에서 최신 `main`을 pull한다.
2. 운영 서버 `server/.env`에 메신저 설정을 반영한다.
   - `NOW_MESSENGER_STORAGE_DIR=/data/messenger`
   - `NOW_MESSENGER_MAX_UPLOAD_MB=10`
   - `NOW_MESSENGER_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip`
   - `NOW_MESSENGER_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip`
3. `server`에서 `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr`를 실행한다.
4. 운영 서버에서 `/health`, `/health/ready`, `/api/v1/server`, `/api/v1/messenger/policy`를 확인한다.
5. `/api/v1/messenger/policy`에 `allowed_mime_types`가 표시되는지 확인한다.
6. `/api/v1/messenger/policy`에 `application/octet-stream`이 없는지 확인한다.
7. 실제 사용자 기준 Web login, Web session, token-login 성공 케이스를 확인한다.
8. 기존 전체 그룹 채팅방을 기본 방으로 유지한다.
9. 일부 그룹원 채팅방 생성을 위한 room, participant, message API를 구현한다.
10. 채팅방 참여자 권한 검증을 구현한다.
11. unread count API를 안정화한다.
12. 첨부 업로드, 다운로드, 첨부 정책 API를 구현한다.
13. 파일 크기, 확장자, MIME 제한을 서버에서 검증한다.
14. 비참여자 접근 차단, 금지 확장자, 금지 MIME, 용량 초과 케이스를 smoke test에 포함한다.
15. 운영 화면/API에서 메신저 저장소, 첨부 용량, 누락 첨부 상태를 확인할 수 있게 한다.
16. 서버 작업 로그와 서버 README/배포 문서를 2.3 기준으로 갱신한다.

## 완료 조건

- 운영 서버 health/ready가 정상이다.
- 운영 서버 capability에 `messenger_rooms`, `messenger_attachments`가 표시된다.
- 운영 서버 첨부 정책에 `allowed_mime_types`가 표시된다.
- 운영 서버 첨부 정책에 `application/octet-stream`이 없다.
- 실제 사용자 Web login, Web session, token-login 성공 케이스가 확인된다.
- 사용자별 데이터 격리가 유지된다.
- 전체 그룹 메신저 기존 데이터와 동작을 잃지 않는다.
- 일부 그룹원 채팅방 API가 권한 검증을 통과한다.
- 첨부 업로드/다운로드 API가 정책과 권한 검증을 통과한다.
- 서버 preflight와 messenger smoke test가 통과한다.
- 운영 화면/API에서 서버 2.3 상태를 확인할 수 있다.

## 어울 확인 항목

- 서버 작업 결과 문서 확인
- 운영 URL API 재확인
- 서버 작업 로그 최신화 확인
- 통합 작업지시서 완료 조건 반영
- 최종 릴리즈 체크리스트 반영
