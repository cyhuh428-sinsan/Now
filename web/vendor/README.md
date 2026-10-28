# Markdown 런타임

- marked 18.1.2, MIT (`marked.LICENSE`). npm 고정 버전의 `lib/marked.umd.js`.
- DOMPurify 3.4.17, Apache-2.0 또는 MPL-2.0 (`dompurify.LICENSE`). npm 고정 버전의 `dist/purify.min.js`.
- `document-renderer.js`는 NowNote의 원문 보존·허용 태그/속성·목차/접기 연결 코드다.
- `node web/scripts/bundle_markdown.mjs`로 두 app.js 맨 앞 런타임 구간을 재생성한다. 기존 서버의 고정 Web 자산 복사·PWA 캐시·설치형 배포에서도 추가 원격 CDN 없이 실행된다.
- 라이브러리 버전/라이선스 헤더는 번들에도 포함되며, 원본과 라이선스 전문은 이 폴더에 보존한다. 갱신 시 고정 버전·회귀·악성 HTML 검증을 다시 수행한다.
