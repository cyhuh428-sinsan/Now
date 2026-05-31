# NowNote 기여 안내

NowNote는 한국어 사용 흐름을 먼저 기준으로 개발합니다.
기여자는 기능 추가보다 기존 방향과 안전 기준을 먼저 확인해야 합니다.

## 기본 원칙

- 화면 문구와 사용자 문서는 한국어를 우선합니다.
- 영어 문서는 한국어 기준이 안정된 뒤 맞춥니다.
- 메모 본문에 사진 첨부는 1차 범위에 넣지 않습니다.
- 계층 메모는 주제 / 분류 / 메모 3단계 기준을 유지합니다.
- 암호화 저장은 메모 단위 선택 기능이며, 암호화 키를 저장소나 서버에 저장하지 않습니다.
- 서버 연결은 개인 Docker 서버와 공용 서버 흐름을 구분합니다.

## 작업 위치

- 모바일 앱: `now_app`
- Web/설치형 기준 화면: `web`
- 서버: `server`
- 공통 문서: `docs`

서버 기능을 작업할 때는 앱 폴더보다 저장소 루트와 `server`를 기준으로 봅니다.
모바일 UI나 Android 출시 문서를 작업할 때는 `now_app`을 기준으로 봅니다.

## 민감정보 금지

아래 값은 커밋하지 않습니다.

- `server/.env`
- `now_app/android/key.properties`
- `now_app/android/upload-keystore.jks`
- 실제 API 토큰
- 실제 DB 비밀번호
- 사용자별 접속 토큰
- LLM API 키

예시 파일에는 `change-this-*` 또는 `CHANGE_ME` placeholder만 사용합니다.

## 변경 전 확인

작업 전에는 변경 범위를 먼저 좁힙니다.

- 기존 동작을 바꾸는지 확인
- Web, 모바일, 서버 문서 중 같이 바꿔야 하는 곳 확인
- 서버 capability와 도움말 문구가 어긋나지 않는지 확인
- 공개 저장소/Google Play/개인정보 문서에 영향이 있는지 확인

## 점검

서버 관련 변경, 문서 정합성 변경, 공개 저장소 기준 변경은 서버 디렉터리에서 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py
```

`.env.example` 구조만 확인할 때는 아래 명령을 사용할 수 있습니다.

```bash
python3 scripts/preflight.py --env-file .env.example --allow-example
```

서버를 띄운 뒤에는 smoke test를 실행합니다.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

공용 서버 오픈 전에는 아래 점검이 통과해야 합니다.

```bash
python3 scripts/preflight.py --public-server
```

## 문서 갱신

작업 중 오류나 대화 중단에 대비해 `docs/WORK_PROGRESS.md`를 갱신합니다.

기록할 내용:

- 시작한 작업
- 확인한 사실
- 구현 내용
- 검증 결과

## 커밋 기준

- 하나의 커밋은 하나의 의도를 갖습니다.
- 기능 변경과 문서 정리는 가능하면 분리합니다.
- 민감정보 제외, 공개 문서, 배포 절차처럼 운영에 영향을 주는 기준은 preflight 또는 smoke test에 회귀 방지 점검을 추가합니다.

## 기여 라이선스

NowNote에 제출하는 기여 코드는 별도 서면 합의가 없는 한 저장소의 Apache License 2.0 조건으로 제공됩니다.

---

# Contributing Guide

Language: 한국어 | English | 中文 | 日本語 | Tiếng Việt | العربية

NowNote is developed with Korean usage flows as the first baseline. Contributors should check the existing direction and safety rules before adding features.

## Principles

- Korean UI text and user documentation come first.
- Additional languages follow the stable Korean baseline.
- Photo attachments in note bodies are not part of phase one.
- Tree notes must keep the topic / category / note three-level structure.
- Encryption is a per-note feature, and encryption keys are never stored in the repository or on the server.
- Server connection flows must distinguish private Docker servers from public servers.

## Work Areas

- Mobile app: `now_app`
- Web/desktop baseline screen: `web`
- Server: `server`
- Shared docs: `docs`

Do server work from the repository root and `server`. Do mobile UI or Android release work from `now_app`.

## Sensitive Data

Do not commit `server/.env`, Android signing files, real API tokens, database passwords, user connection tokens, or LLM API keys. Example files must use placeholders such as `change-this-*` or `CHANGE_ME`.

## Checks

Run server preflight for server, documentation consistency, and public repository changes.

```bash
python3 scripts/preflight.py
```

After starting the server, run smoke test.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token long-random-token
```

## Contribution License

Unless otherwise agreed in writing, contributions to NowNote are provided under Apache License 2.0.

---

# 贡献指南

NowNote 以韩语使用流程为第一基准开发。贡献者在添加功能前，应先确认现有方向和安全标准。

## 基本原则

- 界面文字和用户文档优先使用韩语。
- 其他语言在韩语基准稳定后补齐。
- 第一阶段不包含在笔记正文中附加照片。
- 层级笔记保持主题 / 分类 / 笔记三层结构。
- 加密是按笔记选择的功能，加密 key 不保存到仓库或服务器。
- 服务器连接流程必须区分个人 Docker 服务器和公共服务器。

## 工作位置

- 移动应用: `now_app`
- Web/安装版基准画面: `web`
- 服务器: `server`
- 通用文档: `docs`

## 敏感信息

不要提交 `server/.env`、Android 签名文件、真实 API token、DB 密码、用户连接 token 或 LLM API key。示例文件只使用 `change-this-*` 或 `CHANGE_ME`。

## 检查

服务器、文档一致性、公开仓库相关修改需运行 preflight。服务器启动后运行 smoke test。

---

# コントリビューションガイド

NowNote は韓国語の利用フローを第一基準として開発します。機能追加より先に、既存の方向性と安全基準を確認してください。

## 基本原則

- 画面文言とユーザー文書は韓国語を優先します。
- 追加言語は韓国語基準が安定した後に合わせます。
- メモ本文への写真添付は第一段階に含めません。
- 階層メモはトピック / 分類 / メモの 3 段階を維持します。
- 暗号化はメモ単位の選択機能で、暗号化 key はリポジトリやサーバーに保存しません。
- サーバー接続は個人 Docker サーバーと公共サーバーの流れを分けます。

## 作業場所

- モバイルアプリ: `now_app`
- Web/インストール版基準画面: `web`
- サーバー: `server`
- 共通文書: `docs`

## 機密情報

`server/.env`、Android 署名ファイル、実 API token、DB パスワード、ユーザー接続 token、LLM API key はコミットしません。例示ファイルには placeholder のみ使います。

---

# Hướng dẫn đóng góp

NowNote được phát triển trước hết theo luồng sử dụng tiếng Hàn. Người đóng góp cần kiểm tra hướng đi hiện có và tiêu chuẩn an toàn trước khi thêm tính năng.

## Nguyên tắc

- Văn bản giao diện và tài liệu người dùng ưu tiên tiếng Hàn.
- Ngôn ngữ bổ sung đi theo baseline tiếng Hàn đã ổn định.
- Đính kèm ảnh trong nội dung ghi chú không thuộc giai đoạn một.
- Ghi chú phân cấp giữ cấu trúc 3 cấp chủ đề / phân loại / ghi chú.
- Mã hóa là tính năng theo từng ghi chú, key không được lưu trong repository hoặc server.
- Luồng kết nối server phải tách server Docker cá nhân và server công cộng.

## Khu vực làm việc

- Ứng dụng di động: `now_app`
- Màn hình Web/desktop: `web`
- Server: `server`
- Tài liệu chung: `docs`

## Dữ liệu nhạy cảm

Không commit `server/.env`, file ký Android, API token thật, mật khẩu DB, token kết nối người dùng hoặc LLM API key.

---

# دليل المساهمة

يتم تطوير NowNote أولا حول تدفق استخدام اللغة الكورية. قبل إضافة الميزات، يجب على المساهمين مراجعة الاتجاه الحالي ومعايير الأمان.

## المبادئ

- نصوص الواجهة ووثائق المستخدم تعطي الأولوية للكورية.
- اللغات الإضافية تتبع خط الأساس الكوري بعد استقراره.
- إرفاق الصور داخل نص الملاحظة ليس ضمن المرحلة الأولى.
- الملاحظات الهرمية تحافظ على بنية موضوع / تصنيف / ملاحظة.
- التشفير ميزة اختيارية على مستوى الملاحظة، ولا يتم حفظ المفتاح في المستودع أو الخادم.
- يجب فصل تدفق الخادم الخاص Docker عن الخادم العام.

## مناطق العمل

- تطبيق الهاتف: `now_app`
- شاشة Web/desktop: `web`
- الخادم: `server`
- الوثائق المشتركة: `docs`

## البيانات الحساسة

لا تقم بعمل commit لملف `server/.env` أو ملفات توقيع Android أو API token حقيقي أو كلمة مرور DB أو token اتصال المستخدم أو LLM API key.
