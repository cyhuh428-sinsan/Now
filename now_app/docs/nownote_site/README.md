# NowNote 공개 페이지

이 폴더는 `https://nownote.sinsan.kr/`에 올릴 정적 페이지입니다.

## Docker 실행
서버에서 이 폴더로 이동한 뒤 실행합니다.

```powershell
docker compose up -d --build
```

기본 포트는 `8080:80`입니다.

로컬 확인:

```powershell
curl http://localhost:8080/healthz
curl http://localhost:8080/
```

## 도메인 연결
`https://nownote.sinsan.kr/`는 서버의 리버스 프록시에서 이 컨테이너의 `http://127.0.0.1:8080`으로 연결합니다.

## Play Console 입력값
- 개인정보처리방침 URL: `https://nownote.sinsan.kr/`

## 게시 전 필수 수정
- `index.html`의 `개발자 이메일 입력`을 실제 Play Console 개발자 이메일로 교체해야 합니다.
- 출시 버전에서 LLM 분석, 서버 동기화, 클라우드 기능을 제공하지 않을 경우 해당 문구를 실제 동작에 맞게 줄이는 것이 좋습니다.
