## 변경 내용

- 

## 영향 범위

- [ ] 모바일 앱
- [ ] Web/설치형 화면
- [ ] 서버
- [ ] 문서
- [ ] Google Play/개인정보 문서

## 확인 사항

- [ ] 한국어 우선 문구와 현재 1차 범위를 유지했습니다.
- [ ] 민감정보를 커밋하지 않았습니다.
- [ ] 기존 동작이 암묵적으로 바뀌지 않았는지 확인했습니다.
- [ ] 관련 문서와 도움말을 함께 갱신했습니다.
- [ ] 필요한 경우 preflight 또는 smoke test에 회귀 방지 점검을 추가했습니다.

## 검증

- [ ] `python3 scripts/preflight.py`
- [ ] `python3 scripts/preflight.py --env-file .env.example --allow-example`
- [ ] `python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰`
- [ ] 모바일 앱 수동 확인
- [ ] Web/설치형 화면 수동 확인

## 메모

리뷰어가 알아야 할 내용이 있으면 적어주세요.
