# NowNote 1차 마무리 체크리스트

기준일: 2026-05-31

이 문서는 NowNote 1차 개발을 닫기 전에 실제로 확인해야 하는 항목을 모은 체크리스트입니다.
자동 점검은 `server/scripts/preflight.py`와 `server/scripts/smoke_test.py`가 담당하고, 실제 기기/실제 서버/실제 Play Console 값이 필요한 항목은 사람이 최종 확인합니다.

## 1. 모바일 앱 실제 점검

- [x] 모바일 핵심 화면/서비스/권한 정적 점검 스크립트 준비.
- [x] 모바일 에뮬레이터/실기기 실제 실행 점검서 준비.
- [x] Android 에뮬레이터에서 앱 실행.
- [x] 실제 Android 기기에서 앱 실행.
- [x] 홈에서 오늘 메모 작성.
- [x] 일자별 메모 조회와 추가 작성.
- [x] 계층 메모의 주제 / 분류 / 메모 3단계 작성과 삭제 제한 확인.
- [x] 음성 메모 실시간 변환 확인.
- [x] 음성 녹음 후 변환 흐름 확인.
- [x] 서버 연결 테스트 확인.
- [x] 서버 동기화 확인.
- [x] 녹음 업로드 상태 확인.

## 2. Web / 설치형 점검

- [x] Web/설치형 핵심 화면 요소 정적 점검 스크립트 준비.
- [x] Web 화면을 브라우저에서 실행: `http://127.0.0.1:8761/index.html`.
- [x] 계층 메모 작성, 편집, 삭제 보관함 확인.
- [x] 일자별 메모 팝업 흐름 확인.
- [x] Markdown 가져오기와 내보내기 확인.
- [x] JSON 백업과 복원 확인.
- [x] 검색과 본문 찾기 확인.
- [x] 탭 편집과 단축키 설정 확인.
- [x] 서버 연결 테스트 확인.
- [x] 설치형 포장 방식 확정: 1차는 Windows `.exe`, PWA는 보조/검증용.
- [x] Web/설치형 실제 실행 점검서 준비.
- [x] 설치형 배포 파일 생성과 실행 확인.
- [x] Web/설치형 화면 언어 선택 확장: 한국어, 영어, 중국어, 일본어, 베트남어, 아랍어.

## 3. 서버 재배포 점검

- [x] WSL/Linux 배포 경로에서 `git pull origin main` 실행.
- [x] `server/.env` 존재와 비밀값 변경 확인.
- [x] `python3 scripts/preflight.py` 통과.
- [x] `docker compose up --build -d` 또는 `docker-compose up --build -d` 실행.
- [x] `curl http://localhost:8750/health` 확인.
- [x] `curl http://localhost:8750/health/ready` 확인.
- [x] `curl http://localhost:8750/api/v1/server` 확인.
- [x] `python3 scripts/smoke_test.py --base-url http://localhost:8750` 통과.
- [x] `/monitor`와 `/admin` 화면 확인.

## 4. 공용 서버 오픈 전 점검

공용 서버를 열지 않는 개인 Docker 서버라면 이 항목은 보류할 수 있습니다.

- [x] 실제 공개 도메인 확정.
- [x] `NOW_PUBLIC_BASE_URL=https://도메인` 설정.
- [x] reverse proxy 적용.
- [x] `NOW_BEHIND_REVERSE_PROXY=true` 설정.
- [x] Web 사용자 직접 가입과 앱/설치형 연결 토큰 발급.
- [x] `NOW_USER_TOKEN_REQUIRED=true` 설정.
- [x] 공용 서버 기준 `python3 scripts/preflight.py --public-server` 통과.
- [x] 사용자별 데이터 격리 smoke test 통과.

## 5. Google Play 등록 전 점검

- [x] 실제 Android 서명 키 준비.
- [x] `now_app/android/key.properties` 로컬 파일 준비.
- [x] 서명된 AAB 빌드.
- [x] 개인정보처리방침 URL 확정.
- [x] Play Console 앱 설명 문구 최종 확인.
- [x] 권한 사용 설명 최종 확인.
- [x] Data safety 답변 최종 확인.
- [x] 스크린샷과 기능 그래픽 최종 확인.
- [ ] 내부 테스트 트랙 업로드.
- [x] 실제 기기 설치 테스트.

## 6. 공개 저장소 오픈 전 점검

- [x] 실제 비밀값이 Git에 포함되지 않았는지 확인: `scripts/verify_public_repo_safety.py`.
- [ ] GitHub Actions preflight 통과 확인.
- [x] README, SECURITY, CONTRIBUTING, 이슈/PR 템플릿 확인: `server/scripts/preflight.py` 기준.
- [x] 오픈소스 라이선스 선택 가이드 준비.
- [x] 오픈소스 라이선스 선택.
- [x] 선택한 라이선스 파일 추가.

## 현재 보류 항목

- 라이선스는 Apache License 2.0으로 확정했습니다.
- 실제 도메인은 `nownote.sinsan.kr`로 확정했고, HTTPS/reverse proxy 운영 적용을 완료했습니다.
- WSL/Docker 서버는 공용 모드 환경값과 사용자 토큰 필수 모드 smoke test까지 통과했습니다.
- 정상 기준은 `https://nownote.sinsan.kr/`가 Web 프로그램, `https://nownote.sinsan.kr/privacy`가 개인정보처리방침, `https://nownote.sinsan.kr/api/v1/server`가 JSON을 반환하는 것입니다.
- 실제 서명 키와 Play Console 내부 테스트 업로드 화면은 공개 저장소에 올리지 않고 로컬/콘솔에서만 관리합니다.
