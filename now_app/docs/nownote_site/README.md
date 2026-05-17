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

리버스 프록시가 Docker 네트워크로 컨테이너를 직접 찾아야 하는 서버에서는 운영 환경에 맞는 외부 네트워크를 compose 파일에 추가합니다. 기본 compose 파일은 새 서버에서도 바로 실행되도록 외부 네트워크를 요구하지 않습니다.

## Play Console 입력값
- 개인정보처리방침 URL: `https://nownote.sinsan.kr/`

## 게시 전 확인
- `index.html`의 개인정보 문의 이메일이 Play Console 개발자 이메일과 일치하는지 확인해야 합니다.
- 선택형 서버 동기화, 녹음 업로드, 서버 분석 기능을 실제 출시 범위와 동일하게 개인정보처리방침 및 Data safety에 반영했는지 확인해야 합니다.
