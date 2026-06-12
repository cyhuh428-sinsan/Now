# NowNote

![NowNote Preflight](https://github.com/cyhuh428-sinsan/Now/actions/workflows/preflight.yml/badge.svg)

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

> GitHub README는 사용자의 NowNote 언어 설정을 자동으로 읽을 수 없어서 이 파일은 한국어 기준으로 표시합니다.
> Web/설치형 프로그램 안에서는 설정에서 한국어, English, 中文, 日本語, Tiếng Việt, العربية를 선택할 수 있습니다.

NowNote는 한국어 사용 흐름을 먼저 기준으로 만든 로컬/서버 병행 메모 시스템입니다.

모바일 앱은 빠른 기록과 음성 메모를 중심으로 사용하고, Windows 설치형 프로그램은 PC 로컬 문서와 공유 문서를 함께 다룹니다. 서버 제공 Web 프로그램은 로컬 메모장이 아니라 서버에 공유된 내 문서만 접속하는 브라우저 클라이언트입니다. 서버는 Docker 기반으로 직접 운영하거나 공용 서버에 연결할 수 있도록 준비합니다.

## 최근 변경

- 2.2 Web 그룹 메신저: 메시지 시간 표시를 서버 UTC 기준으로 보정하고, 로그인 중 자동 새로고침과 안 읽은 메시지 수 표시를 안정화했습니다.
- 그룹 설정: 로그인 후 참가 가능한 그룹 목록을 확인하고, 관리자가 발급한 초대코드로 그룹에 참가할 수 있습니다.
- Web 화면: 왼쪽 메뉴 간격과 메신저 보내기 버튼 표시를 조정했습니다.
- 2.3 Web 그룹 메신저 확장: 전체 그룹방을 유지하면서 일부 그룹원 채팅방, 파일/사진 첨부, 서버 저장소, 업로드/다운로드 API, 파일 크기/확장자 제한, 참여자 권한 검사를 추가했습니다.

## 구성

- `now_app`: Flutter 모바일 앱
- `web`: 서버가 루트 주소에서 제공하는 공유 문서 전용 Web 화면
- `desktop`: Windows `.exe` 설치형 프로그램. 별도 EXE로 배포하되 Web 전용 기능을 제외한 디자인과 기능 구조는 Web과 동일하게 유지
- `server`: Docker 기반 NowNote 서버
- `docs`: 공통 도움말, 인증 기준, 작업 진행 기록

## 1차 목표

- 일자별 메모: 날짜마다 메모장 하나를 두고 계속 추가
- 계층 메모: 주제 / 분류 / 메모 3단계 구조
- 음성 메모: 실시간 변환 또는 녹음 후 변환 흐름 유지
- 검색과 분류: 제목, 경로, 태그, 본문 검색
- Markdown: 작성, 미리보기, 가져오기, 내보내기
- 서버 동기화: 개인 Docker 서버 또는 공용 서버 연결
- 운영 화면: `/monitor`, `/admin`에서 상태와 백업/점검 확인
- 한국어 우선: 처음에는 한국어 화면과 문서를 기준으로 개발

## 사용 방식

### 단독 사용자

서버에 연결하지 않고 현재 기기 안에서만 메모를 관리합니다.

- 모바일 앱은 빠른 기록과 음성 입력에 적합합니다.
- Windows 설치형 프로그램은 집 PC의 계층 메모와 Markdown 정리에 적합합니다.
- Web 프로그램은 단독 로컬 저장용이 아니라 서버에 공유된 문서를 접속하는 용도입니다.
- 주기적으로 DB 백업 또는 Markdown 내보내기를 해두는 것이 좋습니다.

### 서버 연결 사용자

개인 Docker 서버나 공용 NowNote 서버에 연결해 여러 기기에서 메모를 동기화합니다.

- 개인 서버는 `server/.env`의 구형 개인 서버 API 토큰과 DB 비밀번호를 먼저 바꿔야 합니다.
- 앱과 설치형 프로그램은 서버 주소, 사용자 ID, Web에서 발급한 앱/설치형 접속 토큰으로 동기화합니다.
- 구형 개인 서버 API 토큰은 2.3 기본 사용 흐름에서는 필요 없으며 기존 개인 서버 호환이 필요할 때만 고급 설정에서 사용합니다.
- Web 프로그램은 사용자 ID와 비밀번호로 로그인하고 서버의 공유 문서를 원본으로 사용합니다.
- 공용 서버는 사용자 직접 가입, 앱/설치형 접속 토큰, 이메일 비밀번호 재설정, 2단계 코드 검증, HTTPS/reverse proxy 기준을 충족해야 합니다.
- 2단계 인증 코드는 저장하지 않고 확인 요청에만 사용합니다.

## 시작 위치

- 처음 설치 가이드: `INSTALL.md`
- 모바일 앱: `now_app/README.md`
- Windows 설치형 프로그램: `desktop/README.md`
- Web 프로그램 원본/개발 문서: `web/README.md`
- 서버 설치와 운영: `server/README.md`
- 사용자 도움말: `docs/HELP.md`
- 현재 진행 상태: `docs/PROJECT_STATUS.md`
- 1차 마무리 체크리스트: `docs/PHASE1_RELEASE_CHECKLIST.md`
- 공개 저장소 오픈 점검: `docs/OPEN_SOURCE_RELEASE.md`
- 오픈소스 라이선스 선택 가이드: `docs/LICENSE_DECISION.md`
- 서버 인증 기준: `docs/SERVER_AUTH_POLICY.md`
- 보안 정책: `SECURITY.md`
- 기여 안내: `CONTRIBUTING.md`

## 라이선스

NowNote는 Apache License 2.0으로 공개합니다.
자세한 내용은 루트 `LICENSE` 파일을 확인하세요.

## 서버 빠른 실행

개인 Linux 서버에 NowNote 서버를 설치할 때는 먼저 `INSTALL.md`를 기준으로 진행합니다.
서버 디렉터리에서 `.env`를 준비한 뒤 Docker Compose로 실행합니다.

```bash
cd server
docker compose up --build -d
```

기본 포트는 `8750`입니다.

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
```

배포 전 점검은 서버 디렉터리에서 실행합니다.

```bash
python3 scripts/preflight.py
python3 scripts/smoke_test.py --base-url http://localhost:8750
```

Linux 서버에서는 갱신, 점검, 컨테이너 재시작, smoke test를 한 번에 실행할 수 있습니다.
도우미 위치는 `server/scripts/deploy_local.sh`입니다.

```bash
cd server
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

공개 저장소에 올리기 전에는 루트 디렉터리에서 비밀값 포함 여부를 확인합니다.

```bash
python3 scripts/verify_public_repo_safety.py
```

1차 마무리 상태는 루트 디렉터리에서 요약 확인할 수 있습니다.

```bash
python3 scripts/release_readiness.py
python3 scripts/release_readiness.py --show-blockers
```

Google Play 등록 준비 상태는 루트 디렉터리에서 자동 확인과 수동 확인 항목을 나눠 볼 수 있습니다.

```bash
python3 scripts/play_release_status.py --show-manual
```

현재 로컬 개발/배포 환경 상태는 루트 디렉터리에서 확인할 수 있습니다.

```bash
python3 scripts/local_environment_status.py --base-url http://localhost:8750
```

## 현재 정책

- 메모 본문에 사진 첨부는 1차 범위에 넣지 않습니다.
- 지식 메모는 필요할 때 메모 단위로 암호화할 수 있으며, 같은 키를 입력해야 Web/설치형/앱에서 열 수 있습니다.
- 공용 서버 오픈 전에는 `NOW_USER_TOKEN_REQUIRED=true`, 공개 HTTPS, reverse proxy 환경을 반드시 확인합니다.
- 실제 `.env`, Android `key.properties`, `upload-keystore.jks`는 Git에 올리지 않습니다.

---

# NowNote English

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

NowNote is a local/server hybrid note system designed first around Korean usage patterns.

The mobile app focuses on quick capture and voice memos. The Windows desktop installer manages both local PC notes and shared server notes. The server-hosted Web program is not a local notebook; it is a browser client for notes that the user has shared to the server. The server can be self-hosted with Docker or connected through a public NowNote server.

## Recent Changes

- 2.2 Web group messenger: message times are normalized to server UTC, and logged-in auto refresh plus unread message counts are stabilized.
- Group settings: after login, users can review available groups and join a group with an administrator-issued invite code.
- Web UI: sidebar spacing and the messenger send button layout were adjusted.
- 2.3 Web group messenger expansion: the full-group room is preserved while selected-member rooms, file/photo attachments, server storage, upload/download APIs, file size/extension limits, and participant permission checks have been added.

## Structure

- `now_app`: Flutter mobile app
- `web`: server-hosted Web screen for shared documents
- `desktop`: Windows `.exe` installer. It is distributed as a separate EXE while keeping the same design and functional structure as Web except hosted Web-only features
- `server`: Docker-based NowNote server
- `docs`: shared help, authentication policy, and work progress logs

## Phase-One Goals

- Daily notes: one notebook per date, appended continuously
- Tree notes: three-level structure: topic / category / note
- Voice memos: realtime transcription or record-then-transcribe
- Search and classification: title, path, tag, and body search
- Markdown: write, preview, import, and export
- Server sync: connect to a private Docker server or public server
- Operations screens: check status, backup, and diagnostics at `/monitor` and `/admin`
- Korean-first: Korean screens and documentation are the primary baseline

## Usage Modes

### Standalone User

Use NowNote only on the current device without connecting to a server.

- The mobile app is best for quick capture and voice input.
- The Windows desktop program is best for structured notes and Markdown on a home PC.
- The Web program is not for standalone local storage; it accesses documents shared to a server.
- Periodic DB backup or Markdown export is recommended.

### Server-Connected User

Connect to a private Docker server or public NowNote server and sync notes across devices.

- On a private server, change the API token and database password in `server/.env` first.
- The app and desktop program sync with an app/desktop connection token issued from Web.
- The Web program logs in with user ID and password and uses shared server documents as the source.
- A public server must support self-registration, app/desktop connection tokens, email password reset, two-factor code checks, HTTPS, and reverse proxy.
- Two-factor codes are not stored and are used only for verification requests.

## Start Here

- First install guide: `INSTALL.md`
- Mobile app: `now_app/README.md`
- Windows desktop program: `desktop/README.md`
- Web source/development document: `web/README.md`
- Server installation and operation: `server/README.md`
- User help: `docs/HELP.md`
- English user help: `docs/HELP.en.md`
- Current project status: `docs/PROJECT_STATUS.md`
- Phase-one checklist: `docs/PHASE1_RELEASE_CHECKLIST.md`
- Public repository checklist: `docs/OPEN_SOURCE_RELEASE.md`
- License decision guide: `docs/LICENSE_DECISION.md`
- Server authentication policy: `docs/SERVER_AUTH_POLICY.md`
- Security policy: `SECURITY.md`
- Contribution guide: `CONTRIBUTING.md`

## License

NowNote is released under Apache License 2.0.
See the root `LICENSE` file for details.

## Quick Server Start

For a private Linux server, start with `INSTALL.md`. Then prepare `.env` in the server directory and run Docker Compose.

```bash
cd server
docker compose up --build -d
```

The default port is `8750`.

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
```

Run pre-deploy checks in the server directory.

```bash
python3 scripts/preflight.py
python3 scripts/smoke_test.py --base-url http://localhost:8750
```

## Current Policy

- Photo attachments in note bodies are not included in phase one.
- Knowledge notes can be encrypted per note. The same key is required to open them in Web, desktop, and mobile.
- Before opening a public server, verify `NOW_USER_TOKEN_REQUIRED=true`, public HTTPS, and reverse proxy settings.
- Real `.env`, Android `key.properties`, and `upload-keystore.jks` files must not be committed.

---

# NowNote 中文

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

NowNote 是一个本地和服务器并行使用的笔记系统，首先以韩语使用流程为基准设计。

移动应用侧重快速记录和语音备忘。Windows 安装版同时管理 PC 本地文档和服务器共享文档。服务器提供的 Web 程序不是本地记事本，而是访问服务器中本人共享文档的浏览器客户端。服务器可以通过 Docker 自行部署，也可以连接公共 NowNote 服务器。

## 最近变更

- 2.2 Web 群组消息: 按服务器 UTC 修正消息时间显示，并稳定登录状态下的自动刷新和未读消息数。
- 群组设置: 登录后可以查看可加入的群组列表，并使用管理员发放的邀请码加入群组。
- Web 界面: 调整了左侧菜单间距和消息发送按钮的显示。
- 2.3 Web 群组消息扩展: 保留全组聊天室，并新增部分成员聊天室、文件/图片附件、服务器存储、上传/下载 API、文件大小/扩展名限制和参与者权限检查。

## 组成

- `now_app`: Flutter 移动应用
- `web`: 由服务器根地址提供的共享文档专用 Web 画面
- `desktop`: Windows `.exe` 安装程序。它作为独立 EXE 发布，并在排除 Web 专用功能后保持与 Web 相同的设计和功能结构
- `server`: Docker 기반 NowNote 服务器
- `docs`: 通用帮助、认证标准、工作进度记录

## 第一阶段目标

- 日期笔记: 每个日期一个记事本，持续追加
- 层级笔记: 主题 / 分类 / 笔记三层结构
- 语音备忘: 实时转写或录音后转写
- 搜索和分类: 标题、路径、标签、正文搜索
- Markdown: 编写、预览、导入、导出
- 服务器同步: 连接个人 Docker 服务器或公共服务器
- 运维画面: 在 `/monitor`、`/admin` 查看状态、备份和检查
- 韩语优先: 初期以韩语界面和文档为开发基准

## 使用方式

### 单独用户

不连接服务器，只在当前设备中管理笔记。

- 移动应用适合快速记录和语音输入。
- Windows 安装版适合在家用 PC 上整理层级笔记和 Markdown。
- Web 程序不是单独本地保存用途，而是访问服务器共享文档。
- 建议定期进行 DB 备份或 Markdown 导出。

### 服务器连接用户

连接个人 Docker 服务器或公共 NowNote 服务器，在多台设备之间同步笔记。

- 个人服务器必须先修改 `server/.env` 中的 API token 和数据库密码。
- 应用和安装版使用 Web 中签发的应用/安装版连接 token 进行同步。
- Web 程序使用用户 ID 和密码登录，并以服务器共享文档为原本。
- 公共服务器必须支持用户自行注册、应用/安装版连接 token、邮件密码重置、二步验证码、HTTPS 和反向代理。
- 二步验证码不会保存，只在验证请求时使用。

## 许可证

NowNote 以 Apache License 2.0 公开。详细内容请查看根目录 `LICENSE` 文件。

## 当前政策

- 第一阶段不支持在笔记正文中附加照片。
- 知识笔记可以按笔记单独加密。Web、安装版、移动应用都需要输入同一个 key 才能打开。
- 公共服务器开放前必须确认 `NOW_USER_TOKEN_REQUIRED=true`、公开 HTTPS、反向代理环境。
- 真实的 `.env`、Android `key.properties`、`upload-keystore.jks` 不能提交到 Git。

---

# NowNote 日本語

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

NowNote は、韓国語の利用フローを最初の基準として作られた、ローカル/サーバー併用型のメモシステムです。

モバイルアプリは素早い記録と音声メモを中心に使います。Windows インストール版は PC ローカル文書と共有文書を一緒に扱います。サーバー提供 Web プログラムはローカルメモ帳ではなく、サーバーに共有された自分の文書だけにアクセスするブラウザクライアントです。サーバーは Docker で自分で運用するか、公共サーバーに接続できます。

## 最近の変更

- 2.2 Web グループメッセンジャー: メッセージ時刻をサーバー UTC 基準で補正し、ログイン中の自動更新と未読メッセージ数を安定化しました。
- グループ設定: ログイン後に参加可能なグループ一覧を確認し、管理者が発行した招待コードでグループに参加できます。
- Web 画面: 左メニューの間隔とメッセンジャー送信ボタンの表示を調整しました。
- 2.3 Web グループメッセンジャー拡張: 全体グループルームを維持しつつ、一部メンバー向けチャットルーム、ファイル/写真添付、サーバーストレージ、アップロード/ダウンロード API、ファイルサイズ/拡張子制限、参加者権限チェックを追加しました。

## 構成

- `now_app`: Flutter モバイルアプリ
- `web`: サーバーのルートアドレスで提供される共有文書専用 Web 画面
- `desktop`: Windows `.exe` インストーラー。独立した EXE として配布しつつ、Web 専用機能を除いて Web と同じデザインと機能構造を維持します
- `server`: Docker ベースの NowNote サーバー
- `docs`: 共通ヘルプ、認証基準、作業進行記録

## 第一段階の目標

- 日付別メモ: 日付ごとに一つのメモ帳を置き、継続して追記
- 階層メモ: トピック / 分類 / メモの 3 段階構造
- 音声メモ: リアルタイム変換または録音後変換
- 検索と分類: タイトル、パス、タグ、本文検索
- Markdown: 作成、プレビュー、インポート、エクスポート
- サーバー同期: 個人 Docker サーバーまたは公共サーバーに接続
- 運用画面: `/monitor`、`/admin` で状態とバックアップ/点検を確認
- 韓国語優先: 初期は韓国語画面と文書を基準に開発

## 使い方

### 単独ユーザー

サーバーに接続せず、現在の端末内だけでメモを管理します。

- モバイルアプリは素早い記録と音声入力に適しています。
- Windows インストール版は自宅 PC の階層メモと Markdown 整理に適しています。
- Web プログラムは単独ローカル保存用ではなく、サーバーに共有された文書にアクセスする用途です。
- 定期的な DB バックアップまたは Markdown エクスポートを推奨します。

### サーバー接続ユーザー

個人 Docker サーバーまたは公共 NowNote サーバーに接続し、複数端末でメモを同期します。

- 個人サーバーでは、まず `server/.env` の API token と DB パスワードを変更します。
- アプリとインストール版は Web で発行したアプリ/インストール版接続 token で同期します。
- Web プログラムはユーザー ID とパスワードでログインし、サーバーの共有文書を原本として使います。
- 公共サーバーには、ユーザー直接登録、アプリ/インストール版接続 token、メールによるパスワード再設定、2段階コード検証、HTTPS/reverse proxy が必要です。
- 2段階認証コードは保存せず、確認要求にのみ使用します。

## ライセンス

NowNote は Apache License 2.0 で公開します。詳細はルートの `LICENSE` ファイルを確認してください。

## 現在の方針

- メモ本文への写真添付は第一段階に含めません。
- 知識メモは必要なときにメモ単位で暗号化できます。同じ key を入力すると Web/インストール版/アプリで開けます。
- 公共サーバー公開前に `NOW_USER_TOKEN_REQUIRED=true`、公開 HTTPS、reverse proxy 環境を必ず確認します。
- 実際の `.env`、Android `key.properties`、`upload-keystore.jks` は Git に入れません。

---

# NowNote Tiếng Việt

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

NowNote là hệ thống ghi chú kết hợp local/server, được thiết kế trước hết theo luồng sử dụng tiếng Hàn.

Ứng dụng di động tập trung vào ghi nhanh và ghi chú bằng giọng nói. Chương trình cài đặt Windows xử lý cả tài liệu local trên PC và tài liệu chia sẻ. Chương trình Web do server cung cấp không phải là sổ ghi chú local; đó là client trình duyệt chỉ truy cập các tài liệu của chính người dùng đã được chia sẻ lên server. Server có thể tự vận hành bằng Docker hoặc kết nối tới server NowNote công cộng.

## Thay Đổi Gần Đây

- 2.2 Web group messenger: thời gian tin nhắn được chuẩn hóa theo UTC của server, đồng thời ổn định tự động làm mới khi đã đăng nhập và số tin nhắn chưa đọc.
- Thiết lập nhóm: sau khi đăng nhập, người dùng có thể xem danh sách nhóm khả dụng và tham gia nhóm bằng mã mời do quản trị viên cấp.
- Giao diện Web: đã điều chỉnh khoảng cách menu bên trái và cách hiển thị nút gửi trong messenger.
- Mở rộng Web group messenger 2.3: giữ phòng toàn nhóm, đồng thời thêm phòng chat cho một số thành viên, đính kèm file/ảnh, lưu trữ server, API upload/download, giới hạn dung lượng/phần mở rộng file và kiểm tra quyền người tham gia.

## Cấu trúc

- `now_app`: ứng dụng di động Flutter
- `web`: màn hình Web chuyên dùng cho tài liệu chia sẻ, được server cung cấp tại địa chỉ gốc
- `desktop`: trình cài đặt Windows `.exe`. Được phân phối dưới dạng EXE riêng nhưng giữ cùng thiết kế và cấu trúc chức năng với Web, trừ các chức năng chỉ dành cho hosted Web
- `server`: NowNote server nền Docker
- `docs`: trợ giúp chung, chính sách xác thực, nhật ký tiến độ

## Mục tiêu giai đoạn một

- Ghi chú theo ngày: mỗi ngày một sổ ghi chú và tiếp tục thêm nội dung
- Ghi chú phân cấp: cấu trúc 3 cấp chủ đề / phân loại / ghi chú
- Ghi chú giọng nói: chuyển đổi realtime hoặc ghi âm rồi chuyển đổi
- Tìm kiếm và phân loại: tìm theo tiêu đề, đường dẫn, tag, nội dung
- Markdown: viết, xem trước, nhập, xuất
- Đồng bộ server: kết nối server Docker cá nhân hoặc server công cộng
- Màn hình vận hành: kiểm tra trạng thái, backup và chẩn đoán tại `/monitor`, `/admin`
- Ưu tiên tiếng Hàn: ban đầu phát triển dựa trên màn hình và tài liệu tiếng Hàn

## Cách sử dụng

### Người dùng độc lập

Quản lý ghi chú chỉ trong thiết bị hiện tại mà không kết nối server.

- Ứng dụng di động phù hợp với ghi nhanh và nhập bằng giọng nói.
- Chương trình Windows phù hợp với ghi chú phân cấp và Markdown trên PC ở nhà.
- Chương trình Web không dùng để lưu local độc lập; nó dùng để truy cập tài liệu đã chia sẻ trên server.
- Nên backup DB hoặc xuất Markdown định kỳ.

### Người dùng kết nối server

Kết nối server Docker cá nhân hoặc server NowNote công cộng để đồng bộ ghi chú trên nhiều thiết bị.

- Với server cá nhân, trước hết phải đổi API token và mật khẩu DB trong `server/.env`.
- Ứng dụng và chương trình cài đặt đồng bộ bằng token kết nối app/desktop được cấp từ Web.
- Chương trình Web đăng nhập bằng user ID và mật khẩu, dùng tài liệu chia sẻ trên server làm nguồn chính.
- Server công cộng cần hỗ trợ tự đăng ký, token kết nối app/desktop, đặt lại mật khẩu qua email, mã xác minh 2 bước, HTTPS và reverse proxy.
- Mã xác minh 2 bước không được lưu, chỉ dùng khi gửi yêu cầu xác minh.

## Giấy phép

NowNote được phát hành theo Apache License 2.0. Xem file `LICENSE` ở thư mục gốc để biết chi tiết.

## Chính sách hiện tại

- Đính kèm ảnh trong nội dung ghi chú không thuộc phạm vi giai đoạn một.
- Ghi chú kiến thức có thể được mã hóa theo từng ghi chú. Cần nhập cùng một key để mở trên Web, desktop và mobile.
- Trước khi mở server công cộng, phải kiểm tra `NOW_USER_TOKEN_REQUIRED=true`, HTTPS công khai và reverse proxy.
- Không commit `.env`, Android `key.properties`, `upload-keystore.jks` thật lên Git.

---

# NowNote العربية

Language: [한국어](#nownote) | [English](#nownote-english) | [中文](#nownote-中文) | [日本語](#nownote-日本語) | [Tiếng Việt](#nownote-tiếng-việt) | [العربية](#nownote-العربية)

NowNote هو نظام ملاحظات يعمل محليا ومع الخادم، وقد صمم أولا حول تدفق استخدام اللغة الكورية.

يركز تطبيق الهاتف على التسجيل السريع والملاحظات الصوتية. يتعامل برنامج Windows المثبت مع مستندات الكمبيوتر المحلية والمستندات المشتركة معا. برنامج Web الذي يقدمه الخادم ليس مفكرة محلية، بل عميل متصفح يصل فقط إلى مستندات المستخدم التي تمت مشاركتها على الخادم. يمكن تشغيل الخادم ذاتيا باستخدام Docker أو الاتصال بخادم NowNote عام.

## آخر التغييرات

- 2.2 مرسال مجموعات Web: تم تصحيح عرض وقت الرسائل اعتمادا على UTC الخاص بالخادم، وتحسين التحديث التلقائي أثناء تسجيل الدخول وعدد الرسائل غير المقروءة.
- إعدادات المجموعة: بعد تسجيل الدخول يمكن للمستخدمين مراجعة قائمة المجموعات المتاحة والانضمام إلى مجموعة باستخدام رمز دعوة يصدره المسؤول.
- واجهة Web: تم ضبط تباعد القائمة اليسرى وطريقة عرض زر الإرسال في المرسال.
- توسيع مرسال مجموعات Web في 2.3: تم الحفاظ على غرفة المجموعة الكاملة، مع إضافة غرف دردشة لبعض الأعضاء، ومرفقات الملفات/الصور، وتخزين الخادم، وواجهات upload/download API، وحدود حجم الملف والامتدادات، وفحص صلاحيات المشاركين.

## البنية

- `now_app`: تطبيق Flutter للهاتف
- `web`: شاشة Web مخصصة للمستندات المشتركة يقدمها الخادم من عنوان الجذر
- `desktop`: مثبّت Windows بصيغة `.exe`. يوزّع كملف EXE منفصل مع الحفاظ على نفس التصميم والبنية الوظيفية مثل Web باستثناء ميزات Web الحصرية
- `server`: خادم NowNote مبني على Docker
- `docs`: المساعدة المشتركة، معايير المصادقة، وسجل تقدم العمل

## أهداف المرحلة الأولى

- ملاحظات يومية: دفتر واحد لكل تاريخ مع الإضافة المستمرة
- ملاحظات هرمية: بنية من ثلاث مراحل: موضوع / تصنيف / ملاحظة
- ملاحظات صوتية: تحويل مباشر أو تسجيل ثم تحويل
- البحث والتصنيف: البحث في العنوان، المسار، الوسوم، والنص
- Markdown: كتابة، معاينة، استيراد، وتصدير
- مزامنة الخادم: الاتصال بخادم Docker خاص أو خادم عام
- شاشات التشغيل: فحص الحالة والنسخ الاحتياطي والتشخيص من `/monitor` و `/admin`
- الكورية أولا: في البداية تكون الشاشات والوثائق الكورية هي الأساس

## طرق الاستخدام

### مستخدم مستقل

إدارة الملاحظات داخل الجهاز الحالي فقط دون الاتصال بخادم.

- تطبيق الهاتف مناسب للتسجيل السريع والإدخال الصوتي.
- برنامج Windows مناسب لتنظيم الملاحظات الهرمية و Markdown على كمبيوتر المنزل.
- برنامج Web ليس للتخزين المحلي المستقل، بل للوصول إلى المستندات المشتركة على الخادم.
- يوصى بعمل نسخة احتياطية من DB أو تصدير Markdown بشكل دوري.

### مستخدم متصل بالخادم

الاتصال بخادم Docker خاص أو خادم NowNote عام لمزامنة الملاحظات بين عدة أجهزة.

- في الخادم الخاص، يجب أولا تغيير API token وكلمة مرور قاعدة البيانات في `server/.env`.
- يستخدم التطبيق وبرنامج سطح المكتب token اتصال app/desktop الصادر من Web للمزامنة.
- يسجل برنامج Web الدخول باستخدام user ID وكلمة المرور ويستخدم مستندات الخادم المشتركة كمصدر أصلي.
- يجب أن يدعم الخادم العام التسجيل الذاتي، token اتصال app/desktop، إعادة تعيين كلمة المرور بالبريد الإلكتروني، رمز التحقق الثنائي، HTTPS، و reverse proxy.
- لا يتم تخزين رمز التحقق الثنائي، ويستخدم فقط لطلبات التحقق.

## الترخيص

يصدر NowNote بموجب Apache License 2.0. راجع ملف `LICENSE` في الجذر للتفاصيل.

## السياسة الحالية

- إرفاق الصور داخل نص الملاحظة ليس ضمن نطاق المرحلة الأولى.
- يمكن تشفير ملاحظات المعرفة على مستوى الملاحظة. يجب إدخال المفتاح نفسه لفتحها في Web وسطح المكتب والهاتف.
- قبل فتح خادم عام، يجب التحقق من `NOW_USER_TOKEN_REQUIRED=true` و HTTPS العام وبيئة reverse proxy.
- لا ترفع ملفات `.env` الحقيقية أو Android `key.properties` أو `upload-keystore.jks` إلى Git.
