# Markdown 런타임

- jsdiff 8.0.2, BSD-3-Clause (`diff.LICENSE`). 공식 npm `diff@8.0.2/dist/diff.min.js`를 `diff.js`로 보존한다. 공급원 https://unpkg.com/diff@8.0.2/dist/diff.min.js 와 고정 tag https://github.com/kpdecker/jsdiff/tree/v8.0.2 를 대조했다. 이력 비교는 diffLines를 textContent 출력에만 사용하며 원문 저장/복원은 diff 결과를 사용하지 않는다.
- `note-history-state.js`는 Note 전용 내구 원장/CAS 전송이고 `note-history-ui.js`는 시점 비교/복원 화면이다. 템플릿·저장조건 원장과 wire 계약을 혼용하지 않는다.

- marked 18.1.2, MIT (`marked.LICENSE`). npm 고정 버전의 `lib/marked.umd.js`.
- DOMPurify 3.4.17, Apache-2.0 또는 MPL-2.0 (`dompurify.LICENSE`). npm 고정 버전의 `dist/purify.min.js`.
- `document-renderer.js`는 NowNote의 원문 보존·허용 태그/속성·목차/접기 연결 코드다.
- `node web/scripts/bundle_markdown.mjs`로 두 app.js 맨 앞 런타임 구간을 재생성한다. 기존 서버의 고정 Web 자산 복사·PWA 캐시·설치형 배포에서도 추가 원격 CDN 없이 실행된다.
- 라이브러리 버전/라이선스 헤더는 번들에도 포함되며, 원본과 라이선스 전문은 이 폴더에 보존한다. 갱신 시 고정 버전·회귀·악성 HTML 검증을 다시 수행한다.
