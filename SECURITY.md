# NowNote 보안 정책

NowNote는 로컬 우선 메모 앱과 직접 운영 가능한 서버를 함께 제공합니다.
보안 문제는 공개 이슈에 민감정보를 올리지 않고 비공개로 먼저 공유하는 것을 원칙으로 합니다.

## 신고 방법

보안 취약점, 토큰 노출, 인증 우회, 데이터 격리 문제를 발견하면 아래 주소로 신고합니다.

- 이메일: cyhuh428@gmail.com

신고할 때는 가능한 범위에서 아래 정보를 함께 전달해 주세요.

- 영향 받는 구성: 모바일 앱, Web/설치형 화면, 서버, Docker 배포, 공개 개인정보 페이지
- 재현 단계
- 영향 범위
- 로그 또는 화면 캡처

API 토큰, 사용자별 접속 토큰, DB 비밀번호, Android 서명 키, 실제 개인정보는 신고 본문에 그대로 넣지 않습니다.

## 민감정보 기준

아래 파일과 값은 Git에 올리지 않습니다.

- `server/.env`
- `now_app/android/key.properties`
- `now_app/android/upload-keystore.jks`
- 실제 `NOW_API_TOKEN`
- 실제 `NOW_POSTGRES_PASSWORD`
- 사용자별 접속 토큰
- LLM API 키

예시 파일에는 `change-this-*` 또는 `CHANGE_ME` placeholder만 사용합니다.

## 서버 운영 기준

개인 Docker 서버는 운영자가 직접 API 토큰과 DB 비밀번호를 관리합니다.

공용 서버로 열기 전에는 아래 조건을 확인합니다.

- `NOW_USER_TOKEN_REQUIRED=true`
- `NOW_PUBLIC_BASE_URL=https://도메인`
- `NOW_BEHIND_REVERSE_PROXY=true`
- 사용자별 접속 토큰 발급과 검증
- 사용자 직접 가입과 등록 이메일 기반 비밀번호 재설정
- 2단계 코드 검증
- 사용자별 데이터 격리 smoke test

## 데이터 보호 기준

- 2단계 인증 코드는 저장하지 않고 확인 요청에만 사용합니다.
- 관리자 발급 사용자별 접속 토큰은 해시와 발급 시각만 저장합니다.
- Web에서 발급한 기기별 연결 토큰은 사용자가 다시 확인할 수 있도록 서버 DB에 보관하지만, 백업 JSON과 관리자 export에는 포함하지 않습니다.
- 연결 토큰이 노출됐다고 판단되면 사용자가 Web에서 새로 발급합니다.
- 서버 API 토큰과 LLM API 키는 모바일 기기의 보안 저장소에 저장합니다.
- Android 자동 클라우드 백업에는 개인 기록과 서버 접속 정보를 포함하지 않도록 설정합니다.

## 점검

배포 전에는 서버 디렉터리에서 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

공용 서버 오픈 전에는 추가로 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py --public-server
```

---

# Security Policy

Language: 한국어 | English | 中文 | 日本語 | Tiếng Việt | العربية

NowNote provides a local-first note app and a self-hostable server. Security reports should be shared privately first, without posting secrets in public issues.

## Reporting

Report vulnerabilities, token exposure, authentication bypass, or data isolation problems by email.

- Email: cyhuh428@gmail.com

Include the affected area, reproduction steps, impact, and logs or screenshots when possible. Do not include raw API tokens, user connection tokens, DB passwords, Android signing keys, or real personal data.

## Sensitive Data

Never commit `server/.env`, Android signing files, real `NOW_API_TOKEN`, real `NOW_POSTGRES_PASSWORD`, user connection tokens, or LLM API keys. Example files must use placeholders only.

## Server Security Baseline

Before opening a public server, verify `NOW_USER_TOKEN_REQUIRED=true`, `NOW_PUBLIC_BASE_URL=https://domain`, `NOW_BEHIND_REVERSE_PROXY=true`, user token issuance and verification, self-registration, email password reset, two-factor code checks, and user data isolation smoke tests.

## Data Protection

Two-factor codes are not stored. Device connection tokens issued from Web can be rechecked by the user but are excluded from backup JSON and admin export. Android cloud backup excludes private records and server connection data.

---

# 安全政策

NowNote 同时提供本地优先的笔记应用和可自行运营的服务器。安全问题应先通过私下方式报告，不要在公开 issue 中写入敏感信息。

- 报告邮箱: cyhuh428@gmail.com
- 不要提交或公开 API token、用户连接 token、DB 密码、Android 签名 key、真实个人信息。
- 公开服务器前必须确认用户 token 强制、HTTPS、reverse proxy、用户直接注册、邮件密码重置、二步验证码、用户数据隔离 smoke test。

---

# セキュリティポリシー

NowNote はローカル優先のメモアプリと自己運用可能なサーバーを提供します。セキュリティ問題は公開 issue に機密情報を書かず、まず非公開で共有してください。

- 報告メール: cyhuh428@gmail.com
- API token、ユーザー接続 token、DB パスワード、Android 署名 key、実個人情報は公開しません。
- 公共サーバー公開前に、ユーザー token 強制、HTTPS、reverse proxy、ユーザー直接登録、メールによるパスワード再設定、2段階コード、ユーザーデータ分離 smoke test を確認します。

---

# Chính sách bảo mật

NowNote cung cấp ứng dụng ghi chú ưu tiên local và server có thể tự vận hành. Vấn đề bảo mật cần được báo cáo riêng trước, không đăng dữ liệu nhạy cảm lên issue công khai.

- Email báo cáo: cyhuh428@gmail.com
- Không công khai API token, token kết nối người dùng, mật khẩu DB, key ký Android hoặc dữ liệu cá nhân thật.
- Trước khi mở server công cộng, phải kiểm tra bắt buộc user token, HTTPS, reverse proxy, tự đăng ký, đặt lại mật khẩu qua email, mã 2 bước và smoke test cách ly dữ liệu người dùng.

---

# سياسة الأمان

يوفر NowNote تطبيق ملاحظات محلي أولا وخادما يمكن تشغيله ذاتيا. يجب إرسال مشاكل الأمان بشكل خاص أولا وعدم نشر الأسرار في issues عامة.

- بريد الإبلاغ: cyhuh428@gmail.com
- لا تنشر API token أو token اتصال المستخدم أو كلمة مرور DB أو مفتاح توقيع Android أو بيانات شخصية حقيقية.
- قبل فتح خادم عام، تحقق من فرض user token و HTTPS و reverse proxy والتسجيل الذاتي وإعادة تعيين كلمة المرور بالبريد ورمز التحقق الثنائي واختبار عزل بيانات المستخدم.
