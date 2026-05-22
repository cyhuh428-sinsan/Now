# NowNote 1차 마무리 체크리스트

기준일: 2026-05-21

이 문서는 NowNote 1차 개발을 닫기 전에 실제로 확인해야 하는 항목을 모은 체크리스트입니다.
자동 점검은 `server/scripts/preflight.py`와 `server/scripts/smoke_test.py`가 담당하고, 실제 기기/실제 서버/실제 Play Console 값이 필요한 항목은 사람이 최종 확인합니다.

## 1. 모바일 앱 실제 점검

- [x] 모바일 핵심 화면/서비스/권한 정적 점검 스크립트 준비.
- [x] 모바일 에뮬레이터/실기기 실제 실행 점검서 준비.
- [ ] Android 에뮬레이터에서 앱 실행.
- [ ] 실제 Android 기기에서 앱 실행.
- [ ] 홈에서 오늘 메모 작성.
- [ ] 일자별 메모 조회와 추가 작성.
- [ ] 계층 메모의 주제 / 분류 / 메모 3단계 작성과 삭제 제한 확인.
- [ ] 음성 메모 실시간 변환 확인.
- [ ] 음성 녹음 후 변환 흐름 확인.
- [ ] 서버 연결 테스트 확인.
- [ ] 서버 동기화 확인.
- [ ] 녹음 업로드 상태 확인.

## 2. Web / 설치형 점검

- [x] Web/설치형 핵심 화면 요소 정적 점검 스크립트 준비.
- [x] Web 화면을 브라우저에서 실행: `http://127.0.0.1:8761/index.html`.
- [x] 계층 메모 작성, 편집, 삭제 보관함 확인.
- [x] 일자별 메모 팝업 흐름 확인.
- [ ] Markdown 가져오기와 내보내기 확인.
- [ ] JSON 백업과 복원 확인.
- [x] 검색과 본문 찾기 확인.
- [x] 탭 편집과 단축키 설정 확인.
- [ ] 서버 연결 테스트 확인.
- [x] 설치형 포장 방식 확정: 1차는 PWA 설치, 이후 Tauri/Electron 확장.
- [x] Web/설치형 실제 실행 점검서 준비.
- [ ] 설치형 배포 파일 생성과 실행 확인.

## 3. 서버 재배포 점검

- [ ] WSL/Linux 배포 경로에서 `git pull origin main` 실행.
- [ ] `server/.env` 존재와 비밀값 변경 확인.
- [ ] `python3 scripts/preflight.py` 통과.
- [ ] `docker compose up --build -d` 또는 `docker-compose up --build -d` 실행.
- [ ] `curl http://localhost:8750/health` 확인.
- [ ] `curl http://localhost:8750/health/ready` 확인.
- [ ] `curl http://localhost:8750/api/v1/server` 확인.
- [ ] `python3 scripts/smoke_test.py --base-url http://localhost:8750` 통과.
- [ ] `/monitor`와 `/admin` 화면 확인.

## 4. 공용 서버 오픈 전 점검

공용 서버를 열지 않는 개인 Docker 서버라면 이 항목은 보류할 수 있습니다.

- [ ] 실제 공개 도메인 확정.
- [ ] `NOW_PUBLIC_BASE_URL=https://도메인` 설정.
- [ ] reverse proxy 적용.
- [ ] `NOW_BEHIND_REVERSE_PROXY=true` 설정.
- [ ] 사용자별 접속 토큰 발급.
- [ ] `NOW_USER_TOKEN_REQUIRED=true` 설정.
- [ ] 공용 서버 기준 `python3 scripts/preflight.py --public-server` 통과.
- [ ] 사용자별 데이터 격리 smoke test 통과.

## 5. Google Play 등록 전 점검

- [ ] 실제 Android 서명 키 준비.
- [ ] `now_app/android/key.properties` 로컬 파일 준비.
- [ ] 서명된 AAB 빌드.
- [ ] 개인정보처리방침 URL 확정.
- [ ] Play Console 앱 설명 문구 최종 확인.
- [ ] 권한 사용 설명 최종 확인.
- [ ] Data safety 답변 최종 확인.
- [ ] 스크린샷과 기능 그래픽 최종 확인.
- [ ] 내부 테스트 트랙 업로드.
- [ ] 실제 기기 설치 테스트.

## 6. 공개 저장소 오픈 전 점검

- [x] 실제 비밀값이 Git에 포함되지 않았는지 확인: `scripts/verify_public_repo_safety.py`.
- [ ] GitHub Actions preflight 통과 확인.
- [x] README, SECURITY, CONTRIBUTING, 이슈/PR 템플릿 확인: `server/scripts/preflight.py` 기준.
- [x] 오픈소스 라이선스 선택 가이드 준비.
- [ ] 오픈소스 라이선스 선택.
- [ ] 선택한 라이선스 파일 추가.

## 현재 보류 항목

- 라이선스는 법적 선택이므로 임의로 정하지 않습니다.
- 실제 도메인과 HTTPS 설정은 운영 서버가 확정된 뒤 진행합니다.
- 실제 서명 키와 Play Console 값은 공개 저장소에 올리지 않고 로컬에서만 관리합니다.
