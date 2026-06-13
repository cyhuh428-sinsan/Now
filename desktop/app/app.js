const STORAGE_KEY = "nownote.web.v1";
const SETTINGS_KEY = "nownote.web.settings.v1";
const WEB_SESSION_KEY = "nownote.web.session.v1";
const WEB_LOGOUT_KEY = "nownote.web.logout.v1";
const WEB_AUTH_ACTIVE_KEY = "nownote.web.auth.active.v1";
const DESKTOP_STORAGE_KEYS = new Set([STORAGE_KEY, SETTINGS_KEY]);
const ENCRYPTED_NOTE_PREFIX = "NOW_ENCRYPTED_V1:";
const ENCRYPTION_ITERATIONS = 210000;
const APP_VERSION = "2.3.5";

const LANGUAGES = {
  ko: { label: "한국어", locale: "ko-KR", dir: "ltr", fallback: "ko" },
  en: { label: "English", locale: "en-US", dir: "ltr", fallback: "en" },
  zh: { label: "中文", locale: "zh-CN", dir: "ltr", fallback: "en" },
  ja: { label: "日本語", locale: "ja-JP", dir: "ltr", fallback: "en" },
  vi: { label: "Tiếng Việt", locale: "vi-VN", dir: "ltr", fallback: "en" },
  ar: { label: "العربية", locale: "ar", dir: "rtl", fallback: "en" },
};

const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES);

const ACCENTS = [
  { id: "blue", labelKey: "accent.blue", label: "파랑", value: "#2563eb" },
  { id: "purple", labelKey: "accent.purple", label: "보라", value: "#8b5cf6" },
  { id: "green", labelKey: "accent.green", label: "초록", value: "#14b8a6" },
  { id: "orange", labelKey: "accent.orange", label: "주황", value: "#f97316" },
];

const I18N = {
  ko: {
    "dialog.confirmTitle": "확인",
    "dialog.ok": "확인",
    "dialog.cancel": "취소",
    "note.untitled": "제목 없음",
    "note.emptyTitle": "주제가 없습니다",
    "note.emptyDescription": "먼저 주제를 추가하세요.",
    "note.pinnedPrefix": "고정 · ",
    "note.unpinTab": "고정 해제",
    "note.pinTab": "탭 고정",
    "note.dailyHasContent": "기록 있음",
    "note.dailyEmpty": "비어 있음",
    "note.backlinks": "백링크",
    "note.linkToNote": "메모로 이동",
    "note.linkMissing": "아직 없는 메모",
    "note.outlineEmpty": "개요로 표시할 제목이 없습니다.",
    "note.previewEmpty": "미리 볼 내용이 없습니다.",
    "note.stats.backlinks": "{count}개 백링크",
    "note.stats.edit": "편집",
    "note.stats.words": "{count}개 단어",
    "note.stats.chars": "{count}개 문자",
    "note.stats.reading": "읽기 {count}분",
    "note.stats.lines": "{count}줄",
    "note.stats.links": "{count}개 링크",
    "note.stats.tags": "{count}개 태그",
    "note.stats.missingLinks": "{count}개 미생성 링크",
    "note.stats.updated": "수정 {time}",
    "note.sectionOut": "연결",
    "note.sectionBacklink": "백링크",
    "note.sectionOutEmpty": "본문에 [[메모 제목]]을 적으면 다른 메모와 연결됩니다.",
    "note.sectionBacklinkEmpty": "이 메모를 언급한 다른 메모가 없습니다.",
    "note.nodeDelete.childrenBlocked": "아래에 연결된 항목이 있으면 삭제할 수 없습니다.",
    "note.nodeDelete.toTrashConfirm": "'{title}' 메모를 삭제 보관함으로 이동할까요?",
    "note.nodeDelete.permanentConfirm": "'{title}' 메모를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    "note.nodeDelete.permanentSelected": "선택한 {count}개 메모를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    "note.nodeDelete.permanentAll": "삭제 보관함의 {count}개 메모를 모두 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    "note.noArchive": "보관할 메모가 없습니다.",
    "note.archiveConfirm": "{date} 메모를 보관함으로 이동할까요?",
    "note.archiveRestoreConfirm": "같은 날짜의 활성 메모가 있습니다. 보관본 내용을 아래에 추가할까요?",
    "note.graphEmpty": "아직 연결된 메모가 없습니다. 본문에 [[메모 제목]]을 적으면 연결됩니다.",
    "note.deletedTreeEmpty": "삭제 보관함이 비어 있습니다.",
    "note.deletedSelection": "선택 {selected}개 / 전체 {total}개",
    "note.deletedSelectAll": "전체 선택",
    "note.deletedClearAll": "전체 해제",
    "note.emptyState": "없음",
    "note.dailyArchiveEmpty": "보관된 일자별 메모가 없습니다.",
    "note.archiveLabel": "보관 시각:",
    "note.archivedAt": "{time} 보관",
    "note.archiveCount": "{count}개",
    "note.archiveViewHint": "보관본 열람",
    "note.deletedAt": "{time} 삭제",
    "note.selectLabel": "{title} 선택",
    "note.childCount": "아래 {count}개",
    "note.tagEmpty": "태그 없음",
    "note.linkFallbackTitle": "링크 제목",
    "note.archiveRestoreMarker": "보관본 복원",
    "note.importDone": "가져오기가 완료되었습니다.",
    "note.importReadError": "JSON 파일을 읽을 수 없습니다.",
    "note.markdownImportedMore": "외 {count}개",
    "note.markdownStructureTitle": "{name} 구조",
    "note.restoredArchivedDailyCount": ", 복원된 보관본 {count}개",
    "note.dateMissing": "날짜 없음",
    "note.emptyContent": "내용 없음",
    "note.mergeChildrenMarker": "하위 메모 병합",
    "note.storageFail": "브라우저 저장소에 저장할 수 없습니다. 중요한 내용은 JSON 내보내기로 백업해 주세요.",
    "note.desktopStorageFail": "PC 로컬 저장소에 저장할 수 없습니다. 중요한 내용은 JSON 내보내기로 백업해 주세요.",
    "note.backupImportError": "NowNote 백업 JSON 형식이 아닙니다.",
    "note.backupReplaceConfirm": "JSON 백업을 가져오면 현재 메모와 설정이 백업 내용으로 교체됩니다.\n\n백업 파일: {file}\n백업 시각: {time}\n백업 내용: 일자별 메모 {daily}개, 보관 일자 {archivedDaily}개{restoredArchivedDaily}, 지식 메모 {tree}개, 삭제 보관 {deletedTree}개\n\n계속할까요?",
    "note.unknownDate": "확인 안 됨",
    "note.linkCreateConfirm": "'{title}' 메모가 없습니다. 새로 만들까요?",
    "note.backupFileReadError": "JSON 파일을 읽을 수 없습니다.",
    "note.backupFileOpenError": "JSON 파일을 열 수 없습니다. 파일 권한이나 형식을 확인해 주세요.",
    "note.backupFileParseError": "JSON 파일을 읽을 수 없습니다. 파일 권한이나 형식을 확인해 주세요.",
    "note.markdownNoContent": "가져올 Markdown 내용이 없습니다.",
    "note.markdownImportConfirm": "{count}개 Markdown 파일을 가져올까요? 지식 메모 {nodes}개, 일자별 메모 {daily}개, 보관 일자 {archivedDaily}개",
    "note.markdownImportDone": "Markdown 가져오기 완료: 지식 메모 {nodes}개, 일자별 메모 {daily}개, 보관 일자 {archivedDaily}개",
    "note.markdownImportError": "Markdown 파일을 읽을 수 없습니다. 파일 권한이나 형식을 확인해 주세요.",
    "note.snapshotCreated": "복구 스냅샷을 만들었습니다.",
    "note.snapshotRestored": "선택한 스냅샷으로 복구했습니다.",
    "note.snapshotRestoreConfirm": "선택한 스냅샷으로 현재 데이터를 복구할까요? 현재 상태도 먼저 스냅샷으로 남깁니다.",
    "note.fallbackMarkDownTitle": "가져온 Markdown",
    "note.exportDenied": "파일을 내보낼 수 없습니다. 브라우저 다운로드 권한이나 저장 공간을 확인해 주세요.",
    "note.newNote": "새 메모",
    "note.newCategory": "새 분류",
    "note.newTopic": "새 주제",
    "note.labelTopic": "주제",
    "note.labelCategory": "분류",
    "note.labelNote": "메모",
    "note.expand": "펼치기",
    "note.collapse": "접기",
    "note.addChild": "아래에 추가",
    "note.open": "열기",
    "note.restored": "복원됨",
    "note.syncMessage": "보낸 메모 {sent}개, 받은 메모 {received}개",
    "note.treeDepthLimit": "최대 3단계까지만 추가할 수 있습니다.",
    "note.tabClose": "닫기",
    "note.restore": "복원",
    "note.nodeDeletePermanent": "영구 삭제",
    "app.title": "NowNote",
    "accent.blue": "파랑",
    "accent.purple": "보라",
    "accent.green": "초록",
    "accent.orange": "주황",
    "brand.subtitle": "지식 메모",
    "quick.eyebrow": "제목과 경로로 바로 이동",
    "quick.title": "빠른 전환",
    "quick.placeholder": "제목 또는 경로 검색",
    "quick.empty": "이동할 메모가 없습니다.",
    "quick.count.recent": "최근 기준 {count}개 표시",
    "quick.count.recentLimited": "최근 기준 {shown}개 표시 / 전체 {count}개",
    "quick.count.match": "전환 후보 {count}개",
    "quick.count.matchLimited": "전환 후보 {count}개 중 {shown}개 표시",
    "search.label": "검색",
    "search.placeholder": "제목, 내용 검색",
    "search.emptyHint": "검색어를 입력하세요.",
    "search.emptyTitle": "검색어를 입력하세요",
    "search.emptyDescription": "일자별 메모와 지식 메모를 함께 검색합니다.",
    "search.popoverEyebrow": "일자별 메모와 지식 메모 전체",
    "search.popoverTitle": "검색",
    "search.popoverPlaceholder": "입력하여 검색하기...",
    "search.invalidHint": "검색어 형식을 확인하세요.",
    "search.invalidTitle": "접두어 뒤에 검색어를 입력하세요.",
    "search.invalidDescription": "예: title:회의, tag:아이디어, #메모",
    "search.noResultTitle": "검색 결과가 없습니다",
    "search.noResultDescription": "다른 검색어를 입력해보세요.",
    "search.scope.all": "전체",
    "search.scope.title": "제목",
    "search.scope.content": "내용",
    "search.scope.tag": "태그",
    "search.scope.path": "경로",
    "search.sort.updatedDesc": "수정일 최신순",
    "search.sort.updatedAsc": "수정일 오래된 순",
    "search.sort.createdDesc": "생성일 최신순",
    "search.sort.createdAsc": "생성일 오래된 순",
    "search.sort.titleAsc": "이름 가나다순",
    "search.sort.titleDesc": "이름 가나다 역순",
    "search.dailyMeta": "일자별 메모",
    "search.resultCount": "검색 결과 {count}개",
    "search.popoverHelp.path": "경로",
    "search.popoverHelp.title": "제목",
    "search.popoverHelp.tag": "태그",
    "search.popoverHelp.content": "내용",
    "today.label": "오늘 메모",
    "nav.tree": "지식 메모",
    "nav.shared.mine": "내 공유메모",
    "nav.shared.groupTree": "그룹 지식체계",
    "nav.shared.member": "구성원별 공유문서",
    "aria.quickMenu": "빠른 메뉴",
    "aria.sidebar": "NowNote 메뉴",
    "aria.noteView": "메모 보기",
    "aria.explore": "탐색",
    "aria.files": "파일",
    "aria.manage": "관리",
    "aria.treeList": "지식 목록",
    "aria.treeResize": "목록 폭 조정",
    "aria.treeEditor": "지식 메모 편집",
    "aria.openTabs": "열린 메모",
    "aria.treeTools": "지식 메모 도구",
    "aria.noteFind": "현재 메모에서 찾기",
    "aria.outline": "현재 메모 개요",
    "aria.tags": "태그",
    "aria.noteStats": "메모 정보",
    "aria.markdownPreview": "Markdown 미리보기",
    "aria.calendar": "달력",
    "aria.dailyEditor": "선택한 날짜 메모",
    "aria.dailyArchive": "일자별 메모 보관함",
    "aria.language": "언어",
    "aria.theme": "기본 테마",
    "aria.accent": "강조 색상",
    "aria.railMode": "빠른 메뉴 표시",
    "aria.fontSize": "글자 크기",
    "aria.lineHeight": "줄 간격",
    "aria.tabIndent": "Tab 들여쓰기",
    "aria.searchScope": "검색 범위",
    "aria.searchSort": "검색 정렬",
    "aria.searchOption": "검색 옵션",
    "aria.close": "닫기",
    "aria.prevResult": "이전 결과",
    "aria.nextResult": "다음 결과",
    "aria.prevMonth": "이전 달",
    "aria.nextMonth": "다음 달",
    "side.favorite": "즐겨찾기",
    "side.recent": "최근 수정",
    "side.tags": "태그",
    "side.explore": "탐색",
    "side.quick": "빠른 전환",
    "side.graph": "연결 보기",
    "side.file": "파일",
    "side.mdExport": "Markdown 내보내기",
    "side.mdImport": "Markdown 가져오기",
    "side.manage": "관리",
    "side.trash": "삭제 보관함",
    "side.settings": "화면 설정",
    "side.help": "도움말",
    "messenger.eyebrow": "같은 그룹 안의 짧은 대화",
    "messenger.title": "그룹 메신저",
    "messenger.refresh": "새로고침",
    "messenger.send": "보내기",
    "messenger.placeholder": "그룹원에게 보낼 메시지",
    "messenger.group": "그룹: {group}",
    "messenger.empty": "아직 메시지가 없습니다.",
    "messenger.loadFailed": "메시지를 불러오지 못했습니다",
    "messenger.sendFailed": "메시지를 보내지 못했습니다",
    "messenger.readFailed": "읽음 상태를 저장하지 못했습니다",
    "rail.sidebar.open": "목록 펼치기",
    "rail.sidebar.close": "목록 접기",
    "rail.knowledge": "지식 메모",
    "rail.daily": "오늘 메모",
    "rail.search": "검색",
    "rail.quick": "빠른 전환",
    "rail.graph": "연결 보기",
    "rail.mdExport": "Markdown 내보내기",
    "rail.mdImport": "Markdown 가져오기",
    "rail.trash": "삭제 보관함",
    "rail.settings": "화면 설정",
    "rail.letter.sidebar": "목",
    "rail.letter.knowledge": "지",
    "rail.letter.daily": "일",
    "rail.letter.search": "검",
    "rail.letter.quick": "전",
    "rail.letter.graph": "연",
    "rail.letter.mdExport": "내",
    "rail.letter.mdImport": "가",
    "rail.letter.trash": "삭",
    "rail.letter.settings": "설",
    "tree.eyebrow": "주제 / 분류 / 메모",
    "tree.title": "지식 메모",
    "tree.panelCollapse": "목록 접기",
    "tree.panelExpand": "목록 펼치기",
    "tree.expandAll": "모두 펼치기",
    "tree.collapseAll": "모두 접기",
    "tree.addRoot": "주제 추가",
    "tree.emptySelectTitle": "메모를 선택하세요",
    "tree.emptySelectDesc": "왼쪽에서 주제, 분류, 메모를 선택하면 내용을 편집할 수 있습니다.",
    "tree.createTopic": "주제 만들기",
    "tree.titlePlaceholder": "제목",
    "tree.contentPlaceholder": "메모 내용을 입력하세요.",
    "tree.moveUp": "위로",
    "tree.moveDown": "아래로",
    "tree.delete": "삭제",
    "tabs.reopen": "다시 열기",
    "tabs.closeOther": "다른 탭 닫기",
    "tabs.closeAll": "모두 닫기",
    "editor.favorite": "즐겨찾기",
    "editor.unfavorite": "즐겨찾기 해제",
    "editor.share": "공유",
    "editor.unshare": "공유 안 함",
    "editor.copyLink": "링크 복사",
    "web.login.desc": "서버 공유 문서에 접속합니다.",
    "web.login.desc.login": "서버 공유 문서에 접속합니다.",
    "web.login.desc.register": "새 계정을 만들려면 사용자 ID, 비밀번호, 등록 이메일을 입력하세요.",
    "web.login.desc.resetRequest": "비밀번호 재설정 메일을 받으려면 사용자 ID와 등록 이메일을 입력하세요.",
    "web.login.desc.resetConfirm": "메일로 받은 코드와 새 비밀번호를 입력하세요.",
    "web.login.owner": "사용자 ID",
    "web.login.password": "비밀번호",
    "web.login.newPassword": "새 비밀번호",
    "web.login.email": "등록 이메일",
    "web.login.emailPlaceholder": "계정 만들기와 비밀번호 재설정에 사용",
    "web.login.twoFactor": "2단계 인증 코드",
    "web.login.twoFactorPlaceholder": "사용 중일 때만 입력",
    "web.login.resetCode": "비밀번호 재설정 코드",
    "web.login.resetCodePlaceholder": "메일로 받은 코드",
    "web.login.submit": "로그인",
    "web.login.backToLogin": "로그인으로 돌아가기",
    "web.login.register": "계정 만들기",
    "web.login.resetRequest": "재설정 메일",
    "web.login.resetConfirm": "비밀번호 재설정",
    "web.login.ready": "서버에 저장된 공유 문서만 표시됩니다.",
    "web.login.loading": "서버 공유 문서를 불러오는 중입니다.",
    "web.login.failed": "로그인 실패: {message}",
    "web.login.registering": "계정을 만드는 중입니다.",
    "web.login.registerFailed": "계정 생성 실패: {message}",
    "web.login.passwordRule": "비밀번호는 문자, 숫자, 기호를 모두 포함한 10자 이상이어야 합니다.",
    "web.login.registerOk": "계정을 만들고 로그인했습니다.",
    "web.login.resetRequesting": "비밀번호 재설정 메일을 요청하는 중입니다.",
    "web.login.resetRequested": "등록 이메일로 재설정 코드를 보냈습니다.",
    "web.login.resetConfirming": "비밀번호를 재설정하는 중입니다.",
    "web.login.resetConfirmed": "비밀번호를 재설정했습니다. 새 비밀번호로 로그인하세요.",
    "web.login.resetFailed": "비밀번호 재설정 실패: {message}",
    "web.login.ok": "로그인되었습니다.",
    "web.login.logout": "로그아웃",
    "web.login.loggedOut": "로그아웃되었습니다.",
    "editor.find": "본문 찾기",
    "editor.findPlaceholder": "본문에서 검색",
    "editor.findTitle": "Enter 다음, Shift+Enter 이전",
    "editor.outline": "개요",
    "editor.insertTime": "시간 넣기",
    "editor.openLink": "링크 열기",
    "editor.openLinkNone": "커서 위치에 열 수 있는 URL이나 이메일이 없습니다.",
    "editor.preview": "Markdown 보기",
    "editor.edit": "편집하기",
    "editor.encrypt": "암호화",
    "editor.unlock": "복호화",
    "editor.decrypt": "암호화 해제",
    "editor.lock": "잠금",
    "encryption.keyTitle": "암호 키 입력",
    "encryption.encryptMessage": "이 메모를 암호화할 키를 입력하세요. 이 키를 잊으면 내용을 복구할 수 없습니다.",
    "encryption.unlockMessage": "암호화된 메모를 열 키를 입력하세요.",
    "encryption.lockedPlaceholder": "암호화된 메모입니다. 복호화 버튼을 눌러 키를 입력하세요.",
    "encryption.empty": "암호화할 내용이 없습니다.",
    "encryption.done": "암호화됨",
    "encryption.unlocked": "복호화됨",
    "encryption.decrypted": "암호화를 해제했습니다.",
    "encryption.decryptMessage": "암호화를 해제하려면 키를 입력하세요. 이후 이 메모는 평문으로 저장됩니다.",
    "encryption.locked": "잠김",
    "encryption.fail": "복호화 실패. 키를 확인하세요.",
    "results.eyebrow": "통합 검색",
    "results.title": "검색 결과",
    "results.close": "검색 닫기",
    "daily.eyebrow": "필요할 때 잠깐 여는 날짜 기록",
    "daily.title": "일자별 메모",
    "daily.today": "오늘",
    "daily.appendTime": "시간 추가",
    "daily.archive": "보관",
    "daily.archiveBox": "보관함",
    "daily.memoTitle": "하루 하나의 메모장",
    "daily.placeholder": "이 날짜의 메모장 하나에 계속 추가해서 적어두세요.",
    "daily.archiveEyebrow": "활성 메모에서 빠진 날짜 기록",
    "daily.week.sun": "일",
    "daily.week.mon": "월",
    "daily.week.tue": "화",
    "daily.week.wed": "수",
    "daily.week.thu": "목",
    "daily.week.fri": "금",
    "daily.week.sat": "토",
    "settings.eyebrow": "사용자 취향에 맞게 조정",
    "settings.title": "화면 설정",
    "settings.language.title": "언어",
    "settings.language.desc": "앱 화면에 사용할 언어를 선택합니다.",
    "settings.theme.title": "기본 테마",
    "settings.theme.desc": "앱의 밝기 테마를 선택합니다.",
    "settings.theme.system": "시스템 테마 적용",
    "settings.theme.light": "밝은 테마",
    "settings.theme.dark": "어두운 테마",
    "settings.accent.title": "강조 색상",
    "settings.accent.desc": "버튼과 선택 상태에 사용할 색상을 선택합니다.",
    "settings.wide.title": "넓은 작성 공간",
    "settings.wide.desc": "목록 폭을 줄여 메모 작성 공간을 넓게 사용합니다.",
    "settings.railMode.title": "빠른 메뉴 표시",
    "settings.railMode.desc": "왼쪽 빠른 메뉴를 아이콘 또는 첫 글자로 표시합니다.",
    "settings.railMode.icon": "아이콘",
    "settings.railMode.letter": "첫 글자",
    "settings.editorActionIcons.title": "메모 작업 아이콘 표시",
    "settings.editorActionIcons.desc": "상단에 자주 쓰는 메모 작업 아이콘을 표시합니다. 끄면 메뉴 안에만 표시됩니다.",
    "settings.font.title": "글자 크기",
    "settings.font.desc": "메모 작성 화면의 글자 크기를 조정합니다.",
    "settings.font.small": "작게",
    "settings.font.medium": "보통",
    "settings.font.large": "크게",
    "settings.line.title": "줄 간격",
    "settings.line.desc": "긴 메모를 읽기 편한 간격으로 조정합니다.",
    "settings.line.compact": "좁게",
    "settings.line.normal": "보통",
    "settings.line.relaxed": "넓게",
    "settings.tabIndent.title": "Tab 들여쓰기",
    "settings.tabIndent.desc": "본문에서 Tab을 눌렀을 때 이동할 칸 수를 정합니다.",
    "settings.tabIndent.2": "2칸",
    "settings.tabIndent.4": "4칸",
    "settings.tabIndent.8": "8칸",
    "settings.backlinks.title": "백링크 표시",
    "settings.backlinks.desc": "현재 메모를 언급한 다른 메모를 편집 화면 아래에 표시합니다.",
    "settings.tags.title": "태그 표시",
    "settings.tags.desc": "본문의 #태그를 인식해 편집 화면과 검색에서 사용합니다.",
    "settings.shortcuts.title": "단축키 사용",
    "settings.shortcuts.desc": "빠른 전환, 새 주제 만들기 같은 기본 단축키를 사용합니다.",
    "settings.shortcutGuide.title": "단축키 안내",
    "settings.shortcutGuide.desc": "자주 쓰는 창, 탭, 편집 작업을 키보드로 바로 실행합니다.",
    "settings.features.title": "지식 기능",
    "settings.features.desc": "사용하지 않는 기능은 화면에서 숨기고 동작도 멈춥니다.",
    "settings.desktopStorage.title": "PC 로컬 저장소",
    "settings.desktopStorage.desc": "설치형 프로그램은 이 PC의 로컬 파일에 원본 메모와 설정을 저장합니다.",
    "settings.desktopStorage.web": "Web은 서버 공유 문서만 사용합니다.",
    "settings.desktopStorage.local": "브라우저 로컬 저장소 사용 중",
    "settings.desktopStorage.ready": "로컬 파일 저장 준비됨",
    "settings.desktopStorage.unknown": "저장 위치 확인 중",
    "settings.desktopStorage.error": "로컬 파일 저장 실패",
    "settings.desktopStorage.updated": "최근 저장 {time}",
    "settings.server.title": "서버 연결",
    "settings.server.desc": "단독 사용 또는 개인/공용 NowNote 서버 연결 방식을 선택합니다.",
    "settings.server.desc.hosted": "Web은 사용자 ID와 비밀번호로 로그인하고 서버의 공유 문서만 사용합니다.",
    "settings.server.mode.local": "단독 사용",
    "settings.server.mode.server": "서버 연결",
    "settings.server.mode": "사용 방식",
    "settings.server.url": "서버 주소",
    "settings.server.url.placeholder": "https://nownote.sinsan.kr",
    "settings.server.url.hint": "공용 서버는 https://nownote.sinsan.kr, 개인 서버는 본인 서버 주소를 입력합니다.",
    "settings.server.advanced": "구형 개인 서버 호환 설정",
    "settings.server.token": "구형 개인 서버 API 토큰",
    "settings.server.token.placeholder": "구형 개인 서버에서 요구할 때만 입력",
    "settings.server.token.hint": "2.3 기본 흐름에서는 필요 없습니다. 기존 개인 서버가 NOW_API_TOKEN 보호를 쓰는 경우에만 입력합니다.",
    "settings.server.userToken": "앱/설치형 접속 토큰",
    "settings.server.userToken.placeholder": "앱/설치형 접속 토큰",
    "settings.server.userToken.hint": "설치형 프로그램이 서버와 동기화할 때 사용하는 개인 토큰입니다. Web 로그인에는 사용하지 않습니다.",
    "settings.server.twoFactorCode": "2단계 인증 코드",
    "settings.server.twoFactorCode.placeholder": "필요한 경우 6자리 코드",
    "settings.server.twoFactorCode.hint": "2단계 인증을 사용하는 계정만 연결 테스트 때 6자리 코드를 입력합니다.",
    "settings.server.owner": "사용자 ID",
    "settings.server.device": "기기 ID",
    "settings.server.device.hint": "기기 식별값을 직접 맞춰야 하는 기존 서버에서만 확인합니다.",
    "settings.server.autoSync": "자동 동기화",
    "settings.server.autoSync.hint": "변경된 공유 문서를 서버에 자동으로 보냅니다.",
    "settings.server.autoSync.on": "자동 동기화 켜짐",
    "settings.server.autoSync.off": "자동 동기화 꺼짐",
    "settings.server.guide.title": "입력 기준",
    "settings.server.guide.local": "단독 사용: 서버 없이 이 기기에만 저장합니다.",
    "settings.server.guide.personal": "설치형/앱: 서버 주소, 사용자 ID, 앱/설치형 접속 토큰을 입력합니다.",
    "settings.server.guide.public": "Web: 서버 주소에서 사용자 ID와 비밀번호로 로그인하며 토큰을 입력하지 않습니다.",
    "settings.server.guide.issue": "앱/설치형 접속 토큰은 Web 로그인 후 내 연결 토큰 화면에서 직접 발급합니다.",
    "settings.server.profile.title": "사용자 프로필",
    "settings.server.profile.desc": "표시 이름, 이메일, 시간대를 서버 사용자 정보로 저장합니다.",
    "settings.server.profile.displayName": "표시 이름",
    "settings.server.profile.email": "이메일",
    "settings.server.profile.timezone": "시간대",
    "settings.server.profile.load": "프로필 불러오기",
    "settings.server.profile.save": "프로필 저장",
    "settings.server.profile.none": "프로필을 불러오지 않았습니다.",
    "settings.server.profile.loading": "사용자 프로필을 불러오는 중입니다.",
    "settings.server.profile.saving": "사용자 프로필을 저장하는 중입니다.",
    "settings.server.profile.loaded": "사용자 프로필을 불러왔습니다.",
    "settings.server.profile.saved": "사용자 프로필을 저장했습니다.",
    "settings.server.profile.summary": "그룹 {group} · {twoFactor} · {active} · 최근 접속 {lastSeen}",
    "settings.server.profile.groupJoin.title": "그룹 참가",
    "settings.server.profile.groupJoin.desc": "관리자가 알려준 그룹 이름과 초대코드로 그룹에 참가합니다.",
    "settings.server.profile.groupJoin.groupName": "그룹 이름",
    "settings.server.profile.groupJoin.inviteCode": "초대코드",
    "settings.server.profile.groupJoin.join": "그룹 참가",
    "settings.server.profile.groupJoin.current": "현재 그룹: {group}",
    "settings.server.profile.groupJoin.empty": "그룹 이름과 초대코드를 입력하세요.",
    "settings.server.profile.groupJoin.joining": "그룹 참가를 확인하는 중입니다.",
    "settings.server.profile.groupJoin.joined": "그룹에 참가했습니다.",
    "settings.server.profile.groupJoin.noGroups": "그룹 목록을 불러오면 선택할 수 있습니다.",
    "settings.server.profile.groupJoin.count": "선택 가능 {count}개",
    "settings.server.profile.twoFactorOn": "2단계 사용",
    "settings.server.profile.twoFactorOff": "2단계 미사용",
    "settings.server.profile.active": "활성",
    "settings.server.profile.inactive": "비활성",
    "settings.server.inactiveDenied": "비활성 사용자라 서버 기능을 사용할 수 없습니다.",
    "settings.server.profile.lastSeenNone": "접속 기록 없음",
    "settings.server.save": "연결 설정 저장",
    "settings.server.test": "연결 테스트",
    "settings.server.sync": "서버로 동기화",
    "settings.server.fullSync": "전체 다시 동기화",
    "settings.server.fullSyncConfirm": "서버에 모든 메모를 다시 전송합니다. 마지막 동기화 시점 기록을 초기화하고 전체 동기화를 진행할까요?",
    "settings.server.local": "서버 연결을 사용하지 않습니다.",
    "settings.server.saved": "연결 설정을 저장했습니다.",
    "settings.server.testing": "서버 연결을 확인하는 중입니다.",
    "settings.server.userTokenOk": "앱/설치형 접속 토큰 확인됨",
    "settings.server.fullSyncing": "서버와 전체 동기화를 진행합니다.",
    "settings.server.ok": "서버 연결 확인됨",
    "settings.server.noUrl": "서버 주소를 입력해야 합니다.",
    "settings.server.fail": "서버 연결 실패",
    "settings.server.syncing": "서버로 메모를 동기화하는 중입니다.",
    "settings.server.syncOk": "서버 동기화 완료",
    "settings.server.syncEmpty": "동기화할 메모가 없습니다.",
    "settings.server.mergeSkipped": "로컬 변경 보존",
    "settings.server.mergeSkippedCount": "로컬 변경 보존 {count}개",
    "settings.server.conflict.title": "충돌 문서",
    "settings.server.conflict.desc": "로컬과 서버가 모두 바뀐 문서는 자동으로 덮어쓰지 않습니다.",
    "settings.server.conflict.none": "충돌 문서가 없습니다.",
    "settings.server.conflict.item": "{title} · {type} · 로컬 {localTime} / 서버 {remoteTime}",
    "settings.server.conflict.encrypted": "암호화 메모",
    "settings.server.conflict.keepLocal": "로컬 유지",
    "settings.server.conflict.useServer": "서버 적용",
    "settings.server.conflict.later": "나중에",
    "settings.server.pending": "보류 변경",
    "settings.server.lastSync": "마지막 동기화",
    "settings.server.pendingMeta": "보류 변경 {count}개 · 마지막 동기화 {time}",
    "settings.server.capabilities.none": "서버 기능 확인 전",
    "settings.server.capabilities.sync": "동기화",
    "settings.server.capabilities.recordings": "녹음",
    "settings.server.capabilities.analysis": "분석 작업",
    "settings.server.capabilities.admin": "운영 점검",
    "settings.server.capabilities.backup": "백업",
    "settings.server.capabilities.backupVerify": "백업 검증",
    "settings.server.capabilities.users": "사용자 관리",
    "settings.server.capabilities.userTimezone": "시간대",
    "settings.server.capabilities.userGroups": "사용자 그룹",
    "settings.server.capabilities.twoFactorStatus": "2단계 상태",
    "settings.server.capabilities.twoFactorPlanned": "2단계 예정",
    "settings.server.capabilities.twoFactorReady": "2단계 인증",
    "settings.server.capabilities.userTokenRequired": "사용자 토큰 필요",
    "settings.server.capabilities.treeLevel": "계층 {level}단계",
    "settings.server.publicReadiness.ready": "공용 서버 준비 완료",
    "settings.server.publicReadiness.planned": "공용 서버 준비 중 · 남은 항목 {count}개",
    "settings.server.analysis.title": "분석 작업",
    "settings.server.analysis.desc": "선택 메모 요약부터 2.0 지식화 점검까지 서버 큐에 등록하고 승인 대기 결과를 검토합니다.",
    "settings.server.analysis.type": "작업 유형",
    "settings.server.analysis.create": "작업 등록",
    "settings.server.analysis.refresh": "작업 새로고침",
    "settings.server.analysis.none": "분석 작업을 불러오지 않았습니다.",
    "settings.server.analysis.noNote": "분석할 지식 메모를 먼저 선택해야 합니다.",
    "settings.server.analysis.noKnowledgeNotes": "분석할 지식 메모가 없습니다.",
    "settings.server.analysis.emptyNote": "선택한 메모에 분석할 내용이 없습니다.",
    "settings.server.analysis.encryptedNote": "암호화 메모는 서버 분석 대상에서 제외됩니다.",
    "settings.server.analysis.creating": "분석 작업을 서버에 등록하는 중입니다.",
    "settings.server.analysis.created": "분석 작업을 등록했습니다.",
    "settings.server.analysis.loading": "분석 작업을 불러오는 중입니다.",
    "settings.server.analysis.loaded": "분석 작업을 불러왔습니다.",
    "settings.server.analysis.item": "#{id} · {type} · {time}",
    "settings.server.analysis.resultPreview": "결과: {text}",
    "settings.server.analysis.inputPreview": "입력: {text}",
    "settings.server.analysis.errorPreview": "오류: {text}",
    "settings.server.analysis.doneNoResult": "완료됐지만 표시할 결과가 없습니다.",
    "settings.server.analysis.apply": "메모에 추가",
    "settings.server.analysis.approve": "승인 반영",
    "settings.server.analysis.reject": "반려",
    "settings.server.analysis.retry": "재시도",
    "settings.server.analysis.cancel": "중단",
    "settings.server.analysis.applied": "분석 결과를 메모에 추가했습니다.",
    "settings.server.analysis.rejected": "분석 결과를 반려했습니다.",
    "settings.server.analysis.retried": "분석 작업을 다시 대기열에 넣었습니다.",
    "settings.server.analysis.cancelled": "분석 작업을 중단했습니다.",
    "settings.server.analysis.applyMissing": "연결된 메모를 찾을 수 없습니다.",
    "settings.server.analysis.sectionTitle": "서버 분석 결과",
    "settings.server.analysis.approvalSectionTitle": "2.0 지식화 승인 결과",
    "settings.server.analysis.job.memo_summary": "선택 메모 요약",
    "settings.server.analysis.job.knowledge_2_0_review": "2.0 지식화 점검",
    "settings.server.analysis.job.similar_notes": "유사 메모 후보",
    "settings.server.analysis.job.duplicate_candidates": "중복 후보",
    "settings.server.analysis.job.relation_suggestions": "관계 후보",
    "settings.server.analysis.job.tag_property_suggestions": "태그/속성 후보",
    "settings.server.analysis.job.knowledge_health": "지식 건강 점검",
    "settings.server.deviceToken.title": "앱/설치형 접속 토큰",
    "settings.server.deviceToken.desc": "앱이나 설치형 프로그램의 서버 연결 설정에 붙여넣을 토큰을 여기서 발급하고 다시 확인합니다.",
    "settings.server.deviceToken.name": "기기 이름",
    "settings.server.deviceToken.id": "기기 ID",
    "settings.server.deviceToken.issue": "연결 토큰 발급",
    "settings.server.deviceToken.placeholder": "발급된 토큰 목록이 여기에 표시됩니다.",
    "settings.server.deviceToken.help": "토큰이 노출되면 같은 기기 ID로 다시 발급해 이전 값을 교체합니다.",
    "settings.server.deviceToken.issuing": "연결 토큰을 발급하는 중입니다.",
    "settings.server.deviceToken.issued": "연결 토큰을 발급했습니다.",
    "settings.server.deviceToken.loading": "연결 토큰 목록을 불러오는 중입니다.",
    "settings.server.deviceToken.loaded": "연결 토큰 목록을 불러왔습니다.",
    "settings.server.deviceToken.empty": "아직 발급된 연결 토큰이 없습니다.",
    "settings.server.deviceToken.item": "{name} / {device}: {token}",
    "settings.server.never": "없음",
    "settings.sidebarAssist.title": "보조 목록 표시",
    "settings.sidebarAssist.desc": "왼쪽에 즐겨찾기, 최근 수정, 태그 목록을 표시합니다.",
    "settings.backup.title": "백업 / 복원",
    "settings.backup.desc": "JSON은 NowNote 전체 데이터를 백업하거나 현재 데이터를 백업 파일로 교체할 때 사용합니다.",
    "settings.backup.export": "JSON 내보내기",
    "settings.backup.import": "JSON 가져오기",
    "settings.resetSection.title": "화면 설정 초기화",
    "settings.resetSection.desc": "메모는 유지하고 테마, 폭, 글자 크기, 열린 탭 같은 화면 설정만 기본값으로 되돌립니다.",
    "shortcut.group.tabs": "창과 탭",
    "shortcut.group.editor": "본문 편집",
    "shortcut.captureWaiting": "입력 대기...",
    "shortcut.unset": "미지정",
    "shortcut.reset": "기본",
    "shortcut.resetHint": "기본 단축키로 되돌리기",
    "shortcut.action.addRoot": "새 주제",
    "shortcut.action.addChild": "아래에 추가",
    "shortcut.action.search": "검색",
    "shortcut.action.noteFind": "본문 찾기",
    "shortcut.action.quickSwitch": "빠른 전환",
    "shortcut.action.quickOpen": "빠른 전환 보조",
    "shortcut.action.commandPalette": "명령 팔레트",
    "shortcut.action.daily": "일자별 메모",
    "shortcut.action.graph": "연결 보기",
    "shortcut.action.saveState": "저장 상태 확인",
    "shortcut.action.insertTime": "현재 시간 삽입",
    "shortcut.action.closeTab": "현재 탭 닫기",
    "shortcut.action.reopenTab": "닫은 탭 다시 열기",
    "shortcut.action.closeOtherTabs": "다른 탭 닫기",
    "shortcut.action.pinTab": "현재 탭 고정",
    "shortcut.action.leftTab": "왼쪽 탭",
    "shortcut.action.rightTab": "오른쪽 탭",
    "shortcut.action.moveUp": "위로 이동",
    "shortcut.action.moveDown": "아래로 이동",
    "shortcut.action.openSettings": "화면 설정",
    "shortcut.action.closePopup": "닫기",
    "shortcut.action.bold": "굵게",
    "shortcut.action.italic": "기울임",
    "shortcut.action.heading1": "제목 1",
    "shortcut.action.heading2": "제목 2",
    "shortcut.action.heading3": "제목 3",
    "shortcut.action.checklist": "체크리스트",
    "shortcut.action.orderedList": "번호 목록",
    "shortcut.action.quote": "인용",
    "shortcut.action.codeBlock": "코드블록",
    "shortcut.action.horizontalRule": "구분선",
    "shortcut.action.link": "링크",
    "shortcut.action.indent": "들여쓰기",
    "shortcut.action.outdent": "내어쓰기",
    "feature.search.label": "통합 검색",
    "feature.search.description": "일자별 메모와 지식 메모 전체 검색",
    "feature.daily.label": "일일 메모",
    "feature.daily.description": "필요할 때 여는 날짜별 메모장",
    "feature.quickSwitch.label": "빠른 전환",
    "feature.quickSwitch.description": "제목과 경로로 바로 이동",
    "feature.backlinks.label": "백링크",
    "feature.backlinks.description": "현재 메모를 언급한 메모 표시",
    "feature.graph.label": "연결 보기",
    "feature.graph.description": "[[메모 제목]] 연결 확인",
    "feature.tags.label": "태그",
    "feature.tags.description": "본문의 #태그 인식과 검색",
    "feature.favorites.label": "즐겨찾기",
    "feature.favorites.description": "중요한 메모 표시",
    "feature.shortcuts.label": "단축키",
    "feature.shortcuts.description": "키보드 빠른 실행",
    "editor.copyLinkSuccess": "링크 복사됨",
    "editor.copyLinkFail": "복사 실패",
    "settings.resetConfirm": "화면 설정을 기본값으로 되돌릴까요? 메모 내용은 유지됩니다.",
    "settings.resetTitle": "기본값으로",
    "settings.help.title": "도움말",
    "settings.help.desc": "단독 사용자와 서버 연결 사용자의 차이, 백업, 서버 설정 기준을 확인합니다.",
    "settings.help.open": "도움말 열기",
    "settings.version.title": "현재 버전",
    "settings.version.desc": "배포와 설치 파일 기준 버전입니다.",
    "settings.workspace.title": "작업공간 / 지식 건강",
    "settings.workspace.desc": "반복 작업 상태를 저장하고 정리 우선순위를 확인합니다.",
    "settings.workspace.placeholder": "작업공간 이름",
    "settings.workspace.empty": "저장된 작업공간이 없습니다.",
    "settings.workspace.saved": "작업공간을 저장했습니다.",
    "settings.workspace.applied": "작업공간을 열었습니다.",
    "settings.workspace.save": "작업공간 저장",
    "settings.workspace.apply": "작업공간 열기",
    "settings.workspace.select": "저장된 작업공간",
    "settings.workspace.summary": "{count}개 작업공간 · 현재 {current}",
    "settings.workspace.current": "현재 화면",
    "settings.workspace.health": "전체 {total}개 · 고립 {isolated}개 · 오래됨 {stale}개 · 허브 {hubs}개 · 속성 누락 {missing}개",
    "settings.workspace.noHealth": "정리 우선순위가 높은 메모가 없습니다.",
    "settings.workspace.health.isolated": "고립 메모",
    "settings.workspace.health.stale": "오래된 메모",
    "settings.workspace.health.hub": "과도 연결",
    "settings.workspace.health.missing": "속성 누락",
    "settings.workspace.links.none": "현재 메모의 외부 링크가 없습니다.",
    "settings.workspace.links.title": "현재 메모 외부 링크",
    "quick.count.all": "전체 메모를 표시합니다.",
    "graph.eyebrow": "[[제목]] 연결 기준",
    "graph.title": "연결 보기",
    "trash.eyebrow": "실수 삭제를 막기 위한 임시 보관",
    "trash.title": "삭제 보관함",
    "trash.deleteSelected": "선택 영구 삭제",
    "trash.deleteAll": "전체 영구 삭제",
    "saved": "저장됨",
    "relative.now": "방금 전",
    "relative.minutes": "{count}분 전",
    "relative.hours": "{count}시간 전",
    "relative.days": "{count}일 전",
    "markdownExport.title": "NowNote 내보내기",
    "markdownExport.exportedAt": "내보낸 날짜",
    "markdownExport.treeCount": "지식 메모",
    "markdownExport.dailyCount": "일자별 메모",
    "markdownExport.archivedDailyCount": "보관 일자별 메모",
    "markdownExport.restoredArchivedDailyCount": "복원된 보관본",
    "markdownExport.treeSection": "지식 메모",
    "markdownExport.dailySection": "일자별 메모",
    "markdownExport.archivedDailySection": "보관된 일자별 메모",
    "markdownExport.emptyTree": "_지식 메모가 없습니다._",
    "markdownExport.emptyDaily": "_일자별 메모가 없습니다._",
    "markdownExport.emptyArchivedDaily": "_보관된 일자별 메모가 없습니다._",
    "markdownExport.path": "경로",
    "markdownExport.updated": "수정",
    "markdownExport.tags": "태그",
    "markdownExport.favorite": "즐겨찾기",
    "markdownExport.yes": "예",
    "markdownExport.emptyContent": "_내용 없음_",
    "markdownExport.archivedAt": "보관 시각",
    "markdownExport.restoredAt": "복원 시각",
  },
  en: {
    "dialog.confirmTitle": "Confirm",
    "dialog.ok": "OK",
    "dialog.cancel": "Cancel",
    "note.untitled": "Untitled",
    "note.emptyTitle": "No topics yet",
    "note.emptyDescription": "Please add a topic first.",
    "note.pinnedPrefix": "Pinned · ",
    "note.unpinTab": "Unpin tab",
    "note.pinTab": "Pin tab",
    "note.dailyHasContent": "Recorded",
    "note.dailyEmpty": "Empty",
    "note.backlinks": "Backlinks",
    "note.linkToNote": "Open note",
    "note.linkMissing": "Not created yet",
    "note.outlineEmpty": "No headings for outline.",
    "note.previewEmpty": "No preview content.",
    "note.stats.backlinks": "{count} backlinks",
    "note.stats.edit": "Edit",
    "note.stats.words": "{count} words",
    "note.stats.chars": "{count} chars",
    "note.stats.reading": "{count} min read",
    "note.stats.lines": "{count} lines",
    "note.stats.links": "{count} links",
    "note.stats.tags": "{count} tags",
    "note.stats.missingLinks": "{count} missing links",
    "note.stats.updated": "Updated {time}",
    "note.sectionOut": "Links",
    "note.sectionBacklink": "Backlinks",
    "note.sectionOutEmpty": "Type [[note title]] in content to link another note.",
    "note.sectionBacklinkEmpty": "No other notes mention this note.",
    "note.nodeDelete.childrenBlocked": "Cannot delete because child notes exist.",
    "note.nodeDelete.toTrashConfirm": "Move '{title}' to trash?",
    "note.nodeDelete.permanentConfirm": "Permanently delete '{title}'? This cannot be undone.",
    "note.nodeDelete.permanentSelected": "Permanently delete the selected {count} notes? This cannot be undone.",
    "note.nodeDelete.permanentAll": "Permanently delete all {count} notes in trash? This cannot be undone.",
    "note.noArchive": "There is no content to archive.",
    "note.archiveConfirm": "Move {date} note to archive?",
    "note.archiveRestoreConfirm": "There is already an active note for this date. Append archived content below?",
    "note.graphEmpty": "No linked notes yet. Add [[note title]] in content to link notes.",
    "note.deletedTreeEmpty": "Trash is empty.",
    "note.deletedSelection": "{selected} selected / {total} total",
    "note.deletedSelectAll": "Select all",
    "note.deletedClearAll": "Clear all",
    "note.emptyState": "None",
    "note.dailyArchiveEmpty": "No archived daily notes.",
    "note.archiveLabel": "Archived:",
    "note.archivedAt": "{time} archived",
    "note.archiveCount": "{count}",
    "note.archiveViewHint": "View archived",
    "note.deletedAt": "{time} deleted",
    "note.selectLabel": "Select {title}",
    "note.childCount": "{count} below",
    "note.tagEmpty": "No tags",
    "note.linkFallbackTitle": "Link title",
    "note.archiveRestoreMarker": "Restored archived copy",
    "note.importDone": "Import complete.",
    "note.importReadError": "Unable to read JSON file.",
    "note.markdownImportedMore": "{count} more",
    "note.markdownStructureTitle": "{name} structure",
    "note.restoredArchivedDailyCount": ", restored archived {count}",
    "note.dateMissing": "No date",
    "note.emptyContent": "No content",
    "note.mergeChildrenMarker": "Merged child notes",
    "note.storageFail": "Failed to save to browser storage. Please back up in JSON now.",
    "note.desktopStorageFail": "Failed to save to PC local storage. Please back up in JSON now.",
    "note.backupImportError": "Not a NowNote backup JSON file.",
    "note.backupReplaceConfirm": "Importing JSON backup will replace current notes and settings.\n\nBackup file: {file}\nBackup time: {time}\nBackup summary: daily {daily}, archived daily {archivedDaily}{restoredArchivedDaily}, notes {tree}, deleted {deletedTree}\n\nContinue?",
    "note.unknownDate": "Unknown",
    "note.linkCreateConfirm": "'{title}' note does not exist. Create it now?",
    "note.backupFileReadError": "Unable to read JSON file.",
    "note.backupFileOpenError": "Unable to open JSON file. Please check file permission or format.",
    "note.backupFileParseError": "Unable to read JSON file. Please check file permission or format.",
    "note.markdownNoContent": "No markdown content to import.",
    "note.markdownImportConfirm": "Import {count} Markdown file(s)? Notes: {nodes}, daily {daily}, archived daily {archivedDaily}",
    "note.markdownImportDone": "Markdown import complete: note {nodes}, daily {daily}, archived daily {archivedDaily}",
    "note.markdownImportError": "Unable to read Markdown file. Please check file permission or format.",
    "note.snapshotCreated": "Recovery snapshot created.",
    "note.snapshotRestored": "Restored the selected snapshot.",
    "note.snapshotRestoreConfirm": "Restore current data from the selected snapshot? The current state will be saved as a snapshot first.",
    "note.fallbackMarkDownTitle": "Imported markdown",
    "note.exportDenied": "Unable to export file. Please check browser download permission or disk space.",
    "note.newNote": "New note",
    "note.newCategory": "New category",
    "note.newTopic": "New topic",
    "note.labelTopic": "Topic",
    "note.labelCategory": "Category",
    "note.labelNote": "Note",
    "note.expand": "Expand",
    "note.collapse": "Collapse",
    "note.addChild": "Add child",
    "note.open": "Open",
    "note.restored": "Restored",
    "note.syncMessage": "Sent {sent} notes, received {received} notes",
    "note.treeDepthLimit": "You can add up to 3 levels.",
    "note.tabClose": "Close",
    "note.restore": "Restore",
    "note.nodeDeletePermanent": "Delete permanently",
    "app.title": "NowNote",
    "accent.blue": "Blue",
    "accent.purple": "Purple",
    "accent.green": "Green",
    "accent.orange": "Orange",
    "brand.subtitle": "Knowledge notes",
    "quick.eyebrow": "Jump directly by title or path",
    "quick.title": "Quick switch",
    "quick.placeholder": "Search title or path",
    "quick.empty": "No notes to jump to.",
    "quick.count.recent": "Showing {count} recent notes",
    "quick.count.recentLimited": "Showing {shown} of {count} recent notes",
    "quick.count.match": "Found {count} candidates",
    "quick.count.matchLimited": "Found {count} candidates, showing {shown}",
    "search.label": "Search",
    "search.placeholder": "Search title or content",
    "search.emptyHint": "Enter a search term.",
    "search.emptyTitle": "Enter a search term",
    "search.emptyDescription": "Search both daily notes and knowledge notes together.",
    "search.popoverEyebrow": "Search daily and knowledge notes together",
    "search.popoverTitle": "Search",
    "search.popoverPlaceholder": "Type to search...",
    "search.invalidHint": "Please check the query format.",
    "search.invalidTitle": "Enter text after the prefix.",
    "search.invalidDescription": "Example: title:meeting, tag:idea, #memo",
    "search.noResultTitle": "No results",
    "search.noResultDescription": "Try a different search term.",
    "search.scope.all": "All",
    "search.scope.title": "Title",
    "search.scope.content": "Content",
    "search.scope.tag": "Tag",
    "search.scope.path": "Path",
    "search.sort.updatedDesc": "Updated (newest)",
    "search.sort.updatedAsc": "Updated (oldest)",
    "search.sort.createdDesc": "Created (newest)",
    "search.sort.createdAsc": "Created (oldest)",
    "search.sort.titleAsc": "Title A-Z",
    "search.sort.titleDesc": "Title Z-A",
    "search.dailyMeta": "Daily note",
    "search.resultCount": "Results {count}",
    "search.popoverHelp.path": "Path",
    "search.popoverHelp.title": "Title",
    "search.popoverHelp.tag": "Tag",
    "search.popoverHelp.content": "Content",
    "today.label": "Today note",
    "nav.tree": "Knowledge notes",
    "nav.shared.mine": "My shared notes",
    "nav.shared.groupTree": "Group knowledge tree",
    "nav.shared.member": "Shared by member",
    "aria.quickMenu": "Quick menu",
    "aria.sidebar": "NowNote menu",
    "aria.noteView": "Note view",
    "aria.explore": "Explore",
    "aria.files": "Files",
    "aria.manage": "Manage",
    "aria.treeList": "Knowledge list",
    "aria.treeResize": "Resize list width",
    "aria.treeEditor": "Knowledge note editor",
    "aria.openTabs": "Open notes",
    "aria.tabIndent": "Tab indentation",
    "aria.treeTools": "Knowledge note tools",
    "aria.noteFind": "Find in current note",
    "aria.outline": "Current note outline",
    "aria.tags": "Tags",
    "aria.noteStats": "Note information",
    "aria.markdownPreview": "Markdown preview",
    "aria.calendar": "Calendar",
    "aria.dailyEditor": "Selected date note",
    "aria.dailyArchive": "Daily note archive",
    "aria.language": "Language",
    "aria.theme": "Default theme",
    "aria.accent": "Accent color",
    "aria.railMode": "Quick menu display",
    "aria.fontSize": "Font size",
    "aria.lineHeight": "Line height",
    "aria.searchScope": "Search scope",
    "aria.searchSort": "Search sort",
    "aria.searchOption": "Search options",
    "aria.close": "Close",
    "aria.prevResult": "Previous result",
    "aria.nextResult": "Next result",
    "aria.prevMonth": "Previous month",
    "aria.nextMonth": "Next month",
    "side.favorite": "Favorites",
    "side.recent": "Recent",
    "side.tags": "Tags",
    "side.explore": "Explore",
    "side.quick": "Quick switch",
    "side.graph": "Linked notes",
    "side.file": "Files",
    "side.mdExport": "Export Markdown",
    "side.mdImport": "Import Markdown",
    "side.manage": "Manage",
    "side.trash": "Trash",
    "side.settings": "Display settings",
    "side.help": "Help",
    "messenger.eyebrow": "Short messages inside the same group",
    "messenger.title": "Group messenger",
    "messenger.refresh": "Refresh",
    "messenger.send": "Send",
    "messenger.placeholder": "Message your group",
    "messenger.group": "Group: {group}",
    "messenger.empty": "No messages yet.",
    "messenger.loadFailed": "Could not load messages",
    "messenger.sendFailed": "Could not send message",
    "messenger.readFailed": "Could not save read state",
    "rail.sidebar.open": "Open list",
    "rail.sidebar.close": "Close list",
    "rail.knowledge": "Knowledge notes",
    "rail.daily": "Today note",
    "rail.search": "Search",
    "rail.quick": "Quick switch",
    "rail.graph": "Linked notes",
    "rail.mdExport": "Export Markdown",
    "rail.mdImport": "Import Markdown",
    "rail.trash": "Trash",
    "rail.settings": "Display settings",
    "rail.letter.sidebar": "L",
    "rail.letter.knowledge": "K",
    "rail.letter.daily": "D",
    "rail.letter.search": "S",
    "rail.letter.quick": "Q",
    "rail.letter.graph": "G",
    "rail.letter.mdExport": "E",
    "rail.letter.mdImport": "I",
    "rail.letter.trash": "T",
    "rail.letter.settings": "C",
    "tree.eyebrow": "Topic / Category / Note",
    "tree.title": "Knowledge notes",
    "tree.panelCollapse": "Collapse list",
    "tree.panelExpand": "Expand list",
    "tree.expandAll": "Expand all",
    "tree.collapseAll": "Collapse all",
    "tree.addRoot": "Add topic",
    "tree.emptySelectTitle": "Select a note",
    "tree.emptySelectDesc": "Choose a topic, category, or note from the left to edit its content.",
    "tree.createTopic": "Create topic",
    "tree.titlePlaceholder": "Title",
    "tree.contentPlaceholder": "Write your note here.",
    "tree.moveUp": "Up",
    "tree.moveDown": "Down",
    "tree.delete": "Delete",
    "tabs.reopen": "Reopen",
    "tabs.closeOther": "Close others",
    "tabs.closeAll": "Close all",
    "editor.favorite": "Favorite",
    "editor.unfavorite": "Unfavorite",
    "editor.share": "Shared",
    "editor.unshare": "Not shared",
    "editor.copyLink": "Copy link",
    "web.login.desc": "Open shared documents from the server.",
    "web.login.desc.login": "Open shared documents from the server.",
    "web.login.desc.register": "Enter a user ID, password, and registered email to create an account.",
    "web.login.desc.resetRequest": "Enter your user ID and registered email to receive a reset code.",
    "web.login.desc.resetConfirm": "Enter the code from email and your new password.",
    "web.login.owner": "User ID",
    "web.login.password": "Password",
    "web.login.newPassword": "New password",
    "web.login.email": "Registered email",
    "web.login.emailPlaceholder": "Used for account creation and password reset",
    "web.login.twoFactor": "Two-factor code",
    "web.login.twoFactorPlaceholder": "Enter only when enabled",
    "web.login.resetCode": "Password reset code",
    "web.login.resetCodePlaceholder": "Code from email",
    "web.login.submit": "Log in",
    "web.login.backToLogin": "Back to login",
    "web.login.register": "Create account",
    "web.login.resetRequest": "Send reset email",
    "web.login.resetConfirm": "Reset password",
    "web.login.ready": "Only server-shared documents are shown.",
    "web.login.loading": "Loading shared documents from the server.",
    "web.login.failed": "Login failed: {message}",
    "web.login.registering": "Creating account.",
    "web.login.registerFailed": "Account creation failed: {message}",
    "web.login.passwordRule": "Password must be at least 10 characters and include letters, numbers, and symbols.",
    "web.login.registerOk": "Account created and signed in.",
    "web.login.resetRequesting": "Requesting password reset email.",
    "web.login.resetRequested": "Password reset code sent to the registered email.",
    "web.login.resetConfirming": "Resetting password.",
    "web.login.resetConfirmed": "Password reset. Sign in with the new password.",
    "web.login.resetFailed": "Password reset failed: {message}",
    "web.login.ok": "Logged in.",
    "web.login.logout": "Log out",
    "web.login.loggedOut": "Logged out.",
    "editor.find": "Find in note",
    "editor.findPlaceholder": "Find in content",
    "editor.findTitle": "Enter next, Shift+Enter previous",
    "editor.outline": "Outline",
    "editor.insertTime": "Insert time",
    "editor.openLink": "Open link",
    "editor.openLinkNone": "No URL or email is available at the cursor.",
    "editor.preview": "Markdown preview",
    "editor.edit": "Edit",
    "editor.encrypt": "Encrypt",
    "editor.unlock": "Decrypt",
    "editor.decrypt": "Remove encryption",
    "editor.lock": "Lock",
    "encryption.keyTitle": "Encryption key",
    "encryption.encryptMessage": "Enter the key for this note. If you forget it, the content cannot be recovered.",
    "encryption.unlockMessage": "Enter the key to open this encrypted note.",
    "encryption.lockedPlaceholder": "This note is encrypted. Press Decrypt and enter the key.",
    "encryption.empty": "There is no content to encrypt.",
    "encryption.done": "Encrypted",
    "encryption.unlocked": "Decrypted",
    "encryption.decrypted": "Encryption removed.",
    "encryption.decryptMessage": "Enter the key to remove encryption. This note will be saved as plain text.",
    "encryption.locked": "Locked",
    "encryption.fail": "Could not decrypt. Check the key.",
    "results.eyebrow": "Global search",
    "results.title": "Search results",
    "results.close": "Close search",
    "daily.eyebrow": "A date note you open only when needed",
    "daily.title": "Daily note",
    "daily.today": "Today",
    "daily.appendTime": "Add time",
    "daily.archive": "Archive",
    "daily.archiveBox": "Archive",
    "daily.memoTitle": "One note per day",
    "daily.placeholder": "Keep adding notes to this single note for the date.",
    "daily.archiveEyebrow": "Date notes removed from active notes",
    "daily.week.sun": "Sun",
    "daily.week.mon": "Mon",
    "daily.week.tue": "Tue",
    "daily.week.wed": "Wed",
    "daily.week.thu": "Thu",
    "daily.week.fri": "Fri",
    "daily.week.sat": "Sat",
    "settings.eyebrow": "Adjust the workspace to your taste",
    "settings.title": "Display settings",
    "settings.language.title": "Language",
    "settings.language.desc": "Choose the language used in the app.",
    "settings.theme.title": "Default theme",
    "settings.theme.desc": "Choose the brightness theme.",
    "settings.theme.system": "Use system theme",
    "settings.theme.light": "Light theme",
    "settings.theme.dark": "Dark theme",
    "settings.accent.title": "Accent color",
    "settings.accent.desc": "Choose the color used for buttons and selected states.",
    "settings.wide.title": "Wide writing area",
    "settings.wide.desc": "Reduce the list width to use a wider note editor.",
    "settings.railMode.title": "Quick menu display",
    "settings.railMode.desc": "Show the left quick menu as icons or first letters.",
    "settings.railMode.icon": "Icons",
    "settings.railMode.letter": "First letters",
    "settings.editorActionIcons.title": "Show note action icons",
    "settings.editorActionIcons.desc": "Show common note actions as compact icons in the editor header. Turn it off to keep them inside the menu.",
    "settings.font.title": "Font size",
    "settings.font.desc": "Adjust the note editor font size.",
    "settings.font.small": "Small",
    "settings.font.medium": "Medium",
    "settings.font.large": "Large",
    "settings.line.title": "Line spacing",
    "settings.line.desc": "Adjust spacing for easier reading of long notes.",
    "settings.line.compact": "Compact",
    "settings.line.normal": "Normal",
    "settings.line.relaxed": "Relaxed",
    "settings.backlinks.title": "Show backlinks",
    "settings.backlinks.desc": "Show notes that mention the current note below the editor.",
    "settings.tags.title": "Show tags",
    "settings.tags.desc": "Recognize #tags in content and use them in editor and search.",
    "settings.shortcuts.title": "Use shortcuts",
    "settings.shortcuts.desc": "Use default shortcuts such as quick switch and new topic.",
    "settings.shortcutGuide.title": "Shortcut guide",
    "settings.shortcutGuide.desc": "Run common windows, tabs, and editing actions from the keyboard.",
    "settings.tabIndent.title": "Tab indentation",
    "settings.tabIndent.desc": "Choose how many spaces Tab inserts in the note body.",
    "settings.tabIndent.2": "2 spaces",
    "settings.tabIndent.4": "4 spaces",
    "settings.tabIndent.8": "8 spaces",
    "settings.features.title": "Knowledge features",
    "settings.features.desc": "Hide unused features from the screen and stop their actions.",
    "settings.desktopStorage.title": "PC local storage",
    "settings.desktopStorage.desc": "The installed desktop client saves original notes and settings to a local file on this PC.",
    "settings.desktopStorage.web": "Web uses only server-shared notes.",
    "settings.desktopStorage.local": "Using browser local storage",
    "settings.desktopStorage.ready": "Local file storage ready",
    "settings.desktopStorage.unknown": "Checking storage location",
    "settings.desktopStorage.error": "Local file save failed",
    "settings.desktopStorage.updated": "Last saved {time}",
    "settings.server.title": "Server connection",
    "settings.server.desc": "Choose standalone use or connect to a personal/public NowNote server.",
    "settings.server.desc.hosted": "The Web client signs in with a user ID and password and uses only shared server notes.",
    "settings.server.mode.local": "Standalone",
    "settings.server.mode.server": "Server connection",
    "settings.server.mode": "Mode",
    "settings.server.url": "Server URL",
    "settings.server.url.placeholder": "https://nownote.sinsan.kr",
    "settings.server.url.hint": "Use https://nownote.sinsan.kr for the public server, or your own server URL for a personal server.",
    "settings.server.advanced": "Legacy personal server compatibility",
    "settings.server.token": "Legacy personal server API token",
    "settings.server.token.placeholder": "Enter only when a legacy personal server requires it",
    "settings.server.token.hint": "Not needed in the 2.3 default flow. Use it only when an existing personal server still protects requests with NOW_API_TOKEN.",
    "settings.server.userToken": "App/desktop access token",
    "settings.server.userToken.placeholder": "App/desktop access token",
    "settings.server.userToken.hint": "This personal token is used by the mobile app or installed desktop client for server sync. It is not used for Web login.",
    "settings.server.twoFactorCode": "2FA code",
    "settings.server.twoFactorCode.placeholder": "6-digit code when required",
    "settings.server.twoFactorCode.hint": "Enter the six-digit code only when your account uses two-factor authentication.",
    "settings.server.owner": "User ID",
    "settings.server.device": "Device ID",
    "settings.server.device.hint": "Check this only when an existing server requires a specific device identifier.",
    "settings.server.autoSync": "Auto sync",
    "settings.server.autoSync.hint": "Automatically send changed shared notes to the server.",
    "settings.server.autoSync.on": "Auto sync on",
    "settings.server.autoSync.off": "Auto sync off",
    "settings.server.guide.title": "Connection guide",
    "settings.server.guide.local": "Standalone: save only on this device without a server.",
    "settings.server.guide.personal": "Desktop/app: enter the server URL, user ID, and app/desktop access token.",
    "settings.server.guide.public": "Web: log in at the server address with user ID and password. No token entry is needed.",
    "settings.server.guide.issue": "App/desktop access tokens are issued from your connection-token panel after Web sign-in.",
    "settings.server.profile.title": "User profile",
    "settings.server.profile.desc": "Save display name, email, and time zone as server user information.",
    "settings.server.profile.displayName": "Display name",
    "settings.server.profile.email": "Email",
    "settings.server.profile.timezone": "Time zone",
    "settings.server.profile.load": "Load profile",
    "settings.server.profile.save": "Save profile",
    "settings.server.profile.none": "Profile has not been loaded.",
    "settings.server.profile.loading": "Loading user profile.",
    "settings.server.profile.saving": "Saving user profile.",
    "settings.server.profile.loaded": "User profile loaded.",
    "settings.server.profile.saved": "User profile saved.",
    "settings.server.profile.summary": "Group {group} · {twoFactor} · {active} · Last seen {lastSeen}",
    "settings.server.profile.groupJoin.title": "Join group",
    "settings.server.profile.groupJoin.desc": "Join a group with the group name and invite code from an administrator.",
    "settings.server.profile.groupJoin.groupName": "Group name",
    "settings.server.profile.groupJoin.inviteCode": "Invite code",
    "settings.server.profile.groupJoin.join": "Join group",
    "settings.server.profile.groupJoin.current": "Current group: {group}",
    "settings.server.profile.groupJoin.empty": "Enter the group name and invite code.",
    "settings.server.profile.groupJoin.joining": "Checking the group invite.",
    "settings.server.profile.groupJoin.joined": "Joined the group.",
    "settings.server.profile.groupJoin.noGroups": "Load the group list to choose one.",
    "settings.server.profile.groupJoin.count": "{count} available",
    "settings.server.profile.twoFactorOn": "2FA on",
    "settings.server.profile.twoFactorOff": "2FA off",
    "settings.server.profile.active": "Active",
    "settings.server.profile.inactive": "Inactive",
    "settings.server.inactiveDenied": "This inactive user cannot use server features.",
    "settings.server.profile.lastSeenNone": "No access record",
    "settings.server.save": "Save connection",
    "settings.server.test": "Test connection",
    "settings.server.sync": "Sync to server",
    "settings.server.fullSync": "Full re-sync",
    "settings.server.fullSyncConfirm": "Send all notes to server again? This will reset last sync marker and perform full sync.",
    "settings.server.local": "Server connection is disabled.",
    "settings.server.saved": "Connection settings saved.",
    "settings.server.testing": "Checking server connection.",
    "settings.server.userTokenOk": "App/desktop access token verified",
    "settings.server.fullSyncing": "Forcing full sync with server.",
    "settings.server.ok": "Server connection verified",
    "settings.server.noUrl": "Enter a server URL first.",
    "settings.server.fail": "Server connection failed",
    "settings.server.syncing": "Syncing notes to the server.",
    "settings.server.syncOk": "Server sync complete",
    "settings.server.syncEmpty": "There are no notes to sync.",
    "settings.server.mergeSkipped": "Local changes kept",
    "settings.server.mergeSkippedCount": "Local changes kept {count}",
    "settings.server.conflict.title": "Conflicted notes",
    "settings.server.conflict.desc": "Notes changed locally and on the server are not overwritten automatically.",
    "settings.server.conflict.none": "No conflicted notes.",
    "settings.server.conflict.item": "{title} · {type} · local {localTime} / server {remoteTime}",
    "settings.server.conflict.encrypted": "Encrypted note",
    "settings.server.conflict.keepLocal": "Keep local",
    "settings.server.conflict.useServer": "Use server",
    "settings.server.conflict.later": "Later",
    "settings.server.pending": "Pending changes",
    "settings.server.lastSync": "Last sync",
    "settings.server.pendingMeta": "Pending changes {count} · Last sync {time}",
    "settings.server.capabilities.none": "Server features not checked",
    "settings.server.capabilities.sync": "Sync",
    "settings.server.capabilities.recordings": "Recordings",
    "settings.server.capabilities.analysis": "Analysis jobs",
    "settings.server.capabilities.admin": "Ops checks",
    "settings.server.capabilities.backup": "Backup",
    "settings.server.capabilities.backupVerify": "Backup verify",
    "settings.server.capabilities.users": "User management",
    "settings.server.capabilities.userTimezone": "Time zone",
    "settings.server.capabilities.userGroups": "User groups",
    "settings.server.capabilities.twoFactorStatus": "2FA status",
    "settings.server.capabilities.twoFactorPlanned": "2FA planned",
    "settings.server.capabilities.twoFactorReady": "2FA challenge",
    "settings.server.capabilities.userTokenRequired": "User token required",
    "settings.server.capabilities.treeLevel": "{level}-level tree",
    "settings.server.publicReadiness.ready": "Public server ready",
    "settings.server.publicReadiness.planned": "Public readiness planned · {count} remaining",
    "settings.server.analysis.title": "Analysis jobs",
    "settings.server.analysis.desc": "Queue selected-note analysis and 2.0 knowledge review jobs, then review approval-ready results.",
    "settings.server.analysis.type": "Job type",
    "settings.server.analysis.create": "Create job",
    "settings.server.analysis.refresh": "Refresh jobs",
    "settings.server.analysis.none": "Analysis jobs have not been loaded.",
    "settings.server.analysis.noNote": "Select a knowledge note to analyze first.",
    "settings.server.analysis.noKnowledgeNotes": "There are no knowledge notes to analyze.",
    "settings.server.analysis.emptyNote": "The selected note has no content to analyze.",
    "settings.server.analysis.encryptedNote": "Encrypted notes are excluded from server analysis.",
    "settings.server.analysis.creating": "Creating an analysis job on the server.",
    "settings.server.analysis.created": "Analysis job created.",
    "settings.server.analysis.loading": "Loading analysis jobs.",
    "settings.server.analysis.loaded": "Analysis jobs loaded.",
    "settings.server.analysis.item": "#{id} · {type} · {time}",
    "settings.server.analysis.resultPreview": "Result: {text}",
    "settings.server.analysis.inputPreview": "Input: {text}",
    "settings.server.analysis.errorPreview": "Error: {text}",
    "settings.server.analysis.doneNoResult": "Done, but no displayable result.",
    "settings.server.analysis.apply": "Add to note",
    "settings.server.analysis.approve": "Approve",
    "settings.server.analysis.reject": "Reject",
    "settings.server.analysis.retry": "Retry",
    "settings.server.analysis.cancel": "Cancel",
    "settings.server.analysis.applied": "Analysis result was added to the note.",
    "settings.server.analysis.rejected": "Analysis result rejected.",
    "settings.server.analysis.retried": "Analysis job queued again.",
    "settings.server.analysis.cancelled": "Analysis job cancelled.",
    "settings.server.analysis.applyMissing": "The linked note could not be found.",
    "settings.server.analysis.sectionTitle": "Server analysis result",
    "settings.server.analysis.approvalSectionTitle": "2.0 knowledge approval result",
    "settings.server.analysis.job.memo_summary": "Selected note summary",
    "settings.server.analysis.job.knowledge_2_0_review": "2.0 knowledge review",
    "settings.server.analysis.job.similar_notes": "Similar note candidates",
    "settings.server.analysis.job.duplicate_candidates": "Duplicate candidates",
    "settings.server.analysis.job.relation_suggestions": "Relation suggestions",
    "settings.server.analysis.job.tag_property_suggestions": "Tag/property suggestions",
    "settings.server.analysis.job.knowledge_health": "Knowledge health",
    "settings.server.deviceToken.title": "App/desktop access token",
    "settings.server.deviceToken.desc": "Issue and review the token that you paste into the mobile app or installed desktop client's server connection settings.",
    "settings.server.deviceToken.name": "Device name",
    "settings.server.deviceToken.id": "Device ID",
    "settings.server.deviceToken.issue": "Issue connection token",
    "settings.server.deviceToken.placeholder": "Issued connection tokens will appear here.",
    "settings.server.deviceToken.help": "If a token is exposed, issue again with the same device ID to replace the old value.",
    "settings.server.deviceToken.issuing": "Issuing connection token.",
    "settings.server.deviceToken.issued": "Connection token issued.",
    "settings.server.deviceToken.loading": "Loading connection tokens.",
    "settings.server.deviceToken.loaded": "Connection tokens loaded.",
    "settings.server.deviceToken.empty": "No connection token has been issued yet.",
    "settings.server.deviceToken.item": "{name} / {device}: {token}",
    "settings.server.never": "Never",
    "settings.sidebarAssist.title": "Show helper lists",
    "settings.sidebarAssist.desc": "Show favorites, recent notes, and tags on the left.",
    "settings.backup.title": "Backup / restore",
    "settings.backup.desc": "JSON is used to back up all NowNote data or replace current data with a backup file.",
    "settings.backup.export": "Export JSON",
    "settings.backup.import": "Import JSON",
    "settings.resetSection.title": "Reset display settings",
    "settings.resetSection.desc": "Keep notes and reset only display settings such as theme, width, font size, and open tabs.",
    "shortcut.group.tabs": "Tabs",
    "shortcut.group.editor": "Editor",
    "shortcut.captureWaiting": "Waiting for input...",
    "shortcut.unset": "Unassigned",
    "shortcut.reset": "Default",
    "shortcut.resetHint": "Reset to default shortcut",
    "shortcut.action.addRoot": "New root",
    "shortcut.action.addChild": "Add child",
    "shortcut.action.search": "Search",
    "shortcut.action.noteFind": "Find in note",
    "shortcut.action.quickSwitch": "Quick switch",
    "shortcut.action.quickOpen": "Quick switch helper",
    "shortcut.action.commandPalette": "Command palette",
    "shortcut.action.daily": "Daily note",
    "shortcut.action.graph": "Linked notes",
    "shortcut.action.saveState": "Check sync state",
    "shortcut.action.insertTime": "Insert now",
    "shortcut.action.closeTab": "Close tab",
    "shortcut.action.reopenTab": "Reopen tab",
    "shortcut.action.closeOtherTabs": "Close other tabs",
    "shortcut.action.pinTab": "Pin current tab",
    "shortcut.action.leftTab": "Left tab",
    "shortcut.action.rightTab": "Right tab",
    "shortcut.action.moveUp": "Move up",
    "shortcut.action.moveDown": "Move down",
    "shortcut.action.openSettings": "Display settings",
    "shortcut.action.closePopup": "Close",
    "shortcut.action.bold": "Bold",
    "shortcut.action.italic": "Italic",
    "shortcut.action.heading1": "Heading 1",
    "shortcut.action.heading2": "Heading 2",
    "shortcut.action.heading3": "Heading 3",
    "shortcut.action.checklist": "Checklist",
    "shortcut.action.orderedList": "Number list",
    "shortcut.action.quote": "Quote",
    "shortcut.action.codeBlock": "Code block",
    "shortcut.action.horizontalRule": "Horizontal rule",
    "shortcut.action.link": "Link",
    "shortcut.action.indent": "Indent",
    "shortcut.action.outdent": "Outdent",
    "feature.search.label": "Global search",
    "feature.search.description": "Search both daily and knowledge notes",
    "feature.daily.label": "Daily note",
    "feature.daily.description": "Open a date-based note on demand",
    "feature.quickSwitch.label": "Quick switch",
    "feature.quickSwitch.description": "Jump directly with title and path",
    "feature.backlinks.label": "Backlinks",
    "feature.backlinks.description": "Show notes that mention the current note",
    "feature.graph.label": "Graph view",
    "feature.graph.description": "Check note links with [[note title]]",
    "feature.tags.label": "Tags",
    "feature.tags.description": "Recognize and search #tags in content",
    "feature.favorites.label": "Favorites",
    "feature.favorites.description": "Mark important notes",
    "feature.shortcuts.label": "Shortcuts",
    "feature.shortcuts.description": "Keyboard quick actions",
    "editor.copyLinkSuccess": "Copied",
    "editor.copyLinkFail": "Copy failed",
    "settings.resetConfirm": "Would you like to reset display settings to defaults? Notes will be kept.",
    "settings.resetTitle": "Reset to default",
    "settings.help.title": "Help",
    "settings.help.desc": "Review standalone use, server-connected use, backups, and server setup.",
    "settings.help.open": "Open help",
    "settings.version.title": "Current version",
    "settings.version.desc": "Version used for deployment and installer builds.",
    "settings.workspace.title": "Workspaces / Knowledge Health",
    "settings.workspace.desc": "Save repeated work states and review cleanup priorities.",
    "settings.workspace.placeholder": "Workspace name",
    "settings.workspace.empty": "No saved workspaces.",
    "settings.workspace.saved": "Workspace saved.",
    "settings.workspace.applied": "Workspace opened.",
    "settings.workspace.save": "Save workspace",
    "settings.workspace.apply": "Open workspace",
    "settings.workspace.select": "Saved workspaces",
    "settings.workspace.summary": "{count} workspaces · Current {current}",
    "settings.workspace.current": "Current screen",
    "settings.workspace.health": "Total {total} · isolated {isolated} · stale {stale} · hubs {hubs} · missing properties {missing}",
    "settings.workspace.noHealth": "No high-priority cleanup items.",
    "settings.workspace.health.isolated": "Isolated note",
    "settings.workspace.health.stale": "Stale note",
    "settings.workspace.health.hub": "Overlinked",
    "settings.workspace.health.missing": "Missing properties",
    "settings.workspace.links.none": "No external links in the current note.",
    "settings.workspace.links.title": "External links in current note",
    "quick.count.all": "Showing all notes.",
    "graph.eyebrow": "Based on [[title]] links",
    "graph.title": "Linked notes",
    "trash.eyebrow": "Temporary storage to prevent accidental deletion",
    "trash.title": "Trash",
    "trash.deleteSelected": "Delete selected",
    "trash.deleteAll": "Delete all",
    "saved": "Saved",
    "relative.now": "Just now",
    "relative.minutes": "{count} min ago",
    "relative.hours": "{count} hr ago",
    "relative.days": "{count} days ago",
    "markdownExport.title": "NowNote Export",
    "markdownExport.exportedAt": "Exported at",
    "markdownExport.treeCount": "Knowledge notes",
    "markdownExport.dailyCount": "Daily notes",
    "markdownExport.archivedDailyCount": "Archived daily notes",
    "markdownExport.restoredArchivedDailyCount": "Restored archived notes",
    "markdownExport.treeSection": "Knowledge notes",
    "markdownExport.dailySection": "Daily notes",
    "markdownExport.archivedDailySection": "Archived daily notes",
    "markdownExport.emptyTree": "_No knowledge notes._",
    "markdownExport.emptyDaily": "_No daily notes._",
    "markdownExport.emptyArchivedDaily": "_No archived daily notes._",
    "markdownExport.path": "Path",
    "markdownExport.updated": "Updated",
    "markdownExport.tags": "Tags",
    "markdownExport.favorite": "Favorite",
    "markdownExport.yes": "Yes",
    "markdownExport.emptyContent": "_No content_",
    "markdownExport.archivedAt": "Archived at",
    "markdownExport.restoredAt": "Restored at",
  },
};

const LANGUAGE_PACKS = {
  zh: {
    "aria.language": "语言",
    "app.title": "NowNote",
    "brand.subtitle": "知识笔记",
    "search.label": "搜索",
    "search.placeholder": "搜索标题和内容",
    "today.label": "今日笔记",
    "nav.tree": "知识笔记",
    "side.quick": "快速切换",
    "side.graph": "链接视图",
    "side.file": "文件",
    "side.mdExport": "导出 Markdown",
    "side.mdImport": "导入 Markdown",
    "side.manage": "管理",
    "side.trash": "回收站",
    "side.settings": "显示设置",
    "side.help": "帮助",
    "tree.eyebrow": "主题 / 分类 / 笔记",
    "tree.title": "知识笔记",
    "tree.addRoot": "添加主题",
    "tree.titlePlaceholder": "标题",
    "tree.contentPlaceholder": "请输入笔记内容。",
    "tree.delete": "删除",
    "editor.favorite": "收藏",
    "editor.unfavorite": "取消收藏",
    "editor.share": "共享",
    "editor.unshare": "不共享",
    "editor.copyLink": "复制链接",
    "editor.find": "在笔记中查找",
    "editor.outline": "大纲",
    "editor.insertTime": "插入时间",
    "editor.openLink": "打开链接",
    "editor.preview": "Markdown 预览",
    "editor.encrypt": "加密",
    "editor.unlock": "解密",
    "editor.decrypt": "取消加密",
    "editor.lock": "锁定",
    "settings.title": "显示设置",
    "settings.language.title": "语言",
    "settings.language.desc": "选择应用界面语言。",
    "settings.theme.title": "默认主题",
    "settings.theme.system": "跟随系统",
    "settings.theme.light": "浅色主题",
    "settings.theme.dark": "深色主题",
    "settings.font.title": "字体大小",
    "settings.font.small": "小",
    "settings.font.medium": "普通",
    "settings.font.large": "大",
    "settings.server.title": "服务器连接",
    "settings.server.desc": "选择单机使用或连接个人/公共 NowNote 服务器。",
    "settings.server.save": "保存连接",
    "settings.server.test": "测试连接",
    "settings.server.sync": "同步到服务器",
    "settings.server.fullSync": "全部重新同步",
    "settings.server.syncOk": "服务器同步完成",
    "settings.server.syncEmpty": "没有需要同步的笔记。",
    "web.login.owner": "用户 ID",
    "web.login.password": "密码",
    "web.login.submit": "登录",
    "web.login.register": "创建账户",
    "web.login.resetRequest": "发送重置邮件",
    "web.login.resetConfirm": "重置密码",
    "saved": "已保存",
  },
  ja: {
    "aria.language": "言語",
    "app.title": "NowNote",
    "brand.subtitle": "知識メモ",
    "search.label": "検索",
    "search.placeholder": "タイトル、内容を検索",
    "today.label": "今日のメモ",
    "nav.tree": "知識メモ",
    "side.quick": "クイック切替",
    "side.graph": "リンク表示",
    "side.file": "ファイル",
    "side.mdExport": "Markdown 書き出し",
    "side.mdImport": "Markdown 読み込み",
    "side.manage": "管理",
    "side.trash": "削除保管箱",
    "side.settings": "画面設定",
    "side.help": "ヘルプ",
    "tree.eyebrow": "トピック / 分類 / メモ",
    "tree.title": "知識メモ",
    "tree.addRoot": "トピック追加",
    "tree.titlePlaceholder": "タイトル",
    "tree.contentPlaceholder": "メモ内容を入力してください。",
    "tree.delete": "削除",
    "editor.favorite": "お気に入り",
    "editor.unfavorite": "お気に入り解除",
    "editor.share": "共有",
    "editor.unshare": "共有しない",
    "editor.copyLink": "リンクをコピー",
    "editor.find": "本文検索",
    "editor.outline": "概要",
    "editor.insertTime": "時刻を挿入",
    "editor.openLink": "リンクを開く",
    "editor.preview": "Markdown 表示",
    "editor.encrypt": "暗号化",
    "editor.unlock": "復号",
    "editor.decrypt": "暗号化解除",
    "editor.lock": "ロック",
    "settings.title": "画面設定",
    "settings.language.title": "言語",
    "settings.language.desc": "アプリ画面で使う言語を選択します。",
    "settings.theme.title": "基本テーマ",
    "settings.theme.system": "システム設定を使用",
    "settings.theme.light": "ライトテーマ",
    "settings.theme.dark": "ダークテーマ",
    "settings.font.title": "文字サイズ",
    "settings.font.small": "小",
    "settings.font.medium": "標準",
    "settings.font.large": "大",
    "settings.server.title": "サーバー接続",
    "settings.server.desc": "単独使用または個人/公開 NowNote サーバー接続を選択します。",
    "settings.server.save": "接続設定を保存",
    "settings.server.test": "接続テスト",
    "settings.server.sync": "サーバー同期",
    "settings.server.fullSync": "全体再同期",
    "settings.server.syncOk": "サーバー同期完了",
    "settings.server.syncEmpty": "同期するメモがありません。",
    "web.login.owner": "ユーザー ID",
    "web.login.password": "パスワード",
    "web.login.submit": "ログイン",
    "web.login.register": "アカウント作成",
    "web.login.resetRequest": "再設定メール",
    "web.login.resetConfirm": "パスワード再設定",
    "saved": "保存済み",
  },
  vi: {
    "aria.language": "Ngôn ngữ",
    "app.title": "NowNote",
    "brand.subtitle": "Ghi chú tri thức",
    "search.label": "Tìm kiếm",
    "search.placeholder": "Tìm tiêu đề, nội dung",
    "today.label": "Ghi chú hôm nay",
    "nav.tree": "Ghi chú tri thức",
    "side.quick": "Chuyển nhanh",
    "side.graph": "Xem liên kết",
    "side.file": "Tệp",
    "side.mdExport": "Xuất Markdown",
    "side.mdImport": "Nhập Markdown",
    "side.manage": "Quản lý",
    "side.trash": "Thùng rác",
    "side.settings": "Cài đặt hiển thị",
    "side.help": "Trợ giúp",
    "tree.eyebrow": "Chủ đề / Phân loại / Ghi chú",
    "tree.title": "Ghi chú tri thức",
    "tree.addRoot": "Thêm chủ đề",
    "tree.titlePlaceholder": "Tiêu đề",
    "tree.contentPlaceholder": "Nhập nội dung ghi chú.",
    "tree.delete": "Xóa",
    "editor.favorite": "Yêu thích",
    "editor.unfavorite": "Bỏ yêu thích",
    "editor.share": "Chia sẻ",
    "editor.unshare": "Không chia sẻ",
    "editor.copyLink": "Sao chép liên kết",
    "editor.find": "Tìm trong ghi chú",
    "editor.outline": "Dàn ý",
    "editor.insertTime": "Chèn thời gian",
    "editor.openLink": "Mở liên kết",
    "editor.preview": "Xem Markdown",
    "editor.encrypt": "Mã hóa",
    "editor.unlock": "Giải mã",
    "editor.decrypt": "Bỏ mã hóa",
    "editor.lock": "Khóa",
    "settings.title": "Cài đặt hiển thị",
    "settings.language.title": "Ngôn ngữ",
    "settings.language.desc": "Chọn ngôn ngữ dùng trong ứng dụng.",
    "settings.theme.title": "Giao diện mặc định",
    "settings.theme.system": "Theo hệ thống",
    "settings.theme.light": "Giao diện sáng",
    "settings.theme.dark": "Giao diện tối",
    "settings.font.title": "Cỡ chữ",
    "settings.font.small": "Nhỏ",
    "settings.font.medium": "Vừa",
    "settings.font.large": "Lớn",
    "settings.server.title": "Kết nối máy chủ",
    "settings.server.desc": "Chọn dùng độc lập hoặc kết nối máy chủ NowNote cá nhân/công cộng.",
    "settings.server.save": "Lưu kết nối",
    "settings.server.test": "Kiểm tra kết nối",
    "settings.server.sync": "Đồng bộ máy chủ",
    "settings.server.fullSync": "Đồng bộ lại toàn bộ",
    "settings.server.syncOk": "Đồng bộ máy chủ hoàn tất",
    "settings.server.syncEmpty": "Không có ghi chú để đồng bộ.",
    "web.login.owner": "ID người dùng",
    "web.login.password": "Mật khẩu",
    "web.login.submit": "Đăng nhập",
    "web.login.register": "Tạo tài khoản",
    "web.login.resetRequest": "Gửi email đặt lại",
    "web.login.resetConfirm": "Đặt lại mật khẩu",
    "saved": "Đã lưu",
  },
  ar: {
    "aria.language": "اللغة",
    "app.title": "NowNote",
    "brand.subtitle": "ملاحظات معرفية",
    "search.label": "بحث",
    "search.placeholder": "ابحث في العنوان والمحتوى",
    "today.label": "ملاحظة اليوم",
    "nav.tree": "ملاحظات معرفية",
    "side.quick": "انتقال سريع",
    "side.graph": "عرض الروابط",
    "side.file": "ملفات",
    "side.mdExport": "تصدير Markdown",
    "side.mdImport": "استيراد Markdown",
    "side.manage": "إدارة",
    "side.trash": "سلة المحذوفات",
    "side.settings": "إعدادات العرض",
    "side.help": "مساعدة",
    "tree.eyebrow": "موضوع / تصنيف / ملاحظة",
    "tree.title": "ملاحظات معرفية",
    "tree.addRoot": "إضافة موضوع",
    "tree.titlePlaceholder": "العنوان",
    "tree.contentPlaceholder": "اكتب محتوى الملاحظة.",
    "tree.delete": "حذف",
    "editor.favorite": "مفضلة",
    "editor.unfavorite": "إزالة من المفضلة",
    "editor.share": "مشاركة",
    "editor.unshare": "غير مشتركة",
    "editor.copyLink": "نسخ الرابط",
    "editor.find": "بحث داخل الملاحظة",
    "editor.outline": "مخطط",
    "editor.insertTime": "إدراج الوقت",
    "editor.openLink": "فتح الرابط",
    "editor.preview": "معاينة Markdown",
    "editor.encrypt": "تشفير",
    "editor.unlock": "فك التشفير",
    "editor.decrypt": "إزالة التشفير",
    "editor.lock": "قفل",
    "settings.title": "إعدادات العرض",
    "settings.language.title": "اللغة",
    "settings.language.desc": "اختر لغة واجهة التطبيق.",
    "settings.theme.title": "السمة الافتراضية",
    "settings.theme.system": "استخدام سمة النظام",
    "settings.theme.light": "سمة فاتحة",
    "settings.theme.dark": "سمة داكنة",
    "settings.font.title": "حجم الخط",
    "settings.font.small": "صغير",
    "settings.font.medium": "عادي",
    "settings.font.large": "كبير",
    "settings.server.title": "اتصال الخادم",
    "settings.server.desc": "اختر الاستخدام المستقل أو الاتصال بخادم NowNote شخصي/عام.",
    "settings.server.save": "حفظ الاتصال",
    "settings.server.test": "اختبار الاتصال",
    "settings.server.sync": "المزامنة مع الخادم",
    "settings.server.fullSync": "إعادة مزامنة كاملة",
    "settings.server.syncOk": "اكتملت مزامنة الخادم",
    "settings.server.syncEmpty": "لا توجد ملاحظات للمزامنة.",
    "web.login.owner": "معرّف المستخدم",
    "web.login.password": "كلمة المرور",
    "web.login.submit": "تسجيل الدخول",
    "web.login.register": "إنشاء حساب",
    "web.login.resetRequest": "إرسال بريد إعادة التعيين",
    "web.login.resetConfirm": "إعادة تعيين كلمة المرور",
    "saved": "تم الحفظ",
  },
};

Object.entries(LANGUAGE_PACKS).forEach(([language, pack]) => {
  I18N[language] = {
    ...I18N.en,
    ...pack,
  };
});

const SHORTCUT_ACTIONS = [
  { id: "addRoot", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.addRoot", label: "새 주제", defaultShortcut: { ctrl: true, key: "n" }, group: "창과 탭" },
  { id: "addChild", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.addChild", label: "아래에 추가", defaultShortcut: { ctrl: true, shift: true, key: "n" }, group: "창과 탭" },
  { id: "search", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.search", label: "검색", defaultShortcut: { ctrl: true, key: "f" }, group: "창과 탭" },
  { id: "noteFind", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.noteFind", label: "본문 찾기", defaultShortcut: { ctrl: true, shift: true, key: "f" }, group: "창과 탭" },
  { id: "quickSwitch", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.quickSwitch", label: "빠른 전환", defaultShortcut: { ctrl: true, key: "k" }, group: "창과 탭" },
  { id: "quickOpen", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.quickOpen", label: "빠른 전환 보조", defaultShortcut: { ctrl: true, key: "o" }, group: "창과 탭" },
  { id: "commandPalette", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.commandPalette", label: "명령 팔레트", defaultShortcut: { ctrl: true, shift: true, key: "p" }, group: "창과 탭" },
  { id: "daily", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.daily", label: "일자별 메모", defaultShortcut: { ctrl: true, key: "d" }, group: "창과 탭" },
  { id: "graph", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.graph", label: "연결 보기", defaultShortcut: { ctrl: true, key: "g" }, group: "창과 탭" },
  { id: "saveState", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.saveState", label: "저장 상태 확인", defaultShortcut: { ctrl: true, key: "s" }, group: "창과 탭" },
  { id: "insertTime", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.insertTime", label: "현재 시간 삽입", defaultShortcut: { ctrl: true, key: ";" }, group: "창과 탭" },
  { id: "closeTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.closeTab", label: "현재 탭 닫기", defaultShortcut: { ctrl: true, key: "w" }, group: "창과 탭" },
  { id: "reopenTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.reopenTab", label: "닫은 탭 다시 열기", defaultShortcut: { ctrl: true, shift: true, key: "t" }, group: "창과 탭" },
  { id: "closeOtherTabs", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.closeOtherTabs", label: "다른 탭 닫기", defaultShortcut: { ctrl: true, shift: true, key: "w" }, group: "창과 탭" },
  { id: "pinTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.pinTab", label: "현재 탭 고정", defaultShortcut: { ctrl: true, alt: true, key: "p" }, group: "창과 탭" },
  { id: "leftTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.leftTab", label: "왼쪽 탭", defaultShortcut: { ctrl: true, key: "pageup" }, group: "창과 탭" },
  { id: "rightTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.rightTab", label: "오른쪽 탭", defaultShortcut: { ctrl: true, key: "pagedown" }, group: "창과 탭" },
  { id: "moveUp", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.moveUp", label: "위로 이동", defaultShortcut: { ctrl: true, alt: true, key: "arrowup" }, group: "창과 탭" },
  { id: "moveDown", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.moveDown", label: "아래로 이동", defaultShortcut: { ctrl: true, alt: true, key: "arrowdown" }, group: "창과 탭" },
  { id: "settings", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.openSettings", label: "화면 설정", defaultShortcut: { ctrl: true, key: "," }, group: "창과 탭" },
  { id: "closePopup", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.closePopup", label: "닫기", defaultShortcut: { key: "escape" }, group: "창과 탭" },
  { id: "bold", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.bold", label: "굵게", defaultShortcut: { ctrl: true, key: "b" }, group: "본문 편집" },
  { id: "italic", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.italic", label: "기울임", defaultShortcut: { ctrl: true, key: "i" }, group: "본문 편집" },
  { id: "heading1", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.heading1", label: "제목 1", defaultShortcut: { ctrl: true, key: "1" }, group: "본문 편집" },
  { id: "heading2", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.heading2", label: "제목 2", defaultShortcut: { ctrl: true, key: "2" }, group: "본문 편집" },
  { id: "heading3", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.heading3", label: "제목 3", defaultShortcut: { ctrl: true, key: "3" }, group: "본문 편집" },
  { id: "checklist", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.checklist", label: "체크리스트", defaultShortcut: { ctrl: true, shift: true, key: "c" }, group: "본문 편집" },
  { id: "orderedList", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.orderedList", label: "번호 목록", defaultShortcut: { ctrl: true, shift: true, key: "7", code: "Digit7" }, group: "본문 편집" },
  { id: "quote", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.quote", label: "인용", defaultShortcut: { ctrl: true, shift: true, key: "q" }, group: "본문 편집" },
  { id: "codeBlock", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.codeBlock", label: "코드블록", defaultShortcut: { ctrl: true, shift: true, key: "k" }, group: "본문 편집" },
  { id: "horizontalRule", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.horizontalRule", label: "구분선", defaultShortcut: { ctrl: true, shift: true, key: "h" }, group: "본문 편집" },
  { id: "link", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.link", label: "링크", defaultShortcut: { ctrl: true, shift: true, key: "l" }, group: "본문 편집" },
  { id: "indent", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.indent", label: "들여쓰기", defaultShortcut: { key: "tab" }, group: "본문 편집" },
  { id: "outdent", groupKey: "shortcut.group.editor", labelKey: "shortcut.action.outdent", label: "내어쓰기", defaultShortcut: { shift: true, key: "tab" }, group: "본문 편집" },
];

const FEATURE_TOGGLES = [
  { id: "search", labelKey: "feature.search.label", descriptionKey: "feature.search.description", label: "통합 검색", description: "일자별 메모와 지식 메모 전체 검색" },
  { id: "daily", labelKey: "feature.daily.label", descriptionKey: "feature.daily.description", label: "일일 메모", description: "필요할 때 여는 날짜별 메모장" },
  { id: "quickSwitch", labelKey: "feature.quickSwitch.label", descriptionKey: "feature.quickSwitch.description", label: "빠른 전환", description: "제목과 경로로 바로 이동" },
  { id: "backlinks", labelKey: "feature.backlinks.label", descriptionKey: "feature.backlinks.description", label: "백링크", description: "현재 메모를 언급한 메모 표시" },
  { id: "graph", labelKey: "feature.graph.label", descriptionKey: "feature.graph.description", label: "연결 보기", description: "[[메모 제목]] 연결 확인" },
  { id: "tags", labelKey: "feature.tags.label", descriptionKey: "feature.tags.description", label: "태그", description: "본문의 #태그 인식과 검색" },
  { id: "favorites", labelKey: "feature.favorites.label", descriptionKey: "feature.favorites.description", label: "즐겨찾기", description: "중요한 메모 표시" },
  { id: "shortcuts", labelKey: "feature.shortcuts.label", descriptionKey: "feature.shortcuts.description", label: "단축키", description: "키보드 빠른 실행" },
];

const state = {
  view: "tree",
  selectedDate: toDateKey(new Date()),
  visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTreeId: null,
  sharedView: "mine",
  selectedCanvasCardIds: [],
  expandedTreeIds: new Set(),
  selectedDeletedTreeIds: new Set(),
  selectedPublishBundleId: "",
  capturingShortcutId: null,
  search: "",
  data: defaultData(),
  settings: defaultSettings(),
};

let storageWarningShown = false;
let serverSyncTimer = null;
let serverSyncRunning = false;
let serverSyncQueued = false;
let groupMessengerRefreshTimer = null;
let groupMessengerRefreshRunning = false;
let groupMessengerLastRefreshAt = 0;
let hostedWebSyncSuspended = false;
let desktopStorageInfo = null;
let webLoginMode = "login";
let pendingCaptureAttachment = null;
let pendingMessengerAttachment = null;
let captureSketchDirty = false;
const unlockedEncryptedNotes = new Map();
const encryptedSaveTimers = new Map();

const WRITING_TEMPLATES = {
  project: {
    label: "프로젝트 템플릿",
    title: "프로젝트 메모",
    content: "## 목표\n\n## 범위\n\n## 다음 작업\n- [ ] ",
    properties: { status: "active", priority: "normal", type: "프로젝트", project: "" },
  },
  meeting: {
    label: "회의 템플릿",
    title: "회의 메모",
    content: "## 안건\n\n## 결정\n\n## 후속 작업\n- [ ] ",
    properties: { status: "active", priority: "normal", type: "회의", project: "" },
  },
  source: {
    label: "자료 템플릿",
    title: "자료 메모",
    content: "## 출처\n\n## 핵심 내용\n\n## 연결할 메모\n- [[ ]]",
    properties: { status: "idea", priority: "normal", type: "자료", source: "" },
  },
};

function defaultData() {
  return {
    daily: {},
    archivedDaily: [],
    deletedTree: [],
    canvases: [],
    captures: [],
    snapshots: [],
    importReports: [],
    publishBundles: [],
    tree: [],
  };
}

function defaultSettings() {
  return {
    language: "ko",
    theme: "system",
    accent: "blue",
    wideEditor: true,
    treeListWidth: 280,
    treePanelCollapsed: false,
    sidebarCollapsed: false,
    railMode: "icon",
    showEditorActionIcons: false,
    fontSize: "medium",
    lineHeight: "normal",
    tabIndentSize: 2,
    showBacklinks: true,
    enableShortcuts: true,
    showTags: true,
    showSidebarAssist: false,
    server: defaultServerSettings(),
    features: defaultFeatureSettings(),
    shortcuts: defaultShortcutSettings(),
    openTreeTabs: [],
    closedTreeTabs: [],
    pinnedTreeTabs: [],
    graph: defaultGraphSettings(),
    properties: defaultPropertyViewSettings(),
    workspaces: defaultWorkspaceSettings(),
  };
}

function defaultGraphSettings() {
  return {
    mode: "global",
    depth: 2,
    filter: "",
    tag: "",
    group: "topic",
    bookmarks: [],
  };
}

function defaultPropertyViewSettings() {
  return {
    search: "",
    status: "",
    priority: "",
    group: "status",
    savedFilters: [],
  };
}

function defaultWorkspaceSettings() {
  return {
    activeId: "",
    items: [],
  };
}

function defaultServerSettings() {
  const hostedServerUrl = defaultHostedServerUrl();
  return {
    mode: hostedServerUrl ? "server" : "local",
    url: hostedServerUrl,
    token: "",
    userToken: "",
    webSessionToken: "",
    autoSync: true,
    ownerId: "local_user",
    deviceId: isHostedWebClient() ? "web-client" : "web-desktop",
    userProfile: defaultServerUserProfile(),
    capabilities: null,
    publicServerReadiness: null,
    analysisJobs: [],
    userGroups: [],
    groupMessages: [],
    groupMessengerRooms: [],
    groupMessengerActiveRoomId: null,
    groupMessengerAttachmentPolicy: null,
    groupMessengerUnreadCount: 0,
    groupMessengerLastReadId: 0,
    groupMessagesLoadedAt: null,
    conflicts: [],
    lastCheckedAt: null,
    lastSyncedAt: null,
    lastStatus: "idle",
    lastMessage: "",
    lastMessageKey: "",
    lastMessageParams: null,
  };
}

function defaultHostedServerUrl() {
  if (!["http:", "https:"].includes(window.location.protocol)) return "";
  if (["127.0.0.1", "localhost", "::1"].includes(window.location.hostname)) return "";
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/index.html" || path === "/app" || path.startsWith("/app/")) {
    return window.location.origin;
  }
  return "";
}

function isHostedWebClient() {
  return Boolean(defaultHostedServerUrl());
}

function isDesktopClient() {
  return Boolean(window.nownoteDesktop?.storage);
}

function defaultServerUserProfile() {
  return {
    email: "",
    displayName: "",
    timezone: "Asia/Seoul",
    groupName: "",
    twoFactorEnabled: false,
    isActive: true,
    lastSeenAt: null,
    loadedAt: null,
  };
}

const $ = (selector) => document.querySelector(selector);

function t(key, vars = null) {
  const lang = normalizeLanguage(state.settings.language);
  const fallbackLanguage = LANGUAGES[lang]?.fallback || "en";
  const value = I18N[lang]?.[key] || I18N[fallbackLanguage]?.[key] || I18N.ko[key];
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
    const resolved = vars[token];
    return resolved === undefined ? `{${token}}` : String(resolved);
  });
}

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "ko";
}

function currentLanguageMeta() {
  return LANGUAGES[normalizeLanguage(state.settings.language)] || LANGUAGES.ko;
}

function noteTitle(value) {
  return value ? String(value) : t("note.untitled");
}

function setText(selector, value) {
  const element = typeof selector === "string" ? $(selector) : selector;
  if (element) element.textContent = value;
}

function setPlaceholder(element, value) {
  if (!element) return;
  if ("placeholder" in element) element.placeholder = value;
  element.dataset.placeholder = value;
}

function localizeOrFallback(key, fallback) {
  if (!key) return fallback;
  const value = t(key);
  return value === key ? fallback : value;
}

function tList(key, replacements) {
  const value = t(key);
  if (typeof value === "string") return value;
  return "";
}

function setTitle(element, value) {
  if (element) element.title = value;
}

function setIconLabel(element, value) {
  if (!element) return;
  element.title = value;
  element.setAttribute("aria-label", value);
}

function setOptionLabels(selectElement, labels) {
  if (!selectElement) return;
  Array.from(selectElement.options).forEach((option) => {
    const key = option.value;
    if (labels[key]) option.textContent = labels[key];
  });
}

function defaultShortcutSettings() {
  return Object.fromEntries(
    SHORTCUT_ACTIONS.map((action) => [action.id, { ...action.defaultShortcut }]),
  );
}

function defaultFeatureSettings() {
  return Object.fromEntries(FEATURE_TOGGLES.map((feature) => [feature.id, true]));
}

const elements = {
  searchInput: $("#searchInput"),
  navTabs: document.querySelectorAll(".nav-tab"),
  dailyToggleBtn: $("#dailyToggleBtn"),
  dailyCloseBtn: $("#dailyCloseBtn"),
  todayMemoState: $("#todayMemoState"),
  favoriteList: $("#favoriteList"),
  favoriteCount: $("#favoriteCount"),
  recentList: $("#recentList"),
  recentCount: $("#recentCount"),
  sideTagList: $("#sideTagList"),
  tagCount: $("#tagCount"),
  dailyView: $("#dailyView"),
  treeView: $("#treeView"),
  resultsView: $("#resultsView"),
  monthLabel: $("#monthLabel"),
  calendarGrid: $("#calendarGrid"),
  selectedDateLabel: $("#selectedDateLabel"),
  dailyContent: $("#dailyContent"),
  dailySavedLabel: $("#dailySavedLabel"),
  todayBtn: $("#todayBtn"),
  appendTimeBtn: $("#appendTimeBtn"),
  archiveSelectedBtn: $("#archiveSelectedBtn"),
  archiveToggleBtn: $("#archiveToggleBtn"),
  archivePanel: $("#archivePanel"),
  archiveList: $("#archiveList"),
  archiveCountLabel: $("#archiveCountLabel"),
  prevMonthBtn: $("#prevMonthBtn"),
  nextMonthBtn: $("#nextMonthBtn"),
  toggleTreePanelBtn: $("#toggleTreePanelBtn"),
  expandAllBtn: $("#expandAllBtn"),
  collapseAllBtn: $("#collapseAllBtn"),
  addRootBtn: $("#addRootBtn"),
  emptyAddRootBtn: $("#emptyAddRootBtn"),
  treeList: $("#treeList"),
  openTabsBar: $("#openTabsBar"),
  openTabs: $("#openTabs"),
  pinTabBtn: $("#pinTabBtn"),
  reopenClosedTabBtn: $("#reopenClosedTabBtn"),
  closeOtherTabsBtn: $("#closeOtherTabsBtn"),
  closeAllTabsBtn: $("#closeAllTabsBtn"),
  emptyTreeEditor: $("#emptyTreeEditor"),
  treeEditor: $("#treeEditor"),
  treeTitleInput: $("#treeTitleInput"),
  treeContent: $("#treeContent"),
  treePathLabel: $("#treePathLabel"),
  notePropertiesPanel: $("#notePropertiesPanel"),
  propertyStatusSelect: $("#propertyStatusSelect"),
  propertyPrioritySelect: $("#propertyPrioritySelect"),
  propertyTypeInput: $("#propertyTypeInput"),
  propertyProjectInput: $("#propertyProjectInput"),
  propertySourceInput: $("#propertySourceInput"),
  propertyAuthorInput: $("#propertyAuthorInput"),
  propertyDueInput: $("#propertyDueInput"),
  treeSavedLabel: $("#treeSavedLabel"),
  noteActionMenuBtn: $("#noteActionMenuBtn"),
  noteActionMenu: $("#noteActionMenu"),
  favoriteBtn: $("#favoriteBtn"),
  shareTreeBtn: $("#shareTreeBtn"),
  copyLinkBtn: $("#copyLinkBtn"),
  noteFindToggleBtn: $("#noteFindToggleBtn"),
  outlineToggleBtn: $("#outlineToggleBtn"),
  insertTimeBtn: $("#insertTimeBtn"),
  outlinePanel: $("#outlinePanel"),
  noteFindBar: $("#noteFindBar"),
  noteFindInput: $("#noteFindInput"),
  noteFindCount: $("#noteFindCount"),
  noteFindPrevBtn: $("#noteFindPrevBtn"),
  noteFindNextBtn: $("#noteFindNextBtn"),
  noteFindCloseBtn: $("#noteFindCloseBtn"),
  tagList: $("#tagList"),
  noteStats: $("#noteStats"),
  previewToggleBtn: $("#previewToggleBtn"),
  openDetectedLinkBtn: $("#openDetectedLinkBtn"),
  encryptNoteBtn: $("#encryptNoteBtn"),
  unlockNoteBtn: $("#unlockNoteBtn"),
  decryptNoteBtn: $("#decryptNoteBtn"),
  lockNoteBtn: $("#lockNoteBtn"),
  markdownPreview: $("#markdownPreview"),
  moveUpBtn: $("#moveUpBtn"),
  moveDownBtn: $("#moveDownBtn"),
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  deletedTreeBtn: $("#deletedTreeBtn"),
  deletedTreeCount: $("#deletedTreeCount"),
  deletedTreeView: $("#deletedTreeView"),
  deletedTreeList: $("#deletedTreeList"),
  deletedTreeCloseBtn: $("#deletedTreeCloseBtn"),
  deletedSelectionLabel: $("#deletedSelectionLabel"),
  deletedSelectAllBtn: $("#deletedSelectAllBtn"),
  deletedBulkDeleteBtn: $("#deletedBulkDeleteBtn"),
  deletedDeleteAllBtn: $("#deletedDeleteAllBtn"),
  resultsList: $("#resultsList"),
  resultsCount: $("#resultsCount"),
  clearResultsBtn: $("#clearResultsBtn"),
  exportBtn: $("#exportBtn"),
  exportMarkdownBtn: $("#exportMarkdownBtn"),
  importInput: $("#importInput"),
  importMarkdownBtn: $("#importMarkdownBtn"),
  importMarkdownInput: $("#importMarkdownInput"),
  publishBundleSelect: $("#publishBundleSelect"),
  publishTitleInput: $("#publishTitleInput"),
  publishDescriptionInput: $("#publishDescriptionInput"),
  publishPermalinkInput: $("#publishPermalinkInput"),
  publishSaveBtn: $("#publishSaveBtn"),
  publishHtmlExportBtn: $("#publishHtmlExportBtn"),
  publishSlidesExportBtn: $("#publishSlidesExportBtn"),
  publishSensitiveList: $("#publishSensitiveList"),
  publishNodeList: $("#publishNodeList"),
  publishPreview: $("#publishPreview"),
  workspaceNameInput: $("#workspaceNameInput"),
  workspaceSelect: $("#workspaceSelect"),
  workspaceSaveBtn: $("#workspaceSaveBtn"),
  workspaceApplyBtn: $("#workspaceApplyBtn"),
  workspaceSummary: $("#workspaceSummary"),
  workspaceHealthSummary: $("#workspaceHealthSummary"),
  workspaceHealthList: $("#workspaceHealthList"),
  workspaceExternalLinks: $("#workspaceExternalLinks"),
  quickSwitchBtn: $("#quickSwitchBtn"),
  commandPaletteBtn: $("#commandPaletteBtn"),
  graphBtn: $("#graphBtn"),
  settingsBtn: $("#settingsBtn"),
  helpBtn: $("#helpBtn"),
  railSidebarBtn: $("#railSidebarBtn"),
  railDailyBtn: $("#railDailyBtn"),
  railSearchBtn: $("#railSearchBtn"),
  railQuickBtn: $("#railQuickBtn"),
  railGraphBtn: $("#railGraphBtn"),
  railMarkdownExportBtn: $("#railMarkdownExportBtn"),
  railMarkdownImportBtn: $("#railMarkdownImportBtn"),
  railDeletedTreeBtn: $("#railDeletedTreeBtn"),
  railSettingsBtn: $("#railSettingsBtn"),
  settingsCloseBtn: $("#settingsCloseBtn"),
  settingsView: $("#settingsView"),
  languageSelect: $("#languageSelect"),
  themeSelect: $("#themeSelect"),
  accentChoices: $("#accentChoices"),
  wideEditorToggle: $("#wideEditorToggle"),
  railModeSelect: $("#railModeSelect"),
  editorActionIconsToggle: $("#editorActionIconsToggle"),
  fontSizeSelect: $("#fontSizeSelect"),
  lineHeightSelect: $("#lineHeightSelect"),
  tabIndentSelect: $("#tabIndentSelect"),
  backlinksToggle: $("#backlinksToggle"),
  tagsToggle: $("#tagsToggle"),
  shortcutsToggle: $("#shortcutsToggle"),
  shortcutEditor: $("#shortcutEditor"),
  featureSettings: $("#featureSettings"),
  serverModeSelect: $("#serverModeSelect"),
  serverUrlInput: $("#serverUrlInput"),
  serverTokenInput: $("#serverTokenInput"),
  serverUserTokenInput: $("#serverUserTokenInput"),
  serverTwoFactorCodeInput: $("#serverTwoFactorCodeInput"),
  serverAutoSyncToggle: $("#serverAutoSyncToggle"),
  ownerIdInput: $("#ownerIdInput"),
  deviceIdInput: $("#deviceIdInput"),
  serverDisplayNameInput: $("#serverDisplayNameInput"),
  serverEmailInput: $("#serverEmailInput"),
  serverTimezoneInput: $("#serverTimezoneInput"),
  serverProfileLoadBtn: $("#serverProfileLoadBtn"),
  serverProfileSaveBtn: $("#serverProfileSaveBtn"),
  serverProfileText: $("#serverProfileText"),
  serverGroupJoinTitle: $("#serverGroupJoinTitle"),
  serverGroupJoinDesc: $("#serverGroupJoinDesc"),
  serverGroupNameLabel: $("#serverGroupNameLabel"),
  serverGroupNameInput: $("#serverGroupNameInput"),
  serverGroupInviteCodeLabel: $("#serverGroupInviteCodeLabel"),
  serverGroupInviteCodeInput: $("#serverGroupInviteCodeInput"),
  serverGroupJoinBtn: $("#serverGroupJoinBtn"),
  serverGroupJoinText: $("#serverGroupJoinText"),
  serverAnalysisCreateBtn: $("#serverAnalysisCreateBtn"),
  serverAnalysisRefreshBtn: $("#serverAnalysisRefreshBtn"),
  serverAnalysisTypeSelect: $("#serverAnalysisTypeSelect"),
  serverAnalysisList: $("#serverAnalysisList"),
  groupMessengerBtn: $("#groupMessengerBtn"),
  groupMessengerUnreadCount: $("#groupMessengerUnreadCount"),
  groupMessengerView: $("#groupMessengerView"),
  groupMessengerCloseBtn: $("#groupMessengerCloseBtn"),
  groupMessengerRefreshBtn: $("#groupMessengerRefreshBtn"),
  groupMessengerNewRoomBtn: $("#groupMessengerNewRoomBtn"),
  groupMessengerForm: $("#groupMessengerForm"),
  groupMessengerInput: $("#groupMessengerInput"),
  groupMessengerFileInput: $("#groupMessengerFileInput"),
  groupMessengerAttachBtn: $("#groupMessengerAttachBtn"),
  groupMessengerAttachmentLabel: $("#groupMessengerAttachmentLabel"),
  groupMessengerSendBtn: $("#groupMessengerSendBtn"),
  groupMessengerList: $("#groupMessengerList"),
  groupMessengerRoomList: $("#groupMessengerRoomList"),
  groupMessengerGroupLabel: $("#groupMessengerGroupLabel"),
  hostedDeviceTokenBox: $("#hostedDeviceTokenBox"),
  deviceTokenNameInput: $("#deviceTokenNameInput"),
  deviceTokenIdInput: $("#deviceTokenIdInput"),
  deviceTokenIssueBtn: $("#deviceTokenIssueBtn"),
  deviceTokenOutput: $("#deviceTokenOutput"),
  deviceTokenText: $("#deviceTokenText"),
  serverSaveBtn: $("#serverSaveBtn"),
  serverTestBtn: $("#serverTestBtn"),
  serverSyncBtn: $("#serverSyncBtn"),
  serverFullSyncBtn: $("#serverFullSyncBtn"),
  webAccountMenuBtn: $("#webAccountMenuBtn"),
  webAccountMenu: $("#webAccountMenu"),
  webLogoutBtn: $("#webLogoutBtn"),
  serverStatusText: $("#serverStatusText"),
  serverMetaText: $("#serverMetaText"),
  serverCapabilitiesText: $("#serverCapabilitiesText"),
  serverConflictBox: $("#serverConflictBox"),
  serverConflictList: $("#serverConflictList"),
  desktopStorageRow: $("#desktopStorageRow"),
  desktopStorageStatus: $("#desktopStorageStatus"),
  desktopStoragePath: $("#desktopStoragePath"),
  sidebarAssistToggle: $("#sidebarAssistToggle"),
  resetSettingsBtn: $("#resetSettingsBtn"),
  settingsHelpBtn: $("#settingsHelpBtn"),
  treeResizeHandle: $("#treeResizeHandle"),
  backlinksPanel: $("#backlinksPanel"),
  quickSwitchView: $("#quickSwitchView"),
  quickInput: $("#quickInput"),
  quickCount: $("#quickCount"),
  quickResults: $("#quickResults"),
  quickCloseBtn: $("#quickCloseBtn"),
  commandPaletteView: $("#commandPaletteView"),
  commandPaletteInput: $("#commandPaletteInput"),
  commandPaletteSummary: $("#commandPaletteSummary"),
  commandPaletteList: $("#commandPaletteList"),
  commandPaletteCloseBtn: $("#commandPaletteCloseBtn"),
  searchPopoverView: $("#searchPopoverView"),
  searchPopoverInput: $("#searchPopoverInput"),
  searchScopeSelect: $("#searchScopeSelect"),
  searchSortSelect: $("#searchSortSelect"),
  searchPopoverCount: $("#searchPopoverCount"),
  searchPopoverResults: $("#searchPopoverResults"),
  searchHelpPath: $("#searchHelpPath"),
  searchHelpTitle: $("#searchHelpTitle"),
  searchHelpTag: $("#searchHelpTag"),
  searchHelpContent: $("#searchHelpContent"),
  searchPopoverCloseBtn: $("#searchPopoverCloseBtn"),
  graphView: $("#graphView"),
  graphModeSelect: $("#graphModeSelect"),
  graphDepthSelect: $("#graphDepthSelect"),
  graphTagSelect: $("#graphTagSelect"),
  graphGroupSelect: $("#graphGroupSelect"),
  graphFilterInput: $("#graphFilterInput"),
  graphBookmarkSaveBtn: $("#graphBookmarkSaveBtn"),
  graphBookmarkSelect: $("#graphBookmarkSelect"),
  graphSummary: $("#graphSummary"),
  graphCanvas: $("#graphCanvas"),
  graphList: $("#graphList"),
  graphOutgoingList: $("#graphOutgoingList"),
  graphBacklinkList: $("#graphBacklinkList"),
  graphSuggestionsList: $("#graphSuggestionsList"),
  graphIsolatedList: $("#graphIsolatedList"),
  graphHubList: $("#graphHubList"),
  graphCloseBtn: $("#graphCloseBtn"),
  propertiesBtn: $("#propertiesBtn"),
  propertiesView: $("#propertiesView"),
  propertiesCloseBtn: $("#propertiesCloseBtn"),
  propertiesSearchInput: $("#propertiesSearchInput"),
  propertiesStatusFilter: $("#propertiesStatusFilter"),
  propertiesPriorityFilter: $("#propertiesPriorityFilter"),
  propertiesGroupSelect: $("#propertiesGroupSelect"),
  propertiesFilterSaveBtn: $("#propertiesFilterSaveBtn"),
  propertiesSavedFilterSelect: $("#propertiesSavedFilterSelect"),
  propertiesSummary: $("#propertiesSummary"),
  propertiesList: $("#propertiesList"),
  propertiesMissingList: $("#propertiesMissingList"),
  propertyTemplateSelect: $("#propertyTemplateSelect"),
  propertyTemplateCreateBtn: $("#propertyTemplateCreateBtn"),
  canvasBtn: $("#canvasBtn"),
  canvasView: $("#canvasView"),
  canvasCloseBtn: $("#canvasCloseBtn"),
  canvasTitleInput: $("#canvasTitleInput"),
  canvasAddNoteBtn: $("#canvasAddNoteBtn"),
  canvasAddTextBtn: $("#canvasAddTextBtn"),
  canvasConnectBtn: $("#canvasConnectBtn"),
  canvasDraftFromGraphBtn: $("#canvasDraftFromGraphBtn"),
  canvasZoomOutBtn: $("#canvasZoomOutBtn"),
  canvasZoomInBtn: $("#canvasZoomInBtn"),
  canvasFitBtn: $("#canvasFitBtn"),
  canvasSummary: $("#canvasSummary"),
  canvasBoard: $("#canvasBoard"),
  canvasSelectionLabel: $("#canvasSelectionLabel"),
  canvasMoveLeftBtn: $("#canvasMoveLeftBtn"),
  canvasMoveUpBtn: $("#canvasMoveUpBtn"),
  canvasMoveDownBtn: $("#canvasMoveDownBtn"),
  canvasMoveRightBtn: $("#canvasMoveRightBtn"),
  captureBtn: $("#captureBtn"),
  captureView: $("#captureView"),
  captureCloseBtn: $("#captureCloseBtn"),
  captureContentInput: $("#captureContentInput"),
  captureColorSelect: $("#captureColorSelect"),
  captureLabelInput: $("#captureLabelInput"),
  captureReminderInput: $("#captureReminderInput"),
  captureChecklistToggle: $("#captureChecklistToggle"),
  capturePinToggle: $("#capturePinToggle"),
  captureAttachmentInput: $("#captureAttachmentInput"),
  captureAttachmentLabel: $("#captureAttachmentLabel"),
  captureSketchClearBtn: $("#captureSketchClearBtn"),
  captureSketchCanvas: $("#captureSketchCanvas"),
  captureSaveBtn: $("#captureSaveBtn"),
  captureFilterSelect: $("#captureFilterSelect"),
  captureSearchInput: $("#captureSearchInput"),
  captureSummary: $("#captureSummary"),
  captureList: $("#captureList"),
  snapshotCreateBtn: $("#snapshotCreateBtn"),
  snapshotSelect: $("#snapshotSelect"),
  snapshotRestoreBtn: $("#snapshotRestoreBtn"),
  snapshotSummary: $("#snapshotSummary"),
  importReportList: $("#importReportList"),
  confirmDialog: $("#confirmDialog"),
  confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"),
  confirmCancelBtn: $("#confirmCancelBtn"),
  confirmOkBtn: $("#confirmOkBtn"),
  keyDialog: $("#keyDialog"),
  keyDialogTitle: $("#keyDialogTitle"),
  keyDialogMessage: $("#keyDialogMessage"),
  keyDialogInput: $("#keyDialogInput"),
  keyDialogCancelBtn: $("#keyDialogCancelBtn"),
  keyDialogOkBtn: $("#keyDialogOkBtn"),
  toastRegion: $("#toastRegion"),
  webLoginView: $("#webLoginView"),
  webLoginForm: $("#webLoginForm"),
  webLoginDesc: $("#webLoginDesc"),
  webLoginOwnerInput: $("#webLoginOwnerInput"),
  webLoginPasswordLabel: $("#webLoginPasswordLabel"),
  webLoginPasswordInput: $("#webLoginPasswordInput"),
  webRegisterEmailInput: $("#webRegisterEmailInput"),
  webLoginTwoFactorInput: $("#webLoginTwoFactorInput"),
  webResetCodeInput: $("#webResetCodeInput"),
  webLoginActions: $(".web-login-actions"),
  webLoginSubmitBtn: $("#webLoginSubmitBtn"),
  webRegisterSubmitBtn: $("#webRegisterSubmitBtn"),
  webResetRequestBtn: $("#webResetRequestBtn"),
  webResetConfirmBtn: $("#webResetConfirmBtn"),
  webLoginStatus: $("#webLoginStatus"),
};

function confirmAction(message) {
  if (!elements.confirmDialog) return Promise.resolve(false);
  elements.confirmTitle.textContent = t("dialog.confirmTitle");
  elements.confirmMessage.textContent = message;
  elements.confirmCancelBtn.textContent = t("dialog.cancel");
  elements.confirmOkBtn.textContent = t("dialog.ok");
  elements.confirmDialog.classList.remove("hidden");

  return new Promise((resolve) => {
    const close = (result) => {
      elements.confirmDialog.classList.add("hidden");
      elements.confirmOkBtn.removeEventListener("click", onOk);
      elements.confirmCancelBtn.removeEventListener("click", onCancel);
      elements.confirmDialog.removeEventListener("click", onBackdrop);
      window.removeEventListener("keydown", onKeyDown);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (event) => {
      if (event.target === elements.confirmDialog) close(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(false);
      if (event.key === "Enter") close(true);
    };
    elements.confirmOkBtn.addEventListener("click", onOk);
    elements.confirmCancelBtn.addEventListener("click", onCancel);
    elements.confirmDialog.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => elements.confirmOkBtn.focus(), 0);
  });
}

function requestEncryptionKey(message) {
  if (!elements.keyDialog) return Promise.resolve("");
  elements.keyDialogTitle.textContent = t("encryption.keyTitle");
  elements.keyDialogMessage.textContent = message;
  elements.keyDialogCancelBtn.textContent = t("dialog.cancel");
  elements.keyDialogOkBtn.textContent = t("dialog.ok");
  elements.keyDialogInput.value = "";
  elements.keyDialog.classList.remove("hidden");

  return new Promise((resolve) => {
    const close = (value) => {
      elements.keyDialog.classList.add("hidden");
      elements.keyDialogOkBtn.removeEventListener("click", onOk);
      elements.keyDialogCancelBtn.removeEventListener("click", onCancel);
      elements.keyDialog.removeEventListener("click", onBackdrop);
      window.removeEventListener("keydown", onKeyDown);
      resolve(value);
    };
    const onOk = () => close(elements.keyDialogInput.value);
    const onCancel = () => close("");
    const onBackdrop = (event) => {
      if (event.target === elements.keyDialog) close("");
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close("");
      if (event.key === "Enter") close(elements.keyDialogInput.value);
    };
    elements.keyDialogOkBtn.addEventListener("click", onOk);
    elements.keyDialogCancelBtn.addEventListener("click", onCancel);
    elements.keyDialog.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => elements.keyDialogInput.focus(), 0);
  });
}

function showNotice(message, type = "info") {
  if (!message) return;
  if (!elements.toastRegion) {
    console.warn(message);
    return;
  }
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.setAttribute("role", type === "error" ? "alert" : "status");
  item.textContent = message;
  elements.toastRegion.append(item);
  requestAnimationFrame(() => item.classList.add("visible"));
  window.setTimeout(() => {
    item.classList.remove("visible");
    window.setTimeout(() => item.remove(), 220);
  }, type === "error" ? 5200 : 3600);
}

async function initializeHostedWebClient() {
  if (!isHostedWebClient()) {
    return true;
  }
  const session = loadWebSession();
  if (!session?.ownerId || !session?.token || isWebSessionInvalidated(session)) {
    clearWebSession();
    showWebLogin(t("web.login.ready"));
    return false;
  }
  applyWebSession(session);
  showWebLogin(t("web.login.loading"), "ok");
  try {
    await verifyWebSession();
    await loadServerGroupOptions({ silent: true });
    await loadServerSharedNotes({ replace: true, message: t("web.login.loading") });
    await refreshDeviceTokens({ silent: true });
    await refreshGroupMessages({ silent: true });
    hideWebLogin();
    return true;
  } catch (error) {
    stopGroupMessengerAutoRefresh();
    clearWebSession();
    showWebLogin(t("web.login.failed", { message: error.message }), "bad");
    return false;
  }
}

function loadWebSession() {
  try {
    const raw = sessionStorage.getItem(WEB_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function webLogoutTimestamp() {
  try {
    return Number(localStorage.getItem(WEB_LOGOUT_KEY) || 0);
  } catch {
    return 0;
  }
}

function isWebSessionInvalidated(session) {
  if (!isWebAuthActive()) return true;
  const loggedOutAt = webLogoutTimestamp();
  if (!loggedOutAt) return false;
  const savedAt = Number(session?.savedAt || 0);
  return !savedAt || savedAt <= loggedOutAt;
}

function isWebAuthActive() {
  try {
    return localStorage.getItem(WEB_AUTH_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

function markWebAuthActive() {
  try {
    localStorage.setItem(WEB_AUTH_ACTIVE_KEY, "1");
  } catch {
    // 자동 로그인 허용 상태 저장에 실패하면 다음 진입은 로그인 화면으로 보낸다.
  }
}

function saveWebSession(session) {
  markWebAuthActive();
  sessionStorage.setItem(WEB_SESSION_KEY, JSON.stringify({
    ...session,
    savedAt: Date.now(),
  }));
}

function clearWebSession() {
  sessionStorage.removeItem(WEB_SESSION_KEY);
}

function markWebLoggedOut() {
  try {
    localStorage.removeItem(WEB_AUTH_ACTIVE_KEY);
    localStorage.setItem(WEB_LOGOUT_KEY, String(Date.now()));
  } catch {
    // 로그아웃 마커 저장 실패 시에도 현재 탭 세션 삭제는 계속 진행한다.
  }
}

function closeWebAccountMenu() {
  elements.webAccountMenu?.classList.add("hidden");
  elements.webAccountMenuBtn?.setAttribute("aria-expanded", "false");
}

function toggleWebAccountMenu() {
  if (!elements.webAccountMenu || !elements.webAccountMenuBtn) return;
  const willOpen = elements.webAccountMenu.classList.contains("hidden");
  elements.webAccountMenu.classList.toggle("hidden", !willOpen);
  elements.webAccountMenuBtn.setAttribute("aria-expanded", String(willOpen));
}

async function clearHostedWebLogoutCache() {
  if (!isHostedWebClient()) return;
  markWebLoggedOut();
  clearWebSession();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(WEB_AUTH_ACTIVE_KEY);
  sessionStorage.clear();
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // 캐시 정리는 브라우저 권한/상태에 따라 실패할 수 있으므로 화면 전환을 우선한다.
    }
  }
}

function applyWebSession(session) {
  const server = state.settings.server || defaultServerSettings();
  state.settings.server = {
    ...server,
    mode: "server",
    url: defaultHostedServerUrl(),
    token: "",
    userToken: "",
    webSessionToken: session.token,
    ownerId: normalizeOwnerId(session.ownerId),
    deviceId: session.deviceId || server.deviceId || "web-client",
  };
  persistSettings();
  renderSettings();
}

function setHostedAppShellVisible(visible) {
  if (!isHostedWebClient()) return;
  document.documentElement.dataset.auth = visible ? "unlocked" : "locked";
  document.querySelector(".app-shell")?.classList.toggle("hidden", !visible);
}

function showWebLogin(message = t("web.login.ready"), status = "") {
  if (!elements.webLoginView) return;
  setHostedAppShellVisible(false);
  elements.webLoginView.classList.remove("hidden");
  renderWebLoginMode();
  elements.webLoginStatus.textContent = message;
  elements.webLoginStatus.classList.toggle("bad", status === "bad");
  elements.webLoginStatus.classList.toggle("ok", status === "ok");
}

function hideWebLogin() {
  setHostedAppShellVisible(true);
  elements.webLoginView?.classList.add("hidden");
}

function setWebLoginMode(mode) {
  webLoginMode = ["login", "register", "reset-request", "reset-confirm"].includes(mode) ? mode : "login";
  renderWebLoginMode();
}

function renderWebLoginMode() {
  if (!elements.webLoginView) return;
  elements.webLoginView.dataset.mode = webLoginMode;
  document.querySelectorAll("[data-login-mode]").forEach((node) => {
    const modes = String(node.dataset.loginMode || "").split(/\s+/);
    node.classList.toggle("hidden", !modes.includes(webLoginMode));
  });
  const buttonModes = new Map([
    [elements.webLoginSubmitBtn, ["login"]],
    [elements.webRegisterSubmitBtn, ["login", "register"]],
    [elements.webResetRequestBtn, ["login", "reset-request"]],
    [elements.webResetConfirmBtn, ["reset-confirm"]],
  ]);
  buttonModes.forEach((modes, button) => {
    button?.classList.toggle("hidden", !modes.includes(webLoginMode));
  });
  const visibleActionCount = Array.from(elements.webLoginActions?.querySelectorAll("button") || [])
    .filter((button) => !button.classList.contains("hidden")).length;
  elements.webLoginActions?.classList.toggle("single-action", visibleActionCount === 1);
  const descKey = {
    login: "web.login.desc.login",
    register: "web.login.desc.register",
    "reset-request": "web.login.desc.resetRequest",
    "reset-confirm": "web.login.desc.resetConfirm",
  }[webLoginMode] || "web.login.desc.login";
  elements.webLoginDesc.textContent = t(descKey);
  elements.webLoginPasswordLabel.textContent = webLoginMode === "reset-confirm"
    ? t("web.login.newPassword")
    : t("web.login.password");
  elements.webLoginPasswordInput.autocomplete = webLoginMode === "reset-confirm"
    ? "new-password"
    : "current-password";
  elements.webLoginPasswordInput.required = ["login", "register", "reset-confirm"].includes(webLoginMode);
  elements.webLoginSubmitBtn.textContent = t("web.login.submit");
  elements.webRegisterSubmitBtn.textContent = t("web.login.register");
  elements.webResetRequestBtn.textContent = t("web.login.resetRequest");
  elements.webResetConfirmBtn.textContent = t("web.login.resetConfirm");
  [
    elements.webLoginSubmitBtn,
    elements.webResetRequestBtn,
    elements.webResetConfirmBtn,
  ].forEach((button) => {
    if (button) button.type = "submit";
  });
  if (elements.webRegisterSubmitBtn) {
    elements.webRegisterSubmitBtn.type = "button";
  }
  [
    [elements.webLoginSubmitBtn, webLoginMode === "login"],
    [elements.webRegisterSubmitBtn, webLoginMode === "register"],
    [elements.webResetRequestBtn, webLoginMode === "reset-request"],
    [elements.webResetConfirmBtn, webLoginMode === "reset-confirm"],
  ].forEach(([button, primary]) => {
    button?.classList.toggle("primary-btn", primary);
    button?.classList.toggle("secondary-btn", !primary);
  });
}

async function handleWebLoginSubmit(event) {
  event.preventDefault();
  const submitter = event.submitter || document.activeElement;
  const action = submitter === elements.webRegisterSubmitBtn
    ? "register"
    : submitter === elements.webResetRequestBtn
      ? "reset-request"
      : submitter === elements.webResetConfirmBtn
        ? "reset-confirm"
        : "login";
  if (action === "register") {
    if (webLoginMode !== "register") {
      setWebLoginMode("register");
      showWebLogin(t("web.login.desc.register"));
      elements.webRegisterEmailInput.focus();
      return;
    }
    await createWebAccount();
    return;
  }
  if (action === "reset-request") {
    if (webLoginMode !== "reset-request") {
      setWebLoginMode("reset-request");
      showWebLogin(t("web.login.desc.resetRequest"));
      elements.webRegisterEmailInput.focus();
      return;
    }
    await requestPasswordReset();
    return;
  }
  if (action === "reset-confirm") {
    if (webLoginMode !== "reset-confirm") {
      setWebLoginMode("reset-confirm");
      showWebLogin(t("web.login.desc.resetConfirm"));
      elements.webResetCodeInput.focus();
      return;
    }
    await confirmPasswordReset();
    return;
  }
  if (webLoginMode === "register") {
    await createWebAccount();
    return;
  }
  if (webLoginMode === "reset-request") {
    await requestPasswordReset();
    return;
  }
  if (webLoginMode === "reset-confirm") {
    await confirmPasswordReset();
    return;
  }
  if (!isHostedWebClient()) return;
  const ownerId = normalizeOwnerId(elements.webLoginOwnerInput.value);
  const password = elements.webLoginPasswordInput.value;
  const twoFactorCode = elements.webLoginTwoFactorInput.value.trim();
  showWebLogin(t("web.login.loading"), "ok");
  elements.webLoginSubmitBtn.disabled = true;
  try {
    const response = await fetch(`${defaultHostedServerUrl()}/api/v1/auth/web-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: ownerId,
        password,
        device_id: "web-client",
        ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
      }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    const session = {
      ownerId,
      token: payload.session_token,
      deviceId: "web-client",
      expiresAt: payload.expires_at,
    };
    saveWebSession(session);
    applyWebSession(session);
    applyServerUserProfile(payload.user);
    await loadServerGroupOptions({ silent: true });
    await loadServerSharedNotes({ replace: true, message: t("web.login.loading") });
    await refreshDeviceTokens({ silent: true });
    await refreshGroupMessages({ silent: true });
    hideWebLogin();
    showNotice(t("web.login.ok"));
  } catch (error) {
    showWebLogin(t("web.login.failed", { message: error.message }), "bad");
  } finally {
    elements.webLoginSubmitBtn.disabled = false;
  }
}

async function handleWebRegisterSubmit(event) {
  event?.preventDefault();
  if (!isHostedWebClient()) return;
  if (webLoginMode !== "register") {
    setWebLoginMode("register");
    showWebLogin(t("web.login.desc.register"));
    elements.webRegisterEmailInput.focus();
    return;
  }
  await createWebAccount();
}

function validWebPassword(password) {
  const value = (password || "").trim();
  return value.length >= 10
    && /[A-Za-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

function validWebEmail(email) {
  const value = (email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createWebAccount() {
  if (!isHostedWebClient()) return;
  const ownerId = normalizeOwnerId(elements.webLoginOwnerInput.value);
  const password = elements.webLoginPasswordInput.value;
  const email = elements.webRegisterEmailInput.value.trim();
  if (!ownerId || !password) {
    showWebLogin(t("web.login.registerFailed", { message: "사용자 ID와 비밀번호를 입력하세요." }), "bad");
    return;
  }
  if (!validWebEmail(email)) {
    showWebLogin(t("web.login.registerFailed", { message: "올바른 등록 이메일을 입력하세요." }), "bad");
    return;
  }
  if (!validWebPassword(password)) {
    showWebLogin(t("web.login.registerFailed", { message: t("web.login.passwordRule") }), "bad");
    return;
  }
  showWebLogin(t("web.login.registering"), "ok");
  elements.webLoginSubmitBtn.disabled = true;
  elements.webRegisterSubmitBtn.disabled = true;
  try {
    const response = await fetch(`${defaultHostedServerUrl()}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: ownerId,
        password,
        email,
        display_name: ownerId,
        device_id: "web-client",
        device_name: "Web",
      }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    const session = {
      ownerId,
      token: payload.session_token,
      deviceId: "web-client",
      expiresAt: payload.expires_at,
    };
    saveWebSession(session);
    applyWebSession(session);
    applyServerUserProfile(payload.user);
    await loadServerGroupOptions({ silent: true });
    await loadServerSharedNotes({ replace: true, message: t("web.login.loading") });
    await refreshDeviceTokens({ silent: true });
    await refreshGroupMessages({ silent: true });
    hideWebLogin();
    showNotice(t("web.login.registerOk"));
  } catch (error) {
    showWebLogin(t("web.login.registerFailed", { message: error.message }), "bad");
  } finally {
    elements.webLoginSubmitBtn.disabled = false;
    elements.webRegisterSubmitBtn.disabled = false;
  }
}

async function handlePasswordResetRequest(event) {
  if (!isHostedWebClient()) return;
  if (webLoginMode !== "reset-request") {
    event?.preventDefault();
    setWebLoginMode("reset-request");
    showWebLogin(t("web.login.desc.resetRequest"));
    elements.webRegisterEmailInput.focus();
    return;
  }
}

async function requestPasswordReset() {
  if (!isHostedWebClient()) return;
  const ownerId = normalizeOwnerId(elements.webLoginOwnerInput.value);
  const email = elements.webRegisterEmailInput.value.trim();
  if (!ownerId || !validWebEmail(email)) {
    showWebLogin(t("web.login.resetFailed", { message: "사용자 ID와 올바른 등록 이메일을 입력하세요." }), "bad");
    return;
  }
  showWebLogin(t("web.login.resetRequesting"), "ok");
  elements.webResetRequestBtn.disabled = true;
  try {
    const response = await fetch(`${defaultHostedServerUrl()}/api/v1/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: ownerId, email }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    setWebLoginMode("reset-confirm");
    showWebLogin(t("web.login.resetRequested"), "ok");
    elements.webResetCodeInput.focus();
  } catch (error) {
    showWebLogin(t("web.login.resetFailed", { message: error.message }), "bad");
  } finally {
    elements.webResetRequestBtn.disabled = false;
  }
}

async function handlePasswordResetConfirm(event) {
  if (!isHostedWebClient()) return;
  if (webLoginMode !== "reset-confirm") {
    event?.preventDefault();
    setWebLoginMode("reset-confirm");
  }
}

async function confirmPasswordReset() {
  if (!isHostedWebClient()) return;
  const ownerId = normalizeOwnerId(elements.webLoginOwnerInput.value);
  const resetCode = elements.webResetCodeInput.value.trim();
  const newPassword = elements.webLoginPasswordInput.value;
  if (!ownerId || !resetCode || !newPassword) {
    showWebLogin(t("web.login.resetFailed", { message: "사용자 ID, 새 비밀번호, 재설정 코드를 입력하세요." }), "bad");
    return;
  }
  if (!validWebPassword(newPassword)) {
    showWebLogin(t("web.login.resetFailed", { message: t("web.login.passwordRule") }), "bad");
    return;
  }
  showWebLogin(t("web.login.resetConfirming"), "ok");
  elements.webResetConfirmBtn.disabled = true;
  try {
    const response = await fetch(`${defaultHostedServerUrl()}/api/v1/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: ownerId,
        reset_code: resetCode,
        new_password: newPassword,
      }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    setWebLoginMode("login");
    elements.webLoginPasswordInput.value = "";
    elements.webResetCodeInput.value = "";
    showWebLogin(t("web.login.resetConfirmed"), "ok");
    elements.webLoginPasswordInput.focus();
  } catch (error) {
    showWebLogin(t("web.login.resetFailed", { message: error.message }), "bad");
  } finally {
    elements.webResetConfirmBtn.disabled = false;
  }
}

async function handleWebLogout() {
  if (!isHostedWebClient()) return;
  closeWebAccountMenu();
  stopGroupMessengerAutoRefresh();
  const server = state.settings.server || defaultServerSettings();
  const logoutHeaders = server.webSessionToken ? serverAuthHeaders(server) : null;
  await clearHostedWebLogoutCache();
  state.settings.server = {
    ...defaultServerSettings(),
    mode: "server",
    url: defaultHostedServerUrl(),
    deviceId: "web-client",
    lastStatus: "idle",
    lastMessage: t("web.login.loggedOut"),
  };
  try {
    if (logoutHeaders) {
      await fetch(`${defaultHostedServerUrl()}/api/v1/auth/web-logout`, {
        method: "POST",
        headers: logoutHeaders,
      });
    }
  } catch {
    // 로그아웃은 로컬 세션 폐기를 우선한다.
  }
  hostedWebSyncSuspended = true;
  try {
    state.data = defaultData();
    state.selectedTreeId = null;
    state.selectedDate = toDateKey(new Date());
    state.expandedTreeIds.clear();
    state.selectedDeletedTreeIds.clear();
    persistSettings();
    render();
    renderSettings();
    showWebLogin(t("web.login.loggedOut"), "ok");
    window.location.replace(defaultHostedServerUrl());
  } finally {
    hostedWebSyncSuspended = false;
  }
}

async function initializeApp() {
  bindHostedAuthEvents();
  await load();
  await loadSettings();
  applyLanguageQueryOverride();
  initializeLiveMemoEditor();
  bindEvents();
  initializeCaptureSketch();
  await refreshDesktopStorageInfo();
  renderSettings();
  applySettings();
  if (isHostedWebClient()) {
    const authenticated = await initializeHostedWebClient();
    if (!authenticated) return;
    render();
    scheduleServerSync({ force: true, delay: 1600 });
    return;
  }
  render();
  scheduleServerSync({ force: true, delay: 1600 });
}

initializeApp();

function bindHostedAuthEvents() {
  if (elements.webLoginForm?.dataset.authSubmitEventsBound !== "true") {
    elements.webLoginForm?.addEventListener("submit", handleWebLoginSubmit);
    if (elements.webLoginForm) {
      elements.webLoginForm.dataset.authSubmitEventsBound = "true";
    }
  }
  if (elements.webRegisterSubmitBtn?.dataset.authClickEventsBound !== "true") {
    elements.webRegisterSubmitBtn?.addEventListener("click", handleWebRegisterSubmit);
    if (elements.webRegisterSubmitBtn) {
      elements.webRegisterSubmitBtn.dataset.authClickEventsBound = "true";
    }
  }
}

function initializeLiveMemoEditor() {
  const editor = elements.treeContent;
  if (!editor || editor.tagName === "TEXTAREA" || editor.dataset.liveEditorReady === "true") return;
  editor.dataset.liveEditorReady = "true";

  Object.defineProperty(editor, "value", {
    configurable: true,
    get() {
      return readLiveMemoEditorText(editor);
    },
    set(value) {
      renderLiveMemoEditorText(editor, String(value ?? ""));
    },
  });

  Object.defineProperty(editor, "selectionStart", {
    configurable: true,
    get() {
      return getLiveMemoEditorSelection(editor).start;
    },
  });

  Object.defineProperty(editor, "selectionEnd", {
    configurable: true,
    get() {
      return getLiveMemoEditorSelection(editor).end;
    },
  });

  Object.defineProperty(editor, "readOnly", {
    configurable: true,
    get() {
      return editor.getAttribute("contenteditable") === "false";
    },
    set(value) {
      editor.setAttribute("contenteditable", value ? "false" : "true");
      editor.setAttribute("aria-readonly", value ? "true" : "false");
    },
  });

  editor.setSelectionRange = (start, end = start) => setLiveMemoEditorSelection(editor, start, end);
  editor.addEventListener("paste", pastePlainTextIntoLiveMemoEditor);
  editor.addEventListener("click", openLiveMemoEditorLink);
  editor.addEventListener("blur", () => {
    const selection = getLiveMemoEditorSelection(editor);
    renderLiveMemoEditorText(editor, editor.value);
    setLiveMemoEditorSelection(editor, selection.start, selection.end);
  });
}

function bindEvents() {
  elements.navTabs.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sharedView) {
        state.sharedView = normalizeSharedView(button.dataset.sharedView);
      }
      setView(button.dataset.view);
    });
  });

  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value.trim();
    if (state.search) {
      setView("results");
    } else if (state.view === "results") {
      setView("tree");
    }
    render();
  });
  elements.searchInput.addEventListener("keydown", handleMainSearchInputKey);

  elements.clearResultsBtn.addEventListener("click", clearSearchResults);

  elements.dailyToggleBtn.addEventListener("click", () => {
    toggleDailyPopup();
  });

  elements.dailyCloseBtn.addEventListener("click", () => {
    closeDailyPopup();
  });

  elements.todayBtn.addEventListener("click", () => {
    const today = new Date();
    state.selectedDate = toDateKey(today);
    state.visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderDaily();
  });

  elements.prevMonthBtn.addEventListener("click", () => {
    state.visibleMonth = new Date(
      state.visibleMonth.getFullYear(),
      state.visibleMonth.getMonth() - 1,
      1,
    );
    renderDaily();
  });

  elements.nextMonthBtn.addEventListener("click", () => {
    state.visibleMonth = new Date(
      state.visibleMonth.getFullYear(),
      state.visibleMonth.getMonth() + 1,
      1,
    );
    renderDaily();
  });

  elements.appendTimeBtn.addEventListener("click", () => {
    if (elements.dailyContent.readOnly) return;
    const current = elements.dailyContent.value.trimEnd();
    const prefix = current ? `${current}\n\n` : "";
    elements.dailyContent.value = `${prefix}[${timeLabel(new Date())}] `;
    elements.dailyContent.focus();
    saveDailyFromEditor();
  });

  elements.archiveSelectedBtn.addEventListener("click", () => {
    archiveSelectedDailyNote();
  });

  elements.archiveToggleBtn.addEventListener("click", () => {
    elements.archivePanel.classList.toggle("hidden");
    renderArchiveList();
  });

  elements.dailyContent.addEventListener("input", () => {
    saveDailyFromEditor();
  });

  elements.railSidebarBtn.addEventListener("click", () => {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    persistSettings();
    applySettings();
  });

  elements.railSearchBtn.addEventListener("click", () => {
    toggleSearchPopover();
  });

  elements.railQuickBtn.addEventListener("click", () => {
    toggleQuickSwitch();
  });

  elements.railGraphBtn.addEventListener("click", () => {
    toggleGraph();
  });

  elements.railMarkdownExportBtn.addEventListener("click", exportMarkdown);

  elements.railMarkdownImportBtn.addEventListener("click", () => {
    elements.importMarkdownInput.click();
  });

  elements.railDeletedTreeBtn.addEventListener("click", toggleDeletedTreeBox);

  elements.quickSwitchBtn.addEventListener("click", () => {
    toggleQuickSwitch();
  });

  elements.commandPaletteBtn?.addEventListener("click", () => {
    toggleCommandPalette();
  });

  elements.graphBtn.addEventListener("click", () => {
    toggleGraph();
  });

  elements.exportMarkdownBtn.addEventListener("click", exportMarkdown);

  elements.importMarkdownBtn.addEventListener("click", () => {
    elements.importMarkdownInput.click();
  });

  elements.publishBundleSelect.addEventListener("change", () => {
    state.selectedPublishBundleId = elements.publishBundleSelect.value;
    renderPublishPanel();
  });

  [elements.publishTitleInput, elements.publishDescriptionInput, elements.publishPermalinkInput].forEach((input) => {
    input.addEventListener("input", renderPublishPreview);
  });

  elements.publishSaveBtn.addEventListener("click", savePublishBundle);
  elements.publishHtmlExportBtn.addEventListener("click", exportPublishHtml);
  elements.publishSlidesExportBtn.addEventListener("click", exportPublishSlides);
  elements.workspaceSaveBtn?.addEventListener("click", saveCurrentWorkspace);
  elements.workspaceApplyBtn?.addEventListener("click", applySelectedWorkspace);
  elements.workspaceSelect?.addEventListener("change", renderWorkspacePanel);

  elements.settingsBtn.addEventListener("click", () => {
    toggleSettings();
  });

  elements.railSettingsBtn.addEventListener("click", () => {
    toggleSettings();
  });

  elements.railDailyBtn.addEventListener("click", () => {
    toggleDailyPopup();
  });

  elements.settingsCloseBtn.addEventListener("click", () => {
    closeSettingsPopup();
  });

  elements.languageSelect.addEventListener("change", () => {
    state.settings.language = elements.languageSelect.value;
    persistSettings();
    syncLanguageQueryParam(state.settings.language);
    renderSettings();
    applyLanguage();
    render();
  });

  elements.themeSelect.addEventListener("change", () => {
    state.settings.theme = elements.themeSelect.value;
    persistSettings();
    applySettings();
  });

  elements.wideEditorToggle.addEventListener("change", () => {
    state.settings.wideEditor = elements.wideEditorToggle.checked;
    state.settings.treeListWidth = state.settings.wideEditor ? 280 : 360;
    persistSettings();
    applySettings();
  });

  elements.railModeSelect.addEventListener("change", () => {
    state.settings.railMode = elements.railModeSelect.value === "letter" ? "letter" : "icon";
    persistSettings();
    applySettings();
  });

  elements.editorActionIconsToggle?.addEventListener("change", () => {
    state.settings.showEditorActionIcons = elements.editorActionIconsToggle.checked;
    persistSettings();
    applySettings();
  });

  elements.fontSizeSelect.addEventListener("change", () => {
    state.settings.fontSize = elements.fontSizeSelect.value;
    persistSettings();
    applySettings();
  });

  elements.lineHeightSelect.addEventListener("change", () => {
    state.settings.lineHeight = elements.lineHeightSelect.value;
    persistSettings();
    applySettings();
  });
  elements.tabIndentSelect.addEventListener("change", () => {
    state.settings.tabIndentSize = normalizeTabIndentSize(elements.tabIndentSelect.value);
    persistSettings();
  });

  elements.backlinksToggle.addEventListener("change", () => {
    state.settings.showBacklinks = elements.backlinksToggle.checked;
    state.settings.features.backlinks = elements.backlinksToggle.checked;
    persistSettings();
    applySettings();
    renderLinkPanel();
    renderFeatureSettings();
  });

  elements.tagsToggle.addEventListener("change", () => {
    state.settings.showTags = elements.tagsToggle.checked;
    state.settings.features.tags = elements.tagsToggle.checked;
    persistSettings();
    applySettings();
    renderTags();
    renderFeatureSettings();
  });

  elements.shortcutsToggle.addEventListener("change", () => {
    state.settings.enableShortcuts = elements.shortcutsToggle.checked;
    state.settings.features.shortcuts = elements.shortcutsToggle.checked;
    persistSettings();
    renderFeatureSettings();
  });

  elements.serverSaveBtn.addEventListener("click", () => {
    saveServerSettingsFromForm();
    scheduleServerSync({ force: true, delay: 800 });
  });

  elements.serverAutoSyncToggle.addEventListener("change", () => {
    saveServerSettingsFromForm();
    scheduleServerSync({ force: true, delay: 800 });
  });

  elements.serverTestBtn.addEventListener("click", testServerConnection);

  elements.serverSyncBtn.addEventListener("click", syncWebNotesToServer);
  elements.serverFullSyncBtn.addEventListener("click", syncAllWebNotesToServer);
  elements.serverProfileLoadBtn.addEventListener("click", loadServerUserProfile);
  elements.serverProfileSaveBtn.addEventListener("click", saveServerUserProfile);
  elements.serverGroupJoinBtn?.addEventListener("click", joinServerGroupByInvite);
  elements.serverAnalysisCreateBtn.addEventListener("click", createSelectedNoteAnalysisJob);
  elements.serverAnalysisRefreshBtn.addEventListener("click", refreshServerAnalysisJobs);
  elements.serverAnalysisList.addEventListener("click", handleServerAnalysisListClick);
  elements.serverConflictList.addEventListener("click", handleServerConflictListClick);
  elements.groupMessengerBtn?.addEventListener("click", openGroupMessenger);
  elements.groupMessengerCloseBtn?.addEventListener("click", closeGroupMessenger);
  elements.groupMessengerRefreshBtn?.addEventListener("click", async () => {
    await refreshGroupMessages();
    await markGroupMessagesRead({ silent: true });
  });
  elements.groupMessengerNewRoomBtn?.addEventListener("click", createMessengerRoomFromPrompt);
  elements.groupMessengerAttachBtn?.addEventListener("click", () => elements.groupMessengerFileInput?.click());
  elements.groupMessengerFileInput?.addEventListener("change", handleMessengerAttachmentChange);
  elements.groupMessengerForm?.addEventListener("submit", sendGroupMessage);
  elements.groupMessengerList?.addEventListener("click", handleMessengerAttachmentClick);
  elements.deviceTokenIssueBtn?.addEventListener("click", issueDeviceToken);
  elements.webAccountMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleWebAccountMenu();
  });
  elements.webLogoutBtn?.addEventListener("click", handleWebLogout);

  window.addEventListener("online", () => {
    scheduleServerSync({ force: true, delay: 800 });
  });

  window.addEventListener("nownote:menu-command", (event) => {
    handleMenuCommand(event.detail);
  });

  window.addEventListener("storage", (event) => {
    if (!isHostedWebClient() || event.key !== WEB_LOGOUT_KEY) return;
    stopGroupMessengerAutoRefresh();
    clearWebSession();
    showWebLogin(t("web.login.ready"));
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleServerSync({ force: true, delay: 800 });
      refreshOpenGroupMessenger();
    }
  });

  elements.sidebarAssistToggle.addEventListener("change", () => {
    state.settings.showSidebarAssist = elements.sidebarAssistToggle.checked;
    persistSettings();
    applySettings();
  });

  elements.resetSettingsBtn.addEventListener("click", resetViewSettings);

  elements.addRootBtn.addEventListener("click", () => {
    addRootNote();
  });

  elements.toggleTreePanelBtn?.addEventListener("click", () => {
    state.settings.treePanelCollapsed = !state.settings.treePanelCollapsed;
    persistSettings();
    applySettings();
  });

  elements.expandAllBtn.addEventListener("click", () => {
    expandAllTreeNodes();
  });

  elements.collapseAllBtn.addEventListener("click", () => {
    state.expandedTreeIds.clear();
    renderTreeListOnly();
  });

  elements.emptyAddRootBtn.addEventListener("click", () => {
    addRootNote();
  });

  elements.treeTitleInput.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (isReadOnlyTreeNode(selected)) {
      elements.treeTitleInput.value = selected.title;
      return;
    }
    selected.title = elements.treeTitleInput.value;
    markTreeNodeChanged(selected);
    persist();
    renderTreeListOnly();
    renderOpenTreeTabs();
    renderSidebarKnowledge();
    renderTreePath(selected);
    renderNoteStats(selected);
    renderLinkPanel();
    if (!elements.graphView.classList.contains("hidden")) renderGraph();
    showSaved(elements.treeSavedLabel);
  });

  elements.treeContent.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (isReadOnlyTreeNode(selected)) {
      elements.treeContent.value = visibleContentForNode(selected);
      return;
    }
    syncTreeContentFromEditor();
  });
  elements.treeContent.addEventListener("keydown", handleTreeContentShortcut);

  elements.favoriteBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (isReadOnlyTreeNode(selected)) return;
    selected.favorite = !selected.favorite;
    markTreeNodeChanged(selected);
    persist();
    renderTree();
  });

  elements.shareTreeBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected || isReadOnlyTreeNode(selected) || isHostedWebClient()) return;
    const nextShared = selected.shared === false;
    selected.shared = nextShared;
    selected.unsharedAt = nextShared ? null : new Date().toISOString();
    if (nextShared || selected.serverShared === true) {
      markTreeNodeChanged(selected);
    } else {
      selected.updatedAt = new Date().toISOString();
      selected.syncState = "local";
    }
    persist();
    renderTree();
  });

  elements.copyLinkBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    copyNoteLink(selected);
  });

  elements.noteFindToggleBtn.addEventListener("click", toggleNoteFind);
  elements.noteFindInput.addEventListener("input", () => selectNoteFindMatch(0, { previewOnly: true }));
  elements.noteFindInput.addEventListener("keydown", handleNoteFindInputKey);
  elements.noteFindPrevBtn.addEventListener("click", () => moveNoteFindMatch(-1));
  elements.noteFindNextBtn.addEventListener("click", () => moveNoteFindMatch(1));
  elements.noteFindCloseBtn.addEventListener("click", closeNoteFind);
  elements.noteActionMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNoteActionMenu();
  });
  elements.noteActionMenu?.addEventListener("click", (event) => {
    if (event.target.closest("button")) closeNoteActionMenu();
  });
  elements.outlineToggleBtn.addEventListener("click", toggleOutlinePanel);
  elements.insertTimeBtn.addEventListener("click", insertCurrentTimeIntoTreeNote);
  elements.openDetectedLinkBtn?.addEventListener("click", openDetectedLinkFromEditor);
  elements.encryptNoteBtn?.addEventListener("click", encryptSelectedNote);
  elements.unlockNoteBtn?.addEventListener("click", unlockSelectedNote);
  elements.decryptNoteBtn?.addEventListener("click", decryptSelectedNote);
  elements.lockNoteBtn?.addEventListener("click", lockSelectedNote);
  elements.pinTabBtn.addEventListener("click", toggleSelectedTreeTabPin);
  elements.reopenClosedTabBtn.addEventListener("click", reopenClosedTreeTab);
  elements.closeOtherTabsBtn.addEventListener("click", closeOtherTreeTabs);
  elements.closeAllTabsBtn.addEventListener("click", closeAllTreeTabs);
  elements.moveUpBtn.addEventListener("click", () => moveSelectedTreeNode(-1));
  elements.moveDownBtn.addEventListener("click", () => moveSelectedTreeNode(1));

  elements.previewToggleBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    const isOpening = elements.markdownPreview.classList.contains("hidden");
    elements.markdownPreview.classList.toggle("hidden", !isOpening);
    elements.treeContent.classList.toggle("hidden", isOpening);
    elements.previewToggleBtn.textContent = isOpening ? t("editor.edit") : t("editor.preview");
    if (isOpening) {
      renderMarkdownPreview(visibleContentForNode(selected));
    } else {
      elements.treeContent.focus();
    }
  });

  elements.addChildBtn.addEventListener("click", addChildToSelectedTreeNode);

  elements.deleteTreeBtn.addEventListener("click", async () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (isReadOnlyTreeNode(selected)) return;
    if (selected.children.length > 0) {
      showNotice(t("note.nodeDelete.childrenBlocked"), "error");
      return;
    }
    if (!(await confirmAction(t("note.nodeDelete.toTrashConfirm", { title: noteTitle(selected.title) })))) return;
    if (!archiveDeletedTreeNode(selected.id)) return;
    state.selectedTreeId = null;
    persist();
    renderTree();
    renderDeletedTreeButton();
  });

  elements.deletedTreeBtn.addEventListener("click", toggleDeletedTreeBox);
  elements.deletedTreeCloseBtn.addEventListener("click", closeDeletedTreeBox);
  elements.deletedSelectAllBtn.addEventListener("click", toggleDeletedTreeSelection);
  elements.deletedBulkDeleteBtn.addEventListener("click", deleteSelectedTreeNodes);
  elements.deletedDeleteAllBtn.addEventListener("click", deleteAllArchivedTreeNodes);
  elements.exportBtn.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);
  elements.importMarkdownInput.addEventListener("change", importMarkdownData);
  elements.snapshotCreateBtn?.addEventListener("click", () => {
    createRecoverySnapshot("manual");
    persist();
    renderRecoveryPanel();
    showNotice(t("note.snapshotCreated"), "success");
  });
  elements.snapshotRestoreBtn?.addEventListener("click", restoreSelectedSnapshot);
  elements.snapshotSelect?.addEventListener("change", renderRecoveryPanel);
  elements.searchPopoverInput.addEventListener("input", () => {
    renderSearchPopoverResults();
  });
  ["pointerdown", "mousedown", "click"].forEach((eventName) => {
    elements.searchPopoverInput.addEventListener(eventName, (event) => {
      event.stopPropagation();
      focusSearchPopoverInput({ select: false });
    });
  });
  elements.searchPopoverInput.addEventListener("keydown", handleSearchPopoverInputKey);
  elements.searchScopeSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchSortSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchPopoverCloseBtn.addEventListener("click", closeSearchPopover);
  elements.quickInput.addEventListener("input", renderQuickResults);
  elements.quickInput.addEventListener("keydown", handleQuickInputKey);
  elements.quickCloseBtn.addEventListener("click", closeQuickSwitch);
  elements.commandPaletteInput?.addEventListener("input", renderCommandPalette);
  elements.commandPaletteInput?.addEventListener("keydown", handleCommandPaletteInputKey);
  elements.commandPaletteCloseBtn?.addEventListener("click", closeCommandPalette);
  elements.graphCloseBtn.addEventListener("click", closeGraph);
  elements.graphModeSelect.addEventListener("change", () => {
    state.settings.graph.mode = elements.graphModeSelect.value === "local" ? "local" : "global";
    persistSettings();
    renderGraph();
  });
  elements.graphDepthSelect.addEventListener("change", () => {
    state.settings.graph.depth = Math.min(3, Math.max(1, Number(elements.graphDepthSelect.value) || 2));
    persistSettings();
    renderGraph();
  });
  elements.graphTagSelect.addEventListener("change", () => {
    state.settings.graph.tag = elements.graphTagSelect.value;
    persistSettings();
    renderGraph();
  });
  elements.graphGroupSelect.addEventListener("change", () => {
    state.settings.graph.group = ["topic", "tag", "share", "analysis"].includes(elements.graphGroupSelect.value)
      ? elements.graphGroupSelect.value
      : "topic";
    persistSettings();
    renderGraph();
  });
  elements.graphFilterInput.addEventListener("input", () => {
    state.settings.graph.filter = elements.graphFilterInput.value.trim();
    persistSettings();
    renderGraph();
  });
  elements.graphBookmarkSaveBtn.addEventListener("click", saveGraphBookmark);
  elements.graphBookmarkSelect.addEventListener("change", applyGraphBookmark);
  const propertyInputs = [
    elements.propertyStatusSelect,
    elements.propertyPrioritySelect,
    elements.propertyTypeInput,
    elements.propertyProjectInput,
    elements.propertySourceInput,
    elements.propertyAuthorInput,
    elements.propertyDueInput,
  ];
  propertyInputs.forEach((input) => {
    input?.addEventListener("input", updateSelectedNoteProperties);
    input?.addEventListener("change", updateSelectedNoteProperties);
  });
  elements.propertiesBtn?.addEventListener("click", openPropertiesView);
  elements.propertiesCloseBtn?.addEventListener("click", closePropertiesView);
  elements.propertiesSearchInput?.addEventListener("input", () => {
    state.settings.properties.search = elements.propertiesSearchInput.value.trim();
    persistSettings();
    renderPropertiesView();
  });
  elements.propertiesStatusFilter?.addEventListener("change", () => {
    state.settings.properties.status = elements.propertiesStatusFilter.value;
    persistSettings();
    renderPropertiesView();
  });
  elements.propertiesPriorityFilter?.addEventListener("change", () => {
    state.settings.properties.priority = elements.propertiesPriorityFilter.value;
    persistSettings();
    renderPropertiesView();
  });
  elements.propertiesGroupSelect?.addEventListener("change", () => {
    state.settings.properties.group = propertyGroupKeys().includes(elements.propertiesGroupSelect.value)
      ? elements.propertiesGroupSelect.value
      : "status";
    persistSettings();
    renderPropertiesView();
  });
  elements.propertiesFilterSaveBtn?.addEventListener("click", savePropertyFilter);
  elements.propertiesSavedFilterSelect?.addEventListener("change", applyPropertyFilter);
  elements.propertyTemplateCreateBtn?.addEventListener("click", createNoteFromPropertyTemplate);
  elements.canvasBtn?.addEventListener("click", openCanvasView);
  elements.canvasCloseBtn?.addEventListener("click", closeCanvasView);
  elements.canvasTitleInput?.addEventListener("input", updateCanvasTitle);
  elements.canvasAddNoteBtn?.addEventListener("click", addSelectedNoteCanvasCard);
  elements.canvasAddTextBtn?.addEventListener("click", addTextCanvasCard);
  elements.canvasConnectBtn?.addEventListener("click", connectSelectedCanvasCards);
  elements.canvasDraftFromGraphBtn?.addEventListener("click", createCanvasDraftFromGraph);
  elements.canvasZoomOutBtn?.addEventListener("click", () => adjustCanvasZoom(-0.1));
  elements.canvasZoomInBtn?.addEventListener("click", () => adjustCanvasZoom(0.1));
  elements.canvasFitBtn?.addEventListener("click", fitCanvasView);
  elements.canvasMoveLeftBtn?.addEventListener("click", () => moveSelectedCanvasCard(-40, 0));
  elements.canvasMoveUpBtn?.addEventListener("click", () => moveSelectedCanvasCard(0, -40));
  elements.canvasMoveDownBtn?.addEventListener("click", () => moveSelectedCanvasCard(0, 40));
  elements.canvasMoveRightBtn?.addEventListener("click", () => moveSelectedCanvasCard(40, 0));
  elements.captureBtn?.addEventListener("click", openCaptureView);
  elements.captureCloseBtn?.addEventListener("click", closeCaptureView);
  elements.captureSaveBtn?.addEventListener("click", saveQuickCapture);
  elements.captureSketchClearBtn?.addEventListener("click", clearCaptureSketch);
  elements.captureAttachmentInput?.addEventListener("change", handleCaptureAttachmentChange);
  elements.captureFilterSelect?.addEventListener("change", renderCaptures);
  elements.captureSearchInput?.addEventListener("input", renderCaptures);
  bindOverlayDismiss(elements.quickSwitchView, closeQuickSwitch);
  bindOverlayDismiss(elements.commandPaletteView, closeCommandPalette);
  bindOverlayDismiss(elements.searchPopoverView, closeSearchPopover);
  bindOverlayDismiss(elements.graphView, closeGraph);
  bindOverlayDismiss(elements.propertiesView, closePropertiesView);
  bindOverlayDismiss(elements.canvasView, closeCanvasView);
  bindOverlayDismiss(elements.captureView, closeCaptureView);
  bindOverlayDismiss(elements.deletedTreeView, closeDeletedTreeBox);
  bindOverlayDismiss(elements.dailyView, closeDailyPopup);
  bindOverlayDismiss(elements.settingsView, closeSettingsPopup);
  elements.markdownPreview.addEventListener("click", (event) => {
    const taskInput = event.target.closest(".task-list-item input");
    if (taskInput) {
      toggleMarkdownTask(Number(taskInput.closest(".task-list-item").dataset.taskIndex));
      return;
    }
    const link = event.target.closest("[data-wiki-link]");
    if (!link) return;
    openWikiLink(link.dataset.wikiLink);
  });
  window.addEventListener("keydown", handleShortcuts);
  window.addEventListener("mousedown", (event) => {
    if (elements.webAccountMenu && !elements.webAccountMenu.classList.contains("hidden")) {
      const target = event.target;
      if (!elements.webAccountMenu.contains(target) && !elements.webAccountMenuBtn?.contains(target)) {
        closeWebAccountMenu();
      }
    }
    if (!state.capturingShortcutId) return;
    const editor = elements.shortcutEditor;
    if (editor && !editor.contains(event.target)) {
      cancelShortcutCapture();
    }
  });
  bindTreeResize();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applySettings();
  });
}

function bindOverlayDismiss(overlay, closeAction) {
  if (!overlay) return;
  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) return;
    closeAction();
  });
}

function closeSettingsPopup() {
  cancelShortcutCapture();
  elements.settingsView.classList.add("hidden");
}

function toggleSettings() {
  if (elements.settingsView.classList.contains("hidden")) {
    closePopupLayers();
    elements.settingsView.classList.remove("hidden");
  } else {
    elements.settingsView.classList.add("hidden");
  }
}

async function refreshDesktopStorageInfo() {
  if (!isDesktopClient()) {
    desktopStorageInfo = null;
    return;
  }
  try {
    desktopStorageInfo = await window.nownoteDesktop.storage.info();
  } catch {
    desktopStorageInfo = null;
  }
}

function renderDesktopStorageStatus() {
  if (!elements.desktopStorageRow) return;
  const visible = isDesktopClient() || isHostedWebClient();
  elements.desktopStorageRow.classList.toggle("hidden", !visible);
  if (!visible) return;
  if (isHostedWebClient()) {
    elements.desktopStorageStatus.textContent = t("settings.desktopStorage.web");
    elements.desktopStoragePath.textContent = "";
    return;
  }
  elements.desktopStorageStatus.textContent = desktopStorageInfo?.error
    ? t("settings.desktopStorage.error")
    : desktopStorageInfo
    ? t("settings.desktopStorage.ready")
    : t("settings.desktopStorage.unknown");
  const updatedText = desktopStorageInfo?.updatedAt
    ? ` · ${t("settings.desktopStorage.updated", { time: formatDateTime(desktopStorageInfo.updatedAt) })}`
    : "";
  elements.desktopStoragePath.textContent = `${desktopStorageInfo?.path || ""}${updatedText}`;
}

function renderSettings() {
  renderLanguageOptions();
  elements.languageSelect.value = state.settings.language;
  elements.themeSelect.value = state.settings.theme;
  elements.wideEditorToggle.checked = state.settings.wideEditor;
  elements.railModeSelect.value = state.settings.railMode;
  elements.editorActionIconsToggle.checked = state.settings.showEditorActionIcons;
  elements.fontSizeSelect.value = state.settings.fontSize;
  elements.lineHeightSelect.value = state.settings.lineHeight;
  elements.tabIndentSelect.value = String(state.settings.tabIndentSize);
  elements.backlinksToggle.checked = state.settings.showBacklinks;
  elements.tagsToggle.checked = state.settings.showTags;
  elements.shortcutsToggle.checked = state.settings.enableShortcuts;
  elements.sidebarAssistToggle.checked = state.settings.showSidebarAssist;
  renderServerSettings();
  renderDesktopStorageStatus();
  renderShortcutEditor();
  renderFeatureSettings();
  renderWorkspacePanel();
  elements.accentChoices.replaceChildren(
    ...ACCENTS.map((accent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "accent-btn";
      setIconLabel(button, localizeOrFallback(accent.labelKey, accent.label));
      button.style.setProperty("--accent-preview", accent.value);
      button.classList.toggle("active", accent.id === state.settings.accent);
      button.addEventListener("click", () => {
        state.settings.accent = accent.id;
        persistSettings();
        renderSettings();
        applySettings();
      });
      return button;
    }),
  );
}

function renderWorkspacePanel() {
  if (!elements.workspaceSelect || !elements.workspaceSummary || !elements.workspaceHealthList) return;
  state.settings.workspaces = normalizeWorkspaceSettings(state.settings.workspaces);
  const workspaces = state.settings.workspaces.items;
  const previousSelectedId = elements.workspaceSelect.value;
  elements.workspaceSelect.replaceChildren(
    optionElement("", t("settings.workspace.select")),
    ...workspaces.map((workspace) => optionElement(workspace.id, `${workspace.name} · ${formatDateTime(workspace.savedAt)}`)),
  );
  const selectedId = previousSelectedId || state.settings.workspaces.activeId || "";
  elements.workspaceSelect.value = workspaces.some((workspace) => workspace.id === selectedId) ? selectedId : "";
  const current = currentWorkspaceName() || t("settings.workspace.current");
  elements.workspaceSummary.textContent = workspaces.length
    ? t("settings.workspace.summary", { count: workspaces.length, current })
    : t("settings.workspace.empty");
  renderKnowledgeHealthPanel();
  renderCurrentExternalLinks();
}

function saveCurrentWorkspace() {
  const now = new Date().toISOString();
  const current = getSelectedTreeNode();
  const name = normalizeText(elements.workspaceNameInput.value).trim()
    || current?.title
    || `${t("settings.workspace.current")} ${new Date().toLocaleDateString(currentLocale())}`;
  const workspaces = normalizeWorkspaceSettings(state.settings.workspaces);
  const selectedId = elements.workspaceSelect.value;
  const id = selectedId || crypto.randomUUID();
  const workspace = {
    id,
    name: name.slice(0, 48),
    savedAt: now,
    state: currentWorkspaceState(),
  };
  workspaces.items = [workspace, ...workspaces.items.filter((item) => item.id !== id)].slice(0, 12);
  workspaces.activeId = id;
  state.settings.workspaces = workspaces;
  persistSettings();
  renderWorkspacePanel();
  showNotice(t("settings.workspace.saved"), "success");
}

function applySelectedWorkspace() {
  const workspaces = normalizeWorkspaceSettings(state.settings.workspaces);
  const workspace = workspaces.items.find((item) => item.id === elements.workspaceSelect.value);
  if (!workspace) return;
  applyWorkspaceState(workspace.state);
  workspaces.activeId = workspace.id;
  state.settings.workspaces = workspaces;
  persistSettings();
  applySettings();
  render();
  renderSettings();
  showNotice(t("settings.workspace.applied"), "success");
}

function currentWorkspaceName() {
  const workspaces = normalizeWorkspaceSettings(state.settings.workspaces);
  return workspaces.items.find((item) => item.id === workspaces.activeId)?.name || "";
}

function currentWorkspaceState() {
  return normalizeWorkspaceState({
    selectedTreeId: state.selectedTreeId || "",
    search: state.search || "",
    openTreeTabs: state.settings.openTreeTabs,
    pinnedTreeTabs: state.settings.pinnedTreeTabs,
    graph: state.settings.graph,
    properties: state.settings.properties,
    treePanelCollapsed: state.settings.treePanelCollapsed,
    sidebarCollapsed: state.settings.sidebarCollapsed,
    wideEditor: state.settings.wideEditor,
    treeListWidth: state.settings.treeListWidth,
  });
}

function applyWorkspaceState(workspaceState = {}) {
  const restored = normalizeWorkspaceState(workspaceState);
  const exists = (id) => Boolean(id && findTreeNode(state.data.tree, id));
  state.selectedTreeId = exists(restored.selectedTreeId) ? restored.selectedTreeId : firstTreeNodeId(state.data.tree);
  state.search = restored.search;
  state.settings.openTreeTabs = limitOpenTreeTabs(restored.openTreeTabs.filter(exists), 10, restored.pinnedTreeTabs);
  state.settings.pinnedTreeTabs = restored.pinnedTreeTabs.filter((id) => state.settings.openTreeTabs.includes(id));
  state.settings.graph = normalizeGraphSettings(restored.graph);
  state.settings.properties = normalizePropertyViewSettings(restored.properties);
  state.settings.treePanelCollapsed = restored.treePanelCollapsed;
  state.settings.sidebarCollapsed = restored.sidebarCollapsed;
  state.settings.wideEditor = restored.wideEditor;
  state.settings.treeListWidth = restored.treeListWidth;
  if (elements.searchInput) elements.searchInput.value = state.search;
}

function firstTreeNodeId(nodes = state.data.tree) {
  for (const node of nodes || []) {
    if (node?.id) return node.id;
    const childId = firstTreeNodeId(node?.children || []);
    if (childId) return childId;
  }
  return null;
}

function renderKnowledgeHealthPanel() {
  const report = knowledgeHealthReport();
  elements.workspaceHealthSummary.textContent = t("settings.workspace.health", report.summary);
  if (!report.items.length) {
    elements.workspaceHealthList.innerHTML = `<div class="empty-compact">${escapeHtml(t("settings.workspace.noHealth"))}</div>`;
    return;
  }
  elements.workspaceHealthList.replaceChildren(
    ...report.items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-health-item ${item.kind}`;
      button.innerHTML = `<span>${escapeHtml(item.label)}</span><strong>${escapeHtml(noteTitle(item.node.title))}</strong><small>${escapeHtml(item.reason)}</small>`;
      button.addEventListener("click", () => {
        selectTreeNode(item.node.id);
        closeSettingsPopup();
      });
      return button;
    }),
  );
}

function knowledgeHealthReport() {
  const nodes = flattenTree(state.data.tree).filter((node) => !node.deletedAt);
  const now = Date.now();
  const summary = { total: nodes.length, isolated: 0, stale: 0, hubs: 0, missing: 0 };
  const items = [];
  nodes.forEach((node) => {
    const contentNode = { ...node, content: visibleContentForNode(node) };
    const outgoing = outgoingLinksFor(contentNode);
    const backlinks = backlinksFor(node);
    const linkCount = outgoing.length + backlinks.length;
    const updatedTime = new Date(node.updatedAt || node.createdAt || 0).getTime();
    const stale = updatedTime && now - updatedTime > 1000 * 60 * 60 * 24 * 45;
    const properties = normalizeNoteProperties(node.properties);
    const missingProperties = ["status", "priority", "type", "project"].filter((key) => !properties[key]);
    if (linkCount === 0) {
      summary.isolated += 1;
      items.push({ kind: "isolated", label: t("settings.workspace.health.isolated"), reason: "연결 없음", node });
    }
    if (stale) {
      summary.stale += 1;
      items.push({ kind: "stale", label: t("settings.workspace.health.stale"), reason: relativeTime(node.updatedAt || node.createdAt), node });
    }
    if (linkCount >= 5) {
      summary.hubs += 1;
      items.push({ kind: "hub", label: t("settings.workspace.health.hub"), reason: `${linkCount} links`, node });
    }
    if (missingProperties.length >= 2) {
      summary.missing += 1;
      items.push({ kind: "missing", label: t("settings.workspace.health.missing"), reason: missingProperties.join(", "), node });
    }
  });
  return { summary, items: items.slice(0, 24) };
}

function renderCurrentExternalLinks() {
  if (!elements.workspaceExternalLinks) return;
  const selected = getSelectedTreeNode();
  const links = selected ? externalLinksForText(visibleContentForNode(selected)) : [];
  if (!links.length) {
    elements.workspaceExternalLinks.textContent = t("settings.workspace.links.none");
    return;
  }
  const title = document.createElement("strong");
  title.textContent = t("settings.workspace.links.title");
  const list = document.createElement("div");
  list.className = "workspace-link-list";
  links.forEach((link) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-link-item";
    button.textContent = link;
    button.addEventListener("click", () => window.open(link, "_blank", "noopener,noreferrer"));
    list.append(button);
  });
  elements.workspaceExternalLinks.replaceChildren(title, list);
}

function externalLinksForText(text) {
  const matches = String(text || "").match(/(?:https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi) || [];
  return Array.from(new Set(matches.map(normalizeDetectedLinkTarget))).slice(0, 12);
}

function renderLanguageOptions() {
  const selectedLanguage = normalizeLanguage(state.settings.language);
  elements.languageSelect.replaceChildren(
    ...SUPPORTED_LANGUAGES.map((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = LANGUAGES[id].label;
      option.selected = id === selectedLanguage;
      return option;
    })
  );
}

async function resetViewSettings() {
  if (!(await confirmAction(t("settings.resetConfirm")))) {
    return;
  }
  state.settings = defaultSettings();
  persistSettings();
  renderSettings();
  applySettings();
  renderTree();
  renderSidebarKnowledge();
}

function renderServerSettings() {
  const server = state.settings.server || defaultServerSettings();
  elements.serverModeSelect.value = server.mode;
  elements.serverUrlInput.value = server.url;
  elements.serverTokenInput.value = server.token;
  elements.serverUserTokenInput.value = server.userToken || "";
  elements.serverAutoSyncToggle.checked = server.autoSync !== false;
  elements.ownerIdInput.value = server.ownerId;
  elements.deviceIdInput.value = server.deviceId;
  const profile = normalizeServerUserProfile(server.userProfile);
  elements.serverDisplayNameInput.value = profile.displayName;
  elements.serverEmailInput.value = profile.email;
  elements.serverTimezoneInput.value = profile.timezone;
  renderServerGroupOptions(server, profile);
  const isServerMode = server.mode === "server";
  applyHostedServerSettingsVisibility();
  elements.serverTestBtn.disabled = !isServerMode;
  elements.serverSyncBtn.disabled = !isServerMode;
  elements.serverFullSyncBtn.disabled = !isServerMode;
  elements.serverAutoSyncToggle.disabled = !isServerMode;
  elements.serverProfileLoadBtn.disabled = !isServerMode;
  elements.serverProfileSaveBtn.disabled = !isServerMode;
  if (elements.serverGroupJoinBtn) elements.serverGroupJoinBtn.disabled = !isServerMode || !isHostedWebClient();
  elements.serverAnalysisCreateBtn.disabled = !isServerMode;
  elements.serverAnalysisRefreshBtn.disabled = !isServerMode;
  if (elements.serverAnalysisTypeSelect) elements.serverAnalysisTypeSelect.disabled = !isServerMode;
  renderServerStatus(server.lastStatus, server.lastMessage);
  renderServerMeta();
  renderServerCapabilities(server.capabilities, server.publicServerReadiness);
  renderServerAnalysisJobs(server.analysisJobs);
  renderServerConflicts(server.conflicts);
  renderServerProfileMeta(profile);
  renderServerGroupJoinMeta(profile);
}

function applyHostedServerSettingsVisibility() {
  const hosted = isHostedWebClient();
  const configNodes = Array.from(document.querySelectorAll(".desktop-server-only"));
  configNodes.forEach((node) => node?.classList.toggle("hidden", hosted));
  Array.from(document.querySelectorAll(".hosted-web-only"))
    .forEach((node) => node?.classList.toggle("hidden", !hosted));
  elements.webLogoutBtn?.classList.toggle("hidden", !hosted);
  if (!hosted) closeWebAccountMenu();
}

function renderDeviceTokenList(items = []) {
  if (!elements.deviceTokenOutput || !elements.deviceTokenText) return;
  const issued = items.filter((item) => item?.access_token);
  if (issued.length === 0) {
    elements.deviceTokenOutput.value = "";
    elements.deviceTokenText.textContent = t("settings.server.deviceToken.empty");
    return;
  }
  elements.deviceTokenOutput.value = issued.map((item) => t("settings.server.deviceToken.item", {
    name: item.display_name || t("settings.server.deviceToken.name"),
    device: item.device_id || "-",
    token: item.access_token,
  })).join("\n\n");
  elements.deviceTokenText.textContent = t("settings.server.deviceToken.help");
}

function saveServerSettingsFromForm(message = t("settings.server.saved"), messageKey = "settings.server.saved", messageParams = null) {
  const previous = state.settings.server || defaultServerSettings();
  if (isHostedWebClient()) {
    state.settings.server = {
      ...previous,
      mode: "server",
      url: defaultHostedServerUrl(),
      token: "",
      userToken: "",
      autoSync: true,
      ownerId: normalizeOwnerId(previous.ownerId),
      deviceId: previous.deviceId || "web-client",
      userProfile: {
        ...normalizeServerUserProfile(previous.userProfile),
        displayName: elements.serverDisplayNameInput.value.trim(),
        email: elements.serverEmailInput.value.trim(),
        timezone: elements.serverTimezoneInput.value.trim() || "Asia/Seoul",
      },
      lastStatus: "saved",
      lastMessage: message,
      lastMessageKey: messageKey,
      lastMessageParams: messageParams,
    };
    persistSettings();
    renderServerSettings();
    return;
  }
  const nextUrl = normalizeServerUrl(elements.serverUrlInput.value);
  const nextToken = elements.serverTokenInput.value.trim();
  const nextUserToken = elements.serverUserTokenInput.value.trim();
  const nextMode = elements.serverModeSelect.value === "server" ? "server" : "local";
  const connectionChanged = previous.mode !== nextMode
    || previous.url !== nextUrl
    || previous.token !== nextToken
    || previous.userToken !== nextUserToken;
  state.settings.server = {
    ...previous,
    mode: nextMode,
    url: nextUrl,
    token: nextToken,
    userToken: nextUserToken,
    autoSync: elements.serverAutoSyncToggle.checked,
    ownerId: normalizeOwnerId(elements.ownerIdInput.value),
    deviceId: elements.deviceIdInput.value.trim() || "web-desktop",
    userProfile: {
      ...normalizeServerUserProfile(previous.userProfile),
      displayName: elements.serverDisplayNameInput.value.trim(),
      email: elements.serverEmailInput.value.trim(),
      timezone: elements.serverTimezoneInput.value.trim() || "Asia/Seoul",
    },
    capabilities: connectionChanged ? null : previous.capabilities,
    publicServerReadiness: connectionChanged ? null : previous.publicServerReadiness,
    lastStatus: "saved",
    lastMessage: message,
    lastMessageKey: messageKey,
    lastMessageParams: messageParams,
  };
  persistSettings();
  renderServerSettings();
}

async function syncAllWebNotesToServer() {
  if (!(await confirmAction(t("settings.server.fullSyncConfirm")))) {
    return;
  }
  const server = state.settings.server || defaultServerSettings();
  server.lastSyncedAt = null;
  persistSettings();
  renderServerSettings();
  syncWebNotesToServer(t("settings.server.fullSyncing"), { messageKey: "settings.server.fullSyncing" });
}

function renderServerStatus(status, message) {
  const server = state.settings.server || defaultServerSettings();
  const fallback = server.mode === "server" ? t("settings.server.saved") : t("settings.server.local");
  const text = translatedServerStatusMessage(server, message) || fallback;
  elements.serverStatusText.textContent = text;
  elements.serverStatusText.classList.remove("ok", "warn", "bad");
  if (status === "ok") elements.serverStatusText.classList.add("ok");
  if (status === "saved" || status === "testing") elements.serverStatusText.classList.add("warn");
  if (status === "bad") elements.serverStatusText.classList.add("bad");
}

function translatedServerStatusMessage(server, message) {
  if (server.lastMessageKey) {
    return t(server.lastMessageKey, server.lastMessageParams || {});
  }
  const legacyKey = legacyServerMessageKey(message);
  if (legacyKey) return t(legacyKey);
  return message || "";
}

function legacyServerMessageKey(message) {
  const text = String(message || "").trim();
  const legacy = {
    "저장했습니다.": "settings.server.saved",
    "Saved.": "settings.server.saved",
    "서버 연결을 사용하지 않습니다.": "settings.server.local",
    "Server connection is disabled.": "settings.server.local",
    "서버 주소를 입력하세요.": "settings.server.noUrl",
    "Enter a server URL.": "settings.server.noUrl",
    "서버 연결 정상": "settings.server.ok",
    "Server connection is healthy": "settings.server.ok",
    "서버 동기화 완료": "settings.server.syncOk",
    "Server sync complete": "settings.server.syncOk",
    "동기화할 메모가 없습니다.": "settings.server.syncEmpty",
    "There are no notes to sync.": "settings.server.syncEmpty",
    "프로필을 불러왔습니다.": "settings.server.profile.loaded",
    "Profile loaded.": "settings.server.profile.loaded",
    "프로필을 저장했습니다.": "settings.server.profile.saved",
    "Profile saved.": "settings.server.profile.saved",
    "선택한 메모가 없습니다.": "settings.server.analysis.noNote",
    "No note is selected.": "settings.server.analysis.noNote",
    "분석할 메모 내용이 없습니다.": "settings.server.analysis.emptyNote",
    "There is no note content to analyze.": "settings.server.analysis.emptyNote",
    "분석 작업을 등록했습니다.": "settings.server.analysis.created",
    "Analysis job created.": "settings.server.analysis.created",
    "분석 작업을 불러왔습니다.": "settings.server.analysis.loaded",
    "Analysis jobs loaded.": "settings.server.analysis.loaded",
  };
  return legacy[text] || "";
}

function setServerMessage(server, status, key, params = null) {
  server.lastStatus = status;
  server.lastMessageKey = key;
  server.lastMessageParams = params;
  server.lastMessage = t(key, params || {});
}

function setServerRawMessage(server, status, message) {
  server.lastStatus = status;
  server.lastMessageKey = "";
  server.lastMessageParams = null;
  server.lastMessage = message;
}

function renderServerMeta() {
  const server = state.settings.server || defaultServerSettings();
  const pendingCount = countPendingSyncNotes();
  const lastSyncedAt = server.lastSyncedAt
    ? new Date(server.lastSyncedAt).toLocaleString(currentLocale())
    : t("settings.server.never");
  const autoSyncText = server.autoSync === false ? t("settings.server.autoSync.off") : t("settings.server.autoSync.on");
  elements.serverMetaText.textContent = `${t("settings.server.pendingMeta", { count: pendingCount, time: lastSyncedAt })} · ${autoSyncText}`;
  elements.serverMetaText.classList.toggle("has-pending", pendingCount > 0);
}

function renderServerCapabilities(capabilities, publicServerReadiness = null) {
  if (!elements.serverCapabilitiesText) return;
  const chips = [
    ...serverCapabilityLabels(capabilities),
    ...serverPublicReadinessLabels(publicServerReadiness),
  ].map((label) => {
    const chip = document.createElement("span");
    chip.className = "server-capability-chip";
    chip.textContent = label;
    return chip;
  });
  if (!chips.length) {
    elements.serverCapabilitiesText.textContent = t("settings.server.capabilities.none");
    return;
  }
  elements.serverCapabilitiesText.replaceChildren(...chips);
}

function renderServerConflicts(conflicts = []) {
  if (!elements.serverConflictBox || !elements.serverConflictList) return;
  const items = Array.isArray(conflicts) ? conflicts : [];
  elements.serverConflictBox.classList.toggle("hidden", items.length === 0);
  if (items.length === 0) {
    elements.serverConflictList.textContent = t("settings.server.conflict.none");
    return;
  }
  elements.serverConflictList.replaceChildren(...items.map(renderServerConflictItem));
}

function renderServerConflictItem(conflict) {
  const item = document.createElement("div");
  item.className = "server-conflict-item";
  const text = document.createElement("span");
  const type = conflict.encrypted ? t("settings.server.conflict.encrypted") : conflict.noteType;
  text.textContent = t("settings.server.conflict.item", {
    title: noteTitle(conflict.title),
    type,
    localTime: formatDateTime(conflict.localUpdatedAt),
    remoteTime: formatDateTime(conflict.remoteUpdatedAt),
  });
  const actions = document.createElement("div");
  actions.className = "server-conflict-actions";
  [
    ["keep-local", t("settings.server.conflict.keepLocal")],
    ["use-server", t("settings.server.conflict.useServer")],
    ["later", t("settings.server.conflict.later")],
  ].forEach(([action, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn";
    button.dataset.conflictAction = action;
    button.dataset.conflictId = conflict.id;
    button.textContent = label;
    actions.append(button);
  });
  item.append(text, actions);
  return item;
}

function serverCapabilityLabels(capabilities) {
  if (!capabilities || typeof capabilities !== "object") return [];
  const labels = [];
  if (capabilities.sync) labels.push(t("settings.server.capabilities.sync"));
  if (capabilities.recordings) labels.push(t("settings.server.capabilities.recordings"));
  if (capabilities.analysis_jobs) labels.push(t("settings.server.capabilities.analysis"));
  if (capabilities.admin_ops) labels.push(t("settings.server.capabilities.admin"));
  if (capabilities.backup_export) labels.push(t("settings.server.capabilities.backup"));
  if (capabilities.backup_verify) labels.push(t("settings.server.capabilities.backupVerify"));
  if (capabilities.user_accounts || capabilities.user_profile) labels.push(t("settings.server.capabilities.users"));
  if (capabilities.user_timezone) labels.push(t("settings.server.capabilities.userTimezone"));
  if (capabilities.user_groups) labels.push(t("settings.server.capabilities.userGroups"));
  if (capabilities.two_factor_status) labels.push(t("settings.server.capabilities.twoFactorStatus"));
  if (capabilities.two_factor_auth === "token_code") labels.push(t("settings.server.capabilities.twoFactorReady"));
  if (capabilities.two_factor_auth === "planned") labels.push(t("settings.server.capabilities.twoFactorPlanned"));
  if (capabilities.user_access_tokens || capabilities.user_token_required) labels.push(t("settings.server.capabilities.userTokenRequired"));
  if (capabilities.max_tree_note_level) {
    labels.push(t("settings.server.capabilities.treeLevel", { level: capabilities.max_tree_note_level }));
  }
  return labels;
}

function serverPublicReadinessLabels(readiness) {
  if (!readiness || typeof readiness !== "object") return [];
  if (readiness.status === "ready") return [t("settings.server.publicReadiness.ready")];
  if (readiness.status === "planned") {
    const remaining = Array.isArray(readiness.remaining) ? readiness.remaining.length : 0;
    return [t("settings.server.publicReadiness.planned", { count: remaining })];
  }
  return [];
}

function renderServerProfileMeta(profile = normalizeServerUserProfile()) {
  const loaded = profile.loadedAt || profile.groupName || profile.lastSeenAt;
  if (!loaded) {
    elements.serverProfileText.textContent = t("settings.server.profile.none");
    return;
  }
  const twoFactor = profile.twoFactorEnabled
    ? t("settings.server.profile.twoFactorOn")
    : t("settings.server.profile.twoFactorOff");
  const active = profile.isActive
    ? t("settings.server.profile.active")
    : t("settings.server.profile.inactive");
  const lastSeen = profile.lastSeenAt
    ? parseServerDate(profile.lastSeenAt).toLocaleString(currentLocale())
    : t("settings.server.profile.lastSeenNone");
  elements.serverProfileText.textContent = t("settings.server.profile.summary", {
    group: profile.groupName || "-",
    twoFactor,
    active,
    lastSeen,
  });
}

function renderServerGroupJoinMeta(profile = normalizeServerUserProfile()) {
  if (!elements.serverGroupJoinText) return;
  const groups = normalizeServerGroups(state.settings.server?.userGroups);
  const groupCountText = groups.length ? ` · ${t("settings.server.profile.groupJoin.count", { count: groups.length })}` : "";
  elements.serverGroupJoinText.textContent = t("settings.server.profile.groupJoin.current", {
    group: profile.groupName || "-",
  }) + groupCountText;
}

function renderServerGroupOptions(server, profile = normalizeServerUserProfile()) {
  if (!elements.serverGroupNameInput) return;
  const groups = normalizeServerGroups(server.userGroups);
  const currentGroup = profile.groupName || "";
  const groupNames = new Set(groups.map((group) => group.name));
  const options = [];
  if (currentGroup && !groupNames.has(currentGroup)) {
    options.push(optionElement(currentGroup, currentGroup));
  }
  options.push(...groups.map((group) => {
    const suffix = group.description ? ` · ${group.description}` : "";
    return optionElement(group.name, `${group.name}${suffix}`);
  }));
  if (!options.length) {
    options.push(optionElement(currentGroup || "", currentGroup || t("settings.server.profile.groupJoin.noGroups")));
  }
  elements.serverGroupNameInput.replaceChildren(...options);
  elements.serverGroupNameInput.value = currentGroup && options.some((option) => option.value === currentGroup)
    ? currentGroup
    : (options[0]?.value || "");
}

function renderServerAnalysisJobs(jobs = []) {
  if (!elements.serverAnalysisList) return;
  const rows = Array.isArray(jobs) ? jobs.slice(0, 5) : [];
  if (!rows.length) {
    elements.serverAnalysisList.textContent = t("settings.server.analysis.none");
    return;
  }
  elements.serverAnalysisList.replaceChildren(
    ...rows.map((job) => {
      const item = document.createElement("div");
      item.className = "server-analysis-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      const time = job.updated_at || job.created_at || "";
      title.textContent = t("settings.server.analysis.item", {
        id: job.id || "-",
        type: serverAnalysisJobLabel(job.job_type),
        time: formatServerJobTime(time),
      });
      const note = document.createElement("span");
      note.textContent = job.note_local_id || "-";
      info.append(title, note);
      const status = document.createElement("span");
      status.className = `server-analysis-status ${job.status || ""}`;
      status.textContent = job.status || "-";
      const side = document.createElement("div");
      side.className = "server-analysis-side";
      side.append(status);
      const resultText = extractServerAnalysisResultText(job.result_json);
      if (job.note_local_id && resultText) {
        const applyButton = document.createElement("button");
        applyButton.className = "server-analysis-apply";
        applyButton.type = "button";
        applyButton.dataset.analysisAction = "append";
        applyButton.dataset.analysisId = String(job.id);
        applyButton.textContent = t("settings.server.analysis.apply");
        side.append(applyButton);
      }
      if (job.status === "done" && resultText) {
        const approveButton = document.createElement("button");
        approveButton.className = "server-analysis-apply";
        approveButton.type = "button";
        approveButton.dataset.analysisAction = "approve";
        approveButton.dataset.analysisId = String(job.id);
        approveButton.textContent = t("settings.server.analysis.approve");
        side.append(approveButton);
        const rejectButton = document.createElement("button");
        rejectButton.className = "server-analysis-apply";
        rejectButton.type = "button";
        rejectButton.dataset.analysisAction = "reject";
        rejectButton.dataset.analysisId = String(job.id);
        rejectButton.textContent = t("settings.server.analysis.reject");
        side.append(rejectButton);
      }
      if (["failed", "cancelled", "done"].includes(job.status)) {
        const retryButton = document.createElement("button");
        retryButton.className = "server-analysis-apply";
        retryButton.type = "button";
        retryButton.dataset.analysisAction = "retry";
        retryButton.dataset.analysisId = String(job.id);
        retryButton.textContent = t("settings.server.analysis.retry");
        side.append(retryButton);
      }
      if (["queued", "running"].includes(job.status)) {
        const cancelButton = document.createElement("button");
        cancelButton.className = "server-analysis-apply";
        cancelButton.type = "button";
        cancelButton.dataset.analysisAction = "cancel";
        cancelButton.dataset.analysisId = String(job.id);
        cancelButton.textContent = t("settings.server.analysis.cancel");
        side.append(cancelButton);
      }
      item.append(info, side);
      const previewText = getServerAnalysisPreview(job);
      if (previewText) {
        const preview = document.createElement("div");
        preview.className = "server-analysis-preview";
        preview.textContent = previewText;
        item.append(preview);
      }
      return item;
    }),
  );
}

function handleServerAnalysisListClick(event) {
  const button = event.target.closest("[data-analysis-action]");
  if (!button) return;
  const action = button.dataset.analysisAction;
  const id = Number(button.dataset.analysisId);
  const job = (state.settings.server.analysisJobs || []).find((item) => Number(item.id) === id);
  if (!job) return;
  if (action === "append") appendAnalysisResultToNote(job);
  if (action === "approve") approveAnalysisResult(job);
  if (action === "reject") rejectAnalysisResult(job);
  if (action === "retry") retryAnalysisJob(job);
  if (action === "cancel") cancelAnalysisJob(job);
}

function handleServerConflictListClick(event) {
  const button = event.target.closest("[data-conflict-action]");
  if (!button) return;
  const action = button.dataset.conflictAction;
  const conflictId = button.dataset.conflictId;
  if (action === "later") return;
  if (action === "keep-local") {
    removeServerConflict(conflictId);
    persistSettings();
    renderServerSettings();
    scheduleServerSync({ force: true, delay: 800 });
    return;
  }
  if (action === "use-server") {
    applyServerConflictRemote(conflictId);
  }
}

function appendAnalysisResultToNote(job) {
  const node = findTreeNode(state.data.tree, job.note_local_id);
  const resultText = extractServerAnalysisResultText(job.result_json);
  if (!node || !resultText) {
    setServerMessage(state.settings.server, "bad", "settings.server.analysis.applyMissing");
    persistSettings();
    renderServerSettings();
    return;
  }

  const time = formatServerJobTime(job.updated_at || job.created_at || new Date().toISOString());
  const section = [
    `## ${t("settings.server.analysis.sectionTitle")}`,
    "",
    `- ${t("settings.server.analysis.item", {
      id: job.id || "-",
      type: job.job_type || "-",
      time,
    })}`,
    "",
    resultText,
  ].join("\n");

  node.content = [node.content || "", section].filter((part) => part.trim()).join("\n\n");
  node.tags = extractTags(node.content);
  markTreeNodeChanged(node);
  state.selectedTreeId = node.id;
  setServerMessage(state.settings.server, "ok", "settings.server.analysis.applied");
  persist();
  renderTree();
  renderServerSettings();
  showSaved(elements.treeSavedLabel);
}

function approveAnalysisResult(job) {
  const resultText = extractServerAnalysisResultText(job.result_json);
  if (!resultText) {
    setServerMessage(state.settings.server, "bad", "settings.server.analysis.applyMissing");
    persistSettings();
    renderServerSettings();
    return;
  }
  createRecoverySnapshot("before-analysis-approval");
  const node = job.note_local_id
    ? findTreeNode(state.data.tree, job.note_local_id)
    : null;
  if (node) {
    appendAnalysisResultToNote(job);
    return;
  }
  const title = `${t("settings.server.analysis.approvalSectionTitle")} ${formatServerJobTime(job.updated_at || job.created_at || new Date().toISOString())}`;
  const content = [
    `# ${title}`,
    "",
    resultText,
  ].join("\n");
  const created = createNode(title, content, null, 1);
  created.tags = extractTags(content);
  state.data.tree.unshift(created);
  state.selectedTreeId = created.id;
  setServerMessage(state.settings.server, "ok", "settings.server.analysis.applied");
  persist();
  persistSettings();
  renderTree();
  renderServerSettings();
  showSaved(elements.treeSavedLabel);
}

async function rejectAnalysisResult(job) {
  await updateAnalysisJob(job, {
    status: "cancelled",
    result_json: job.result_json || null,
    error_message: "rejected by user",
  }, "settings.server.analysis.rejected");
}

async function retryAnalysisJob(job) {
  await analysisJobCommand(job, "retry", "settings.server.analysis.retried");
}

async function cancelAnalysisJob(job) {
  await analysisJobCommand(job, "cancel", "settings.server.analysis.cancelled");
}

async function analysisJobCommand(job, command, messageKey) {
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;
  try {
    const updated = await requestServerJson(server, `/api/v1/analysis/jobs/${job.id}/${command}`, {
      method: "POST",
    });
    replaceServerAnalysisJob(updated);
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", messageKey);
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

async function updateAnalysisJob(job, payload, messageKey) {
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;
  try {
    const updated = await requestServerJson(server, `/api/v1/analysis/jobs/${job.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    replaceServerAnalysisJob(updated);
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", messageKey);
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

function replaceServerAnalysisJob(updated) {
  const jobs = Array.isArray(state.settings.server.analysisJobs)
    ? state.settings.server.analysisJobs.slice()
    : [];
  const index = jobs.findIndex((job) => Number(job.id) === Number(updated.id));
  if (index >= 0) jobs[index] = updated;
  else jobs.unshift(updated);
  state.settings.server.analysisJobs = jobs.slice(0, 5);
}

function getServerAnalysisPreview(job) {
  if (job.status === "failed" && job.error_message) {
    return t("settings.server.analysis.errorPreview", { text: compactText(job.error_message, 160) });
  }
  const resultText = extractServerAnalysisResultText(job.result_json);
  if (resultText) {
    return t("settings.server.analysis.resultPreview", { text: compactText(resultText, 180) });
  }
  if (job.status === "done") return t("settings.server.analysis.doneNoResult");
  if (job.input_text) {
    return t("settings.server.analysis.inputPreview", { text: compactText(job.input_text, 140) });
  }
  return "";
}

function extractServerAnalysisResultText(resultJson) {
  if (!resultJson) return "";
  try {
    const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.summary === "string") return parsed.summary;
    if (parsed && Array.isArray(parsed.suggestions) && parsed.suggestions.length) {
      return parsed.suggestions
        .map((item) => [item.title, item.preview].filter(Boolean).join(": "))
        .filter(Boolean)
        .slice(0, 8)
        .join("\n");
    }
    if (parsed && Array.isArray(parsed.logs) && parsed.logs.length) {
      return parsed.logs.filter(Boolean).join("\n");
    }
    if (parsed && Array.isArray(parsed.keywords) && parsed.keywords.length) {
      return parsed.keywords.filter(Boolean).join(", ");
    }
    if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
  } catch (_) {
    return String(resultJson);
  }
  return "";
}

function serverAnalysisJobLabel(jobType) {
  const key = `settings.server.analysis.job.${jobType}`;
  return I18N.ko[key] || I18N.en[key] ? t(key) : jobType || "-";
}

function compactText(value, maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatServerJobTime(value) {
  if (!value) return "-";
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(currentLocale());
}

function countPendingSyncNotes() {
  return [
    ...Object.values(state.data.daily),
    ...state.data.archivedDaily,
  ].filter((item) => item?.syncState === "pending").length
    + flattenTree(state.data.tree).filter(shouldCountPendingTreeSync).length;
}

async function testServerConnection() {
  saveServerSettingsFromForm(t("settings.server.testing"), "settings.server.testing");
  const server = state.settings.server;
  if (server.mode !== "server") {
    setServerMessage(server, "idle", "settings.server.local");
    persistSettings();
    renderServerSettings();
    return;
  }
  if (!server.url) {
    setServerMessage(server, "bad", "settings.server.noUrl");
    persistSettings();
    renderServerSettings();
    return;
  }

  renderServerStatus("testing", t("settings.server.testing"));
  try {
    const response = await fetch(`${server.url}/api/v1/server`, {
      headers: serverAuthHeaders(server),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    const serverName = payload.server || "NowNote";
    const apiVersion = payload.api_version ? ` · API ${payload.api_version}` : "";
    server.lastCheckedAt = new Date().toISOString();
    server.capabilities = payload.capabilities || null;
    server.publicServerReadiness = payload.public_server_readiness || null;
    let tokenMessage = "";
    if ((server.webSessionToken || "").trim()) {
      const sessionPayload = await verifyWebSession();
      applyServerUserProfile(sessionPayload.user);
      await loadServerGroupOptions({ silent: true });
      tokenMessage = ` · ${t("web.login.ok")}`;
    } else if ((server.userToken || "").trim()) {
      const tokenPayload = await verifyServerUserToken(server);
      applyServerUserProfile(tokenPayload.user);
      tokenMessage = ` · ${t("settings.server.userTokenOk")}`;
    }
    setServerRawMessage(server, "ok", `${t("settings.server.ok")}: ${serverName}${apiVersion}${tokenMessage}`);
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    server.capabilities = null;
    server.publicServerReadiness = null;
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

async function verifyServerUserToken(server) {
  const twoFactorCode = elements.serverTwoFactorCodeInput?.value.trim() || "";
  const body = {
    owner_id: normalizeOwnerId(server.ownerId),
    access_token: server.userToken,
    ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
  };
  const response = await fetch(`${server.url}/api/v1/auth/token-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await serverResponseError(response));
  return response.json();
}

async function verifyWebSession() {
  const server = state.settings.server;
  const ownerId = normalizeOwnerId(server.ownerId);
  const payload = await requestServerJson(
    server,
    `/api/v1/auth/web-session?owner_id=${encodeURIComponent(ownerId)}`,
  );
  applyServerUserProfile(payload.user);
  return payload;
}

async function loadServerSharedNotes({ replace = false, message = t("settings.server.syncing") } = {}) {
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;
  renderServerStatus("testing", message);
  const payload = await requestServerJson(server, "/api/v1/sync", {
    method: "POST",
    body: JSON.stringify({
      owner_id: normalizeOwnerId(server.ownerId),
      device_id: server.deviceId || "web-client",
      updated_after: null,
      include_deleted: true,
      notes: [],
    }),
  });
  hostedWebSyncSuspended = true;
  try {
    if (replace) {
      state.data = defaultData();
      state.selectedTreeId = null;
      state.expandedTreeIds.clear();
      state.selectedDeletedTreeIds.clear();
    }
    const mergeResult = applyPulledServerNotes(payload.pulled_notes || []);
    markServerSyncedNotes();
    server.lastCheckedAt = new Date().toISOString();
    server.lastSyncedAt = payload.server_time || server.lastCheckedAt;
    setServerMessage(server, "ok", "settings.server.syncOk");
    persist();
    persistSettings();
    render();
    renderServerSettings();
    return mergeResult;
  } finally {
    hostedWebSyncSuspended = false;
  }
}

async function loadServerUserProfile() {
  saveServerSettingsFromForm(t("settings.server.profile.loading"), "settings.server.profile.loading");
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  renderServerStatus("testing", t("settings.server.profile.loading"));
  try {
    const payload = await requestServerJson(
      server,
      `/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    applyServerUserProfile(payload.user);
    await loadServerGroupOptions({ silent: true });
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", "settings.server.profile.loaded");
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

async function loadServerGroupOptions({ silent = false } = {}) {
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  try {
    const payload = await requestServerJson(
      server,
      `/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}/groups`,
    );
    server.userGroups = normalizeServerGroups(payload.items);
    persistSettings();
    renderServerSettings();
  } catch (error) {
    if (!silent) showNotice(`${t("settings.server.fail")}: ${error.message}`, "error");
  }
}

async function saveServerUserProfile() {
  saveServerSettingsFromForm(t("settings.server.profile.saving"), "settings.server.profile.saving");
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  const path = `/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}`;
  const data = {
    email: blankToNull(elements.serverEmailInput.value),
    display_name: blankToNull(elements.serverDisplayNameInput.value),
    timezone: elements.serverTimezoneInput.value.trim() || "Asia/Seoul",
  };
  renderServerStatus("testing", t("settings.server.profile.saving"));
  try {
    let payload = await requestServerJson(server, path, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    applyServerUserProfile(payload.user);
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", "settings.server.profile.saved");
  } catch (error) {
    if (!String(error.message).includes("404")) {
      server.lastCheckedAt = new Date().toISOString();
      setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
      persistSettings();
      renderServerSettings();
      return;
    }
    try {
      await requestServerJson(server, path);
      const payload = await requestServerJson(server, path, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      applyServerUserProfile(payload.user);
      server.lastCheckedAt = new Date().toISOString();
      setServerMessage(server, "ok", "settings.server.profile.saved");
    } catch (retryError) {
      server.lastCheckedAt = new Date().toISOString();
      setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${retryError.message}`);
    }
  }
  persistSettings();
  renderServerSettings();
}

async function joinServerGroupByInvite() {
  const groupName = elements.serverGroupNameInput?.value.trim() || "";
  const inviteCode = elements.serverGroupInviteCodeInput?.value.trim() || "";
  saveServerSettingsFromForm(t("settings.server.profile.groupJoin.joining"), "settings.server.profile.groupJoin.joining");
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  if (!groupName || !inviteCode) {
    setServerMessage(server, "bad", "settings.server.profile.groupJoin.empty");
    persistSettings();
    renderServerSettings();
    return;
  }

  const path = `/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}/group-join`;
  renderServerStatus("testing", t("settings.server.profile.groupJoin.joining"));
  if (elements.serverGroupJoinBtn) elements.serverGroupJoinBtn.disabled = true;
  try {
    const payload = await requestServerJson(server, path, {
      method: "POST",
      body: JSON.stringify({
        group_name: groupName,
        invite_code: inviteCode,
      }),
    });
    applyServerUserProfile(payload.user);
    await loadServerGroupOptions({ silent: true });
    if (elements.serverGroupInviteCodeInput) elements.serverGroupInviteCodeInput.value = "";
    server.groupMessages = [];
    server.groupMessengerUnreadCount = 0;
    server.groupMessengerLastReadId = 0;
    server.groupMessagesLoadedAt = null;
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", "settings.server.profile.groupJoin.joined");
    persistSettings();
    renderServerSettings();
    if (isHostedWebClient()) {
      await loadServerSharedNotes({ replace: true }).catch((error) => {
        showNotice(`${t("settings.server.fail")}: ${error.message}`, "error");
      });
      await refreshGroupMessages({ silent: true });
    }
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
    persistSettings();
    renderServerSettings();
  } finally {
    if (elements.serverGroupJoinBtn) elements.serverGroupJoinBtn.disabled = server.mode !== "server" || !isHostedWebClient();
  }
}

function buildKnowledgeAnalysisPayload(jobType = "knowledge_2_0_review") {
  const notes = flattenTree(state.data.tree)
    .filter((node) => !isEncryptedContent(node.content) && node.status !== "deleted")
    .slice(0, 300)
    .map((node) => ({
      id: node.id,
      title: node.title || "",
      content: node.content || "",
      tags: Array.isArray(node.tags) ? node.tags.join(" ") : String(node.tags || ""),
      level: node.level || 1,
      parentId: node.parentId || null,
      properties: node.properties || {},
    }))
    .filter((node) => `${node.title}\n${node.content}`.trim());
  if (!notes.length) return "";
  return JSON.stringify({
    version: "2.0",
    jobType,
    createdAt: new Date().toISOString(),
    notes,
  });
}

async function createSelectedNoteAnalysisJob() {
  saveServerSettingsFromForm(t("settings.server.analysis.creating"), "settings.server.analysis.creating");
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  const selected = getSelectedTreeNode();
  const jobType = elements.serverAnalysisTypeSelect?.value || "memo_summary";
  const requiresSelectedNote = jobType === "memo_summary" || jobType === "tree_note_index";
  if (requiresSelectedNote && !selected) {
    setServerMessage(server, "bad", "settings.server.analysis.noNote");
    persistSettings();
    renderServerSettings();
    return;
  }
  if (requiresSelectedNote && isEncryptedContent(selected.content)) {
    setServerMessage(server, "bad", "settings.server.analysis.encryptedNote");
    persistSettings();
    renderServerSettings();
    return;
  }
  const inputText = requiresSelectedNote
    ? `${selected.title || ""}\n\n${selected.content || ""}`.trim()
    : buildKnowledgeAnalysisPayload(jobType);
  if (!inputText) {
    setServerMessage(
      server,
      "bad",
      requiresSelectedNote ? "settings.server.analysis.emptyNote" : "settings.server.analysis.noKnowledgeNotes",
    );
    persistSettings();
    renderServerSettings();
    return;
  }

  renderServerStatus("testing", t("settings.server.analysis.creating"));
  try {
    const job = await requestServerJson(server, "/api/v1/analysis/jobs", {
      method: "POST",
      body: JSON.stringify({
        owner_id: normalizeOwnerId(server.ownerId),
        job_type: jobType,
        note_local_id: requiresSelectedNote ? selected.id : null,
        input_text: inputText,
      }),
    });
    server.analysisJobs = [job, ...(server.analysisJobs || [])].slice(0, 5);
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", "settings.server.analysis.created");
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

async function refreshServerAnalysisJobs() {
  saveServerSettingsFromForm(t("settings.server.analysis.loading"), "settings.server.analysis.loading");
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  renderServerStatus("testing", t("settings.server.analysis.loading"));
  try {
    const jobs = await requestServerJson(
      server,
      `/api/v1/analysis/jobs?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    server.analysisJobs = Array.isArray(jobs) ? jobs.slice(0, 5) : [];
    server.lastCheckedAt = new Date().toISOString();
    setServerMessage(server, "ok", "settings.server.analysis.loaded");
  } catch (error) {
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  }
  persistSettings();
  renderServerSettings();
}

async function refreshDeviceTokens({ silent = false } = {}) {
  if (!isHostedWebClient()) return;
  const server = state.settings.server || defaultServerSettings();
  if (!server.webSessionToken) return;
  if (!silent) elements.deviceTokenText.textContent = t("settings.server.deviceToken.loading");
  try {
    const response = await fetch(
      `${server.url}/api/v1/auth/device-tokens?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
      { headers: serverAuthHeaders(server) },
    );
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    renderDeviceTokenList(payload.items || []);
    if (!silent && elements.deviceTokenText.textContent !== t("settings.server.deviceToken.empty")) {
      elements.deviceTokenText.textContent = t("settings.server.deviceToken.loaded");
    }
  } catch (error) {
    elements.deviceTokenText.textContent = `${t("settings.server.fail")}: ${error.message}`;
  }
}

async function issueDeviceToken() {
  if (!isHostedWebClient()) return;
  const server = state.settings.server || defaultServerSettings();
  if (!server.webSessionToken) return;
  const deviceName = elements.deviceTokenNameInput.value.trim() || "NowNote";
  const deviceId = normalizeDeviceId(
    elements.deviceTokenIdInput.value.trim()
    || `desktop_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`,
  );
  elements.deviceTokenIssueBtn.disabled = true;
  elements.deviceTokenText.textContent = t("settings.server.deviceToken.issuing");
  try {
    const response = await fetch(`${server.url}/api/v1/auth/device-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...serverAuthHeaders(server),
      },
      body: JSON.stringify({
        owner_id: normalizeOwnerId(server.ownerId),
        device_id: deviceId,
        device_name: deviceName,
      }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    elements.deviceTokenIdInput.value = payload.device_id || deviceId;
    renderDeviceTokenList([{
      display_name: deviceName,
      device_id: payload.device_id || deviceId,
      access_token: payload.access_token,
    }]);
    elements.deviceTokenText.textContent = t("settings.server.deviceToken.issued");
    await refreshDeviceTokens({ silent: true });
  } catch (error) {
    elements.deviceTokenText.textContent = `${t("settings.server.fail")}: ${error.message}`;
  } finally {
    elements.deviceTokenIssueBtn.disabled = false;
  }
}

async function syncWebNotesToServer(message = t("settings.server.syncing"), options = {}) {
  if (serverSyncRunning) {
    serverSyncQueued = true;
    return;
  }
  serverSyncRunning = true;
  try {
    if (!options.skipFormSave) {
      saveServerSettingsFromForm(message, options.messageKey || (message === t("settings.server.syncing") ? "settings.server.syncing" : ""));
    }
    const server = state.settings.server;
    if (server.mode !== "server") {
      setServerMessage(server, "idle", "settings.server.local");
      persistSettings();
      renderServerSettings();
      return;
    }
    if (!server.url) {
      setServerMessage(server, "bad", "settings.server.noUrl");
      persistSettings();
      renderServerSettings();
      return;
    }

    const notes = buildServerSyncNotes(server);
    renderServerStatus("testing", message);
    const response = await fetch(`${server.url}/api/v1/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...serverAuthHeaders(server),
      },
      body: JSON.stringify({
        owner_id: normalizeOwnerId(server.ownerId),
        device_id: server.deviceId,
        updated_after: server.lastSyncedAt,
        include_deleted: true,
        notes,
      }),
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    const serverAcceptedNotes = [
      ...(payload.pushed_notes || []),
      ...(payload.pulled_notes || []),
    ];
    const mergeResult = applyPulledServerNotes(serverAcceptedNotes);
    const pushedCount = payload.pushed_notes?.length || 0;
    const pulledCount = (payload.pulled_notes || []).length;
    markServerSyncedNotes(payload.pushed_notes || []);
    server.lastCheckedAt = new Date().toISOString();
    server.lastSyncedAt = payload.server_time || server.lastCheckedAt;
    if (notes.length === 0 && pushedCount === 0 && pulledCount === 0 && mergeResult.applied === 0) {
      setServerMessage(server, "ok", "settings.server.syncEmpty");
    } else {
      const syncSummary = t("note.syncMessage", { sent: pushedCount, received: mergeResult.applied });
      setServerRawMessage(server, "ok", `${t("settings.server.syncOk")}: ${syncSummary}${mergeResult.skipped ? `, ${t("settings.server.mergeSkippedCount", { count: mergeResult.skipped })}` : ""}`);
    }
    persist();
    render();
    renderServerMeta();
  } catch (error) {
    const server = state.settings.server;
    server.lastCheckedAt = new Date().toISOString();
    setServerRawMessage(server, "bad", `${t("settings.server.fail")}: ${error.message}`);
  } finally {
    persistSettings();
    renderServerSettings();
    serverSyncRunning = false;
    if (serverSyncQueued) {
      serverSyncQueued = false;
      scheduleServerSync({ force: true, delay: 800 });
    }
  }
}

function prepareServerRequest(server) {
  if (isHostedWebClient() && !server.webSessionToken) {
    showWebLogin(t("web.login.ready"));
    return false;
  }
  if (server.mode !== "server") {
    setServerMessage(server, "idle", "settings.server.local");
    persistSettings();
    renderServerSettings();
    return false;
  }
  if (!server.url) {
    setServerMessage(server, "bad", "settings.server.noUrl");
    persistSettings();
    renderServerSettings();
    return false;
  }
  return true;
}

async function requestServerJson(server, path, options = {}) {
  const response = await fetch(`${server.url}${path}`, {
    ...options,
    headers: {
      ...(options.body && !options.skipJsonContentType ? { "Content-Type": "application/json" } : {}),
      ...serverAuthHeaders(server),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(await serverResponseError(response));
  return response.json();
}

function serverAuthHeaders(server) {
  return {
    ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}),
    ...(server.userToken ? { "X-Now-User-Token": server.userToken } : {}),
    ...(server.webSessionToken ? { "X-Now-Web-Session": server.webSessionToken } : {}),
  };
}

function applyServerUserProfile(user) {
  const server = state.settings.server || defaultServerSettings();
  server.userProfile = normalizeServerUserProfile({
    email: user?.email || "",
    displayName: user?.display_name || "",
    timezone: user?.timezone || "Asia/Seoul",
    groupName: user?.group_name || "",
    twoFactorEnabled: user?.two_factor_enabled === true,
    isActive: user?.is_active !== false,
    lastSeenAt: user?.last_seen_at || null,
    loadedAt: new Date().toISOString(),
  });
}

async function openGroupMessenger() {
  if (!isHostedWebClient()) return;
  closePopupLayers();
  elements.groupMessengerView?.classList.remove("hidden");
  renderGroupMessenger();
  await refreshMessengerRooms({ silent: true });
  await refreshGroupMessages({ silent: true });
  await markGroupMessagesRead({ silent: true });
  startGroupMessengerAutoRefresh();
  window.setTimeout(() => elements.groupMessengerInput?.focus(), 0);
}

function closeGroupMessenger() {
  elements.groupMessengerView?.classList.add("hidden");
  stopGroupMessengerAutoRefresh();
}

function isGroupMessengerOpen() {
  return Boolean(elements.groupMessengerView && !elements.groupMessengerView.classList.contains("hidden"));
}

function startGroupMessengerAutoRefresh() {
  stopGroupMessengerAutoRefresh();
  groupMessengerRefreshTimer = window.setInterval(refreshOpenGroupMessenger, 5000);
}

function stopGroupMessengerAutoRefresh() {
  if (!groupMessengerRefreshTimer) return;
  window.clearInterval(groupMessengerRefreshTimer);
  groupMessengerRefreshTimer = null;
}

async function refreshOpenGroupMessenger() {
  const server = state.settings.server || defaultServerSettings();
  if (!isHostedWebClient() || !server.webSessionToken) {
    stopGroupMessengerAutoRefresh();
    return;
  }
  if (!isGroupMessengerOpen()) {
    stopGroupMessengerAutoRefresh();
    return;
  }
  if (document.visibilityState === "hidden" || groupMessengerRefreshRunning) return;
  const now = Date.now();
  const refreshGap = 5000;
  if (now - groupMessengerLastRefreshAt < refreshGap) return;
  groupMessengerLastRefreshAt = now;
  groupMessengerRefreshRunning = true;
  try {
    await refreshGroupMessages({ silent: true });
    if (isGroupMessengerOpen()) {
      await markGroupMessagesRead({ silent: true });
    }
  } finally {
    groupMessengerRefreshRunning = false;
  }
}

async function refreshGroupMessages({ silent = false } = {}) {
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  try {
    if (!Array.isArray(server.groupMessengerRooms) || server.groupMessengerRooms.length === 0) {
      await refreshMessengerRooms({ silent: true });
    }
    const roomId = activeMessengerRoomId(server);
    if (!roomId) return;
    const payload = await requestServerJson(
      server,
      `/api/v1/messenger/rooms/${encodeURIComponent(roomId)}/messages?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    const nextMessages = (Array.isArray(payload.items) ? payload.items : []).slice(-100);
    const messagesChanged = groupMessagesChanged(server.groupMessages, nextMessages)
      || server.userProfile?.groupName !== payload.room?.group_name;
    if (!messagesChanged) return;
    server.groupMessages = nextMessages;
    if (payload.room) {
      upsertMessengerRoom(payload.room);
      server.groupMessengerLastReadId = Number(payload.room.last_read_message_id) || 0;
    }
    server.groupMessagesLoadedAt = new Date().toISOString();
    if (payload.room?.group_name) {
      server.userProfile = normalizeServerUserProfile({
        ...server.userProfile,
        groupName: payload.room.group_name,
      });
    }
    updateMessengerUnreadTotal();
    persistSettings();
    if (isGroupMessengerOpen()) {
      renderGroupMessenger();
    } else {
      renderGroupMessengerButton();
    }
  } catch (error) {
    if (!silent) showNotice(`${t("messenger.loadFailed")}: ${error.message}`, "error");
  }
}

async function sendGroupMessage(event) {
  event?.preventDefault();
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  const body = elements.groupMessengerInput?.value.trim() || "";
  if (!body && !pendingMessengerAttachment) return;
  const roomId = activeMessengerRoomId(server);
  if (!roomId) return;
  elements.groupMessengerSendBtn.disabled = true;
  try {
    const payload = pendingMessengerAttachment
      ? await uploadMessengerAttachment(server, roomId, body)
      : await requestServerJson(server, `/api/v1/messenger/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          owner_id: normalizeOwnerId(server.ownerId),
          body,
        }),
      });
    const messages = Array.isArray(server.groupMessages) ? server.groupMessages.slice() : [];
    if (payload.item) messages.push(payload.item);
    server.groupMessages = messages.slice(-100);
    server.groupMessagesLoadedAt = new Date().toISOString();
    elements.groupMessengerInput.value = "";
    clearMessengerAttachment();
    await refreshMessengerRooms({ silent: true });
    persistSettings();
    renderGroupMessenger();
    renderGroupMessengerButton();
  } catch (error) {
    showNotice(`${t("messenger.sendFailed")}: ${error.message}`, "error");
  } finally {
    elements.groupMessengerSendBtn.disabled = false;
  }
}

async function markGroupMessagesRead({ silent = false } = {}) {
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  const roomId = activeMessengerRoomId(server);
  if (!roomId) return;
  const latestId = Math.max(0, ...((server.groupMessages || []).map((message) => Number(message.id) || 0)));
  if (!latestId) {
    updateMessengerUnreadTotal();
    renderGroupMessengerButton();
    return;
  }
  try {
    const payload = await requestServerJson(server, `/api/v1/messenger/rooms/${encodeURIComponent(roomId)}/read`, {
      method: "POST",
      body: JSON.stringify({
        owner_id: normalizeOwnerId(server.ownerId),
        last_read_message_id: latestId,
      }),
    });
    const room = (server.groupMessengerRooms || []).find((item) => Number(item.id) === Number(roomId));
    if (room) {
      room.unread_count = Number(payload.unread_count) || 0;
      room.last_read_message_id = Number(payload.last_read_message_id) || latestId;
    }
    updateMessengerUnreadTotal();
    server.groupMessengerLastReadId = Number(payload.last_read_message_id) || latestId;
    persistSettings();
    renderGroupMessengerButton();
  } catch (error) {
    if (!silent) showNotice(`${t("messenger.readFailed")}: ${error.message}`, "error");
  }
}

function renderGroupMessengerButton() {
  if (!elements.groupMessengerUnreadCount) return;
  const count = Number(state.settings.server?.groupMessengerUnreadCount) || 0;
  elements.groupMessengerUnreadCount.textContent = String(count);
  elements.groupMessengerBtn?.classList.toggle("has-items", count > 0);
}

function renderGroupMessenger() {
  if (!elements.groupMessengerList) return;
  renderGroupMessengerButton();
  const server = state.settings.server || defaultServerSettings();
  const profile = normalizeServerUserProfile(server.userProfile);
  elements.groupMessengerGroupLabel.textContent = t("messenger.group", {
    group: profile.groupName || "-",
  });
  renderMessengerRooms();
  const messages = Array.isArray(server.groupMessages) ? server.groupMessages : [];
  if (!messages.length) {
    elements.groupMessengerList.innerHTML = `<div class="side-empty">${escapeHtml(t("messenger.empty"))}</div>`;
    return;
  }
  elements.groupMessengerList.replaceChildren(
    ...messages.map((message) => groupMessageElement(message, server.ownerId)),
  );
  elements.groupMessengerList.scrollTop = elements.groupMessengerList.scrollHeight;
}

function groupMessageElement(message, currentOwnerId) {
  const item = document.createElement("article");
  const mine = message.sender_owner_id === normalizeOwnerId(currentOwnerId);
  item.className = `messenger-item${mine ? " mine" : ""}`;
  const sender = message.sender_display_name || message.sender_owner_id || "-";
  const time = message.created_at ? relativeTime(message.created_at) : "";
  item.innerHTML = [
    `<div class="messenger-meta"><span>${escapeHtml(sender)}</span><time>${escapeHtml(time)}</time></div>`,
    `<p class="messenger-body">${escapeHtml(message.body || "")}</p>`,
    messengerAttachmentsHtml(message.attachments || []),
  ].join("");
  return item;
}

async function refreshMessengerRooms({ silent = false } = {}) {
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  try {
    const payload = await requestServerJson(
      server,
      `/api/v1/messenger/rooms?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    server.groupMessengerRooms = Array.isArray(payload.rooms) ? payload.rooms : [];
    if (!activeMessengerRoomId(server) && server.groupMessengerRooms.length) {
      server.groupMessengerActiveRoomId = server.groupMessengerRooms[0].id;
    }
    if (payload.group_name) {
      server.userProfile = normalizeServerUserProfile({
        ...server.userProfile,
        groupName: payload.group_name,
      });
    }
    updateMessengerUnreadTotal();
    persistSettings();
    renderGroupMessengerButton();
  } catch (error) {
    if (!silent) showNotice(`${t("messenger.loadFailed")}: ${error.message}`, "error");
  }
}

function activeMessengerRoomId(server = state.settings.server) {
  const rooms = Array.isArray(server?.groupMessengerRooms) ? server.groupMessengerRooms : [];
  const activeId = Number(server?.groupMessengerActiveRoomId) || 0;
  if (rooms.some((room) => Number(room.id) === activeId)) return activeId;
  return Number(rooms[0]?.id) || 0;
}

function upsertMessengerRoom(room) {
  const server = state.settings.server;
  const rooms = Array.isArray(server.groupMessengerRooms) ? server.groupMessengerRooms.slice() : [];
  const index = rooms.findIndex((item) => Number(item.id) === Number(room.id));
  if (index >= 0) rooms[index] = { ...rooms[index], ...room };
  else rooms.push(room);
  server.groupMessengerRooms = rooms;
}

function updateMessengerUnreadTotal() {
  const server = state.settings.server;
  server.groupMessengerUnreadCount = (server.groupMessengerRooms || [])
    .reduce((sum, room) => sum + (Number(room.unread_count) || 0), 0);
}

function renderMessengerRooms() {
  if (!elements.groupMessengerRoomList) return;
  const server = state.settings.server || defaultServerSettings();
  const rooms = Array.isArray(server.groupMessengerRooms) ? server.groupMessengerRooms : [];
  const activeId = activeMessengerRoomId(server);
  if (!rooms.length) {
    elements.groupMessengerRoomList.innerHTML = `<div class="side-empty">${escapeHtml(t("messenger.empty"))}</div>`;
    return;
  }
  elements.groupMessengerRoomList.replaceChildren(
    ...rooms.map((room) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `messenger-room-item${Number(room.id) === Number(activeId) ? " active" : ""}`;
      const unread = Number(room.unread_count) || 0;
      button.innerHTML = `<strong>${escapeHtml(room.name || "-")}</strong><span>${unread ? `${unread} unread` : room.room_type || ""}</span>`;
      button.addEventListener("click", async () => {
        server.groupMessengerActiveRoomId = room.id;
        server.groupMessages = [];
        persistSettings();
        renderGroupMessenger();
        await refreshGroupMessages({ silent: true });
        await markGroupMessagesRead({ silent: true });
      });
      return button;
    }),
  );
}

async function createMessengerRoomFromPrompt() {
  const server = state.settings.server;
  if (!isHostedWebClient() || !prepareServerRequest(server)) return;
  const rawMembers = window.prompt("채팅방에 초대할 사용자 ID를 쉼표로 입력하세요.");
  if (!rawMembers) return;
  const memberOwnerIds = rawMembers.split(",").map((item) => item.trim()).filter(Boolean);
  if (!memberOwnerIds.length) return;
  const name = window.prompt("채팅방 이름을 입력하세요. 비워두면 참여자 이름으로 표시됩니다.") || "";
  try {
    const payload = await requestServerJson(server, "/api/v1/messenger/rooms", {
      method: "POST",
      body: JSON.stringify({
        owner_id: normalizeOwnerId(server.ownerId),
        name,
        member_owner_ids: memberOwnerIds,
      }),
    });
    if (payload.room) {
      upsertMessengerRoom(payload.room);
      server.groupMessengerActiveRoomId = payload.room.id;
      server.groupMessages = [];
      persistSettings();
      renderGroupMessenger();
    }
  } catch (error) {
    showNotice(`${t("messenger.loadFailed")}: ${error.message}`, "error");
  }
}

function handleMessengerAttachmentChange() {
  pendingMessengerAttachment = elements.groupMessengerFileInput?.files?.[0] || null;
  renderMessengerAttachmentLabel();
}

function renderMessengerAttachmentLabel() {
  if (!elements.groupMessengerAttachmentLabel) return;
  elements.groupMessengerAttachmentLabel.textContent = pendingMessengerAttachment
    ? `${pendingMessengerAttachment.name} · ${formatBytes(pendingMessengerAttachment.size)}`
    : "첨부 없음";
}

function clearMessengerAttachment() {
  pendingMessengerAttachment = null;
  if (elements.groupMessengerFileInput) elements.groupMessengerFileInput.value = "";
  renderMessengerAttachmentLabel();
}

async function uploadMessengerAttachment(server, roomId, body) {
  const form = new FormData();
  form.append("file", pendingMessengerAttachment);
  const query = new URLSearchParams({
    owner_id: normalizeOwnerId(server.ownerId),
    body,
  });
  return requestServerJson(server, `/api/v1/messenger/rooms/${encodeURIComponent(roomId)}/attachments?${query.toString()}`, {
    method: "POST",
    body: form,
    skipJsonContentType: true,
  });
}

function messengerAttachmentsHtml(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return "";
  return `<div class="messenger-attachments">${attachments.map((attachment) => {
    return `<button class="messenger-attachment" type="button" data-attachment-id="${escapeHtml(attachment.id)}" data-file-name="${escapeHtml(attachment.original_name || "attachment")}">${escapeHtml(attachment.original_name || "attachment")}</button>`;
  }).join("")}</div>`;
}

async function handleMessengerAttachmentClick(event) {
  const button = event.target.closest("[data-attachment-id]");
  if (!button) return;
  event.preventDefault();
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;
  try {
    const response = await fetch(
      `${normalizeServerUrl(server.url)}/api/v1/messenger/attachments/${encodeURIComponent(button.dataset.attachmentId)}?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
      { headers: serverAuthHeaders(server) },
    );
    if (!response.ok) throw new Error(await serverResponseError(response));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = button.dataset.fileName || "attachment";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    showNotice(`${t("messenger.loadFailed")}: ${error.message}`, "error");
  }
}

async function serverResponseError(response) {
  const statusPart = `HTTP ${response.status}`;
  try {
    const body = await response.text();
    if (!body) return statusPart;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && typeof parsed.detail === "string") {
        if (parsed.detail === "user inactive") {
          return `${statusPart}: ${t("settings.server.inactiveDenied")}`;
        }
        return `${statusPart}: ${parsed.detail}`;
      }
      if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
        return `${statusPart}: ${parsed.message}`;
      }
      return `${statusPart}: ${body.slice(0, 200)}`;
    } catch {
      return `${statusPart}: ${body.slice(0, 200)}`;
    }
  } catch {
    return statusPart;
  }
}

function applyPulledServerNotes(serverNotes) {
  const result = { applied: 0, skipped: 0 };
  const notes = Array.isArray(serverNotes) ? serverNotes : [];
  const dailyNotes = notes.filter((note) => note.note_type === "daily");
  const activeTreeNotes = notes
    .filter((note) => note.note_type === "tree" && !note.deleted_at)
    .sort((a, b) => (a.level || 1) - (b.level || 1));
  const deletedTreeNotes = notes.filter((note) => note.note_type === "tree" && note.deleted_at);

  dailyNotes.forEach((note) => {
    applyPulledDailyNote(note) ? result.applied += 1 : result.skipped += 1;
  });
  activeTreeNotes.forEach((note) => {
    applyPulledTreeNote(note) ? result.applied += 1 : result.skipped += 1;
  });
  deletedTreeNotes.forEach((note) => {
    applyPulledDeletedTreeNote(note) ? result.applied += 1 : result.skipped += 1;
  });
  normalizeData();
  return result;
}

function serverConflictId(note) {
  return `${note?.note_type || "note"}:${note?.local_id || ""}`;
}

function recordServerConflict(local, note) {
  const server = state.settings.server || defaultServerSettings();
  const id = serverConflictId(note);
  const conflicts = Array.isArray(server.conflicts) ? server.conflicts.filter((item) => item.id !== id) : [];
  conflicts.unshift({
    id,
    noteType: note.note_type || "note",
    localId: note.local_id || "",
    title: note.title || local?.title || note.local_id || "",
    localUpdatedAt: localNoteTime(local) || "",
    remoteUpdatedAt: serverNoteTime(note) || "",
    encrypted: isEncryptedContent(local?.content) || isEncryptedContent(note?.content),
    remoteNote: note,
  });
  server.conflicts = conflicts.slice(0, 20);
}

function removeServerConflict(id) {
  const server = state.settings.server || defaultServerSettings();
  server.conflicts = (server.conflicts || []).filter((conflict) => conflict.id !== id);
}

function clearServerConflictForNote(noteType, localId) {
  removeServerConflict(`${noteType}:${localId}`);
}

function applyServerConflictRemote(id) {
  const server = state.settings.server || defaultServerSettings();
  const conflict = (server.conflicts || []).find((item) => item.id === id);
  if (!conflict?.remoteNote) return;
  const local = findLocalNoteForServerNote(conflict.remoteNote);
  if (local) local.syncState = "synced";
  removeServerConflict(id);
  applyPulledServerNotes([conflict.remoteNote]);
  persist();
  persistSettings();
  render();
  renderServerSettings();
}

function findLocalNoteForServerNote(note) {
  if (note.note_type === "daily") {
    const date = dailyDateFromServerNote(note);
    if (!date) return null;
    if (note.source === "web-daily-archive" || String(note.local_id || "").startsWith("daily-archive:")) {
      const id = String(note.local_id || "").replace(/^daily-archive:/, "");
      return state.data.archivedDaily.find((item) => item.id === id) || null;
    }
    return state.data.daily[date] || null;
  }
  if (note.note_type === "tree") {
    return findTreeNode(state.data.tree, note.local_id);
  }
  return null;
}

function serverNoteTime(note) {
  return note?.client_updated_at || note?.updated_at || note?.deleted_at || note?.created_at || "";
}

function localNoteTime(note) {
  return note?.updatedAt || note?.archivedAt || note?.deletedAt || note?.createdAt || "";
}

function timeValue(value) {
  const time = Date.parse(value || "");
  return Number.isNaN(time) ? 0 : time;
}

function shouldApplyPulledNote(local, note) {
  if (!local || local.syncState !== "pending") return true;
  const remoteTime = timeValue(serverNoteTime(note));
  const localTime = timeValue(localNoteTime(local));
  if (remoteTime === 0 && localTime === 0) return false;
  if (remoteTime > localTime) return true;
  if (
    remoteTime === localTime
    && isEncryptedContent(note?.content)
    && !isEncryptedContent(local?.content)
  ) {
    return true;
  }
  if (remoteTime === localTime && String(note?.content || "") !== String(local?.content || "")) {
    return true;
  }
  return false;
}

function clearUnlockedEncryptionState(nodeId) {
  unlockedEncryptedNotes.delete(nodeId);
  window.clearTimeout(encryptedSaveTimers.get(nodeId));
  encryptedSaveTimers.delete(nodeId);
}

function applyPulledDailyNote(note) {
  const date = dailyDateFromServerNote(note);
  if (!date) return false;
  if (note.source === "web-daily-archive" || String(note.local_id || "").startsWith("daily-archive:")) {
    return applyPulledArchivedDailyNote(note, date);
  }
  const current = state.data.daily[date];
  if (!shouldApplyPulledNote(current, note)) {
    recordServerConflict(current, note);
    return false;
  }
  clearServerConflictForNote("daily", note.local_id);
  state.data.daily[date] = {
    ...(current || {}),
    date,
    content: note.content || "",
    status: note.deleted_at ? "archived" : "active",
    syncState: "synced",
    updatedAt: note.client_updated_at || note.updated_at || new Date().toISOString(),
  };
  if (note.deleted_at) {
    state.data.archivedDaily.unshift({
      id: note.local_id,
      date,
      content: note.content || "",
      status: "archived",
      syncState: "synced",
      archivedAt: note.deleted_at,
      restoredAt: null,
      updatedAt: note.client_updated_at || note.updated_at || note.deleted_at,
    });
    delete state.data.daily[date];
  }
  return true;
}

function applyPulledArchivedDailyNote(note, date) {
  const id = note.local_id.replace(/^daily-archive:/, "") || note.local_id;
  const current = state.data.archivedDaily.find((item) => item.id === id);
  if (!shouldApplyPulledNote(current, note)) {
    recordServerConflict(current, note);
    return false;
  }
  clearServerConflictForNote("daily", note.local_id);
  const next = {
    ...(current || {}),
    id,
    date,
    content: note.content || "",
    status: "archived",
    syncState: "synced",
    archivedAt: note.deleted_at || note.updated_at || new Date().toISOString(),
    restoredAt: note.deleted_at || null,
    updatedAt: note.client_updated_at || note.updated_at || new Date().toISOString(),
  };
  if (current) {
    Object.assign(current, next);
  } else {
    state.data.archivedDaily.unshift(next);
  }
  return true;
}

function applyPulledTreeNote(note) {
  const localId = serverTreeNodeLocalId(note);
  const current = findTreeNode(state.data.tree, localId);
  if (!shouldApplyPulledNote(current, note)) {
    recordServerConflict(current, note);
    return false;
  }
  clearServerConflictForNote("tree", localId);
  const deleted = state.data.deletedTree.find((node) => node.id === localId);
  if (deleted) return false;
  removePulledDeletedTreeNote(note.local_id);
  const parentId = serverTreeParentLocalId(note);
  const parent = parentId ? findTreeNode(state.data.tree, parentId) : null;
  const nextLevel = Math.min(3, Math.max(1, note.level || (parent ? parent.level + 1 : 1)));
  const nextParentId = parent && nextLevel > 1 ? parent.id : null;
  if (current) {
    current.title = noteTitle(note.title);
    current.content = note.content || "";
    clearUnlockedEncryptionState(current.id);
    current.parentId = nextParentId;
    current.level = nextLevel;
    current.status = "active";
    current.syncState = "synced";
    current.shared = true;
    current.serverShared = true;
    current.groupSharedReadOnly = isGroupSharedServerNote(note);
    current.remoteOwnerId = note.owner_id || "";
    current.remoteLocalId = note.local_id || "";
    current.unsharedAt = null;
    current.tags = tagsFromServerNote(note);
    current.updatedAt = note.client_updated_at || note.updated_at || new Date().toISOString();
    return true;
  }

  const created = createPulledTreeNode(note, nextParentId, nextLevel);
  if (parent && nextLevel > 1) {
    parent.children.push(created);
    state.expandedTreeIds.add(parent.id);
  } else {
    state.data.tree.push(created);
  }
  return true;
}

function applyPulledDeletedTreeNote(note) {
  const localId = serverTreeNodeLocalId(note);
  const current = findTreeNode(state.data.tree, localId);
  if (current?.shared === false) {
    current.serverShared = false;
    current.syncState = "local";
    clearServerConflictForNote("tree", localId);
    return true;
  }
  if (!shouldApplyPulledNote(current, note)) {
    recordServerConflict(current, note);
    return false;
  }
  clearServerConflictForNote("tree", localId);
  if (current) {
    clearUnlockedEncryptionState(localId);
    detachTreeNode(localId);
    removeTreeTabReferences(localId);
    return true;
  }
  return false;
}

function createPulledTreeNode(note, parentId, level) {
  const groupShared = isGroupSharedServerNote(note);
  return {
    id: serverTreeNodeLocalId(note),
    title: noteTitle(note.title),
    content: note.content || "",
    parentId,
    level,
    children: [],
    status: note.deleted_at ? "deleted" : "active",
    syncState: "synced",
    shared: true,
    serverShared: true,
    groupSharedReadOnly: groupShared,
    remoteOwnerId: note.owner_id || "",
    remoteLocalId: note.local_id || "",
    unsharedAt: null,
    favorite: false,
    tags: tagsFromServerNote(note),
    createdAt: note.created_at || note.client_updated_at || note.updated_at || new Date().toISOString(),
    updatedAt: note.client_updated_at || note.updated_at || new Date().toISOString(),
  };
}

function isGroupSharedServerNote(note) {
  const ownerId = normalizeOwnerId(state.settings.server?.ownerId || "");
  return Boolean(note?.owner_id && ownerId && note.owner_id !== ownerId);
}

function serverTreeNodeLocalId(note) {
  if (!isGroupSharedServerNote(note)) return note.local_id;
  return `group:${note.owner_id}:${note.local_id}`;
}

function serverTreeParentLocalId(note) {
  if (!note.parent_local_id) return null;
  if (!isGroupSharedServerNote(note)) return note.parent_local_id;
  return `group:${note.owner_id}:${note.parent_local_id}`;
}

function dailyDateFromLocalId(localId) {
  const text = String(localId || "");
  const direct = text.match(/^daily:(\d{4}-\d{2}-\d{2})$/);
  if (direct) return direct[1];
  const archive = text.match(/^daily-archive:(\d{4}-\d{2}-\d{2})/);
  if (archive) return archive[1];
  return null;
}

function dailyDateFromServerNote(note) {
  return dailyDateFromLocalId(note.local_id)
    || String(note.title || "").match(/(\d{4}-\d{2}-\d{2})/)?.[1]
    || null;
}

function tagsFromServerNote(note) {
  return String(note.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function removePulledDeletedTreeNote(id) {
  state.data.deletedTree = state.data.deletedTree.filter((node) => node.id !== id && node.remoteLocalId !== id);
}

function buildServerSyncNotes(server) {
  const changedOnly = Boolean(server.lastSyncedAt);
  const notes = [
    ...Object.values(state.data.daily)
      .filter((note) => note.content?.trim())
      .filter((note) => shouldSendServerNote(note, changedOnly))
      .map((note) => dailyNoteToServerNote(note, server)),
    ...state.data.archivedDaily
      .filter((note) => note.content?.trim())
      .filter((note) => shouldSendServerNote(note, changedOnly))
      .map((note) => archivedDailyNoteToServerNote(note, server)),
    ...flattenTree(state.data.tree)
      .filter((node) => shouldTreeNodeSyncWithServer(node, changedOnly))
      .map((node) => treeNodeToServerNote(
        node,
        server,
        treeNodeDeletedAtForServer(node),
      )),
  ];
  return notes.filter(Boolean);
}

function shouldSendServerNote(item, changedOnly) {
  return !changedOnly || item.syncState === "pending";
}

function shouldCountPendingTreeSync(node) {
  if (isReadOnlyTreeNode(node)) return false;
  if (node?.syncState !== "pending") return false;
  return isTreeNodeSharedForServer(node) || node.serverShared === true;
}

function shouldTreeNodeSyncWithServer(node, changedOnly) {
  if (isReadOnlyTreeNode(node)) return false;
  if (!shouldSendServerNote(node, changedOnly)) return false;
  return isTreeNodeSharedForServer(node) || node.serverShared === true;
}

function treeNodeDeletedAtForServer(node) {
  return isTreeNodeSharedForServer(node)
    ? null
    : node.unsharedAt || node.updatedAt || new Date().toISOString();
}

function isTreeNodeSharedForServer(node) {
  if (node.shared === false) return false;
  let parent = node.parentId ? findTreeNode(state.data.tree, node.parentId) : null;
  while (parent) {
    if (parent.shared === false) return false;
    parent = parent.parentId ? findTreeNode(state.data.tree, parent.parentId) : null;
  }
  return true;
}

function dailyNoteToServerNote(note, server) {
  return {
    owner_id: server.ownerId,
    device_id: server.deviceId,
    local_id: `daily:${note.date}`,
    note_type: "daily",
    title: `${note.date} ${t("daily.title")}`,
    content: note.content || "",
    parent_local_id: null,
    level: 1,
    tags: "",
    source: "web-daily",
    client_updated_at: note.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
}

function archivedDailyNoteToServerNote(note, server) {
  return {
    owner_id: server.ownerId,
    device_id: server.deviceId,
    local_id: `daily-archive:${note.id}`,
    note_type: "daily",
    title: `${note.date} ${t("daily.archiveBox")}`,
    content: note.content || "",
    parent_local_id: null,
    level: 1,
    tags: "",
    source: "web-daily-archive",
    client_updated_at: note.updatedAt || note.archivedAt || new Date().toISOString(),
    deleted_at: note.restoredAt || null,
  };
}

function treeNodeToServerNote(node, server, deletedAt) {
  return {
    owner_id: server.ownerId,
    device_id: server.deviceId,
    local_id: node.id,
    note_type: "tree",
    title: noteTitle(node.title),
    content: node.content || "",
    parent_local_id: node.parentId || null,
    level: node.level || 1,
    tags: Array.isArray(node.tags) ? node.tags.join(",") : "",
    source: "web-tree",
    client_updated_at: node.updatedAt || new Date().toISOString(),
    deleted_at: deletedAt,
  };
}

function markServerSyncedNotes(pushedNotes = null) {
  if (Array.isArray(pushedNotes)) {
    const syncedIds = new Set(pushedNotes.map((note) => `${note.note_type}:${note.local_id}`));
    Object.values(state.data.daily).forEach((note) => {
      if (syncedIds.has(`daily:daily:${note.date}`)) {
        note.syncState = "synced";
        clearServerConflictForNote("daily", `daily:${note.date}`);
      }
    });
    state.data.archivedDaily.forEach((note) => {
      if (syncedIds.has(`daily:daily-archive:${note.id}`)) {
        note.syncState = "synced";
        clearServerConflictForNote("daily", `daily-archive:${note.id}`);
      }
    });
    flattenTree(state.data.tree).forEach((node) => {
      const syncedNote = pushedNotes.find((note) => note.note_type === "tree" && note.local_id === node.id);
      if (syncedNote) {
        node.syncState = syncedNote.deleted_at ? "local" : "synced";
        node.serverShared = !syncedNote.deleted_at;
        clearServerConflictForNote("tree", node.id);
      }
    });
    return;
  }
  Object.values(state.data.daily).forEach((note) => {
    note.syncState = "synced";
  });
  state.data.archivedDaily.forEach((note) => {
    note.syncState = "synced";
  });
  flattenTree(state.data.tree).forEach((node) => {
    node.syncState = "synced";
    if (isTreeNodeSharedForServer(node)) node.serverShared = true;
  });
  state.settings.server.conflicts = [];
}

function normalizeServerUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function renderShortcutEditor() {
  const groups = Array.from(new Set(SHORTCUT_ACTIONS.map((action) => action.groupKey || action.group)));
  elements.shortcutEditor.replaceChildren(
    ...groups.map((groupName) => {
      const group = document.createElement("div");
      group.className = "shortcut-group";
      const title = document.createElement("strong");
      const sample = SHORTCUT_ACTIONS.find((action) => (action.groupKey || action.group) === groupName);
      title.textContent = localizeOrFallback(sample?.groupKey, sample?.group);
      const list = document.createElement("div");
      list.className = "shortcut-list shortcut-edit-list";
      list.replaceChildren(
        ...SHORTCUT_ACTIONS.filter((action) => (action.groupKey || action.group) === groupName).map(renderShortcutRow),
      );
      group.append(title, list);
      return group;
    }),
  );
}

function renderShortcutRow(action) {
  const row = document.createElement("div");
  row.className = "shortcut-edit-row";
  const label = document.createElement("span");
  label.textContent = localizeOrFallback(action.labelKey, action.label);
  const current = shortcutForAction(action.id);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shortcut-capture-btn";
  button.dataset.shortcutId = action.id;
  button.textContent = state.capturingShortcutId === action.id ? t("shortcut.captureWaiting") : shortcutLabel(current);
  button.addEventListener("click", () => {
    state.capturingShortcutId = state.capturingShortcutId === action.id ? null : action.id;
    renderShortcutEditor();
  });
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "shortcut-reset-btn";
  reset.textContent = t("shortcut.reset");
  reset.title = t("shortcut.resetHint");
  reset.addEventListener("click", () => {
    state.settings.shortcuts[action.id] = { ...action.defaultShortcut };
    persistSettings();
    renderShortcutEditor();
  });
  row.append(label, button, reset);
  return row;
}

function renderFeatureSettings() {
  elements.featureSettings.replaceChildren(
    ...FEATURE_TOGGLES.map((feature) => {
      const row = document.createElement("label");
      row.className = "feature-toggle-row";
      const text = document.createElement("span");
      const featureLabel = localizeOrFallback(feature.labelKey, feature.label);
      const featureDescription = localizeOrFallback(feature.descriptionKey, feature.description);
      text.innerHTML = `<strong>${escapeHtml(featureLabel)}</strong><small>${escapeHtml(featureDescription)}</small>`;
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = featureEnabled(feature.id);
      toggle.addEventListener("change", () => {
        state.settings.features[feature.id] = toggle.checked;
        syncFeatureSettings();
        persistSettings();
        applySettings();
        render();
      });
      row.append(text, toggle);
      return row;
    }),
  );
}

function featureEnabled(featureId) {
  return state.settings.features?.[featureId] !== false;
}

function syncFeatureSettings() {
  state.settings.showBacklinks = featureEnabled("backlinks");
  state.settings.showTags = featureEnabled("tags");
  state.settings.enableShortcuts = featureEnabled("shortcuts");
  elements.backlinksToggle.checked = state.settings.showBacklinks;
  elements.tagsToggle.checked = state.settings.showTags;
  elements.shortcutsToggle.checked = state.settings.enableShortcuts;
}

function handleShortcutCapture(event) {
  if (!state.capturingShortcutId) return false;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    state.capturingShortcutId = null;
    renderShortcutEditor();
    return true;
  }
  const shortcut = shortcutFromEvent(event);
  if (!shortcut.key) return true;
  assignShortcut(state.capturingShortcutId, shortcut);
  state.capturingShortcutId = null;
  persistSettings();
  renderShortcutEditor();
  return true;
}

function assignShortcut(actionId, shortcut) {
  const signature = shortcutSignature(shortcut);
  Object.entries(state.settings.shortcuts).forEach(([id, current]) => {
    if (id !== actionId && shortcutSignature(current) === signature) {
      delete state.settings.shortcuts[id];
    }
  });
  state.settings.shortcuts[actionId] = shortcut;
}

function shortcutForAction(actionId) {
  const action = SHORTCUT_ACTIONS.find((item) => item.id === actionId);
  return state.settings.shortcuts?.[actionId] || action?.defaultShortcut || {};
}

function shortcutMatches(event, actionId) {
  return shortcutSignature(shortcutFromEvent(event)) === shortcutSignature(shortcutForAction(actionId));
}

function shortcutEquals(left, right) {
  return shortcutSignature(left) === shortcutSignature(right);
}

function shortcutFromEvent(event) {
  return normalizeShortcut({
    ctrl: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
    key: normalizeShortcutKey(event.key),
    code: event.code || undefined,
  });
}

function normalizeShortcut(shortcut = {}) {
  return {
    ctrl: Boolean(shortcut.ctrl),
    shift: Boolean(shortcut.shift),
    alt: Boolean(shortcut.alt),
    key: normalizeShortcutKey(shortcut.key),
    code: shortcut.code || undefined,
  };
}

function normalizeShortcutKey(key = "") {
  const value = String(key).toLowerCase();
  if (value === "esc") return "escape";
  if (value === " ") return "space";
  return value;
}

function shortcutSignature(shortcut = {}) {
  const normalized = normalizeShortcut(shortcut);
  const code = normalized.code ? `:${normalized.code}` : "";
  return [
    normalized.ctrl ? "ctrl" : "",
    normalized.shift ? "shift" : "",
    normalized.alt ? "alt" : "",
    `${normalized.key}${code}`,
  ].filter(Boolean).join("+");
}

function shortcutLabel(shortcut = {}) {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized.key) return t("shortcut.unset");
  const parts = [];
  if (normalized.ctrl) parts.push("Ctrl");
  if (normalized.shift) parts.push("Shift");
  if (normalized.alt) parts.push("Alt");
  parts.push(shortcutKeyLabel(normalized.key));
  return parts.join(" + ");
}

function shortcutKeyLabel(key) {
  const labels = {
    arrowup: "↑",
    arrowdown: "↓",
    pageup: "PageUp",
    pagedown: "PageDown",
    escape: "Esc",
    tab: "Tab",
    space: "Space",
  };
  return labels[key] || key.toUpperCase();
}

function handleMenuCommand(command) {
  if (command === "search") {
    if (!featureEnabled("search")) return;
    openSearchPopover();
    return;
  }
  if (command === "noteFind") {
    openNoteFind();
  }
}

function groupMessagesChanged(previous = [], next = []) {
  if (!Array.isArray(previous) || previous.length !== next.length) return true;
  return next.some((message, index) => {
    const before = previous[index] || {};
    return Number(before.id) !== Number(message.id)
      || String(before.body || "") !== String(message.body || "")
      || String(before.created_at || "") !== String(message.created_at || "")
      || String(before.sender_id || "") !== String(message.sender_id || "");
  });
}

function applySettings() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = state.settings.theme === "system"
    ? (systemDark ? "dark" : "light")
    : state.settings.theme;
  const accent = ACCENTS.find((item) => item.id === state.settings.accent) || ACCENTS[0];
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.client = isHostedWebClient() ? "hosted" : isDesktopClient() ? "desktop" : "local";
  document.documentElement.dataset.editor = state.settings.wideEditor ? "wide" : "normal";
  document.documentElement.dataset.treePanel = state.settings.treePanelCollapsed ? "collapsed" : "open";
  document.documentElement.dataset.sidebar = state.settings.sidebarCollapsed ? "collapsed" : "open";
  document.documentElement.dataset.railMode = state.settings.railMode;
  document.documentElement.dataset.editorActionIcons = state.settings.showEditorActionIcons ? "show" : "hide";
  document.documentElement.dataset.fontSize = state.settings.fontSize;
  document.documentElement.dataset.lineHeight = state.settings.lineHeight;
  document.documentElement.dataset.backlinks = state.settings.showBacklinks ? "show" : "hide";
  document.documentElement.dataset.tags = state.settings.showTags ? "show" : "hide";
  document.documentElement.dataset.sidebarAssist = state.settings.showSidebarAssist ? "show" : "hide";
  FEATURE_TOGGLES.forEach((feature) => {
    document.documentElement.dataset[`feature${feature.id[0].toUpperCase()}${feature.id.slice(1)}`] = featureEnabled(feature.id) ? "show" : "hide";
  });
  document.documentElement.style.setProperty("--blue", accent.value);
  document.documentElement.style.setProperty("--tree-list-width", `${state.settings.treeListWidth}px`);
  applyLanguage();
}

function applyLanguage() {
  state.settings.language = normalizeLanguage(state.settings.language);
  const languageMeta = currentLanguageMeta();
  document.documentElement.lang = state.settings.language;
  document.documentElement.dir = languageMeta.dir;
  document.documentElement.dataset.direction = languageMeta.dir;
  document.title = t("app.title");
  updateHelpLinks();
  setIconLabel($("#appRail"), t("aria.quickMenu"));
  setIconLabel($("#sidebarMenu"), t("aria.sidebar"));
  setIconLabel($("#noteViewNav"), t("aria.noteView"));
  setIconLabel($("#exploreActionGroup"), t("aria.explore"));
  setIconLabel($("#fileActionGroup"), t("aria.files"));
  setIconLabel($("#manageActionGroup"), t("aria.manage"));
  setIconLabel($("#treePanel"), t("aria.treeList"));
  setIconLabel(elements.treeResizeHandle, t("aria.treeResize"));
  setIconLabel($("#treeEditorPanel"), t("aria.treeEditor"));
  setIconLabel(elements.openTabs, t("aria.openTabs"));
  setIconLabel($("#treeTools"), t("aria.treeTools"));
  setIconLabel(elements.noteFindBar, t("aria.noteFind"));
  setIconLabel(elements.outlinePanel, t("aria.outline"));
  setIconLabel(elements.tagList, t("aria.tags"));
  setIconLabel(elements.noteStats, t("aria.noteStats"));
  setIconLabel(elements.markdownPreview, t("aria.markdownPreview"));
  setIconLabel($("#calendarPanel"), t("aria.calendar"));
  setIconLabel($("#dailyEditorPanel"), t("aria.dailyEditor"));
  setIconLabel(elements.archivePanel, t("aria.dailyArchive"));
  setText("#quickSwitchTitle", t("quick.title"));
  setText("#quickSwitchEyebrow", t("quick.eyebrow"));
  setText("#quickCount", t("quick.count.all"));
  setPlaceholder(elements.quickInput, t("quick.placeholder"));
  setText("#searchPopoverTitle", t("search.popoverTitle"));
  setText("#searchPopoverEyebrow", t("search.popoverEyebrow"));
  setPlaceholder(elements.searchPopoverInput, t("search.popoverPlaceholder"));
  setText("#brandSubtitle", t("brand.subtitle"));
  setText("#searchLabel", t("search.label"));
  setText("#todayChipLabel", t("today.label"));
  setText("#sharedMineNavBtn", t("nav.shared.mine"));
  setText("#sharedGroupTreeNavBtn", t("nav.shared.groupTree"));
  setText("#sharedMemberNavBtn", t("nav.shared.member"));
  setText("#favoriteTitle", t("side.favorite"));
  setText("#recentTitle", t("side.recent"));
  setText("#tagTitle", t("side.tags"));
  setText("#exploreActionTitle", t("side.explore"));
  setText("#fileActionTitle", t("side.file"));
  setText("#manageActionTitle", t("side.manage"));
  setText("#quickSwitchBtn", t("side.quick"));
  setText("#graphBtn", t("side.graph"));
  setText("#exportMarkdownBtn", t("side.mdExport"));
  setText("#importMarkdownBtn", t("side.mdImport"));
  setText("#deletedTreeBtnLabel", t("side.trash"));
  setText("#groupMessengerBtnLabel", t("messenger.title"));
  setText("#settingsBtn", t("side.settings"));
  setText("#helpBtn", t("side.help"));
  setText("#treeEyebrow", t("tree.eyebrow"));
  setText("#treeTitle", t("tree.title"));
  setText("#webLoginTitle", t("app.title"));
  setText("#webLoginDesc", t("web.login.desc"));
  setText("#webLoginOwnerLabel", t("web.login.owner"));
  setText("#webLoginPasswordLabel", t("web.login.password"));
  setText("#webRegisterEmailLabel", t("web.login.email"));
  setText("#webLoginTwoFactorLabel", t("web.login.twoFactor"));
  setText("#webResetCodeLabel", t("web.login.resetCode"));
  setText("#webLoginSubmitBtn", t("web.login.submit"));
  setText("#webRegisterSubmitBtn", t("web.login.register"));
  setText("#webResetRequestBtn", t("web.login.resetRequest"));
  setText("#webResetConfirmBtn", t("web.login.resetConfirm"));
  setText("#groupMessengerEyebrow", t("messenger.eyebrow"));
  setText("#groupMessengerTitle", t("messenger.title"));
  setText("#groupMessengerRefreshBtn", t("messenger.refresh"));
  setText("#groupMessengerSendBtn", t("messenger.send"));
  setPlaceholder(elements.groupMessengerInput, t("messenger.placeholder"));
  setIconLabel(elements.groupMessengerCloseBtn, t("aria.close"));
  setPlaceholder(elements.webRegisterEmailInput, t("web.login.emailPlaceholder"));
  setPlaceholder(elements.webLoginTwoFactorInput, t("web.login.twoFactorPlaceholder"));
  setPlaceholder(elements.webResetCodeInput, t("web.login.resetCodePlaceholder"));
  renderWebLoginMode();
  renderTreePanelToggle();
  setIconLabel(elements.expandAllBtn, t("tree.expandAll"));
  setIconLabel(elements.collapseAllBtn, t("tree.collapseAll"));
  setIconLabel(elements.addRootBtn, t("tree.addRoot"));
  setText("#emptyTreeEditorTitle", t("tree.emptySelectTitle"));
  setText("#emptyTreeEditorDesc", t("tree.emptySelectDesc"));
  setText("#emptyAddRootBtn", t("tree.createTopic"));
  setPlaceholder(elements.treeTitleInput, t("tree.titlePlaceholder"));
  setPlaceholder(elements.treeContent, t("tree.contentPlaceholder"));
  setText("#copyLinkBtn", t("editor.copyLink"));
  setText("#shareTreeBtn", t("editor.share"));
  setText("#reopenClosedTabBtn", t("tabs.reopen"));
  setText("#closeOtherTabsBtn", t("tabs.closeOther"));
  setText("#closeAllTabsBtn", t("tabs.closeAll"));
  setText("#noteFindToggleBtn", t("editor.find"));
  setPlaceholder(elements.noteFindInput, t("editor.findPlaceholder"));
  setTitle(elements.noteFindInput, t("editor.findTitle"));
  setIconLabel(elements.noteFindPrevBtn, t("aria.prevResult"));
  setIconLabel(elements.noteFindNextBtn, t("aria.nextResult"));
  setIconLabel(elements.noteFindCloseBtn, t("aria.close"));
  setText("#outlineToggleBtn", t("editor.outline"));
  setText("#insertTimeBtn", t("editor.insertTime"));
  setText("#openDetectedLinkBtn", t("editor.openLink"));
  setText("#encryptNoteBtn", t("editor.encrypt"));
  setText("#unlockNoteBtn", t("editor.unlock"));
  setText("#decryptNoteBtn", t("editor.decrypt"));
  setText("#lockNoteBtn", t("editor.lock"));
  setText(
    "#previewToggleBtn",
    elements.markdownPreview.classList.contains("hidden") ? t("editor.preview") : t("editor.edit"),
  );
  setText("#moveUpBtn", t("tree.moveUp"));
  setText("#moveDownBtn", t("tree.moveDown"));
  setText("#addChildBtn", t("note.addChild"));
  setText("#deleteTreeBtn", t("tree.delete"));
  setText("#resultsEyebrow", t("results.eyebrow"));
  setText("#resultsTitle", t("results.title"));
  setText("#clearResultsBtn", t("results.close"));
  setText("#dailyEyebrow", t("daily.eyebrow"));
  setText("#dailyTitle", t("daily.title"));
  setText("#todayBtn", t("daily.today"));
  setText("#appendTimeBtn", t("daily.appendTime"));
  setText("#archiveSelectedBtn", t("daily.archive"));
  setText("#archiveToggleBtn", t("daily.archiveBox"));
  setIconLabel(elements.dailyCloseBtn, t("aria.close"));
  setIconLabel(elements.prevMonthBtn, t("aria.prevMonth"));
  setIconLabel(elements.nextMonthBtn, t("aria.nextMonth"));
  setText("#weekdaySun", t("daily.week.sun"));
  setText("#weekdayMon", t("daily.week.mon"));
  setText("#weekdayTue", t("daily.week.tue"));
  setText("#weekdayWed", t("daily.week.wed"));
  setText("#weekdayThu", t("daily.week.thu"));
  setText("#weekdayFri", t("daily.week.fri"));
  setText("#weekdaySat", t("daily.week.sat"));
  setText("#dailyMemoTitle", t("daily.memoTitle"));
  setPlaceholder(elements.dailyContent, t("daily.placeholder"));
  setText("#dailyArchiveEyebrow", t("daily.archiveEyebrow"));
  setText("#dailyArchiveTitle", t("daily.archiveBox"));
  setText("#settingsEyebrow", t("settings.eyebrow"));
  setText("#settingsTitle", t("settings.title"));
  setIconLabel(elements.settingsCloseBtn, t("aria.close"));
  setText("#languageSettingTitle", t("settings.language.title"));
  setText("#languageSettingDesc", t("settings.language.desc"));
  setIconLabel(elements.languageSelect, t("aria.language"));
  setText("#themeSettingTitle", t("settings.theme.title"));
  setText("#themeSettingDesc", t("settings.theme.desc"));
  setIconLabel(elements.themeSelect, t("aria.theme"));
  setOptionLabels(elements.themeSelect, {
    system: t("settings.theme.system"),
    light: t("settings.theme.light"),
    dark: t("settings.theme.dark"),
  });
  setText("#accentSettingTitle", t("settings.accent.title"));
  setText("#accentSettingDesc", t("settings.accent.desc"));
  setIconLabel(elements.accentChoices, t("aria.accent"));
  setText("#wideEditorSettingTitle", t("settings.wide.title"));
  setText("#wideEditorSettingDesc", t("settings.wide.desc"));
  setText("#railModeSettingTitle", t("settings.railMode.title"));
  setText("#railModeSettingDesc", t("settings.railMode.desc"));
  setIconLabel(elements.railModeSelect, t("aria.railMode"));
  setText("#railModeIconOption", t("settings.railMode.icon"));
  setText("#railModeLetterOption", t("settings.railMode.letter"));
  setText("#editorActionIconsSettingTitle", t("settings.editorActionIcons.title"));
  setText("#editorActionIconsSettingDesc", t("settings.editorActionIcons.desc"));
  setText("#fontSizeSettingTitle", t("settings.font.title"));
  setText("#fontSizeSettingDesc", t("settings.font.desc"));
  setIconLabel(elements.fontSizeSelect, t("aria.fontSize"));
  setOptionLabels(elements.fontSizeSelect, {
    small: t("settings.font.small"),
    medium: t("settings.font.medium"),
    large: t("settings.font.large"),
  });
  setText("#lineHeightSettingTitle", t("settings.line.title"));
  setText("#lineHeightSettingDesc", t("settings.line.desc"));
  setIconLabel(elements.lineHeightSelect, t("aria.lineHeight"));
  setOptionLabels(elements.lineHeightSelect, {
    compact: t("settings.line.compact"),
    normal: t("settings.line.normal"),
    relaxed: t("settings.line.relaxed"),
  });
  setText("#tabIndentSettingTitle", t("settings.tabIndent.title"));
  setText("#tabIndentSettingDesc", t("settings.tabIndent.desc"));
  setIconLabel(elements.tabIndentSelect, t("aria.tabIndent"));
  setOptionLabels(elements.tabIndentSelect, {
    2: t("settings.tabIndent.2"),
    4: t("settings.tabIndent.4"),
    8: t("settings.tabIndent.8"),
  });
  setText("#backlinksSettingTitle", t("settings.backlinks.title"));
  setText("#backlinksSettingDesc", t("settings.backlinks.desc"));
  setText("#tagsSettingTitle", t("settings.tags.title"));
  setText("#tagsSettingDesc", t("settings.tags.desc"));
  setText("#shortcutsSettingTitle", t("settings.shortcuts.title"));
  setText("#shortcutsSettingDesc", t("settings.shortcuts.desc"));
  setText("#shortcutGuideSettingTitle", t("settings.shortcutGuide.title"));
  setText("#shortcutGuideSettingDesc", t("settings.shortcutGuide.desc"));
  setText("#featuresSettingTitle", t("settings.features.title"));
  setText("#featuresSettingDesc", t("settings.features.desc"));
  setText("#serverSettingTitle", t("settings.server.title"));
  setText("#serverSettingDesc", t(isHostedWebClient() ? "settings.server.desc.hosted" : "settings.server.desc"));
  setText("#serverGuideTitle", t("settings.server.guide.title"));
  setText("#serverGuideLocal", t("settings.server.guide.local"));
  setText("#serverGuidePersonal", t("settings.server.guide.personal"));
  setText("#serverGuidePublic", t("settings.server.guide.public"));
  setText("#serverGuideIssue", t("settings.server.guide.issue"));
  setText("#serverAdvancedSummary", t("settings.server.advanced"));
  setText("#serverModeLocalOption", t("settings.server.mode.local"));
  setText("#serverModeServerOption", t("settings.server.mode.server"));
  setText("#serverModeLabel", t("settings.server.mode"));
  setText("#serverUrlLabel", t("settings.server.url"));
  setText("#serverTokenLabel", t("settings.server.token"));
  setText("#serverUserTokenLabel", t("settings.server.userToken"));
  setText("#serverTwoFactorCodeLabel", t("settings.server.twoFactorCode"));
  setText("#serverAutoSyncLabel", t("settings.server.autoSync"));
  setText("#serverAutoSyncHint", t("settings.server.autoSync.hint"));
  setText("#serverUrlHint", t("settings.server.url.hint"));
  setText("#serverTokenHint", t("settings.server.token.hint"));
  setText("#serverUserTokenHint", t("settings.server.userToken.hint"));
  setText("#serverTwoFactorCodeHint", t("settings.server.twoFactorCode.hint"));
  setText("#deviceIdHint", t("settings.server.device.hint"));
  setText("#ownerIdLabel", t("settings.server.owner"));
  setText("#deviceIdLabel", t("settings.server.device"));
  setText("#serverProfileTitle", t("settings.server.profile.title"));
  setText("#serverProfileDesc", t("settings.server.profile.desc"));
  setText("#serverDisplayNameLabel", t("settings.server.profile.displayName"));
  setText("#serverEmailLabel", t("settings.server.profile.email"));
  setText("#serverTimezoneLabel", t("settings.server.profile.timezone"));
  setText("#serverProfileLoadBtn", t("settings.server.profile.load"));
  setText("#serverProfileSaveBtn", t("settings.server.profile.save"));
  setText("#serverGroupJoinTitle", t("settings.server.profile.groupJoin.title"));
  setText("#serverGroupJoinDesc", t("settings.server.profile.groupJoin.desc"));
  setText("#serverGroupNameLabel", t("settings.server.profile.groupJoin.groupName"));
  setText("#serverGroupInviteCodeLabel", t("settings.server.profile.groupJoin.inviteCode"));
  setText("#serverGroupJoinBtn", t("settings.server.profile.groupJoin.join"));
  setText("#deviceTokenTitle", t("settings.server.deviceToken.title"));
  setText("#deviceTokenDesc", t("settings.server.deviceToken.desc"));
  setText("#deviceTokenNameLabel", t("settings.server.deviceToken.name"));
  setText("#deviceTokenIdLabel", t("settings.server.deviceToken.id"));
  setText("#deviceTokenIssueBtn", t("settings.server.deviceToken.issue"));
  setPlaceholder(elements.deviceTokenOutput, t("settings.server.deviceToken.placeholder"));
  setText("#serverAnalysisTitle", t("settings.server.analysis.title"));
  setText("#serverAnalysisDesc", t("settings.server.analysis.desc"));
  setText("#serverAnalysisTypeLabel", t("settings.server.analysis.type"));
  setText("#serverAnalysisCreateBtn", t("settings.server.analysis.create"));
  setText("#serverAnalysisRefreshBtn", t("settings.server.analysis.refresh"));
  setOptionLabels(elements.serverAnalysisTypeSelect, {
    memo_summary: t("settings.server.analysis.job.memo_summary"),
    knowledge_2_0_review: t("settings.server.analysis.job.knowledge_2_0_review"),
    similar_notes: t("settings.server.analysis.job.similar_notes"),
    duplicate_candidates: t("settings.server.analysis.job.duplicate_candidates"),
    relation_suggestions: t("settings.server.analysis.job.relation_suggestions"),
    tag_property_suggestions: t("settings.server.analysis.job.tag_property_suggestions"),
    knowledge_health: t("settings.server.analysis.job.knowledge_health"),
  });
  setText("#serverConflictTitle", t("settings.server.conflict.title"));
  setText("#serverConflictDesc", t("settings.server.conflict.desc"));
  setText("#serverSaveBtn", t("settings.server.save"));
  setText("#serverTestBtn", t("settings.server.test"));
  setText("#serverSyncBtn", t("settings.server.sync"));
  setText("#serverFullSyncBtn", t("settings.server.fullSync"));
  setText("#desktopStorageTitle", t("settings.desktopStorage.title"));
  setText("#desktopStorageDesc", t(isHostedWebClient() ? "settings.desktopStorage.web" : "settings.desktopStorage.desc"));
  setText("#webLogoutBtn", t("web.login.logout"));
  setPlaceholder(elements.serverUrlInput, t("settings.server.url.placeholder"));
  setPlaceholder(elements.serverTokenInput, t("settings.server.token.placeholder"));
  setPlaceholder(elements.serverUserTokenInput, t("settings.server.userToken.placeholder"));
  setPlaceholder(elements.serverTwoFactorCodeInput, t("settings.server.twoFactorCode.placeholder"));
  setText("#sidebarAssistSettingTitle", t("settings.sidebarAssist.title"));
  setText("#sidebarAssistSettingDesc", t("settings.sidebarAssist.desc"));
  setText("#backupSettingTitle", t("settings.backup.title"));
  setText("#backupSettingDesc", t("settings.backup.desc"));
  setText("#exportBtn", t("settings.backup.export"));
  setText("#importBtnLabel", t("settings.backup.import"));
  setText("#resetSettingTitle", t("settings.resetSection.title"));
  setText("#resetSettingDesc", t("settings.resetSection.desc"));
  setText("#helpSettingTitle", t("settings.help.title"));
  setText("#helpSettingDesc", t("settings.help.desc"));
  setText("#settingsHelpBtn", t("settings.help.open"));
  setText("#versionSettingTitle", t("settings.version.title"));
  setText("#versionSettingDesc", t("settings.version.desc"));
  setText("#appVersionText", `${isDesktopClient() ? "Desktop" : "Web"} ${APP_VERSION}`);
  setText("#workspaceSettingTitle", t("settings.workspace.title"));
  setText("#workspaceSettingDesc", t("settings.workspace.desc"));
  setPlaceholder(elements.workspaceNameInput, t("settings.workspace.placeholder"));
  setText("#workspaceSaveBtn", t("settings.workspace.save"));
  setText("#workspaceApplyBtn", t("settings.workspace.apply"));
  setIconLabel(elements.workspaceSelect, t("settings.workspace.select"));
  setOptionLabels(elements.searchScopeSelect, {
    all: t("search.scope.all"),
    title: t("search.scope.title"),
    content: t("search.scope.content"),
    tag: t("search.scope.tag"),
    path: t("search.scope.path"),
  });
  setOptionLabels(elements.searchSortSelect, {
    "updated-desc": t("search.sort.updatedDesc"),
    "updated-asc": t("search.sort.updatedAsc"),
    "created-desc": t("search.sort.createdDesc"),
    "created-asc": t("search.sort.createdAsc"),
    "title-asc": t("search.sort.titleAsc"),
    "title-desc": t("search.sort.titleDesc"),
  });
  setText("#resetSettingsBtn", t("settings.resetTitle"));
  setText("#graphEyebrow", t("graph.eyebrow"));
  setText("#graphTitle", t("graph.title"));
  setIconLabel(elements.graphCloseBtn, t("aria.close"));
  setText("#deletedTreeEyebrow", t("trash.eyebrow"));
  setText("#deletedTreeTitle", t("trash.title"));
  setIconLabel(elements.deletedTreeCloseBtn, t("aria.close"));
  setText("#deletedBulkDeleteBtn", t("trash.deleteSelected"));
  setText("#deletedDeleteAllBtn", t("trash.deleteAll"));
  renderServerStatus(state.settings.server.lastStatus, state.settings.server.lastMessage);
  renderServerMeta();
  renderServerCapabilities(state.settings.server.capabilities);
  renderServerAnalysisJobs(state.settings.server.analysisJobs);
  setPlaceholder(elements.searchInput, t("search.placeholder"));
  setIconLabel(elements.searchScopeSelect, t("aria.searchScope"));
  setIconLabel(elements.searchSortSelect, t("aria.searchSort"));
  setIconLabel(document.querySelector(".search-option-help"), t("aria.searchOption"));
  elements.searchHelpPath.textContent = t("search.popoverHelp.path");
  elements.searchHelpTitle.textContent = t("search.popoverHelp.title");
  elements.searchHelpTag.textContent = t("search.popoverHelp.tag");
  elements.searchHelpContent.textContent = t("search.popoverHelp.content");
  setTitle(elements.railSidebarBtn, state.settings.sidebarCollapsed ? t("rail.sidebar.open") : t("rail.sidebar.close"));
  setTitle(document.querySelector(".app-rail .rail-btn.active"), t("rail.knowledge"));
  setTitle(elements.railDailyBtn, t("rail.daily"));
  setTitle(elements.railSearchBtn, t("rail.search"));
  setTitle(elements.railQuickBtn, t("rail.quick"));
  setTitle(elements.railGraphBtn, t("rail.graph"));
  setTitle(elements.railMarkdownExportBtn, t("rail.mdExport"));
  setTitle(elements.railMarkdownImportBtn, t("rail.mdImport"));
  setTitle(elements.railDeletedTreeBtn, t("rail.trash"));
  setTitle(elements.railSettingsBtn, t("rail.settings"));
  setIconLabel(elements.quickCloseBtn, t("aria.close"));
  setIconLabel(elements.searchPopoverCloseBtn, t("aria.close"));
  renderShortcutEditor();
  renderFeatureSettings();
  renderTree();
  renderDaily();
  renderResults();
  renderSidebarKnowledge();
  renderOpenTreeTabs();
  renderDeletedTreeList();
  renderSearchPopoverResults();
  renderWorkspacePanel();
  if (getSelectedTreeNode()) {
    renderLinkPanel();
    renderNoteStats(getSelectedTreeNode());
  }
  renderRailButtons();
}

function updateHelpLinks() {
  const language = normalizeLanguage(state.settings.language);
  const helpUrl = `./help.html?lang=${encodeURIComponent(language)}`;
  [elements.helpBtn, elements.settingsHelpBtn].forEach((link) => {
    if (!link) return;
    link.href = helpUrl;
    link.removeAttribute("target");
    link.removeAttribute("rel");
  });
}

function renderRailButtons() {
  const mode = state.settings.railMode === "letter" ? "letter" : "icon";
  const letterMap = new Map([
    [elements.railSidebarBtn, "rail.letter.sidebar"],
    [document.querySelector(".app-rail .rail-btn.active"), "rail.letter.knowledge"],
    [elements.railDailyBtn, "rail.letter.daily"],
    [elements.railSearchBtn, "rail.letter.search"],
    [elements.railQuickBtn, "rail.letter.quick"],
    [elements.railGraphBtn, "rail.letter.graph"],
    [elements.railMarkdownExportBtn, "rail.letter.mdExport"],
    [elements.railMarkdownImportBtn, "rail.letter.mdImport"],
    [elements.railDeletedTreeBtn, "rail.letter.trash"],
    [elements.railSettingsBtn, "rail.letter.settings"],
  ]);
  letterMap.forEach((letterKey, button) => {
    if (!button) return;
    const value = mode === "icon" ? button.dataset.railIcon : t(letterKey);
    button.textContent = value || button.dataset.railLetter || "";
  });
}

function openQuickSwitch() {
  closePopupLayers();
  elements.quickSwitchView.classList.remove("hidden");
  elements.quickInput.value = "";
  renderQuickResults();
  elements.quickInput.focus();
}

function toggleQuickSwitch() {
  if (elements.quickSwitchView.classList.contains("hidden")) {
    openQuickSwitch();
  } else {
    closeQuickSwitch();
  }
}

function closeQuickSwitch() {
  elements.quickSwitchView.classList.add("hidden");
}

function openCommandPalette() {
  closePopupLayers();
  elements.commandPaletteView.classList.remove("hidden");
  elements.commandPaletteInput.value = "";
  renderCommandPalette();
  elements.commandPaletteInput.focus();
}

function toggleCommandPalette() {
  if (elements.commandPaletteView.classList.contains("hidden")) {
    openCommandPalette();
  } else {
    closeCommandPalette();
  }
}

function closeCommandPalette() {
  elements.commandPaletteView.classList.add("hidden");
}

function commandCatalog() {
  return [
    {
      id: "template-project",
      label: "프로젝트 템플릿 메모",
      group: "템플릿",
      description: "목표, 범위, 다음 작업 섹션을 가진 메모를 만듭니다.",
      keywords: "template project 템플릿 프로젝트",
      run: () => createWritingTemplateNote("project"),
    },
    {
      id: "template-meeting",
      label: "회의 템플릿 메모",
      group: "템플릿",
      description: "안건, 결정, 후속 작업 섹션을 가진 메모를 만듭니다.",
      keywords: "template meeting 템플릿 회의",
      run: () => createWritingTemplateNote("meeting"),
    },
    {
      id: "template-source",
      label: "자료 템플릿 메모",
      group: "템플릿",
      description: "출처, 핵심 내용, 연결할 메모 섹션을 가진 메모를 만듭니다.",
      keywords: "template source 템플릿 자료",
      run: () => createWritingTemplateNote("source"),
    },
    {
      id: "unique-note",
      label: "고유 메모 생성",
      group: "생성",
      description: "시각 기반 ID가 들어간 새 메모를 만듭니다.",
      keywords: "unique note id 고유 시각",
      run: createUniqueNote,
    },
    {
      id: "random-note",
      label: "랜덤 메모 열기",
      group: "탐색",
      description: "지식 점검용으로 임의의 메모를 엽니다.",
      keywords: "random note 랜덤",
      run: openRandomNote,
    },
    {
      id: "merge-children",
      label: "하위 메모 내용 병합",
      group: "정리",
      description: "선택 메모의 하위 메모 내용을 본문 아래에 추가합니다.",
      keywords: "merge composer 합치기 병합",
      run: mergeSelectedNoteChildren,
    },
    {
      id: "split-heading",
      label: "제목 섹션으로 나누기",
      group: "정리",
      description: "현재 메모의 ## 섹션을 하위 메모로 분리합니다.",
      keywords: "split composer 나누기 heading 제목",
      run: splitSelectedNoteByHeading,
    },
    {
      id: "quick-switch",
      label: "빠른 전환 열기",
      group: "탐색",
      description: "제목과 경로로 메모를 바로 엽니다.",
      keywords: "quick switch open 빠른 전환",
      run: openQuickSwitch,
    },
    {
      id: "insert-time",
      label: "현재 시간 삽입",
      group: "작성",
      description: "선택 메모 커서 위치에 현재 시간을 넣습니다.",
      keywords: "time now insert 시간",
      run: insertCurrentTimeIntoTreeNote,
    },
    {
      id: "insert-checklist",
      label: "체크리스트 삽입",
      group: "작성",
      description: "선택 메모 커서 위치에 체크리스트를 넣습니다.",
      keywords: "check checklist todo 체크리스트",
      run: insertChecklistIntoTreeContent,
    },
  ];
}

function renderCommandPalette() {
  const query = elements.commandPaletteInput.value.trim().toLowerCase();
  const commands = commandCatalog().filter((command) => {
    const text = `${command.label} ${command.group} ${command.description} ${command.keywords}`.toLowerCase();
    return !query || text.includes(query);
  });
  elements.commandPaletteSummary.textContent = query
    ? `${commands.length}개 명령`
    : "작성 보조 명령을 바로 실행할 수 있습니다.";
  if (!commands.length) {
    elements.commandPaletteList.innerHTML = `<div class="empty-compact">실행할 명령이 없습니다.</div>`;
    return;
  }
  elements.commandPaletteList.replaceChildren(...commands.map(commandPaletteItem));
}

function commandPaletteItem(command) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "command-item";
  button.dataset.commandId = command.id;
  button.innerHTML = [
    `<span>${escapeHtml(command.group)}</span>`,
    `<strong>${escapeHtml(command.label)}</strong>`,
    `<small>${escapeHtml(command.description)}</small>`,
  ].join("");
  button.addEventListener("click", () => executeCommand(command.id));
  button.addEventListener("keydown", (event) => handleCommandPaletteResultKey(event, button));
  return button;
}

function handleCommandPaletteInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = elements.commandPaletteList.querySelector(".command-item");
  if (!first) return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleCommandPaletteResultKey(event, button) {
  if (!["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(elements.commandPaletteList.querySelectorAll(".command-item"));
  const index = items.indexOf(button);
  if (event.key === "Enter") {
    button.click();
  } else if (event.key === "ArrowDown") {
    (items[index + 1] || items[0] || button).focus();
  } else if (event.key === "ArrowUp") {
    (items[index - 1] || items.at(-1) || button).focus();
  } else {
    elements.commandPaletteInput.focus();
  }
}

function executeCommand(commandId) {
  const command = commandCatalog().find((item) => item.id === commandId);
  if (!command) return false;
  const result = command.run();
  if (result !== false) closeCommandPalette();
  return result !== false;
}

function toggleSearchPopover() {
  if (elements.searchPopoverView.classList.contains("hidden")) {
    openSearchPopover();
  } else {
    closeSearchPopover();
  }
}

function openSearchPopover() {
  closePopupLayers();
  elements.searchPopoverView.classList.remove("hidden");
  elements.searchPopoverInput.value = state.search;
  renderSearchPopoverResults();
  focusSearchPopoverInput();
}

function closeSearchPopover() {
  elements.searchPopoverView.classList.add("hidden");
}

function focusSearchPopoverInput(options = {}) {
  elements.searchPopoverInput.focus();
  window.setTimeout(() => {
    if (!elements.searchPopoverView.classList.contains("hidden")) {
      elements.searchPopoverInput.focus();
      if (options.select !== false) {
        elements.searchPopoverInput.select();
      }
    }
  }, 0);
}

function renderSearchPopoverResults() {
  const query = elements.searchPopoverInput.value.trim();
  if (!query) {
    const emptyHint = t("search.emptyHint");
    elements.searchPopoverCount.textContent = emptyHint;
    elements.searchPopoverResults.innerHTML = `<div class="empty-compact">${escapeHtml(emptyHint)}</div>`;
    return;
  }
  const parsed = parseSearchQuery(query, elements.searchScopeSelect.value);
  if (parsed.valid === false) {
    elements.searchPopoverCount.textContent = t("search.invalidHint");
    elements.searchPopoverResults.innerHTML = `<div class="empty-compact">${escapeHtml(t("search.invalidTitle"))}</div>`;
    return;
  }
  const results = searchResults(query, {
    scope: elements.searchScopeSelect.value,
    sort: elements.searchSortSelect.value,
  });
  elements.searchPopoverCount.textContent = t("search.resultCount").replace("{count}", String(results.length));
  renderSearchResultsInto(elements.searchPopoverResults, results, () => closeSearchPopover());
}

function renderQuickResults() {
  const query = elements.quickInput.value.trim().toLowerCase();
  const matches = flattenTree(state.data.tree)
    .filter((node) => !query || quickSwitchText(node).includes(query))
    .sort((a, b) => quickSwitchTime(b) - quickSwitchTime(a));
  const nodes = matches.slice(0, 30);
  if (query) {
    elements.quickCount.textContent = matches.length > nodes.length
      ? t("quick.count.matchLimited").replace("{count}", String(matches.length)).replace("{shown}", String(nodes.length))
      : t("quick.count.match").replace("{count}", String(matches.length));
  } else {
    elements.quickCount.textContent = matches.length > nodes.length
      ? t("quick.count.recentLimited").replace("{shown}", String(nodes.length)).replace("{count}", String(matches.length))
      : t("quick.count.recent").replace("{count}", String(nodes.length));
  }
  if (nodes.length === 0) {
    elements.quickResults.innerHTML = `<div class="empty-compact">${escapeHtml(t("quick.empty"))}</div>`;
    return;
  }
  elements.quickResults.replaceChildren(
    ...nodes.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-result";
      button.innerHTML = `<strong>${escapeHtml(noteTitle(node.title))}</strong><span>${escapeHtml(treePath(node.id).join(" / "))}</span>`;
      button.addEventListener("click", () => {
        openQuickNode(node.id);
      });
      button.addEventListener("keydown", (event) => {
        handleQuickResultKey(event, button);
      });
      return button;
    }),
  );
}

function handleQuickInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = elements.quickResults.querySelector(".quick-result");
  if (!first) return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleQuickResultKey(event, button) {
  if (!["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
  event.preventDefault();
  const results = Array.from(elements.quickResults.querySelectorAll(".quick-result"));
  const index = results.indexOf(button);
  if (event.key === "Enter") {
    button.click();
  } else if (event.key === "ArrowDown") {
    (results[index + 1] || results[0] || button).focus();
  } else if (event.key === "ArrowUp") {
    (results[index - 1] || results.at(-1) || button).focus();
  } else {
    elements.quickInput.focus();
  }
}

function openQuickNode(id) {
  selectTreeNode(id);
}

function quickSwitchTime(node) {
  return new Date(node.updatedAt || node.createdAt || 0).getTime() || 0;
}

function quickSwitchText(node) {
  return `${node.title} ${treePath(node.id).join(" ")}`.toLowerCase();
}

function openGraph() {
  closePopupLayers();
  renderGraph();
  elements.graphView.classList.remove("hidden");
}

function toggleGraph() {
  if (elements.graphView.classList.contains("hidden")) {
    openGraph();
  } else {
    closeGraph();
  }
}

function closeGraph() {
  elements.graphView.classList.add("hidden");
}

function openDeletedTreeBox() {
  closePopupLayers();
  state.selectedDeletedTreeIds.clear();
  renderDeletedTreeList();
  elements.deletedTreeView.classList.remove("hidden");
}

function toggleDeletedTreeBox() {
  if (elements.deletedTreeView.classList.contains("hidden")) {
    openDeletedTreeBox();
  } else {
    closeDeletedTreeBox();
  }
}

function closeDeletedTreeBox() {
  elements.deletedTreeView.classList.add("hidden");
  state.selectedDeletedTreeIds.clear();
  renderDeletedTreeControls();
}

function handleShortcuts(event) {
  if (handleShortcutCapture(event)) return;
  if (isPrimaryShortcut(event, "f") && !event.shiftKey && !event.altKey) {
    if (!featureEnabled("search")) return;
    event.preventDefault();
    openSearchPopover();
    return;
  }
  if (isPrimaryShortcut(event, "f") && event.shiftKey && !event.altKey) {
    event.preventDefault();
    openNoteFind();
    return;
  }
  if (shortcutMatches(event, "search")) {
    if (!featureEnabled("search")) return;
    event.preventDefault();
    openSearchPopover();
    return;
  }
  if (shortcutMatches(event, "noteFind")) {
    event.preventDefault();
    openNoteFind();
    return;
  }
  if (!state.settings.enableShortcuts) return;
  if (shortcutMatches(event, "closePopup")) {
    if (!elements.noteFindBar.classList.contains("hidden")) {
      closeNoteFind();
      return;
    }
    closePopupLayers();
    return;
  }
  if (shortcutMatches(event, "moveUp")) {
    event.preventDefault();
    moveSelectedTreeNode(-1);
  }
  if (shortcutMatches(event, "moveDown")) {
    event.preventDefault();
    moveSelectedTreeNode(1);
  }
  if (shortcutMatches(event, "quickSwitch") || shortcutMatches(event, "quickOpen")) {
    if (!featureEnabled("quickSwitch")) return;
    event.preventDefault();
    openQuickSwitch();
  }
  if (shortcutMatches(event, "commandPalette")) {
    event.preventDefault();
    openCommandPalette();
  }
  if (shortcutMatches(event, "daily")) {
    if (!featureEnabled("daily")) return;
    event.preventDefault();
    toggleDailyPopup();
  }
  if (shortcutMatches(event, "graph")) {
    if (!featureEnabled("graph")) return;
    event.preventDefault();
    toggleGraph();
  }
  if (shortcutMatches(event, "saveState")) {
    event.preventDefault();
    showCurrentSaveState();
  }
  if (shortcutMatches(event, "insertTime")) {
    event.preventDefault();
    insertCurrentTimeIntoTreeNote();
  }
  if (shortcutMatches(event, "closeOtherTabs")) {
    event.preventDefault();
    closeOtherTreeTabs();
  }
  if (shortcutMatches(event, "closeTab")) {
    event.preventDefault();
    closeOpenTreeTab(state.selectedTreeId);
  }
  if (shortcutMatches(event, "pinTab")) {
    event.preventDefault();
    toggleSelectedTreeTabPin();
  }
  if (shortcutMatches(event, "reopenTab")) {
    event.preventDefault();
    reopenClosedTreeTab();
  }
  if (shortcutMatches(event, "leftTab")) {
    event.preventDefault();
    cycleOpenTreeTab(-1);
  }
  if (shortcutMatches(event, "rightTab")) {
    event.preventDefault();
    cycleOpenTreeTab(1);
  }
  if (shortcutMatches(event, "settings")) {
    event.preventDefault();
    toggleSettings();
  }
  if (shortcutMatches(event, "addChild")) {
    event.preventDefault();
    addChildToSelectedTreeNode();
  }
  if (shortcutMatches(event, "addRoot")) {
    event.preventDefault();
    addRootNote();
  }
}

function showCurrentSaveState() {
  if (state.view === "tree" && state.selectedTreeId) {
    showSaved(elements.treeSavedLabel);
    return;
  }
  if (!elements.dailyPopup.classList.contains("hidden")) {
    showSaved(elements.dailySavedLabel);
  }
}

function insertCurrentTimeIntoTreeNote() {
  const selected = getSelectedTreeNode();
  if (!selected || state.view !== "tree") return;
  if (!elements.markdownPreview.classList.contains("hidden")) {
    elements.markdownPreview.classList.add("hidden");
    elements.treeContent.classList.remove("hidden");
    elements.previewToggleBtn.textContent = t("editor.preview");
  }
  const marker = `[${timeLabel(new Date())}] `;
  const start = elements.treeContent.selectionStart ?? elements.treeContent.value.length;
  const end = elements.treeContent.selectionEnd ?? start;
  const before = elements.treeContent.value.slice(0, start);
  const after = elements.treeContent.value.slice(end);
  elements.treeContent.value = `${before}${marker}${after}`;
  const nextCursor = start + marker.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(nextCursor, nextCursor);
  syncTreeContentFromEditor();
}

function insertTextIntoTreeContent(text) {
  const selected = getSelectedTreeNode();
  if (!selected) return false;
  const start = elements.treeContent.selectionStart ?? elements.treeContent.value.length;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const spacerBefore = before && !before.endsWith("\n") ? "\n" : "";
  const spacerAfter = after && !String(text).endsWith("\n") ? "\n" : "";
  elements.treeContent.value = `${before}${spacerBefore}${text}${spacerAfter}${after}`;
  const nextCursor = before.length + spacerBefore.length + String(text).length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(nextCursor, nextCursor);
  syncTreeContentFromEditor();
  return true;
}

function createWritingTemplateNote(templateId = "project") {
  const template = writingTemplate(templateId);
  const parent = getSelectedTreeNode();
  const parentId = parent && parent.level < 3 ? parent.id : null;
  const level = parent && parent.level < 3 ? parent.level + 1 : 1;
  const node = createNode(template.title, template.content, parentId, level);
  node.properties = normalizeNoteProperties(template.properties);
  if (parentId) {
    parent.children.push(node);
    state.expandedTreeIds.add(parent.id);
  } else {
    state.data.tree.push(node);
  }
  state.selectedTreeId = node.id;
  persist();
  renderTree();
  showSaved(elements.treeSavedLabel);
  return node;
}

function insertWritingTemplateIntoCurrentNote(templateId = "project") {
  const selected = getSelectedTreeNode();
  if (!selected || isEncryptedContent(selected.content)) return false;
  const template = writingTemplate(templateId);
  insertTextIntoTreeContent(template.content);
  selected.properties = normalizeNoteProperties({ ...selected.properties, ...template.properties });
  markTreeNodeChanged(selected);
  persist();
  renderTree();
  return true;
}

function writingTemplate(templateId = "project") {
  return WRITING_TEMPLATES[templateId] || WRITING_TEMPLATES.project;
}

function createUniqueNote() {
  const stamp = uniqueNoteStamp(new Date());
  const node = createNode(`메모 ${stamp}`, `# 메모 ${stamp}\n\n`, null, 1);
  node.properties = normalizeNoteProperties({ status: "idea", priority: "normal", type: "빠른 메모" });
  state.data.tree.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(node.id);
  persist();
  renderTree();
  return node;
}

function uniqueNoteStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function openRandomNote() {
  const nodes = flattenTree(state.data.tree).filter((node) => node.status !== "deleted");
  if (!nodes.length) {
    showNotice(t("quick.empty"), "info");
    return false;
  }
  const node = nodes[Math.floor(Math.random() * nodes.length)];
  selectTreeNode(node.id);
  return true;
}

function mergeSelectedNoteChildren() {
  const selected = getSelectedTreeNode();
  if (!selected || isEncryptedContent(selected.content) || !selected.children.length) return false;
  const sections = selected.children.map((child) => [
    `## ${noteTitle(child.title)}`,
    "",
    visibleContentForNode(child).trim(),
  ].join("\n").trim());
  selected.content = [selected.content || "", "## 하위 메모 병합", ...sections]
    .filter((part) => part.trim())
    .join("\n\n");
  selected.tags = extractTags(selected.content);
  markTreeNodeChanged(selected);
  elements.treeContent.value = editableContentForNode(selected);
  persist();
  renderTree();
  return true;
}

function splitSelectedNoteByHeading() {
  const selected = getSelectedTreeNode();
  if (!selected || isEncryptedContent(selected.content) || selected.level >= 3) return false;
  const sections = splitContentBySecondLevelHeading(selected.content);
  if (!sections.parts.length) return false;
  selected.content = sections.intro.trim();
  selected.tags = extractTags(selected.content);
  sections.parts.slice(0, 20).forEach((part) => {
    const child = createNode(part.title, part.content, selected.id, selected.level + 1);
    child.properties = normalizeNoteProperties({ ...selected.properties });
    selected.children.push(child);
  });
  state.expandedTreeIds.add(selected.id);
  markTreeNodeChanged(selected);
  elements.treeContent.value = editableContentForNode(selected);
  persist();
  renderTree();
  return true;
}

function splitContentBySecondLevelHeading(content) {
  const lines = String(content || "").split(/\r?\n/);
  const intro = [];
  const parts = [];
  let current = null;
  lines.forEach((line) => {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) parts.push(current);
      current = { title: heading[1].trim().slice(0, 80) || t("note.newNote"), lines: [] };
      return;
    }
    if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  });
  if (current) parts.push(current);
  return {
    intro: intro.join("\n"),
    parts: parts
      .map((part) => ({ title: part.title, content: part.lines.join("\n").trim() }))
      .filter((part) => part.title || part.content),
  };
}

function handleTreeContentShortcut(event) {
  if (event.key === "Enter" && executeSlashCommandFromEditor()) {
    consumeTreeContentShortcut(event);
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && continueMarkdownLineOnEnter()) {
    consumeTreeContentShortcut(event);
    return;
  }
  if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) {
    consumeTreeContentShortcut(event);
    indentTreeContentSelection(event.shiftKey ? -1 : 1);
    return;
  }
  if (!state.settings.enableShortcuts) return;
  if (shortcutMatches(event, "indent") || shortcutMatches(event, "outdent")) {
    consumeTreeContentShortcut(event);
    indentTreeContentSelection(shortcutMatches(event, "outdent") ? -1 : 1);
    return;
  }
  if (shortcutMatches(event, "bold")) {
    consumeTreeContentShortcut(event);
    wrapTreeContentSelection("**", "**");
  }
  if (shortcutMatches(event, "italic")) {
    consumeTreeContentShortcut(event);
    wrapTreeContentSelection("*", "*");
  }
  if (shortcutMatches(event, "checklist")) {
    consumeTreeContentShortcut(event);
    insertChecklistIntoTreeContent();
  }
  if (shortcutMatches(event, "orderedList")) {
    consumeTreeContentShortcut(event);
    insertOrderedListIntoTreeContent();
  }
  if (shortcutMatches(event, "quote")) {
    consumeTreeContentShortcut(event);
    applyLinePrefixToTreeContent("> ", /^>\s*/);
  }
  if (shortcutMatches(event, "codeBlock")) {
    consumeTreeContentShortcut(event);
    wrapTreeContentAsCodeBlock();
  }
  if (shortcutMatches(event, "horizontalRule")) {
    consumeTreeContentShortcut(event);
    insertHorizontalRuleIntoTreeContent();
  }
  if (shortcutMatches(event, "link")) {
    consumeTreeContentShortcut(event);
    wrapTreeContentAsMarkdownLink();
  }
  if (shortcutMatches(event, "heading1") || shortcutMatches(event, "heading2") || shortcutMatches(event, "heading3")) {
    consumeTreeContentShortcut(event);
    const level = shortcutMatches(event, "heading1") ? 1 : shortcutMatches(event, "heading2") ? 2 : 3;
    applyHeadingToTreeContent(level);
  }
}

function executeSlashCommandFromEditor() {
  const selected = getSelectedTreeNode();
  if (!selected || isEncryptedContent(selected.content)) return false;
  const cursor = elements.treeContent.selectionStart ?? 0;
  const value = elements.treeContent.value;
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const lineEndIndex = value.indexOf("\n", cursor);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const commandText = value.slice(lineStart, lineEnd).trim();
  if (!commandText.startsWith("/")) return false;
  const [name, ...args] = commandText.slice(1).split(/\s+/).filter(Boolean);
  if (!name) return false;
  const before = value.slice(0, lineStart);
  const after = value.slice(lineEndIndex === -1 ? lineEnd : lineEnd + 1);
  elements.treeContent.value = `${before}${after}`;
  elements.treeContent.setSelectionRange(lineStart, lineStart);
  syncTreeContentFromEditor();
  const normalized = name.toLowerCase();
  if (normalized === "time") {
    insertCurrentTimeIntoTreeNote();
  } else if (normalized === "check" || normalized === "todo") {
    insertChecklistIntoTreeContent();
  } else if (normalized === "template") {
    insertWritingTemplateIntoCurrentNote(args[0] || "project");
  } else if (normalized === "unique") {
    createUniqueNote();
  } else if (normalized === "random") {
    openRandomNote();
  } else if (normalized === "split") {
    splitSelectedNoteByHeading();
  } else if (normalized === "merge") {
    mergeSelectedNoteChildren();
  } else {
    showNotice("알 수 없는 작성 명령입니다.", "error");
  }
  return true;
}

function consumeTreeContentShortcut(event) {
  event.preventDefault();
  event.stopPropagation();
}

function continueMarkdownLineOnEnter() {
  const selected = getSelectedTreeNode();
  if (!selected) return false;
  const cursor = elements.treeContent.selectionStart ?? 0;
  const value = elements.treeContent.value;
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const line = value.slice(lineStart, cursor);
  const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);
  if (quoteMatch) {
    const [, marker, body] = quoteMatch;
    if (!body.trim()) {
      const before = value.slice(0, lineStart);
      const after = value.slice(cursor);
      elements.treeContent.value = `${before}${after}`;
      elements.treeContent.setSelectionRange(lineStart, lineStart);
    } else {
      elements.treeContent.value = `${value.slice(0, cursor)}\n${marker}${value.slice(cursor)}`;
      const nextCursor = cursor + 1 + marker.length;
      elements.treeContent.setSelectionRange(nextCursor, nextCursor);
    }
    syncTreeContentFromEditor();
    return true;
  }
  const orderedListMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (orderedListMatch) {
    const [, indent, number, body] = orderedListMatch;
    if (!body.trim()) {
      const before = value.slice(0, lineStart);
      const after = value.slice(cursor);
      elements.treeContent.value = `${before}${after}`;
      elements.treeContent.setSelectionRange(lineStart, lineStart);
    } else {
      const nextMarker = `${indent}${Number(number) + 1}. `;
      elements.treeContent.value = `${value.slice(0, cursor)}\n${nextMarker}${value.slice(cursor)}`;
      const nextCursor = cursor + 1 + nextMarker.length;
      elements.treeContent.setSelectionRange(nextCursor, nextCursor);
    }
    syncTreeContentFromEditor();
    return true;
  }
  const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
  if (!listMatch) return false;
  const [, indent, bullet, body] = listMatch;
  const taskMatch = body.match(/^\[([ xX])\]\s*(.*)$/);
  if (!body.trim() || (taskMatch && !taskMatch[2].trim())) {
    const before = value.slice(0, lineStart);
    const after = value.slice(cursor);
    elements.treeContent.value = `${before}${after}`;
    elements.treeContent.setSelectionRange(lineStart, lineStart);
  } else {
    const nextMarker = taskMatch ? `${indent}${bullet} [ ] ` : `${indent}${bullet} `;
    elements.treeContent.value = `${value.slice(0, cursor)}\n${nextMarker}${value.slice(cursor)}`;
    const nextCursor = cursor + 1 + nextMarker.length;
    elements.treeContent.setSelectionRange(nextCursor, nextCursor);
  }
  syncTreeContentFromEditor();
  return true;
}

function syncTreeContentFromEditor() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  if (isEncryptedContent(selected.content)) {
    const unlocked = unlockedEncryptedNotes.get(selected.id);
    if (!unlocked) return;
    unlocked.plain = elements.treeContent.value;
    scheduleEncryptedNoteSave(selected);
    renderMarkdownPreview(unlocked.plain);
    renderTags();
    renderNoteStats({ ...selected, content: unlocked.plain });
    renderOutlinePanel({ ...selected, content: unlocked.plain });
    renderLinkPanel();
    return;
  }
  selected.content = elements.treeContent.value;
  selected.tags = extractTags(selected.content);
  markTreeNodeChanged(selected);
  persist();
  renderMarkdownPreview(selected.content);
  renderTags();
  renderNoteStats(selected);
  renderOutlinePanel(selected);
  renderLinkPanel();
  showSaved(elements.treeSavedLabel);
}

function indentTreeContentSelection(direction) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const selectionEndForLine = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
    ? selectionEnd - 1
    : selectionEnd;
  const lineEnd = value.indexOf("\n", selectionEndForLine);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const indent = " ".repeat(normalizeTabIndentSize(state.settings.tabIndentSize));
  const nextBlock = block
    .split("\n")
    .map((line) => {
      if (direction > 0) return `${indent}${line}`;
      return line.replace(new RegExp(`^ {1,${indent.length}}`), "");
    })
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  const delta = nextBlock.length - block.length;
  const nextStart = Math.max(lineStart, selectionStart + (direction > 0 ? indent.length : Math.min(0, delta)));
  const nextEnd = Math.max(nextStart, selectionEnd + delta);
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(nextStart, nextEnd);
  syncTreeContentFromEditor();
}

function wrapTreeContentSelection(prefix, suffix) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  elements.treeContent.value = `${value.slice(0, start)}${prefix}${selectedText}${suffix}${value.slice(end)}`;
  const cursorStart = start + prefix.length;
  const cursorEnd = cursorStart + selectedText.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertHorizontalRuleIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end).trimStart();
  const rule = `${before ? `${before}\n\n` : ""}---${after ? `\n\n${after}` : ""}`;
  elements.treeContent.value = rule;
  const cursor = (before ? before.length + 2 : 0) + 3;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursor, cursor);
  syncTreeContentFromEditor();
}

function wrapTreeContentAsMarkdownLink() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end) || t("note.linkFallbackTitle");
  const linkText = `[${selectedText}](https://)`;
  elements.treeContent.value = `${value.slice(0, start)}${linkText}${value.slice(end)}`;
  const urlStart = start + selectedText.length + 3;
  const urlEnd = urlStart + "https://".length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(urlStart, urlEnd);
  syncTreeContentFromEditor();
}

function wrapTreeContentAsCodeBlock() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const codeBlock = `\`\`\`\n${selectedText}\n\`\`\``;
  elements.treeContent.value = `${value.slice(0, start)}${codeBlock}${value.slice(end)}`;
  const cursorStart = start + 4;
  const cursorEnd = cursorStart + selectedText.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function applyLinePrefixToTreeContent(prefix, cleanupPattern) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => `${prefix}${line.replace(cleanupPattern, "")}`)
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(lineStart, lineStart + nextBlock.length);
  syncTreeContentFromEditor();
}

function applyHeadingToTreeContent(level) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const marker = `${"#".repeat(level)} `;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => `${marker}${line.replace(/^#{1,6}\s+/, "")}`)
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  const cursorStart = lineStart;
  const cursorEnd = lineStart + nextBlock.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertChecklistIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const checklist = selectedText
    ? selectedText
      .split("\n")
      .map((line) => `- [ ] ${line.replace(/^[-*]\s+\[[ xX]\]\s*/, "").trimStart()}`)
      .join("\n")
    : "- [ ] ";
  elements.treeContent.value = `${value.slice(0, start)}${checklist}${value.slice(end)}`;
  const cursorStart = start + (selectedText ? 0 : checklist.length);
  const cursorEnd = start + checklist.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertOrderedListIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const orderedList = selectedText
    ? selectedText
      .split("\n")
      .map((line, index) => `${index + 1}. ${line.replace(/^(\d+\.\s+|[-*]\s+)/, "").trimStart()}`)
      .join("\n")
    : "1. ";
  elements.treeContent.value = `${value.slice(0, start)}${orderedList}${value.slice(end)}`;
  const cursorStart = start + (selectedText ? 0 : orderedList.length);
  const cursorEnd = start + orderedList.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function renderGraph() {
  syncGraphControls();
  const model = graphModel();
  const selected = getSelectedTreeNode();
  elements.graphSummary.innerHTML = graphSummaryHtml(model);
  renderGraphCanvas(model);
  renderGraphEdges(model);
  renderGraphMiniList(elements.graphOutgoingList, selected ? outgoingLinksFor({ ...selected, content: visibleContentForNode(selected) }) : [], graphOutgoingItem);
  renderGraphMiniList(elements.graphBacklinkList, selected ? backlinksFor(selected) : [], graphNodeButton);
  renderGraphMiniList(elements.graphSuggestionsList, selected ? unlinkedMentionSuggestions(selected) : [], graphSuggestionButton);
  renderGraphMiniList(elements.graphIsolatedList, model.isolated.slice(0, 12), graphNodeButton);
  renderGraphMiniList(elements.graphHubList, model.hubs.slice(0, 12), graphHubButton);
}

function syncGraphControls() {
  state.settings.graph = normalizeGraphSettings(state.settings.graph);
  const graph = state.settings.graph;
  elements.graphModeSelect.value = graph.mode;
  elements.graphDepthSelect.value = String(graph.depth);
  elements.graphGroupSelect.value = graph.group;
  elements.graphFilterInput.value = graph.filter;
  const tags = tagSummary().map((tag) => tag.name);
  elements.graphTagSelect.replaceChildren(
    optionElement("", "전체 태그"),
    ...tags.map((tag) => optionElement(tag, `#${tag}`)),
  );
  elements.graphTagSelect.value = tags.includes(graph.tag) ? graph.tag : "";
  if (graph.tag && !tags.includes(graph.tag)) {
    graph.tag = "";
    persistSettings();
  }
  elements.graphBookmarkSelect.replaceChildren(
    optionElement("", "북마크"),
    ...graph.bookmarks.map((bookmark, index) => optionElement(String(index), bookmark.name)),
  );
}

function optionElement(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function graphModel() {
  const settings = state.settings.graph || defaultGraphSettings();
  const allNodes = flattenTree(state.data.tree);
  const byTitle = new Map(allNodes.map((node) => [noteTitle(node.title).toLowerCase(), node]));
  const allEdges = allNodes.flatMap((from) => (
    uniqueWikiLinks(graphNodeContent(from))
      .map((title) => ({ from, to: byTitle.get(title.toLowerCase()), title }))
      .filter((edge) => edge.to && edge.to.id !== from.id)
  ));
  const localIds = settings.mode === "local" && state.selectedTreeId
    ? localGraphNodeIds(state.selectedTreeId, allEdges, settings.depth)
    : null;
  const visibleNodes = allNodes.filter((node) => graphNodeVisible(node, localIds));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = allEdges.filter((edge) => visibleIds.has(edge.from.id) && visibleIds.has(edge.to.id));
  const degree = new Map(visibleNodes.map((node) => [node.id, 0]));
  visibleEdges.forEach((edge) => {
    degree.set(edge.from.id, (degree.get(edge.from.id) || 0) + 1);
    degree.set(edge.to.id, (degree.get(edge.to.id) || 0) + 1);
  });
  const isolated = visibleNodes.filter((node) => (degree.get(node.id) || 0) === 0);
  const hubs = visibleNodes
    .map((node) => ({ node, degree: degree.get(node.id) || 0 }))
    .filter((item) => item.degree > 0)
    .sort((a, b) => b.degree - a.degree || noteTitle(a.node.title).localeCompare(noteTitle(b.node.title)));
  return { nodes: visibleNodes, edges: visibleEdges, isolated, hubs, degree };
}

function graphNodeVisible(node, localIds) {
  if (localIds && !localIds.has(node.id)) return false;
  const settings = state.settings.graph || defaultGraphSettings();
  const tag = settings.tag.trim().toLowerCase();
  if (tag && !node.tags?.some((item) => item.toLowerCase() === tag)) return false;
  const filter = settings.filter.trim().toLowerCase();
  if (!filter) return true;
  const text = [
    noteTitle(node.title),
    graphNodeContent(node),
    treePath(node.id).join(" / "),
    node.tags?.join(" ") || "",
    graphGroupLabel(node, settings.group),
  ].join(" ").toLowerCase();
  return text.includes(filter);
}

function localGraphNodeIds(rootId, edges, depth) {
  const graph = new Map();
  edges.forEach((edge) => {
    if (!graph.has(edge.from.id)) graph.set(edge.from.id, new Set());
    if (!graph.has(edge.to.id)) graph.set(edge.to.id, new Set());
    graph.get(edge.from.id).add(edge.to.id);
    graph.get(edge.to.id).add(edge.from.id);
  });
  const visited = new Set([rootId]);
  const queue = [{ id: rootId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= depth) continue;
    for (const nextId of graph.get(current.id) || []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }
  return visited;
}

function graphNodeContent(node) {
  return isEncryptedContent(node.content) ? "" : (node.content || "");
}

function graphGroupLabel(node, group) {
  if (group === "tag") return node.tags?.[0] ? `#${node.tags[0]}` : "태그 없음";
  if (group === "share") return node.shared === false ? "로컬" : "공유";
  if (group === "analysis") return node.analysisJobId || node.analysisStatus ? "분석 있음" : "분석 전";
  return treePath(node.id)[0] || noteTitle(node.title);
}

function graphSummaryHtml(model) {
  const settings = state.settings.graph || defaultGraphSettings();
  const mode = settings.mode === "local" ? `로컬 깊이 ${settings.depth}` : "전체";
  const filters = [settings.filter && `검색 ${settings.filter}`, settings.tag && `#${settings.tag}`, `그룹 ${graphGroupName(settings.group)}`]
    .filter(Boolean)
    .join(" · ");
  return `
    <span>${escapeHtml(mode)}</span>
    <span>노드 ${model.nodes.length}</span>
    <span>연결 ${model.edges.length}</span>
    <span>고립 ${model.isolated.length}</span>
    <span>허브 ${model.hubs.length}</span>
    ${filters ? `<span>${escapeHtml(filters)}</span>` : ""}
  `;
}

function graphGroupName(group) {
  return { topic: "주제", tag: "태그", share: "공유", analysis: "분석" }[group] || "주제";
}

function renderGraphCanvas(model) {
  if (model.nodes.length === 0) {
    elements.graphCanvas.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.graphEmpty"))}</div>`;
    return;
  }
  const width = 760;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(280, 72 + model.nodes.length * 9);
  const selectedId = state.selectedTreeId;
  const settings = state.settings.graph || defaultGraphSettings();
  const positions = new Map();
  model.nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, model.nodes.length) - Math.PI / 2;
    const degree = model.degree.get(node.id) || 0;
    const nodeRadius = Math.max(6, Math.min(14, 6 + degree * 2));
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * Math.min(radius, 112),
      r: nodeRadius,
    });
  });
  const edgeSvg = model.edges.map((edge) => {
    const from = positions.get(edge.from.id);
    const to = positions.get(edge.to.id);
    if (!from || !to) return "";
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
  }).join("");
  const nodeSvg = model.nodes.map((node) => {
    const pos = positions.get(node.id);
    const active = node.id === selectedId ? " active" : "";
    const label = escapeHtml(noteTitle(node.title));
    const group = escapeHtml(graphGroupLabel(node, settings.group));
    return `
      <button class="graph-node${active}" type="button" style="left:${(pos.x / width) * 100}%;top:${(pos.y / height) * 100}%" data-node-id="${escapeHtml(node.id)}">
        <span class="dot" style="--node-size:${pos.r * 2}px"></span>
        <strong>${label}</strong>
        <small>${group}</small>
      </button>
    `;
  }).join("");
  elements.graphCanvas.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${edgeSvg}</svg>
    ${nodeSvg}
  `;
  elements.graphCanvas.querySelectorAll("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectTreeNode(button.dataset.nodeId);
      renderGraph();
    });
  });
}

function renderGraphEdges(model) {
  if (model.edges.length === 0) {
    elements.graphList.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.graphEmpty"))}</div>`;
    return;
  }
  elements.graphList.replaceChildren(
    ...model.edges.slice(0, 80).map((link) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "graph-link";
      const fromTitle = noteTitle(link.from.title);
      const toTitle = noteTitle(link.to.title);
      row.innerHTML = `<strong>${escapeHtml(fromTitle)}</strong><span>→</span><strong>${escapeHtml(toTitle)}</strong>`;
      row.addEventListener("click", () => {
        selectTreeNode(link.to.id);
        renderGraph();
      });
      return row;
    }),
  );
}

function renderGraphMiniList(container, items, renderer) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.emptyState"))}</div>`;
    return;
  }
  container.replaceChildren(...items.map(renderer));
}

function graphOutgoingItem(link) {
  return linkButton(link.title, link.node, link.exists);
}

function graphNodeButton(node) {
  const item = node.node ? node.node : node;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "backlink-item";
  button.innerHTML = `<strong>${escapeHtml(noteTitle(item.title))}</strong><span>${escapeHtml(snippet(graphNodeContent(item)))}</span>`;
  button.addEventListener("click", () => {
    selectTreeNode(item.id);
    renderGraph();
  });
  return button;
}

function graphHubButton(item) {
  const button = graphNodeButton(item.node);
  button.querySelector("span").textContent = `연결 ${item.degree}개`;
  return button;
}

function graphSuggestionButton(candidate) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "backlink-item suggestion-item";
  button.innerHTML = `<strong>${escapeHtml(noteTitle(candidate.target.title))}</strong><span>${escapeHtml(candidate.preview)}</span>`;
  button.addEventListener("click", () => applyLinkSuggestion(candidate));
  return button;
}

function unlinkedMentionSuggestions(source) {
  if (!source || isEncryptedContent(source.content)) return [];
  const content = source.content || "";
  const linkedTitles = new Set(uniqueWikiLinks(content).map((title) => title.toLowerCase()));
  return flattenTree(state.data.tree)
    .filter((target) => target.id !== source.id)
    .filter((target) => {
      const title = noteTitle(target.title);
      return title && !linkedTitles.has(title.toLowerCase()) && content.toLowerCase().includes(title.toLowerCase());
    })
    .slice(0, 12)
    .map((target) => ({ source, target, preview: `본문에 "${noteTitle(target.title)}" 언급` }));
}

function applyLinkSuggestion(candidate) {
  const source = candidate.source;
  const title = noteTitle(candidate.target.title);
  const pattern = new RegExp(`(^|[^\\[])(${escapeRegExp(title)})(?!\\]\\])`, "i");
  source.content = (source.content || "").replace(pattern, `$1[[${title}]]`);
  source.updatedAt = new Date().toISOString();
  source.syncState = "pending";
  if (state.selectedTreeId === source.id) {
    elements.treeContent.value = source.content;
  }
  persist();
  renderTree();
  renderGraph();
}

function saveGraphBookmark() {
  const graph = normalizeGraphSettings(state.settings.graph);
  const label = [
    graph.mode === "local" ? `로컬${graph.depth}` : "전체",
    graph.tag && `#${graph.tag}`,
    graph.filter || "",
    graphGroupName(graph.group),
  ].filter(Boolean).join(" · ");
  const bookmark = {
    name: label || `그래프 ${new Date().toLocaleTimeString()}`,
    mode: graph.mode,
    depth: graph.depth,
    filter: graph.filter,
    tag: graph.tag,
    group: graph.group,
  };
  graph.bookmarks = [bookmark, ...graph.bookmarks.filter((item) => item.name !== bookmark.name)].slice(0, 12);
  state.settings.graph = graph;
  persistSettings();
  syncGraphControls();
}

function applyGraphBookmark() {
  const index = Number(elements.graphBookmarkSelect.value);
  const bookmark = state.settings.graph.bookmarks[index];
  if (!bookmark) return;
  state.settings.graph = normalizeGraphSettings({
    ...state.settings.graph,
    ...bookmark,
    bookmarks: state.settings.graph.bookmarks,
  });
  persistSettings();
  renderGraph();
}

function propertyStatusKeys() {
  return ["idea", "active", "waiting", "done"];
}

function propertyPriorityKeys() {
  return ["low", "normal", "high"];
}

function propertyGroupKeys() {
  return ["status", "priority", "type", "project", "share"];
}

function defaultNoteProperties() {
  return {
    status: "",
    priority: "",
    type: "",
    source: "",
    author: "",
    dueDate: "",
    project: "",
  };
}

function normalizeNoteProperties(properties = {}) {
  const source = properties && typeof properties === "object" ? properties : {};
  const normalized = {
    ...defaultNoteProperties(),
    ...source,
  };
  normalized.status = propertyStatusKeys().includes(normalized.status) ? normalized.status : "";
  normalized.priority = propertyPriorityKeys().includes(normalized.priority) ? normalized.priority : "";
  normalized.type = normalizeText(normalized.type).slice(0, 60);
  normalized.source = normalizeText(normalized.source).slice(0, 160);
  normalized.author = normalizeText(normalized.author).slice(0, 60);
  normalized.project = normalizeText(normalized.project).slice(0, 80);
  normalized.dueDate = isDateKey(normalized.dueDate) ? normalized.dueDate : "";
  return normalized;
}

function propertyLabel(kind, value) {
  const labels = {
    status: { idea: "아이디어", active: "진행", waiting: "대기", done: "완료" },
    priority: { low: "낮음", normal: "보통", high: "높음" },
  };
  return labels[kind]?.[value] || value || "미지정";
}

function renderNoteProperties(node) {
  const properties = normalizeNoteProperties(node.properties);
  node.properties = properties;
  elements.propertyStatusSelect.value = properties.status;
  elements.propertyPrioritySelect.value = properties.priority;
  elements.propertyTypeInput.value = properties.type;
  elements.propertyProjectInput.value = properties.project;
  elements.propertySourceInput.value = properties.source;
  elements.propertyAuthorInput.value = properties.author;
  elements.propertyDueInput.value = properties.dueDate;
}

function updateSelectedNoteProperties() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  if (isReadOnlyTreeNode(selected)) return;
  selected.properties = normalizeNoteProperties({
    status: elements.propertyStatusSelect.value,
    priority: elements.propertyPrioritySelect.value,
    type: elements.propertyTypeInput.value,
    project: elements.propertyProjectInput.value,
    source: elements.propertySourceInput.value,
    author: elements.propertyAuthorInput.value,
    dueDate: elements.propertyDueInput.value,
  });
  markTreeNodeChanged(selected);
  persist();
  renderTreeListOnly();
  renderSidebarKnowledge();
  if (!elements.propertiesView.classList.contains("hidden")) renderPropertiesView();
  showSaved(elements.treeSavedLabel);
}

function openPropertiesView() {
  closePopupLayers();
  syncPropertyControls();
  renderPropertiesView();
  elements.propertiesView.classList.remove("hidden");
  elements.propertiesSearchInput.focus();
}

function closePropertiesView() {
  elements.propertiesView.classList.add("hidden");
}

function syncPropertyControls() {
  const settings = normalizePropertyViewSettings(state.settings.properties);
  state.settings.properties = settings;
  elements.propertiesSearchInput.value = settings.search || "";
  elements.propertiesStatusFilter.value = settings.status || "";
  elements.propertiesPriorityFilter.value = settings.priority || "";
  elements.propertiesGroupSelect.value = settings.group || "status";
  elements.propertiesSavedFilterSelect.replaceChildren(
    optionElement("", "저장 필터"),
    ...settings.savedFilters.map((filter, index) => optionElement(String(index), filter.name)),
  );
}

function propertyMatches(node, settings) {
  const properties = normalizeNoteProperties(node.properties);
  if (settings.status && properties.status !== settings.status) return false;
  if (settings.priority && properties.priority !== settings.priority) return false;
  const query = (settings.search || "").toLowerCase();
  if (!query) return true;
  return [
    node.title,
    node.content,
    properties.status,
    properties.priority,
    properties.type,
    properties.source,
    properties.author,
    properties.project,
    properties.dueDate,
    ...(node.tags || []),
  ].join(" ").toLowerCase().includes(query);
}

function propertyGroupValue(node, group) {
  const properties = normalizeNoteProperties(node.properties);
  if (group === "share") return node.shared === false ? "비공유" : "공유";
  if (group === "status") return propertyLabel("status", properties.status);
  if (group === "priority") return propertyLabel("priority", properties.priority);
  if (group === "type") return properties.type || "미지정";
  if (group === "project") return properties.project || "미지정";
  return "미지정";
}

function renderPropertiesView() {
  const settings = normalizePropertyViewSettings(state.settings.properties);
  state.settings.properties = settings;
  syncPropertyControls();
  const nodes = flattenTree(state.data.tree);
  const filtered = nodes.filter((node) => propertyMatches(node, settings));
  const missing = nodes.filter((node) => missingPropertyKeys(node).length > 0);
  elements.propertiesSummary.innerHTML = [
    `<span>전체 <strong>${nodes.length}</strong></span>`,
    `<span>표시 <strong>${filtered.length}</strong></span>`,
    `<span>누락 <strong>${missing.length}</strong></span>`,
  ].join("");
  if (filtered.length === 0) {
    elements.propertiesList.innerHTML = `<div class="empty-compact">조건에 맞는 메모가 없습니다.</div>`;
  } else {
    const groups = groupBy(filtered, (node) => propertyGroupValue(node, settings.group));
    elements.propertiesList.replaceChildren(
      ...Array.from(groups.entries()).map(([groupName, groupNodes]) => propertyGroupElement(groupName, groupNodes)),
    );
  }
  renderPropertiesMissingList(missing.slice(0, 12));
}

function propertyGroupElement(groupName, nodes) {
  const section = document.createElement("section");
  section.className = "properties-group";
  const rows = nodes
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((node) => propertyRowHtml(node))
    .join("");
  section.innerHTML = `<h3>${escapeHtml(groupName)} <span>${nodes.length}</span></h3><div class="properties-table">${rows}</div>`;
  section.querySelectorAll("[data-note-id]").forEach((button) => {
    button.addEventListener("click", () => selectTreeNode(button.dataset.noteId));
  });
  return section;
}

function propertyRowHtml(node) {
  const properties = normalizeNoteProperties(node.properties);
  const chips = [
    propertyLabel("status", properties.status),
    propertyLabel("priority", properties.priority),
    properties.type,
    properties.project,
    properties.dueDate,
    node.shared === false ? "비공유" : "공유",
  ].filter(Boolean);
  return `
    <button class="properties-row" type="button" data-note-id="${escapeHtml(node.id)}">
      <strong>${escapeHtml(noteTitle(node.title))}</strong>
      <span>${chips.map((chip) => escapeHtml(chip)).join(" · ")}</span>
    </button>
  `;
}

function missingPropertyKeys(node) {
  const properties = normalizeNoteProperties(node.properties);
  return ["status", "priority", "type", "project"].filter((key) => !properties[key]);
}

function renderPropertiesMissingList(nodes) {
  if (nodes.length === 0) {
    elements.propertiesMissingList.innerHTML = `<div class="empty-compact">누락 속성이 없습니다.</div>`;
    return;
  }
  renderGraphMiniList(elements.propertiesMissingList, nodes, (node) => {
    const missing = missingPropertyKeys(node).join(", ");
    const button = graphNodeButton(node);
    button.querySelector("span").textContent = `누락: ${missing}`;
    return button;
  });
}

function savePropertyFilter() {
  const settings = normalizePropertyViewSettings(state.settings.properties);
  const parts = [
    settings.search,
    propertyLabel("status", settings.status),
    propertyLabel("priority", settings.priority),
    propertyGroupValue({ shared: true, properties: { [settings.group]: "" } }, settings.group),
  ].filter((part) => part && part !== "미지정");
  const filter = {
    name: parts.slice(0, 3).join(" · ") || `속성 ${new Date().toLocaleTimeString()}`,
    search: settings.search,
    status: settings.status,
    priority: settings.priority,
    group: settings.group,
  };
  settings.savedFilters = [filter, ...settings.savedFilters.filter((item) => item.name !== filter.name)].slice(0, 12);
  state.settings.properties = settings;
  persistSettings();
  syncPropertyControls();
}

function applyPropertyFilter() {
  const index = Number(elements.propertiesSavedFilterSelect.value);
  const filter = state.settings.properties.savedFilters[index];
  if (!filter) return;
  state.settings.properties = normalizePropertyViewSettings({
    ...state.settings.properties,
    ...filter,
    savedFilters: state.settings.properties.savedFilters,
  });
  persistSettings();
  renderPropertiesView();
}

function createNoteFromPropertyTemplate() {
  const template = propertyTemplate(elements.propertyTemplateSelect.value);
  const node = createNode(template.title, template.content, null, 1);
  node.properties = normalizeNoteProperties(template.properties);
  state.data.tree.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(node.id);
  persist();
  closePropertiesView();
  renderTree();
}

function propertyTemplate(id) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const templates = {
    project: {
      title: `프로젝트 메모 ${now}`,
      content: "## 목표\n\n## 진행\n\n## 다음 행동\n",
      properties: { status: "active", priority: "normal", type: "프로젝트", project: "" },
    },
    meeting: {
      title: `회의 메모 ${now}`,
      content: "## 참석자\n\n## 결정\n\n## 할 일\n",
      properties: { status: "active", priority: "normal", type: "회의", project: "" },
    },
    source: {
      title: `자료 메모 ${now}`,
      content: "## 요약\n\n## 인용/근거\n\n## 연결할 메모\n",
      properties: { status: "idea", priority: "normal", type: "자료", source: "" },
    },
  };
  return templates[id] || templates.project;
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function defaultCanvas() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "생각 Canvas",
    cards: [],
    edges: [],
    zoom: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCanvas(canvas = {}) {
  const now = new Date().toISOString();
  const source = canvas && typeof canvas === "object" ? canvas : {};
  const cards = Array.isArray(source.cards) ? source.cards.filter(isPlainObject) : [];
  const cardIds = new Set(cards.map((card) => card.id).filter(Boolean));
  return {
    id: typeof source.id === "string" && source.id ? source.id : crypto.randomUUID(),
    title: normalizeText(source.title || "생각 Canvas").slice(0, 80),
    cards: cards.map((card) => normalizeCanvasCard(card)),
    edges: (Array.isArray(source.edges) ? source.edges : [])
      .filter(isPlainObject)
      .map((edge) => ({
        id: typeof edge.id === "string" && edge.id ? edge.id : crypto.randomUUID(),
        from: typeof edge.from === "string" ? edge.from : "",
        to: typeof edge.to === "string" ? edge.to : "",
        label: normalizeText(edge.label).slice(0, 60),
      }))
      .filter((edge) => edge.from && edge.to && edge.from !== edge.to && cardIds.has(edge.from) && cardIds.has(edge.to))
      .slice(0, 80),
    zoom: Math.min(1.8, Math.max(0.6, Number(source.zoom) || 1)),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || source.createdAt || now,
  };
}

function normalizeCanvasCard(card = {}) {
  const type = card.type === "text" ? "text" : "note";
  return {
    id: typeof card.id === "string" && card.id ? card.id : crypto.randomUUID(),
    type,
    noteId: type === "note" && typeof card.noteId === "string" ? card.noteId : "",
    text: normalizeText(card.text).slice(0, 600),
    x: Math.min(1800, Math.max(0, Number(card.x) || 80)),
    y: Math.min(1200, Math.max(0, Number(card.y) || 80)),
    width: Math.min(360, Math.max(180, Number(card.width) || 240)),
    color: normalizeText(card.color || "blue").slice(0, 24),
  };
}

function activeCanvas() {
  if (!Array.isArray(state.data.canvases)) state.data.canvases = [];
  if (state.data.canvases.length === 0) {
    state.data.canvases.push(defaultCanvas());
    persist();
  }
  state.data.canvases[0] = normalizeCanvas(state.data.canvases[0]);
  return state.data.canvases[0];
}

function markCanvasChanged(canvas = activeCanvas()) {
  canvas.updatedAt = new Date().toISOString();
  persist();
}

function openCanvasView() {
  closePopupLayers();
  renderCanvas();
  elements.canvasView.classList.remove("hidden");
}

function closeCanvasView() {
  elements.canvasView.classList.add("hidden");
}

function updateCanvasTitle() {
  const canvas = activeCanvas();
  canvas.title = normalizeText(elements.canvasTitleInput.value).slice(0, 80) || "생각 Canvas";
  markCanvasChanged(canvas);
  renderCanvasSummary(canvas);
}

function renderCanvas() {
  const canvas = activeCanvas();
  elements.canvasTitleInput.value = canvas.title;
  renderCanvasSummary(canvas);
  renderCanvasBoard(canvas);
}

function renderCanvasSummary(canvas) {
  elements.canvasSummary.innerHTML = [
    `<span>카드 <strong>${canvas.cards.length}</strong></span>`,
    `<span>연결 <strong>${canvas.edges.length}</strong></span>`,
    `<span>확대 <strong>${Math.round(canvas.zoom * 100)}%</strong></span>`,
  ].join("");
  const selected = state.selectedCanvasCardIds
    .map((id) => canvas.cards.find((card) => card.id === id))
    .filter(Boolean);
  elements.canvasSelectionLabel.textContent = selected.length
    ? selected.map(canvasCardTitle).join(" + ")
    : "카드를 선택하세요.";
}

function renderCanvasBoard(canvas) {
  if (canvas.cards.length === 0) {
    elements.canvasBoard.innerHTML = `<div class="empty-compact">메모 카드나 텍스트 카드를 추가하세요.</div>`;
    return;
  }
  const cardById = new Map(canvas.cards.map((card) => [card.id, card]));
  const edgeSvg = canvas.edges.map((edge) => {
    const from = cardById.get(edge.from);
    const to = cardById.get(edge.to);
    if (!from || !to) return "";
    const x1 = (from.x + from.width / 2) * canvas.zoom;
    const y1 = (from.y + 50) * canvas.zoom;
    const x2 = (to.x + to.width / 2) * canvas.zoom;
    const y2 = (to.y + 50) * canvas.zoom;
    const lx = (x1 + x2) / 2;
    const ly = (y1 + y2) / 2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line><text x="${lx}" y="${ly}">${escapeHtml(edge.label || "연결")}</text>`;
  }).join("");
  elements.canvasBoard.innerHTML = `
    <svg class="canvas-edges" viewBox="0 0 2200 1500" aria-hidden="true">${edgeSvg}</svg>
    ${canvas.cards.map((card) => canvasCardHtml(card, canvas.zoom)).join("")}
  `;
  elements.canvasBoard.querySelectorAll("[data-canvas-card-id]").forEach((cardEl) => {
    cardEl.addEventListener("click", () => toggleCanvasCardSelection(cardEl.dataset.canvasCardId));
    cardEl.querySelector("[data-action='open-note']")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = canvas.cards.find((item) => item.id === cardEl.dataset.canvasCardId);
      if (card?.noteId && findTreeNode(state.data.tree, card.noteId)) selectTreeNode(card.noteId);
    });
    cardEl.querySelector("[data-action='text']")?.addEventListener("input", (event) => {
      const card = canvas.cards.find((item) => item.id === cardEl.dataset.canvasCardId);
      if (!card) return;
      card.text = normalizeText(event.target.value).slice(0, 600);
      markCanvasChanged(canvas);
    });
  });
}

function canvasCardHtml(card, zoom) {
  const note = card.noteId ? findTreeNode(state.data.tree, card.noteId) : null;
  const selected = state.selectedCanvasCardIds.includes(card.id);
  const title = canvasCardTitle(card);
  const body = card.type === "text"
    ? `<textarea data-action="text" aria-label="텍스트 카드">${escapeHtml(card.text)}</textarea>`
    : `<p>${escapeHtml(note ? snippet(note.content || "") : "원본 메모 없음")}</p>`;
  const openButton = card.type === "note" && note
    ? `<button class="small-btn" type="button" data-action="open-note">열기</button>`
    : "";
  return `
    <article class="canvas-board-card ${selected ? "selected" : ""}" data-canvas-card-id="${escapeHtml(card.id)}" style="left:${card.x * zoom}px; top:${card.y * zoom}px; width:${card.width * zoom}px;">
      <header><strong>${escapeHtml(title)}</strong>${openButton}</header>
      ${body}
    </article>
  `;
}

function canvasCardTitle(card) {
  if (card.type === "text") return card.text.split(/\r?\n/).find(Boolean)?.slice(0, 28) || "텍스트 카드";
  const note = card.noteId ? findTreeNode(state.data.tree, card.noteId) : null;
  return note ? noteTitle(note.title) : "누락 메모";
}

function addSelectedNoteCanvasCard() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    showNotice("선택한 메모가 없습니다.", "error");
    return;
  }
  const canvas = activeCanvas();
  const offset = canvas.cards.length * 24;
  canvas.cards.push(normalizeCanvasCard({
    type: "note",
    noteId: selected.id,
    x: 80 + offset,
    y: 80 + offset,
  }));
  markCanvasChanged(canvas);
  renderCanvas();
}

function addTextCanvasCard() {
  const canvas = activeCanvas();
  const offset = canvas.cards.length * 24;
  const card = normalizeCanvasCard({
    type: "text",
    text: "새 생각",
    x: 120 + offset,
    y: 120 + offset,
  });
  canvas.cards.push(card);
  state.selectedCanvasCardIds = [card.id];
  markCanvasChanged(canvas);
  renderCanvas();
}

function toggleCanvasCardSelection(id) {
  if (!id) return;
  const selected = state.selectedCanvasCardIds.includes(id)
    ? state.selectedCanvasCardIds.filter((item) => item !== id)
    : [...state.selectedCanvasCardIds.slice(-1), id];
  state.selectedCanvasCardIds = selected.slice(-2);
  renderCanvas();
}

function moveSelectedCanvasCard(dx, dy) {
  const canvas = activeCanvas();
  const id = state.selectedCanvasCardIds[state.selectedCanvasCardIds.length - 1];
  const card = canvas.cards.find((item) => item.id === id);
  if (!card) return;
  card.x = Math.min(1800, Math.max(0, card.x + dx));
  card.y = Math.min(1200, Math.max(0, card.y + dy));
  markCanvasChanged(canvas);
  renderCanvas();
}

function connectSelectedCanvasCards() {
  const canvas = activeCanvas();
  const [from, to] = state.selectedCanvasCardIds;
  if (!from || !to || from === to) {
    showNotice("연결할 카드 2개를 선택하세요.", "error");
    return;
  }
  const exists = canvas.edges.some((edge) => edge.from === from && edge.to === to);
  if (!exists) {
    canvas.edges.push({ id: crypto.randomUUID(), from, to, label: "연결" });
    markCanvasChanged(canvas);
  }
  renderCanvas();
}

function adjustCanvasZoom(delta) {
  const canvas = activeCanvas();
  canvas.zoom = Math.min(1.8, Math.max(0.6, Math.round((canvas.zoom + delta) * 10) / 10));
  markCanvasChanged(canvas);
  renderCanvas();
}

function fitCanvasView() {
  const canvas = activeCanvas();
  canvas.zoom = 1;
  markCanvasChanged(canvas);
  renderCanvas();
}

function createCanvasDraftFromGraph() {
  const canvas = activeCanvas();
  const model = graphModel();
  const candidates = model.nodes.slice(0, 6);
  if (candidates.length === 0) {
    showNotice("Canvas로 보낼 그래프 메모가 없습니다.", "error");
    return;
  }
  canvas.cards = candidates.map((node, index) => normalizeCanvasCard({
    type: "note",
    noteId: node.id,
    x: 90 + (index % 3) * 280,
    y: 90 + Math.floor(index / 3) * 190,
  }));
  const cardByNoteId = new Map(canvas.cards.map((card) => [card.noteId, card.id]));
  canvas.edges = model.edges
    .filter((edge) => cardByNoteId.has(edge.from.id) && cardByNoteId.has(edge.to.id))
    .map((edge) => ({
      id: crypto.randomUUID(),
      from: cardByNoteId.get(edge.from.id),
      to: cardByNoteId.get(edge.to.id),
      label: edge.title || "연결",
    }))
    .slice(0, 12);
  state.selectedCanvasCardIds = [];
  markCanvasChanged(canvas);
  renderCanvas();
}

function defaultCaptureCard() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content: "",
    checklist: [],
    labels: [],
    color: "plain",
    pinned: false,
    reminderAt: "",
    archived: false,
    attachments: [],
    sketchData: "",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCaptureCard(capture = {}) {
  const source = capture && typeof capture === "object" ? capture : {};
  const card = {
    ...defaultCaptureCard(),
    ...source,
  };
  card.id = typeof card.id === "string" && card.id ? card.id : crypto.randomUUID();
  card.content = normalizeText(card.content).slice(0, 2000);
  card.checklist = Array.isArray(card.checklist)
    ? card.checklist
        .filter(isPlainObject)
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
          text: normalizeText(item.text).slice(0, 200),
          done: Boolean(item.done),
        }))
        .filter((item) => item.text)
        .slice(0, 40)
    : [];
  card.labels = Array.isArray(card.labels)
    ? card.labels.map((label) => normalizeText(label).replace(/^#/, "").slice(0, 32)).filter(Boolean).slice(0, 12)
    : [];
  card.color = ["plain", "blue", "green", "amber", "red"].includes(card.color) ? card.color : "plain";
  card.pinned = Boolean(card.pinned);
  card.reminderAt = typeof card.reminderAt === "string" && !Number.isNaN(new Date(card.reminderAt).getTime()) ? card.reminderAt : "";
  card.archived = Boolean(card.archived);
  card.attachments = Array.isArray(card.attachments)
    ? card.attachments.filter(isPlainObject).map(normalizeCaptureAttachment).filter(Boolean).slice(0, 8)
    : [];
  card.sketchData = typeof card.sketchData === "string" && card.sketchData.startsWith("data:image/png") ? card.sketchData : "";
  card.createdAt = card.createdAt || new Date().toISOString();
  card.updatedAt = card.updatedAt || card.createdAt;
  return card;
}

function normalizeCaptureAttachment(file = {}) {
  const name = normalizeText(file.name).slice(0, 160);
  if (!name) return null;
  return {
    id: typeof file.id === "string" && file.id ? file.id : crypto.randomUUID(),
    name,
    type: normalizeText(file.type).slice(0, 80),
    size: Math.max(0, Number(file.size) || 0),
    dataUrl: typeof file.dataUrl === "string" && file.dataUrl.startsWith("data:") ? file.dataUrl : "",
    addedAt: file.addedAt || new Date().toISOString(),
  };
}

function initializeCaptureSketch() {
  const canvas = elements.captureSketchCanvas;
  if (!canvas) return;
  clearCaptureSketch();
  let drawing = false;
  const draw = (event) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#2563eb";
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    captureSketchDirty = true;
  };
  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  });
  canvas.addEventListener("pointermove", draw);
  window.addEventListener("pointerup", () => {
    drawing = false;
  });
}

function clearCaptureSketch() {
  const canvas = elements.captureSketchCanvas;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  captureSketchDirty = false;
}

async function handleCaptureAttachmentChange() {
  const file = elements.captureAttachmentInput.files?.[0];
  if (!file) {
    pendingCaptureAttachment = null;
    elements.captureAttachmentLabel.textContent = "첨부 없음";
    return;
  }
  const dataUrl = await readFileAsDataUrl(file).catch(() => "");
  pendingCaptureAttachment = normalizeCaptureAttachment({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl,
  });
  elements.captureAttachmentLabel.textContent = `${file.name} · ${formatBytes(file.size)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openCaptureView() {
  closePopupLayers();
  renderCaptures();
  elements.captureView.classList.remove("hidden");
  elements.captureContentInput.focus();
}

function closeCaptureView() {
  elements.captureView.classList.add("hidden");
}

function saveQuickCapture() {
  const content = normalizeText(elements.captureContentInput.value);
  const checklistMode = elements.captureChecklistToggle.checked;
  const checklist = checklistMode
    ? content.split(/\r?\n/).map((line) => ({ id: crypto.randomUUID(), text: line.replace(/^[-*]\s*\[[ x]\]\s*/i, "").trim(), done: /\[[x]\]/i.test(line) })).filter((item) => item.text)
    : [];
  if (!content.trim() && !pendingCaptureAttachment && !captureSketchDirty) {
    showNotice("저장할 기록이 없습니다.", "error");
    return;
  }
  const canvas = elements.captureSketchCanvas;
  const capture = normalizeCaptureCard({
    content,
    checklist,
    labels: labelsFromInput(elements.captureLabelInput.value),
    color: elements.captureColorSelect.value,
    pinned: elements.capturePinToggle.checked,
    reminderAt: elements.captureReminderInput.value ? new Date(elements.captureReminderInput.value).toISOString() : "",
    archived: false,
    attachments: pendingCaptureAttachment ? [pendingCaptureAttachment] : [],
    sketchData: captureSketchDirty && canvas ? canvas.toDataURL("image/png") : "",
  });
  state.data.captures.unshift(capture);
  resetCaptureComposer();
  persist();
  renderCaptures();
}

function resetCaptureComposer() {
  elements.captureContentInput.value = "";
  elements.captureColorSelect.value = "plain";
  elements.captureLabelInput.value = "";
  elements.captureReminderInput.value = "";
  elements.captureChecklistToggle.checked = false;
  elements.capturePinToggle.checked = false;
  elements.captureAttachmentInput.value = "";
  elements.captureAttachmentLabel.textContent = "첨부 없음";
  pendingCaptureAttachment = null;
  clearCaptureSketch();
}

function labelsFromInput(value) {
  return normalizeText(value).split(/[,\s]+/).map((label) => label.replace(/^#/, "").trim()).filter(Boolean);
}

function renderCaptures() {
  state.data.captures = Array.isArray(state.data.captures) ? state.data.captures.map(normalizeCaptureCard) : [];
  const filter = elements.captureFilterSelect.value || "active";
  const query = normalizeText(elements.captureSearchInput.value).toLowerCase();
  const cards = state.data.captures
    .filter((card) => captureMatchesFilter(card, filter))
    .filter((card) => !query || [card.content, card.labels.join(" "), card.attachments.map((file) => file.name).join(" ")].join(" ").toLowerCase().includes(query))
    .sort(captureSort);
  elements.captureSummary.innerHTML = [
    `<span>전체 <strong>${state.data.captures.length}</strong></span>`,
    `<span>표시 <strong>${cards.length}</strong></span>`,
    `<span>리마인더 <strong>${state.data.captures.filter((card) => card.reminderAt && !card.archived).length}</strong></span>`,
  ].join("");
  if (cards.length === 0) {
    elements.captureList.innerHTML = `<div class="empty-compact">표시할 빠른 기록이 없습니다.</div>`;
    return;
  }
  elements.captureList.replaceChildren(...cards.map(captureCardElement));
}

function captureMatchesFilter(card, filter) {
  if (filter === "all") return true;
  if (filter === "pinned") return card.pinned && !card.archived;
  if (filter === "reminders") return Boolean(card.reminderAt) && !card.archived;
  if (filter === "archived") return card.archived;
  return !card.archived;
}

function captureSort(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}

function captureCardElement(card) {
  const article = document.createElement("article");
  article.className = `capture-item capture-${card.color}`;
  const checklist = card.checklist.length
    ? `<ul>${card.checklist.map((item) => `<li>${item.done ? "✓" : "□"} ${escapeHtml(item.text)}</li>`).join("")}</ul>`
    : "";
  const attachments = card.attachments.length
    ? `<div class="capture-attachments">${card.attachments.map((file) => `<span>${escapeHtml(file.name)} · ${escapeHtml(formatBytes(file.size))}</span>`).join("")}</div>`
    : "";
  const sketch = card.sketchData ? `<img src="${escapeHtml(card.sketchData)}" alt="그림 기록">` : "";
  article.innerHTML = `
    <header>
      <strong>${card.pinned ? "핀 · " : ""}${escapeHtml(card.labels.map((label) => `#${label}`).join(" ") || "빠른 기록")}</strong>
      <span>${escapeHtml(formatArchivedAt(card.updatedAt))}</span>
    </header>
    ${card.content ? `<p>${escapeHtml(card.content)}</p>` : ""}
    ${checklist}
    ${attachments}
    ${sketch}
    ${card.reminderAt ? `<div class="capture-reminder">리마인더 ${escapeHtml(formatArchivedAt(card.reminderAt))}</div>` : ""}
    <div class="capture-actions">
      <button class="secondary-btn" type="button" data-action="pin">${card.pinned ? "핀 해제" : "핀"}</button>
      <button class="secondary-btn" type="button" data-action="archive">${card.archived ? "복원" : "보관"}</button>
    </div>
  `;
  article.querySelector('[data-action="pin"]').addEventListener("click", () => toggleCapturePin(card.id));
  article.querySelector('[data-action="archive"]').addEventListener("click", () => toggleCaptureArchive(card.id));
  return article;
}

function toggleCapturePin(id) {
  const card = state.data.captures.find((item) => item.id === id);
  if (!card) return;
  card.pinned = !card.pinned;
  card.updatedAt = new Date().toISOString();
  persist();
  renderCaptures();
}

function toggleCaptureArchive(id) {
  const card = state.data.captures.find((item) => item.id === id);
  if (!card) return;
  card.archived = !card.archived;
  card.updatedAt = new Date().toISOString();
  persist();
  renderCaptures();
}

function formatBytes(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderDeletedTreeList() {
  const deleted = state.data.deletedTree || [];
  renderDeletedTreeButton();
  pruneDeletedTreeSelection();
  renderDeletedTreeControls();
  if (deleted.length === 0) {
    elements.deletedTreeList.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.deletedTreeEmpty"))}</div>`;
    return;
  }
  elements.deletedTreeList.replaceChildren(
    ...deleted.map((node) => {
      const selected = state.selectedDeletedTreeIds.has(node.id);
      const item = document.createElement("article");
      item.className = "archive-item";
      item.classList.toggle("selected", selected);
      item.innerHTML = `
        <label class="archive-check" aria-label="${escapeHtml(t("note.selectLabel", { title: noteTitle(node.title) }))}">
          <input type="checkbox" data-action="select" ${selected ? "checked" : ""}>
        </label>
        <div class="archive-info">
          <strong>${escapeHtml(noteTitle(node.title))}</strong>
          <span>${escapeHtml(t("note.deletedAt", { time: formatArchivedAt(node.deletedAt) }))}</span>
          <p>${escapeHtml(snippet(node.content || ""))}</p>
        </div>
        <div class="archive-actions">
          <button class="secondary-btn" type="button" data-action="restore">${t("note.restore")}</button>
          <button class="danger-btn" type="button" data-action="remove">${t("note.nodeDeletePermanent")}</button>
        </div>
      `;
      item.querySelector('[data-action="select"]').addEventListener("change", (event) => {
        if (event.target.checked) {
          state.selectedDeletedTreeIds.add(node.id);
        } else {
          state.selectedDeletedTreeIds.delete(node.id);
        }
        renderDeletedTreeList();
      });
      item.querySelector('[data-action="restore"]').addEventListener("click", () => {
        restoreDeletedTreeNode(node.id);
      });
      item.querySelector('[data-action="remove"]').addEventListener("click", () => {
        permanentlyDeleteTreeNode(node.id);
      });
      return item;
    }),
  );
}

function renderDeletedTreeControls() {
  if (!elements.deletedSelectionLabel) return;
  const deleted = state.data.deletedTree || [];
  const selectedCount = state.selectedDeletedTreeIds.size;
  const totalCount = deleted.length;
  elements.deletedSelectionLabel.textContent = t("note.deletedSelection", { selected: selectedCount, total: totalCount });
  elements.deletedSelectAllBtn.disabled = totalCount === 0;
  elements.deletedSelectAllBtn.textContent = selectedCount === totalCount && totalCount > 0 ? t("note.deletedClearAll") : t("note.deletedSelectAll");
  elements.deletedBulkDeleteBtn.disabled = selectedCount === 0;
  elements.deletedDeleteAllBtn.disabled = totalCount === 0;
}

function pruneDeletedTreeSelection() {
  const deletedIds = new Set((state.data.deletedTree || []).map((node) => node.id));
  state.selectedDeletedTreeIds.forEach((id) => {
    if (!deletedIds.has(id)) {
      state.selectedDeletedTreeIds.delete(id);
    }
  });
}

function toggleDeletedTreeSelection() {
  const deleted = state.data.deletedTree || [];
  if (deleted.length === 0) return;
  pruneDeletedTreeSelection();
  if (state.selectedDeletedTreeIds.size === deleted.length) {
    state.selectedDeletedTreeIds.clear();
  } else {
    state.selectedDeletedTreeIds = new Set(deleted.map((node) => node.id));
  }
  renderDeletedTreeList();
}

async function deleteSelectedTreeNodes() {
  pruneDeletedTreeSelection();
  const selectedIds = [...state.selectedDeletedTreeIds];
  if (selectedIds.length === 0) return;
  if (!(await confirmAction(t("note.nodeDelete.permanentSelected", { count: selectedIds.length })))) {
    return;
  }
  const selectedSet = new Set(selectedIds);
  state.data.deletedTree = state.data.deletedTree.filter((node) => !selectedSet.has(node.id));
  state.selectedDeletedTreeIds.clear();
  persist();
  renderDeletedTreeList();
  renderDeletedTreeButton();
}

async function deleteAllArchivedTreeNodes() {
  const deleted = state.data.deletedTree || [];
  if (deleted.length === 0) return;
  if (!(await confirmAction(t("note.nodeDelete.permanentAll", { count: deleted.length })))) {
    return;
  }
  state.data.deletedTree = [];
  state.selectedDeletedTreeIds.clear();
  persist();
  renderDeletedTreeList();
  renderDeletedTreeButton();
}

function bindTreeResize() {
  let startX = 0;
  let startWidth = 0;

  const onMove = (event) => {
    const nextWidth = Math.min(460, Math.max(180, startWidth + event.clientX - startX));
    state.settings.treeListWidth = nextWidth;
    applySettings();
  };

  const onUp = () => {
    persistSettings();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.classList.remove("resizing");
  };

  elements.treeResizeHandle.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startWidth = state.settings.treeListWidth;
    document.body.classList.add("resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function setView(view) {
  closePopupLayers();
  state.view = view;
  elements.navTabs.forEach((button) => {
    const sameView = button.dataset.view === view;
    const sameSharedView = !button.dataset.sharedView || button.dataset.sharedView === state.sharedView;
    button.classList.toggle("active", sameView && sameSharedView);
  });
  elements.treeView.classList.toggle("active", view === "tree");
  elements.resultsView.classList.toggle("active", view === "results");
  render();
}

function normalizeSharedView(value) {
  return ["mine", "group-tree", "member"].includes(value) ? value : "mine";
}

function selectTreeNode(id) {
  state.selectedTreeId = id;
  expandAncestors(id);
  closeSelectionOverlays();
  setView("tree");
}

function closeSelectionOverlays() {
  closePopupLayers();
}

function closePopupLayers() {
  cancelShortcutCapture();
  closeNoteActionMenu();
  closeDailyPopup();
  closeQuickSwitch();
  closeCommandPalette();
  closeSearchPopover();
  closeGraph();
  closePropertiesView();
  closeCanvasView();
  closeCaptureView();
  closeGroupMessenger();
  closeDeletedTreeBox();
  closeSettingsPopup();
}

function isPrimaryShortcut(event, key) {
  return (event.ctrlKey || event.metaKey) && normalizeShortcutKey(event.key) === key;
}

function toggleNoteActionMenu() {
  if (!elements.noteActionMenu || !elements.noteActionMenuBtn) return;
  const opening = elements.noteActionMenu.classList.contains("hidden");
  elements.noteActionMenu.classList.toggle("hidden", !opening);
  elements.noteActionMenuBtn.setAttribute("aria-expanded", opening ? "true" : "false");
}

function closeNoteActionMenu() {
  if (!elements.noteActionMenu || !elements.noteActionMenuBtn) return;
  elements.noteActionMenu.classList.add("hidden");
  elements.noteActionMenuBtn.setAttribute("aria-expanded", "false");
}

function cancelShortcutCapture() {
  if (!state.capturingShortcutId) return;
  state.capturingShortcutId = null;
  renderShortcutEditor();
}

function toggleDailyPopup() {
  if (elements.dailyView.classList.contains("hidden")) {
    openDailyPopup();
  } else {
    closeDailyPopup();
  }
}

function openDailyPopup() {
  closePopupLayers();
  elements.dailyView.classList.remove("hidden");
  elements.dailyContent.focus();
}

function closeDailyPopup() {
  elements.dailyView.classList.add("hidden");
}

function render() {
  renderDaily();
  renderTree();
  renderResults();
  renderSidebarKnowledge();
  renderDeletedTreeButton();
  if (!elements.propertiesView.classList.contains("hidden")) renderPropertiesView();
  if (!elements.canvasView.classList.contains("hidden")) renderCanvas();
  if (!elements.captureView.classList.contains("hidden")) renderCaptures();
  if (!elements.groupMessengerView?.classList.contains("hidden")) renderGroupMessenger();
  renderRecoveryPanel();
  renderPublishPanel();
}

function renderDeletedTreeButton() {
  const count = state.data.deletedTree?.length || 0;
  elements.deletedTreeCount.textContent = String(count);
  elements.deletedTreeBtn.classList.toggle("has-items", count > 0);
}

function renderDaily() {
  setDailyArchivePreviewMode(false);
  elements.monthLabel.textContent = monthLabel(state.visibleMonth);
  elements.selectedDateLabel.textContent = longDateLabel(state.selectedDate);
  elements.dailyContent.value = state.data.daily[state.selectedDate]?.content || "";
  renderTodayMemoState();
  renderCalendar();
  renderArchiveList();
}

function renderTodayMemoState() {
  elements.todayMemoState.textContent = state.data.daily[toDateKey(new Date())]?.content?.trim()
    ? t("note.dailyHasContent")
    : t("note.dailyEmpty");
}

function renderSidebarKnowledge() {
  renderFavoriteList();
  renderRecentList();
  renderSideTags();
}

function renderFavoriteList() {
  const favorites = flattenTree(state.data.tree).filter((node) => node.favorite);
  elements.favoriteCount.textContent = String(favorites.length);
  if (favorites.length === 0) {
    elements.favoriteList.innerHTML = `<div class="side-empty">${escapeHtml(t("note.emptyState"))}</div>`;
    return;
  }
  elements.favoriteList.replaceChildren(
    ...favorites.slice(0, 8).map((node) => {
      const title = noteTitle(node.title);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-link";
      button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(levelName(node.level))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
}

function renderRecentList() {
  const recent = flattenTree(state.data.tree)
    .filter((node) => node.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 8);
  elements.recentCount.textContent = String(recent.length);
  if (recent.length === 0) {
    elements.recentList.innerHTML = `<div class="side-empty">${escapeHtml(t("note.emptyState"))}</div>`;
    return;
  }
  elements.recentList.replaceChildren(
    ...recent.map((node) => {
      const title = noteTitle(node.title);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-link";
      button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(relativeTime(node.updatedAt))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
}

function renderSideTags() {
  const tags = tagSummary();
  elements.tagCount.textContent = String(tags.length);
  if (tags.length === 0) {
    elements.sideTagList.innerHTML = `<div class="side-empty">${escapeHtml(t("note.emptyState"))}</div>`;
    return;
  }
  elements.sideTagList.replaceChildren(
    ...tags.slice(0, 16).map((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-tag";
      button.textContent = `#${tag.name} ${tag.count}`;
      button.addEventListener("click", () => {
        elements.searchInput.value = `tag:${tag.name}`;
        state.search = `tag:${tag.name}`;
        setView("results");
      });
      return button;
    }),
  );
}

function renderCalendar() {
  elements.calendarGrid.replaceChildren(...calendarButtons());
}

function calendarButtons() {
  const start = new Date(state.visibleMonth);
  start.setDate(1 - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-btn";
    button.textContent = String(date.getDate());
    button.classList.toggle("muted", date.getMonth() !== state.visibleMonth.getMonth());
    button.classList.toggle("selected", key === state.selectedDate);
    button.classList.toggle("has-note", Boolean(state.data.daily[key]?.content?.trim()));
    button.addEventListener("click", () => {
      state.selectedDate = key;
      state.visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      renderDaily();
    });
    return button;
  });
}

function saveDailyFromEditor() {
  if (elements.dailyContent.readOnly) return;
  const content = elements.dailyContent.value;
  if (!content.trim()) {
    delete state.data.daily[state.selectedDate];
  } else {
    state.data.daily[state.selectedDate] = {
      date: state.selectedDate,
      content,
      status: "active",
      syncState: "pending",
      updatedAt: new Date().toISOString(),
    };
  }
  persist();
  renderCalendar();
  renderTodayMemoState();
  showSaved(elements.dailySavedLabel);
}

async function archiveSelectedDailyNote() {
  const note = state.data.daily[state.selectedDate];
  if (!note?.content?.trim()) {
    showNotice(t("note.noArchive"), "error");
    return;
  }
  if (!(await confirmAction(t("note.archiveConfirm", { date: longDateLabel(state.selectedDate) })))) return;

  state.data.archivedDaily.unshift({
    id: crypto.randomUUID(),
    date: state.selectedDate,
    content: note.content,
    status: "archived",
    syncState: "pending",
    archivedAt: new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString(),
  });
  delete state.data.daily[state.selectedDate];
  persist();
  renderDaily();
  elements.dailyContent.focus();
}

function renderArchiveList() {
  const archives = state.data.archivedDaily || [];
  elements.archiveCountLabel.textContent = t("note.archiveCount", { count: archives.length });
  if (archives.length === 0) {
    elements.archiveList.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.dailyArchiveEmpty"))}</div>`;
    return;
  }

  elements.archiveList.replaceChildren(
    ...archives.map((note) => {
      const restored = Boolean(note.restoredAt);
      const item = document.createElement("article");
      item.className = "archive-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(longDateLabel(note.date))}</strong>
          <span>${escapeHtml(t("note.archivedAt", { time: formatArchivedAt(note.archivedAt) }))}${restored ? ` · ${escapeHtml(formatArchivedAt(note.restoredAt))} ${t("note.restored")}` : ""}</span>
          <p>${escapeHtml(snippet(note.content))}</p>
        </div>
        <div class="archive-actions">
          <button class="secondary-btn" type="button" data-action="view">${t("note.open")}</button>
          <button class="secondary-btn" type="button" data-action="restore"${restored ? " disabled" : ""}>${restored ? t("note.restored") : t("note.restore")}</button>
        </div>
      `;
      item.querySelector('[data-action="view"]').addEventListener("click", () => {
        state.selectedDate = note.date;
        const [year, month] = note.date.split("-").map(Number);
        state.visibleMonth = new Date(year, month - 1, 1);
        elements.dailyContent.value = note.content;
        elements.selectedDateLabel.textContent = `${longDateLabel(note.date)} · ${t("note.archiveViewHint")}`;
        setDailyArchivePreviewMode(true);
        elements.dailyContent.focus();
      });
      item.querySelector('[data-action="restore"]').addEventListener("click", () => {
        restoreArchivedDailyNote(note.id);
      });
      return item;
    }),
  );
}

function setDailyArchivePreviewMode(isPreview) {
  elements.dailyContent.readOnly = isPreview;
  elements.dailyContent.classList.toggle("readonly", isPreview);
  elements.appendTimeBtn.disabled = isPreview;
  elements.archiveSelectedBtn.disabled = isPreview;
}

async function restoreArchivedDailyNote(id) {
  const note = state.data.archivedDaily.find((item) => item.id === id);
  if (!note || note.restoredAt) return;
  const active = state.data.daily[note.date];
  const restoredAt = new Date().toISOString();
  if (active?.content?.trim()) {
    const ok = await confirmAction(t("note.archiveRestoreConfirm"));
    if (!ok) return;
    state.data.daily[note.date].content = `${active.content.trimEnd()}\n\n--- ${t("note.archiveRestoreMarker")} ---\n${note.content}`;
    state.data.daily[note.date].syncState = "pending";
    state.data.daily[note.date].updatedAt = restoredAt;
  } else {
    state.data.daily[note.date] = {
      date: note.date,
      content: note.content,
      status: "active",
      syncState: "pending",
      restoredFromArchiveId: note.id,
      updatedAt: restoredAt,
    };
  }
  note.restoredAt = restoredAt;
  note.syncState = "pending";
  note.updatedAt = restoredAt;
  state.selectedDate = note.date;
  const [year, month] = note.date.split("-").map(Number);
  state.visibleMonth = new Date(year, month - 1, 1);
  persist();
  renderDaily();
}

function renderTree() {
  renderTreeListOnly();
  renderTreeEditor();
  renderOpenTreeTabs();
}

function addRootNote() {
  const node = createNode(t("note.newTopic"), "", null, 1);
  state.data.tree.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(node.id);
  persist();
  renderTree();
}

function addChildToSelectedTreeNode() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    addRootNote();
    return;
  }
  if (isReadOnlyTreeNode(selected)) return;
  if (selected.level >= 3) {
    showNotice(t("note.treeDepthLimit"), "error");
    return;
  }
  const node = createNode(defaultTitleForLevel(selected.level + 1), "", selected.id, selected.level + 1);
  selected.children.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(selected.id);
  persist();
  renderTree();
}

function renderTreeListOnly() {
  state.sharedView = normalizeSharedView(state.sharedView);
  const roots = sharedViewTreeRoots();
  if (roots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>${escapeHtml(t("note.emptyTitle"))}</strong><span>${escapeHtml(t("note.emptyDescription"))}</span>`;
    elements.treeList.replaceChildren(empty);
    return;
  }
  if (state.sharedView === "member") {
    renderMemberSharedTreeList(roots);
    return;
  }
  elements.treeList.replaceChildren(...roots.map((node) => treeNodeElement(node)));
}

function sharedViewTreeRoots() {
  if (!isHostedWebClient() && !hasGroupSharedTreeNodes()) return state.data.tree;
  if (state.sharedView === "mine") {
    return filterTreeForSharedView(state.data.tree, (node) => isOwnSharedTreeNode(node));
  }
  return filterTreeForSharedView(state.data.tree, (node) => isSharedTreeVisibleToGroup(node));
}

function hasGroupSharedTreeNodes() {
  return flattenTree(state.data.tree).some((node) => node.groupSharedReadOnly);
}

function isOwnSharedTreeNode(node) {
  if (node.groupSharedReadOnly) return false;
  if (!isHostedWebClient()) return true;
  return node.shared !== false;
}

function isSharedTreeVisibleToGroup(node) {
  return node.groupSharedReadOnly || isOwnSharedTreeNode(node);
}

function filterTreeForSharedView(nodes, predicate) {
  return (nodes || [])
    .map((node) => filterTreeNodeForSharedView(node, predicate))
    .filter(Boolean);
}

function filterTreeNodeForSharedView(node, predicate) {
  const children = filterTreeForSharedView(node.children || [], predicate);
  if (!predicate(node) && children.length === 0) return null;
  return {
    ...node,
    children,
  };
}

function renderMemberSharedTreeList(roots) {
  const groups = groupSharedRootsByOwner(roots);
  if (groups.length === 0) {
    elements.treeList.innerHTML = `<div class="empty-state"><strong>${escapeHtml(t("note.emptyTitle"))}</strong><span>${escapeHtml(t("note.emptyDescription"))}</span></div>`;
    return;
  }
  elements.treeList.replaceChildren(
    ...groups.map((group) => {
      const section = document.createElement("section");
      section.className = "member-shared-section";
      const title = document.createElement("h3");
      title.textContent = group.ownerLabel;
      const list = document.createElement("div");
      list.className = "member-shared-list";
      list.append(...group.nodes.map((node) => treeNodeElement(node)));
      section.append(title, list);
      return section;
    }),
  );
}

function groupSharedRootsByOwner(roots) {
  const groups = new Map();
  roots.forEach((root) => {
    const ownerKey = ownerKeyForTreeNode(root);
    if (!groups.has(ownerKey)) {
      groups.set(ownerKey, {
        ownerLabel: ownerLabelForTreeNode(root),
        nodes: [],
      });
    }
    groups.get(ownerKey).nodes.push(root);
  });
  return Array.from(groups.values()).sort((a, b) => a.ownerLabel.localeCompare(b.ownerLabel, "ko"));
}

function ownerKeyForTreeNode(node) {
  if (node.groupSharedReadOnly) return node.remoteOwnerId || "group";
  return state.settings.server?.ownerId || "mine";
}

function ownerLabelForTreeNode(node) {
  if (node.groupSharedReadOnly) return node.remoteOwnerId || "그룹 구성원";
  return `${state.settings.server?.ownerId || "내 계정"} · 내 공유`;
}

function treeNodeElement(node) {
  const sourceNode = findTreeNode(state.data.tree, node.id) || node;
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";
  const expanded = state.expandedTreeIds.has(node.id);
  const hasChildren = node.children.length > 0;
  wrapper.classList.toggle("expanded", expanded && hasChildren);
  wrapper.classList.toggle("has-children", hasChildren);

  const row = document.createElement("div");
  row.className = "tree-row";
  row.classList.toggle("active", node.id === state.selectedTreeId);

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "tree-toggle";
  toggleButton.textContent = hasChildren ? (expanded ? "⌄" : "›") : "";
  toggleButton.disabled = !hasChildren;
  toggleButton.title = expanded ? t("note.collapse") : t("note.expand");
  toggleButton.addEventListener("click", () => {
    toggleTreeNode(node.id);
  });

  const labelButton = document.createElement("button");
  labelButton.type = "button";
  labelButton.className = "tree-label-btn";
  labelButton.addEventListener("click", () => {
    state.selectedTreeId = node.id;
    expandAncestors(node.id);
    renderTree();
  });

  const metaParts = [
    levelName(node.level),
    isReadOnlyTreeNode(node) ? `읽기 전용 ${node.remoteOwnerId || ""}`.trim() : "",
    node.children.length > 0 ? t("note.childCount", { count: node.children.length }) : "",
    node.tags.length ? `#${node.tags.slice(0, 2).join(" #")}` : "",
  ].filter(Boolean);
  const nodeTitle = noteTitle(node.title);
  labelButton.innerHTML = `<div class="tree-title">${escapeHtml(node.favorite ? `★ ${nodeTitle}` : nodeTitle)}</div><div class="tree-meta">${escapeHtml(metaParts.join(" · "))}</div>`;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "small-btn";
  addButton.textContent = "+";
  addButton.title = t("note.addChild");
  addButton.disabled = node.level >= 3 || isReadOnlyTreeNode(node);
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isReadOnlyTreeNode(sourceNode)) return;
    if (sourceNode.level >= 3) return;
    const child = createNode(defaultTitleForLevel(sourceNode.level + 1), "", sourceNode.id, sourceNode.level + 1);
    sourceNode.children.push(child);
    state.selectedTreeId = child.id;
    state.expandedTreeIds.add(sourceNode.id);
    persist();
    renderTree();
  });

  row.append(toggleButton, labelButton, addButton);
  wrapper.append(row);

  if (hasChildren && expanded) {
    const children = document.createElement("div");
    children.className = "tree-children";
    children.append(...node.children.map((child) => treeNodeElement(child)));
    wrapper.append(children);
  }

  return wrapper;
}

function toggleTreeNode(id) {
  if (state.expandedTreeIds.has(id)) {
    state.expandedTreeIds.delete(id);
  } else {
    state.expandedTreeIds.add(id);
  }
  renderTreeListOnly();
}

function expandAllTreeNodes() {
  flattenTree(state.data.tree)
    .filter((node) => node.children.length > 0)
    .forEach((node) => state.expandedTreeIds.add(node.id));
  renderTreeListOnly();
}

function renderTreePanelToggle() {
  if (!elements.toggleTreePanelBtn) return;
  const collapsed = Boolean(state.settings.treePanelCollapsed);
  const label = collapsed ? t("tree.panelExpand") : t("tree.panelCollapse");
  elements.toggleTreePanelBtn.textContent = collapsed ? "⇥" : "⇤";
  setIconLabel(elements.toggleTreePanelBtn, label);
}

function renderTreeEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) {
    renderOpenTreeTabs();
    return;
  }
  addOpenTreeTab(selected.id);

  elements.treeTitleInput.value = selected.title;
  const displayContent = visibleContentForNode(selected);
  const editableContent = editableContentForNode(selected);
  elements.treeContent.value = isEncryptedContent(selected.content) && !isEncryptedNodeUnlocked(selected)
    ? displayContent
    : editableContent;
  renderFavorite(selected);
  renderShareState(selected);
  renderEncryptionControls(selected);
  renderTags();
  renderNoteProperties(selected);
  renderNoteStats(selected);
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = t("editor.preview");
  renderTreePath(selected);
  renderMarkdownPreview(displayContent);
  renderOutlinePanel({ ...selected, content: displayContent });
  renderLinkPanel();
  elements.addChildBtn.disabled = selected.level >= 3;
  renderTreeMoveButtons(selected);
  renderReadOnlyTreeState(selected);
}

function renderReadOnlyTreeState(node) {
  const readOnly = isReadOnlyTreeNode(node);
  const encryptedLocked = isEncryptedTreeNodeLocked(node);
  const contentReadOnly = readOnly || encryptedLocked;
  elements.treeTitleInput.disabled = readOnly;
  elements.treeContent.readOnly = contentReadOnly;
  elements.treeContent.classList.toggle("readonly", readOnly);
  elements.treeContent.classList.toggle("locked", encryptedLocked);
  elements.addChildBtn.disabled = readOnly || node.level >= 3;
  elements.deleteTreeBtn.disabled = readOnly;
  elements.moveUpBtn.disabled = readOnly || elements.moveUpBtn.disabled;
  elements.moveDownBtn.disabled = readOnly || elements.moveDownBtn.disabled;
  elements.favoriteBtn.disabled = readOnly;
  elements.shareTreeBtn.disabled = readOnly || isHostedWebClient();
  elements.encryptNoteBtn.disabled = readOnly;
  elements.decryptNoteBtn.disabled = readOnly;
  elements.unlockNoteBtn.disabled = false;
  elements.lockNoteBtn.disabled = false;
  elements.propertyStatusSelect.disabled = readOnly;
  elements.propertyPrioritySelect.disabled = readOnly;
  elements.propertyTypeInput.disabled = readOnly;
  elements.propertyProjectInput.disabled = readOnly;
  elements.propertySourceInput.disabled = readOnly;
  elements.propertyAuthorInput.disabled = readOnly;
  elements.propertyDueInput.disabled = readOnly;
  elements.treeSavedLabel.textContent = readOnly
    ? `읽기 전용 · ${node.remoteOwnerId || "그룹 공유"}`
    : t("saved");
}

function isReadOnlyTreeNode(node) {
  return !isDesktopClient() && node?.groupSharedReadOnly === true;
}

function isEncryptedTreeNodeLocked(node) {
  return Boolean(node && isEncryptedContent(node.content) && !isEncryptedNodeUnlocked(node));
}

function renderTreeMoveButtons(node) {
  const { siblings, index } = treeSiblingPosition(node);
  elements.moveUpBtn.disabled = index <= 0;
  elements.moveDownBtn.disabled = index < 0 || index >= siblings.length - 1;
}

function renderTreePath(node) {
  const nodes = treePathNodes(node.id);
  if (nodes.length === 0) {
    elements.treePathLabel.textContent = "";
    return;
  }
  elements.treePathLabel.replaceChildren(
    ...nodes.flatMap((pathNode, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "path-link";
      button.textContent = noteTitle(pathNode.title);
      button.addEventListener("click", () => {
        selectTreeNode(pathNode.id);
      });
      if (index === nodes.length - 1) {
        button.setAttribute("aria-current", "page");
      }
      if (index === nodes.length - 1) return [button];
      const separator = document.createElement("span");
      separator.className = "path-separator";
      separator.textContent = "/";
      return [button, separator];
    }),
  );
}

function addOpenTreeTab(id) {
  if (!id) return;
  if (!state.settings.openTreeTabs.includes(id)) {
    state.settings.openTreeTabs = limitOpenTreeTabs([...state.settings.openTreeTabs, id]);
  }
  persistSettings();
}

function limitOpenTreeTabs(ids, limit = 10, pinnedTabIds = state.settings.pinnedTreeTabs) {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (uniqueIds.length <= limit) return uniqueIds;
  const pinnedIds = new Set(pinnedTabIds);
  const pinnedToKeep = uniqueIds.filter((id) => pinnedIds.has(id)).slice(0, limit);
  const remainingSlots = Math.max(0, limit - pinnedToKeep.length);
  const normalIds = uniqueIds.filter((id) => !pinnedIds.has(id));
  const normalToKeep = remainingSlots > 0 ? normalIds.slice(-remainingSlots) : [];
  const keepIds = new Set([...pinnedToKeep, ...normalToKeep]);
  return uniqueIds.filter((id) => keepIds.has(id));
}

function visibleOpenTreeTabs() {
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  return [
    ...tabs.filter((node) => pinnedIds.has(node.id)),
    ...tabs.filter((node) => !pinnedIds.has(node.id)),
  ];
}

function firstVisibleOpenTreeTabId() {
  return visibleOpenTreeTabs()[0]?.id || null;
}

function renderOpenTreeTabs() {
  pruneTreeTabSettings();
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  const sortedTabs = visibleOpenTreeTabs();
  elements.openTabsBar.classList.toggle("hidden", sortedTabs.length === 0);
  if (tabs.length === 0) {
    elements.openTabs.replaceChildren();
    persistSettings();
    return;
  }
  elements.openTabs.replaceChildren(
    ...sortedTabs.map((node) => {
      const pinned = pinnedIds.has(node.id);
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "open-tab";
      tab.classList.toggle("active", node.id === state.selectedTreeId);
      tab.classList.toggle("pinned", pinned);
      const pinnedPrefix = pinned ? t("note.pinnedPrefix") : "";
      const tabTitle = noteTitle(node.title);
      tab.innerHTML = `<span>${escapeHtml(pinnedPrefix)}${escapeHtml(tabTitle)}</span><strong aria-label="${t("note.tabClose")}" title="${t("note.tabClose")}">×</strong>`;
      tab.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      tab.querySelector("strong").addEventListener("click", (event) => {
        event.stopPropagation();
        closeOpenTreeTab(node.id);
      });
      return tab;
    }),
  );
  const selectedPinned = state.settings.pinnedTreeTabs.includes(state.selectedTreeId);
  elements.pinTabBtn.disabled = !state.selectedTreeId || !state.settings.openTreeTabs.includes(state.selectedTreeId);
  elements.pinTabBtn.textContent = selectedPinned ? t("note.unpinTab") : t("note.pinTab");
  setIconLabel(elements.pinTabBtn, selectedPinned ? t("note.unpinTab") : t("note.pinTab"));
  elements.reopenClosedTabBtn.disabled = !state.settings.closedTreeTabs.some((id) => findTreeNode(state.data.tree, id));
  persistSettings();
}

function pruneTreeTabSettings() {
  const exists = (id) => Boolean(findTreeNode(state.data.tree, id));
  const pinnedTabs = normalizeIdList(state.settings.pinnedTreeTabs, 10).filter(exists);
  const openTabs = normalizeIdList(state.settings.openTreeTabs, 100).filter(exists);
  state.settings.openTreeTabs = limitOpenTreeTabs(openTabs, 10, pinnedTabs);
  state.settings.closedTreeTabs = normalizeIdList(state.settings.closedTreeTabs, 10).filter(exists);
  state.settings.pinnedTreeTabs = pinnedTabs.filter((id) => state.settings.openTreeTabs.includes(id));
  if (state.selectedTreeId && !exists(state.selectedTreeId)) {
    state.selectedTreeId = null;
  }
}

function cycleOpenTreeTab(direction) {
  const tabs = visibleOpenTreeTabs();
  if (tabs.length < 2) return;
  const currentIndex = Math.max(0, tabs.findIndex((node) => node.id === state.selectedTreeId));
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  selectTreeNode(tabs[nextIndex].id);
}

function rememberClosedTreeTabs(ids) {
  const validIds = ids.filter((id) => id && findTreeNode(state.data.tree, id));
  if (validIds.length === 0) return;
  state.settings.closedTreeTabs = [
    ...validIds.reverse(),
    ...state.settings.closedTreeTabs.filter((id) => !validIds.includes(id)),
  ].slice(0, 10);
}

function reopenClosedTreeTab() {
  const id = state.settings.closedTreeTabs.find((tabId) => findTreeNode(state.data.tree, tabId));
  if (!id) return;
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((tabId) => tabId !== id);
  addOpenTreeTab(id);
  selectTreeNode(id);
}

function toggleSelectedTreeTabPin() {
  const id = state.selectedTreeId;
  if (!id || !state.settings.openTreeTabs.includes(id)) return;
  if (state.settings.pinnedTreeTabs.includes(id)) {
    state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  } else {
    state.settings.pinnedTreeTabs = [...state.settings.pinnedTreeTabs, id];
  }
  persistSettings();
  renderOpenTreeTabs();
}

function closeOtherTreeTabs() {
  if (!state.selectedTreeId) return;
  const keepIds = new Set([state.selectedTreeId, ...state.settings.pinnedTreeTabs]);
  const closingIds = state.settings.openTreeTabs.filter((tabId) => !keepIds.has(tabId));
  rememberClosedTreeTabs(closingIds);
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => keepIds.has(tabId));
  persistSettings();
  renderTree();
}

function closeAllTreeTabs() {
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  const closingIds = state.settings.openTreeTabs.filter((tabId) => !pinnedIds.has(tabId));
  rememberClosedTreeTabs(closingIds);
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => pinnedIds.has(tabId));
  if (!state.settings.openTreeTabs.includes(state.selectedTreeId)) {
    state.selectedTreeId = firstVisibleOpenTreeTabId();
  }
  persistSettings();
  renderTree();
}

function closeOpenTreeTab(id) {
  if (!id) return;
  const tabs = state.settings.openTreeTabs.filter((tabId) => tabId !== id);
  const wasSelected = state.selectedTreeId === id;
  rememberClosedTreeTabs([id]);
  state.settings.openTreeTabs = tabs;
  state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  if (wasSelected) {
    state.selectedTreeId = firstVisibleOpenTreeTabId();
  }
  persistSettings();
  renderTree();
}

function removeTreeTabReferences(id) {
  if (!id) return;
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => tabId !== id);
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((tabId) => tabId !== id);
  state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  persistSettings();
}

function renderFavorite(node) {
  elements.favoriteBtn.classList.toggle("active", Boolean(node.favorite));
  elements.favoriteBtn.textContent = node.favorite ? t("editor.unfavorite") : t("editor.favorite");
}

function renderShareState(node) {
  const shared = node.shared !== false;
  elements.shareTreeBtn.classList.toggle("active", shared);
  elements.shareTreeBtn.disabled = isHostedWebClient();
  elements.shareTreeBtn.textContent = shared ? t("editor.share") : t("editor.unshare");
}

function renderTags() {
  const selected = getSelectedTreeNode();
  if (!selected || !state.settings.showTags) {
    elements.tagList.replaceChildren();
    return;
  }
  const tags = isEncryptedContent(selected.content)
    ? (isEncryptedNodeUnlocked(selected) ? extractTags(editableContentForNode(selected)) : [])
    : extractTags(selected.content);
  if (!isEncryptedContent(selected.content)) selected.tags = tags;
  if (tags.length === 0) {
    elements.tagList.innerHTML = `<span class="tag-empty">${escapeHtml(t("note.tagEmpty"))}</span>`;
    return;
  }
  elements.tagList.replaceChildren(
    ...tags.map((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-chip";
      button.textContent = `#${tag}`;
      button.addEventListener("click", () => {
        elements.searchInput.value = `tag:${tag}`;
        state.search = `tag:${tag}`;
        setView("results");
      });
      return button;
    }),
  );
}

function renderNoteStats(node) {
  const text = visibleContentForNode(node);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readingMinutes = Math.max(1, Math.ceil(words / 300));
  const chars = text.replace(/\s/g, "").length;
  const lines = text ? text.split("\n").length : 0;
  const outgoing = outgoingLinksFor({ ...node, content: text });
  const links = outgoing.length;
  const missingLinks = outgoing.filter((link) => !link.exists).length;
  const backlinks = backlinksFor(node).length;
  const tags = extractTags(text).length;
  elements.noteStats.innerHTML = [
    `<span>${escapeHtml(t("note.stats.backlinks", { count: backlinks }))}</span>`,
    `<span>${escapeHtml(t("note.stats.edit"))}</span>`,
    `<span>${escapeHtml(t("note.stats.words", { count: words }))}</span>`,
    `<span>${escapeHtml(t("note.stats.chars", { count: chars }))}</span>`,
    `<span>${escapeHtml(t("note.stats.reading", { count: readingMinutes }))}</span>`,
    `<span>${escapeHtml(t("note.stats.lines", { count: lines }))}</span>`,
    `<span>${escapeHtml(t("note.stats.links", { count: links }))}</span>`,
    `<span>${escapeHtml(t("note.stats.tags", { count: tags }))}</span>`,
    ...(missingLinks ? [`<span class="warning">${escapeHtml(t("note.stats.missingLinks", { count: missingLinks }))}</span>`] : []),
    `<span>${escapeHtml(t("note.stats.updated", { time: relativeTime(node.updatedAt) }))}</span>`,
  ].join("");
}

function toggleOutlinePanel() {
  elements.outlinePanel.classList.toggle("hidden");
  const selected = getSelectedTreeNode();
  if (selected) renderOutlinePanel({ ...selected, content: visibleContentForNode(selected) });
}

function renderOutlinePanel(node) {
  if (elements.outlinePanel.classList.contains("hidden")) return;
  const headings = extractHeadings(node.content);
  if (headings.length === 0) {
    elements.outlinePanel.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.outlineEmpty"))}</div>`;
    return;
  }
  elements.outlinePanel.replaceChildren(
    ...headings.map((heading) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "outline-item";
      button.style.setProperty("--outline-depth", String(Math.min(heading.level - 1, 4)));
      button.innerHTML = `<span>H${heading.level}</span><strong>${escapeHtml(heading.title)}</strong>`;
      button.addEventListener("click", () => {
        elements.markdownPreview.classList.add("hidden");
        elements.treeContent.classList.remove("hidden");
        elements.previewToggleBtn.textContent = t("editor.preview");
        elements.treeContent.focus();
        elements.treeContent.setSelectionRange(heading.index, heading.index + heading.raw.length);
      });
      return button;
    }),
  );
}

function extractHeadings(content) {
  const headings = [];
  let offset = 0;
  String(content || "").split("\n").forEach((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        raw: line,
        index: offset,
      });
    }
    offset += line.length + 1;
  });
  return headings;
}

function toggleNoteFind() {
  if (elements.noteFindBar.classList.contains("hidden")) {
    openNoteFind();
  } else {
    closeNoteFind();
  }
}

function openNoteFind() {
  elements.noteFindBar.classList.remove("hidden");
  seedNoteFindFromSelection();
  elements.noteFindInput.focus();
  elements.noteFindInput.select();
  selectNoteFindMatch(0, { keepInputFocus: true });
}

function closeNoteFind() {
  elements.noteFindBar.classList.add("hidden");
  elements.noteFindInput.value = "";
  elements.noteFindInput.dataset.index = "0";
  updateNoteFindState([], "");
  elements.treeContent.focus();
}

function seedNoteFindFromSelection() {
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  if (end <= start) return;
  const selectedText = elements.treeContent.value.slice(start, end).trim();
  if (!selectedText || selectedText.includes("\n")) return;
  elements.noteFindInput.value = selectedText;
}

function handleNoteFindInputKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    moveNoteFindMatch(event.shiftKey ? -1 : 1);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeNoteFind();
  }
}

function noteFindMatches() {
  const query = elements.noteFindInput.value.trim().toLowerCase();
  if (!query) return [];
  const text = elements.treeContent.value.toLowerCase();
  const matches = [];
  let index = text.indexOf(query);
  while (index >= 0) {
    matches.push(index);
    index = text.indexOf(query, index + query.length);
  }
  return matches;
}

function scrollTreeContentToOffset(offset) {
  const editor = elements.treeContent;
  if (!editor) return;
  const computed = window.getComputedStyle(editor);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const width = Math.max(0, editor.clientWidth);
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.left = "-10000px";
  mirror.style.top = "0";
  mirror.style.width = `${width}px`;
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.font = computed.font;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = computed.wordBreak;
  mirror.textContent = editor.value.slice(0, Math.max(0, offset));
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const targetTop = marker.offsetTop;
  mirror.remove();
  editor.scrollTop = Math.max(0, targetTop - editor.clientHeight * 0.4);
}

function selectNoteFindMatch(index, options = {}) {
  const query = elements.noteFindInput.value.trim();
  const matches = noteFindMatches();
  const shouldKeepInputFocus = options.keepInputFocus || options.previewOnly;
  if (!query || matches.length === 0) {
    elements.noteFindInput.dataset.index = "0";
    updateNoteFindState(matches, query);
    return;
  }
  const safeIndex = ((index % matches.length) + matches.length) % matches.length;
  const start = matches[safeIndex];
  elements.noteFindInput.dataset.index = String(safeIndex);
  updateNoteFindState(matches, query, safeIndex);
  if (shouldKeepInputFocus) {
    return;
  }
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = t("editor.preview");
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(start, start + query.length);
  scrollTreeContentToOffset(start);
}

function focusNoteFindInput() {
  window.setTimeout(() => {
    if (elements.noteFindBar.classList.contains("hidden")) return;
    elements.noteFindInput.focus();
    const length = elements.noteFindInput.value.length;
    elements.noteFindInput.setSelectionRange(length, length);
  }, 0);
}

function moveNoteFindMatch(direction) {
  const current = Number(elements.noteFindInput.dataset.index || 0);
  selectNoteFindMatch(current + direction, { keepInputFocus: false });
}

function updateNoteFindState(matches, query, index = -1) {
  const hasQuery = Boolean(query);
  const hasMatches = matches.length > 0;
  elements.noteFindCount.textContent = hasMatches ? `${index + 1} / ${matches.length}` : "0 / 0";
  elements.noteFindBar.classList.toggle("not-found", hasQuery && !hasMatches);
  elements.noteFindPrevBtn.disabled = !hasMatches;
  elements.noteFindNextBtn.disabled = !hasMatches;
}

async function copyNoteLink(node) {
  const link = `[[${noteTitle(node.title)}]]`;
  const copied = await copyText(link);
  elements.treeSavedLabel.textContent = copied ? t("editor.copyLinkSuccess") : t("editor.copyLinkFail");
  showSaved(elements.treeSavedLabel);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // file:// 환경에서는 권한 문제로 실패할 수 있어 아래 방식으로 재시도합니다.
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand("copy");
  input.remove();
  return ok;
}

function treePath(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    const current = [...parents, noteTitle(node.title)];
    if (node.id === id) return current;
    const childPath = treePath(id, node.children, current);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

function treePathNodes(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    const current = [...parents, node];
    if (node.id === id) return current;
    const childPath = treePathNodes(id, node.children, current);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

function renderMarkdownPreview(content) {
  const html = markdownToHtml(content || "");
  elements.markdownPreview.innerHTML = html || `<p class="empty-compact">${escapeHtml(t("note.previewEmpty"))}</p>`;
}

function renderLinkPanel() {
  const selected = getSelectedTreeNode();
  if (!selected || !state.settings.showBacklinks) {
    elements.backlinksPanel.replaceChildren();
    return;
  }
  const displayNode = { ...selected, content: visibleContentForNode(selected) };
  const outgoing = outgoingLinksFor(displayNode);
  const backlinks = backlinksFor(selected);
  const blocks = [];

  blocks.push(sectionTitle(t("note.sectionOut")));
  if (outgoing.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-compact";
    empty.textContent = t("note.sectionOutEmpty");
    blocks.push(empty);
  } else {
    const list = document.createElement("div");
    list.className = "backlink-list";
    list.append(...outgoing.map((link) => linkButton(link.title, link.node, link.exists)));
    blocks.push(list);
  }

  blocks.push(sectionTitle(t("note.sectionBacklink")));
  if (backlinks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-compact";
    empty.textContent = t("note.sectionBacklinkEmpty");
    blocks.push(empty);
    elements.backlinksPanel.replaceChildren(...blocks);
    return;
  }
  const list = document.createElement("div");
  list.className = "backlink-list";
  list.append(
    ...backlinks.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "backlink-item";
      button.innerHTML = `<strong>${escapeHtml(noteTitle(node.title))}</strong><span>${escapeHtml(snippet(node.content))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
  blocks.push(list);
  elements.backlinksPanel.replaceChildren(...blocks);
}

function markdownToHtml(markdown) {
  const lines = escapeHtml(markdown).split("\n");
  const blocks = [];
  let listItems = [];
  let listType = "ul";
  let taskIndex = 0;
  let codeLines = null;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<${listType}>${listItems.map((item) => {
      const isTask = /^\[[ xX]\]\s*/.test(item);
      const html = renderMarkdownListItem(item, isTask ? taskIndex : null);
      if (isTask) taskIndex += 1;
      return html;
    }).join("")}</${listType}>`);
    listItems = [];
    listType = "ul";
  };

  const addListItem = (type, item) => {
    if (listItems.length > 0 && listType !== type) flushList();
    listType = type;
    listItems.push(item);
  };

  const flushCode = () => {
    if (!codeLines) return;
    blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
    codeLines = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushList();
      if (codeLines) {
        flushCode();
      } else {
        codeLines = [];
      }
      return;
    }
    if (codeLines) {
      codeLines.push(line);
      return;
    }
    if (!trimmed) {
      flushList();
      return;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushList();
      blocks.push("<hr>");
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      return;
    }
    const quote = trimmed.match(/^>\s*(.+)$/);
    if (quote) {
      flushList();
      blocks.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      return;
    }
    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      addListItem("ul", list[1]);
      return;
    }
    const orderedList = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedList) {
      addListItem("ol", orderedList[1]);
      return;
    }
    flushList();
    blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  });
  flushList();
  flushCode();
  return blocks.join("");
}

function renderMarkdownListItem(item, taskIndex) {
  const task = item.match(/^\[([ xX])\]\s*(.*)$/);
  if (!task) return `<li>${inlineMarkdown(item)}</li>`;
  const checked = task[1].toLowerCase() === "x";
  return `<li class="task-list-item" data-task-index="${taskIndex}"><input type="checkbox"${checked ? " checked" : ""}> <span>${inlineMarkdown(task[2])}</span></li>`;
}

function toggleMarkdownTask(taskIndex) {
  const selected = getSelectedTreeNode();
  if (!selected || Number.isNaN(taskIndex)) return;
  let currentTask = -1;
  const lines = (selected.content || "").split("\n");
  const nextLines = lines.map((line) => {
    const task = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s*)/);
    if (!task) return line;
    currentTask += 1;
    if (currentTask !== taskIndex) return line;
    const nextMark = task[2].toLowerCase() === "x" ? " " : "x";
    return line.replace(/^(\s*[-*]\s+\[)([ xX])(\]\s*)/, `$1${nextMark}$3`);
  });
  elements.treeContent.value = nextLines.join("\n");
  syncTreeContentFromEditor();
}

function isEncryptedContent(content) {
  return String(content || "").startsWith(ENCRYPTED_NOTE_PREFIX);
}

function encryptedPayloadFromContent(content) {
  if (!isEncryptedContent(content)) return null;
  try {
    return JSON.parse(atob(String(content).slice(ENCRYPTED_NOTE_PREFIX.length)));
  } catch {
    return null;
  }
}

function bytesToBase64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(String(value || "")), (char) => char.charCodeAt(0));
}

async function encryptionKeyFromPassword(password, saltBytes, usages) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: ENCRYPTION_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

async function encryptPlainText(plainText, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKeyFromPassword(password, salt, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText),
  );
  const payload = {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ENCRYPTION_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted),
  };
  return `${ENCRYPTED_NOTE_PREFIX}${btoa(JSON.stringify(payload))}`;
}

async function decryptPlainText(encryptedContent, password) {
  const payload = encryptedPayloadFromContent(encryptedContent);
  if (!payload || payload.v !== 1 || !payload.salt || !payload.iv || !payload.data) {
    throw new Error(t("encryption.fail"));
  }
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await encryptionKeyFromPassword(password, salt, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(payload.data),
  );
  return new TextDecoder().decode(decrypted);
}

function visibleContentForNode(node) {
  if (!node) return "";
  if (!isEncryptedContent(node.content)) return node.content || "";
  return unlockedEncryptedNotes.get(node.id)?.plain || t("encryption.lockedPlaceholder");
}

function editableContentForNode(node) {
  if (!node) return "";
  if (!isEncryptedContent(node.content)) return node.content || "";
  return unlockedEncryptedNotes.get(node.id)?.plain || "";
}

function isEncryptedNodeUnlocked(node) {
  return Boolean(node && isEncryptedContent(node.content) && unlockedEncryptedNotes.has(node.id));
}

function renderEncryptionControls(node) {
  if (!node) return;
  const encrypted = isEncryptedContent(node.content);
  const unlocked = isEncryptedNodeUnlocked(node);
  elements.encryptNoteBtn.classList.toggle("hidden", encrypted);
  elements.unlockNoteBtn.classList.toggle("hidden", !encrypted || unlocked);
  elements.decryptNoteBtn.classList.toggle("hidden", !encrypted || !unlocked);
  elements.lockNoteBtn.classList.toggle("hidden", !encrypted || !unlocked);
}

async function encryptSelectedNote() {
  const selected = getSelectedTreeNode();
  if (!selected || isEncryptedContent(selected.content)) return;
  const plain = elements.treeContent.value || selected.content || "";
  if (!plain.trim()) {
    showNotice(t("encryption.empty"), "info");
    return;
  }
  const key = await requestEncryptionKey(t("encryption.encryptMessage"));
  if (!key) return;
  try {
    selected.content = await encryptPlainText(plain, key);
    unlockedEncryptedNotes.delete(selected.id);
    selected.tags = [];
    markTreeNodeChanged(selected);
    persist();
    renderTree();
    showNotice(t("encryption.done"), "success");
  } catch (error) {
    showNotice(error.message || t("encryption.fail"), "error");
  }
}

async function unlockSelectedNote() {
  const selected = getSelectedTreeNode();
  if (!selected || !isEncryptedContent(selected.content)) return;
  const key = await requestEncryptionKey(t("encryption.unlockMessage"));
  if (!key) return;
  try {
    const plain = await decryptPlainText(selected.content, key);
    unlockedEncryptedNotes.set(selected.id, { key, plain });
    renderTreeEditor();
    showNotice(t("encryption.unlocked"), "success");
  } catch {
    showNotice(t("encryption.fail"), "error");
  }
}

function lockSelectedNote() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  unlockedEncryptedNotes.delete(selected.id);
  window.clearTimeout(encryptedSaveTimers.get(selected.id));
  encryptedSaveTimers.delete(selected.id);
  renderTreeEditor();
  showNotice(t("encryption.locked"), "success");
}

async function decryptSelectedNote() {
  const selected = getSelectedTreeNode();
  if (!selected || !isEncryptedContent(selected.content)) return;
  let unlocked = unlockedEncryptedNotes.get(selected.id);
  if (!unlocked) {
    const key = await requestEncryptionKey(t("encryption.decryptMessage"));
    if (!key) return;
    try {
      unlocked = { key, plain: await decryptPlainText(selected.content, key) };
    } catch {
      showNotice(t("encryption.fail"), "error");
      return;
    }
  }
  selected.content = unlocked.plain || "";
  clearUnlockedEncryptionState(selected.id);
  markTreeNodeChanged(selected);
  persist();
  renderTree();
  showNotice(t("encryption.decrypted"), "success");
}

function scheduleEncryptedNoteSave(node) {
  const unlocked = unlockedEncryptedNotes.get(node.id);
  if (!unlocked) return;
  window.clearTimeout(encryptedSaveTimers.get(node.id));
  const timer = window.setTimeout(async () => {
    encryptedSaveTimers.delete(node.id);
    const latest = findTreeNode(state.data.tree, node.id);
    const latestUnlocked = unlockedEncryptedNotes.get(node.id);
    if (!latest || !latestUnlocked) return;
    latest.content = await encryptPlainText(latestUnlocked.plain, latestUnlocked.key);
    latest.tags = [];
    markTreeNodeChanged(latest);
    persist();
    renderNoteStats(latest);
    showSaved(elements.treeSavedLabel);
  }, 700);
  encryptedSaveTimers.set(node.id, timer);
}

function readLiveMemoEditorText(editor) {
  return Array.from(editor.childNodes)
    .map((node) => liveMemoNodeText(node))
    .join("")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n$/, "");
}

function liveMemoNodeText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
  if (node.nodeName === "BR") return "\n";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const text = Array.from(node.childNodes).map((child) => liveMemoNodeText(child)).join("");
  return node.nodeName === "DIV" || node.nodeName === "P" ? `${text}\n` : text;
}

function renderLiveMemoEditorText(editor, text) {
  editor.innerHTML = liveMemoEditorHtml(text);
}

function liveMemoEditorHtml(text) {
  const source = String(text || "");
  if (!source) return "";
  const pattern = /(?:https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let html = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source))) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    const trailing = match[0].slice(raw.length);
    html += liveMemoPlainHtml(source.slice(lastIndex, match.index));
    html += `<span class="live-editor-link" data-href="${escapeHtml(normalizeDetectedLinkTarget(raw))}">${escapeHtml(raw)}</span>`;
    html += liveMemoPlainHtml(trailing);
    lastIndex = match.index + match[0].length;
  }
  html += liveMemoPlainHtml(source.slice(lastIndex));
  return html;
}

function liveMemoPlainHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function getLiveMemoEditorSelection(editor) {
  const selection = window.getSelection();
  const length = editor.value.length;
  if (!selection || selection.rangeCount === 0) return { start: length, end: length };
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return { start: length, end: length };
  }
  const start = liveMemoOffsetFromDomPoint(editor, range.startContainer, range.startOffset);
  const end = liveMemoOffsetFromDomPoint(editor, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function liveMemoOffsetFromDomPoint(root, target, targetOffset) {
  let offset = 0;
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (node === target) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += Math.min(targetOffset, (node.nodeValue || "").length);
      } else {
        offset += Array.from(node.childNodes)
          .slice(0, targetOffset)
          .map((child) => liveMemoNodeText(child))
          .join("").length;
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.nodeValue || "").length;
      return;
    }
    if (node.nodeName === "BR") {
      offset += 1;
      return;
    }
    Array.from(node.childNodes).forEach(visit);
  };
  Array.from(root.childNodes).forEach(visit);
  return offset;
}

function setLiveMemoEditorSelection(editor, start, end = start) {
  const textLength = editor.value.length;
  const range = document.createRange();
  const startPoint = liveMemoDomPointFromOffset(editor, Math.max(0, Math.min(start, textLength)));
  const endPoint = liveMemoDomPointFromOffset(editor, Math.max(0, Math.min(end, textLength)));
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function liveMemoDomPointFromOffset(root, targetOffset) {
  let current = 0;
  let point = { node: root, offset: root.childNodes.length };
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue || "";
      const next = current + text.length;
      if (targetOffset <= next) {
        point = { node, offset: Math.max(0, targetOffset - current) };
        return true;
      }
      current = next;
      return false;
    }
    if (node.nodeName === "BR") {
      if (targetOffset <= current) {
        const parent = node.parentNode || root;
        point = { node: parent, offset: Math.max(0, Array.from(parent.childNodes).indexOf(node)) };
        return true;
      }
      current += 1;
      return false;
    }
    return Array.from(node.childNodes).some(visit);
  };
  Array.from(root.childNodes).some(visit);
  return point;
}

function pastePlainTextIntoLiveMemoEditor(event) {
  if (elements.treeContent?.tagName === "TEXTAREA") return;
  event.preventDefault();
  document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
}

function openLiveMemoEditorLink(event) {
  const link = event.target.closest?.(".live-editor-link");
  if (!link) return;
  event.preventDefault();
  const target = normalizeDetectedLinkTarget(link.textContent || link.dataset.href || "");
  if (target) window.open(target, "_blank", "noopener,noreferrer");
}

function inlineMarkdown(text) {
  const codeSpans = [];
  const markdownLinks = [];
  const protectedText = text
    .replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSpans.push(code) - 1;
    return `\u0000CODE${index}\u0000`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const index = markdownLinks.push(renderExternalLink(label, url)) - 1;
      return `\u0000LINK${index}\u0000`;
    });
  return protectedText
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      const target = decodeHtml(title.trim());
      return `<button class="wiki-link" type="button" data-wiki-link="${escapeHtml(target)}">${title}</button>`;
    })
    .replace(/\bhttps?:\/\/[^\s<>()]+/gi, (value) => renderDetectedLink(value))
    .replace(/\bwww\.[^\s<>()]+/gi, (value) => renderDetectedLink(value))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, (value) => renderDetectedLink(value))
    .replace(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g, '$1<span class="tag-inline">#$2</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\u0000LINK(\d+)\u0000/g, (_, index) => markdownLinks[Number(index)] || "")
    .replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${codeSpans[Number(index)] || ""}</code>`);
}

function renderExternalLink(label, url) {
  const trimmedUrl = decodeHtml(url.trim());
  if (!/^(https?:\/\/|mailto:)/i.test(trimmedUrl)) {
    return `[${label}](${url})`;
  }
  return `<a href="${escapeHtml(trimmedUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderDetectedLink(value) {
  const target = normalizeDetectedLinkTarget(value);
  return `<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${value}</a>`;
}

function normalizeDetectedLinkTarget(value) {
  const text = decodeHtml(String(value || "").trim()).replace(/[.,;:!?]+$/, "");
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text)) return `mailto:${text}`;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function detectedLinkFromText(value, selectionStart = 0, selectionEnd = selectionStart) {
  const text = String(value || "");
  const selected = text.slice(selectionStart, selectionEnd).trim();
  if (selected && detectedLinkCandidate(selected) === selected) return normalizeDetectedLinkTarget(selected);
  const pattern = /(?:https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    if (selectionStart >= start && selectionStart <= end) {
      return normalizeDetectedLinkTarget(match[0]);
    }
  }
  return "";
}

function detectedLinkCandidate(value) {
  return String(value || "").match(/^(?:https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})$/i)?.[0] || "";
}

function openDetectedLinkFromEditor() {
  const target = detectedLinkFromText(
    elements.treeContent.value,
    elements.treeContent.selectionStart ?? 0,
    elements.treeContent.selectionEnd ?? 0,
  );
  if (!target) {
    showNotice(t("editor.openLinkNone"), "info");
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}

async function openWikiLink(title) {
  const normalized = title.trim();
  if (!normalized) return;
  const existing = findTreeNodeByTitle(normalized);
  if (existing) {
    selectTreeNode(existing.id);
    return;
  }
  if (!(await confirmAction(t("note.linkCreateConfirm", { title: normalized })))) return;
  const node = createLinkedNote(normalized);
  selectTreeNode(node.id);
}

function createLinkedNote(title) {
  const selected = getSelectedTreeNode();
  if (!selected) {
    const root = createNode(title, "", null, 1);
    state.data.tree.push(root);
    persist();
    renderTree();
    return root;
  }
  if (selected.level < 3) {
    const child = createNode(title, "", selected.id, selected.level + 1);
    selected.children.push(child);
    state.expandedTreeIds.add(selected.id);
    persist();
    renderTree();
    return child;
  }
  const parent = findTreeNode(state.data.tree, selected.parentId);
  if (parent) {
    const sibling = createNode(title, "", parent.id, selected.level);
    parent.children.push(sibling);
    state.expandedTreeIds.add(parent.id);
    persist();
    renderTree();
    return sibling;
  }
  const root = createNode(title, "", null, 1);
  state.data.tree.push(root);
  persist();
  renderTree();
  return root;
}

function outgoingLinksFor(node) {
  const allNodes = flattenTree(state.data.tree);
  const byTitle = new Map(allNodes.map((item) => [item.title.trim().toLowerCase(), item]));
  return uniqueWikiLinks(node.content).map((title) => {
    const linked = byTitle.get(title.toLowerCase());
    return {
      title,
      node: linked || null,
      exists: Boolean(linked),
    };
  });
}

function linkButton(title, node, exists) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "backlink-item";
  button.classList.toggle("missing-link", !exists);
  button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${exists ? t("note.linkToNote") : t("note.linkMissing")}</span>`;
  button.addEventListener("click", () => {
    if (node) {
      selectTreeNode(node.id);
    } else {
      openWikiLink(title);
    }
  });
  return button;
}

function backlinksFor(target) {
  const targetTitle = target.title?.trim().toLowerCase();
  if (!targetTitle) return [];
  return flattenTree(state.data.tree).filter((node) => (
    node.id !== target.id && uniqueWikiLinks(node.content).some((title) => title.toLowerCase() === targetTitle)
  ));
}

function graphLinks() {
  const nodes = flattenTree(state.data.tree);
  const byTitle = new Map(nodes.map((node) => [node.title.trim().toLowerCase(), node]));
  return nodes.flatMap((from) => (
    uniqueWikiLinks(from.content)
      .map((title) => ({ from, to: byTitle.get(title.toLowerCase()) }))
      .filter((link) => link.to && link.to.id !== from.id)
  ));
}

function findTreeNodeByTitle(title) {
  const normalized = title.trim().toLowerCase();
  return flattenTree(state.data.tree).find((node) => node.title.trim().toLowerCase() === normalized) || null;
}

function extractWikiLinks(content) {
  return Array.from(stripMarkdownCode(content).matchAll(/\[\[([^\]]+)\]\]/g), (match) => match[1].trim())
    .filter(Boolean);
}

function uniqueWikiLinks(content) {
  const seen = new Set();
  return extractWikiLinks(content).filter((title) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripMarkdownCode(content) {
  return String(content || "")
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/`[^`]*`/g, "");
}

function sectionTitle(title) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  return heading;
}

function renderResults() {
  const query = state.search.toLowerCase();
  if (!query) {
    const emptyTitle = t("search.emptyTitle");
    const emptyDescription = t("search.emptyDescription");
    elements.resultsCount.textContent = t("search.emptyHint");
    elements.resultsList.innerHTML = `<div class="empty-state"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyDescription)}</span></div>`;
    return;
  }
  const parsed = parseSearchQuery(query, "all");
  if (parsed.valid === false) {
    const invalidTitle = t("search.invalidTitle");
    const invalidDescription = t("search.invalidDescription");
    elements.resultsCount.textContent = t("search.invalidHint");
    elements.resultsList.innerHTML = `<div class="empty-state"><strong>${escapeHtml(invalidTitle)}</strong><span>${escapeHtml(invalidDescription)}</span></div>`;
    return;
  }

  const results = searchResults(query);
  elements.resultsCount.textContent = t("search.resultCount").replace("{count}", String(results.length));
  renderSearchResultsInto(elements.resultsList, results);
}

function clearSearchResults() {
  state.search = "";
  elements.searchInput.value = "";
  setView("tree");
  render();
}

function searchResults(query, options = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const parsed = parseSearchQuery(normalizedQuery, options.scope || "all");
  const sort = options.sort || "updated-desc";
  const dailyMeta = t("search.dailyMeta");
  const dailyResults = Object.values(state.data.daily)
    .map((note) => ({
      type: "daily",
      id: note.date,
      title: longDateLabel(note.date),
      meta: dailyMeta,
      preview: note.content,
      content: note.content,
      path: `${dailyMeta} / ${longDateLabel(note.date)}`,
      tags: [],
      updatedAt: note.updatedAt || note.date,
      createdAt: note.date,
    }))
    .filter((result) => matchesSearchResult(result, parsed))
    .map((note) => ({
      type: "daily",
      id: note.id,
      title: note.title,
      meta: `${note.meta} · ${formatDateTime(note.updatedAt)}`,
      preview: note.content,
      searchText: parsed.text,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    }));

  const treeResults = flattenTree(state.data.tree)
    .map((node) => ({
      type: "tree",
      id: node.id,
      title: noteTitle(node.title),
      meta: `${levelName(node.level)} · ${treePath(node.id).join(" / ")}`,
      preview: node.content,
      content: node.content,
      path: treePath(node.id).join(" / "),
      tags: node.tags || [],
      updatedAt: node.updatedAt,
      createdAt: node.createdAt,
    }))
    .filter((result) => matchesSearchResult(result, parsed))
    .map((node) => ({ ...node, searchText: parsed.text }));

  return sortSearchResults([...dailyResults, ...treeResults], sort);
}

function parseSearchQuery(query, fallbackScope) {
  const prefixes = {
    "path:": "path",
    "file:": "title",
    "title:": "title",
    "tag:": "tag",
    "line:": "content",
    "content:": "content",
    "section:": "content",
    "[property]": "all",
  };
  if (query.startsWith("#")) {
    const text = query.slice(1).trim();
    return { scope: "tag", text, valid: text.length > 0 };
  }
  const prefix = Object.keys(prefixes).find((item) => query.startsWith(item));
  if (!prefix) {
    return { scope: fallbackScope, text: query, valid: query.length > 0 };
  }
  const text = query.slice(prefix.length).trim();
  if (!text) {
    return { scope: prefixes[prefix], text: "", valid: false };
  }
  return {
    scope: prefixes[prefix],
    text,
    valid: true,
  };
}

function matchesSearchResult(result, parsed) {
  if (!parsed.valid) return false;
  const text = parsed.text;
  if (!text) return true;
  const title = result.title.toLowerCase();
  const content = result.content.toLowerCase();
  const path = result.path.toLowerCase();
  const tags = result.tags.map((tag) => tag.toLowerCase());
  if (parsed.scope === "title") return title.includes(text);
  if (parsed.scope === "content") return content.includes(text);
  if (parsed.scope === "path") return path.includes(text);
  if (parsed.scope === "tag") return tags.some((tag) => tag.includes(text.replace(/^#/, "")));
  return [title, content, path, tags.join(" ")].some((value) => value.includes(text));
}

function sortSearchResults(results, sort) {
  const collator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
  const timeValue = (value) => new Date(value || 0).getTime() || 0;
  return [...results].sort((a, b) => {
    if (sort === "title-asc") return collator.compare(a.title, b.title);
    if (sort === "title-desc") return collator.compare(b.title, a.title);
    if (sort === "created-asc") return timeValue(a.createdAt) - timeValue(b.createdAt);
    if (sort === "created-desc") return timeValue(b.createdAt) - timeValue(a.createdAt);
    if (sort === "updated-asc") return timeValue(a.updatedAt) - timeValue(b.updatedAt);
    return timeValue(b.updatedAt) - timeValue(a.updatedAt);
  });
}

function renderSearchResultsInto(container, results, afterSelect) {
  if (results.length === 0) {
    const noResultTitle = t("search.noResultTitle");
    const noResultDescription = t("search.noResultDescription");
    container.innerHTML = `<div class="empty-state"><strong>${escapeHtml(noResultTitle)}</strong><span>${escapeHtml(noResultDescription)}</span></div>`;
    return;
  }

  container.replaceChildren(
    ...results.map((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-item";
      button.innerHTML = [
        `<strong>${highlightSearchText(result.title, result.searchText)}</strong>`,
        `<span>${highlightSearchText(result.meta, result.searchText)}</span>`,
        `<p>${highlightSearchText(snippet(result.preview, result.searchText), result.searchText)}</p>`,
      ].join("");
      button.addEventListener("click", () => {
        if (result.type === "daily") {
          state.selectedDate = result.id;
          const [year, month] = result.id.split("-").map(Number);
          state.visibleMonth = new Date(year, month - 1, 1);
          setView("tree");
          openDailyPopup();
        } else {
          selectTreeNode(result.id);
        }
        if (afterSelect) afterSelect(result);
      });
      button.addEventListener("keydown", (event) => {
        handleResultItemKey(event, button);
      });
      return button;
    }),
  );
}

function handleSearchPopoverInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = firstSearchResult(elements.searchPopoverResults);
  if (!first) return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleMainSearchInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = firstSearchResult(elements.resultsList);
  if (!first || state.view !== "results") return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleResultItemKey(event, button) {
  if (!["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
  event.preventDefault();
  const container = button.closest(".quick-results, .results-list");
  const results = Array.from(container?.querySelectorAll(".result-item") || []);
  const index = results.indexOf(button);
  if (event.key === "Enter") {
    button.click();
  } else if (event.key === "ArrowDown") {
    (results[index + 1] || results[0] || button).focus();
  } else if (event.key === "ArrowUp") {
    (results[index - 1] || results.at(-1) || button).focus();
  } else if (!elements.searchPopoverView.classList.contains("hidden")) {
    elements.searchPopoverInput.focus();
  } else {
    elements.searchInput.focus();
  }
}

function firstSearchResult(container) {
  return container.querySelector(".result-item");
}

function createNode(title, content, parentId, level) {
  return {
    id: crypto.randomUUID(),
    title,
    content,
    parentId,
    level,
    children: [],
    status: "active",
    syncState: "pending",
    shared: isHostedWebClient(),
    serverShared: isHostedWebClient(),
    unsharedAt: null,
    favorite: false,
    tags: extractTags(content),
    properties: defaultNoteProperties(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function defaultTitleForLevel(level) {
  if (level === 1) return t("note.newTopic");
  if (level === 2) return t("note.newCategory");
  return t("note.newNote");
}

function levelName(level) {
  if (level === 1) return t("note.labelTopic");
  if (level === 2) return t("note.labelCategory");
  return t("note.labelNote");
}

function markTreeNodeChanged(node) {
  if (isReadOnlyTreeNode(node)) return;
  node.updatedAt = new Date().toISOString();
  node.status = node.status || "active";
  node.syncState = "pending";
}

function getSelectedTreeNode() {
  if (!state.selectedTreeId) return null;
  return findTreeNode(state.data.tree, state.selectedTreeId);
}

function treeSiblingPosition(node) {
  const siblings = node.parentId
    ? findTreeNode(state.data.tree, node.parentId)?.children || []
    : state.data.tree;
  return {
    siblings,
    index: siblings.findIndex((item) => item.id === node.id),
  };
}

function moveSelectedTreeNode(direction) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const { siblings, index } = treeSiblingPosition(selected);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;
  [siblings[index], siblings[nextIndex]] = [siblings[nextIndex], siblings[index]];
  markTreeNodeChanged(selected);
  persist();
  renderTree();
}

function findTreeNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findTreeNode(node.children, id);
    if (child) return child;
  }
  return null;
}

function expandAncestors(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    if (node.id === id) {
      parents.forEach((parentId) => state.expandedTreeIds.add(parentId));
      return true;
    }
    if (expandAncestors(id, node.children, [...parents, node.id])) {
      return true;
    }
  }
  return false;
}

function archiveDeletedTreeNode(id) {
  const node = detachTreeNode(id);
  if (!node) return false;
  removeTreeTabReferences(id);
  state.data.deletedTree.unshift({
    ...node,
    children: [],
    status: "deleted",
    syncState: "local",
    deletedAt: new Date().toISOString(),
  });
  return true;
}

function restoreDeletedTreeNode(id) {
  const index = state.data.deletedTree.findIndex((node) => node.id === id);
  if (index < 0) return;
  const [node] = state.data.deletedTree.splice(index, 1);
  state.selectedDeletedTreeIds.delete(id);
  const parent = node.parentId ? findTreeNode(state.data.tree, node.parentId) : null;
  const restored = {
    ...node,
    status: "active",
    syncState: "pending",
    deletedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  if (parent && parent.level < 3) {
    restored.level = parent.level + 1;
    restored.parentId = parent.id;
    parent.children.push(restored);
    state.expandedTreeIds.add(parent.id);
  } else {
    restored.level = 1;
    restored.parentId = null;
    state.data.tree.push(restored);
  }
  state.selectedTreeId = restored.id;
  persist();
  render();
  renderDeletedTreeList();
}

async function permanentlyDeleteTreeNode(id) {
  const index = state.data.deletedTree.findIndex((node) => node.id === id);
  if (index < 0) return;
  const node = state.data.deletedTree[index];
  if (!(await confirmAction(t("note.nodeDelete.permanentConfirm", { title: noteTitle(node.title) })))) {
    return;
  }
  state.data.deletedTree.splice(index, 1);
  state.selectedDeletedTreeIds.delete(id);
  persist();
  renderDeletedTreeList();
  renderDeletedTreeButton();
}

function detachTreeNode(id, nodes = state.data.tree) {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const [node] = nodes.splice(index, 1);
    return node;
  }
  for (const node of nodes) {
    const child = detachTreeNode(id, node.children);
    if (child) return child;
  }
  return null;
}

function flattenTree(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(isPlainObject)
    .flatMap((node) => [node, ...flattenTree(node.children)]);
}

async function load() {
  if (isHostedWebClient()) {
    state.data = defaultData();
    return;
  }
  const raw = await readStorage(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    state.data.daily = parsed.daily || {};
    state.data.archivedDaily = parsed.archivedDaily || [];
    state.data.deletedTree = parsed.deletedTree || [];
    state.data.canvases = parsed.canvases || [];
    state.data.captures = parsed.captures || [];
    state.data.tree = parsed.tree || [];
    normalizeData();
    persist();
  } catch {
    clearStorage(STORAGE_KEY);
  }
}

async function loadSettings() {
  const raw = await readStorage(SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    state.settings = normalizeSettings(parsed);
    persistSettings();
  } catch {
    clearStorage(SETTINGS_KEY);
  }
}

function applyLanguageQueryOverride() {
  const language = getLanguageFromQuery();
  if (!language || language === state.settings.language) return;
  state.settings.language = language;
  persistSettings();
}

function getLanguageFromQuery() {
  const language = new URLSearchParams(window.location.search).get("lang");
  return SUPPORTED_LANGUAGES.includes(language) ? language : "";
}

function syncLanguageQueryParam(language) {
  if (!getLanguageFromQuery()) return;
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(null, "", url);
}

function normalizeSettings(settings = {}) {
  const defaults = defaultSettings();
  const normalized = {
    ...defaults,
    ...settings,
  };
  normalized.language = normalizeLanguage(normalized.language || defaults.language);
  normalized.theme = ["system", "light", "dark"].includes(normalized.theme) ? normalized.theme : defaults.theme;
  normalized.accent = ACCENTS.some((accent) => accent.id === normalized.accent) ? normalized.accent : defaults.accent;
  normalized.railMode = ["icon", "letter"].includes(normalized.railMode) ? normalized.railMode : defaults.railMode;
  normalized.showEditorActionIcons = normalizeToggle(normalized.showEditorActionIcons, defaults.showEditorActionIcons);
  normalized.fontSize = ["small", "medium", "large"].includes(normalized.fontSize) ? normalized.fontSize : defaults.fontSize;
  normalized.lineHeight = ["compact", "normal", "relaxed"].includes(normalized.lineHeight) ? normalized.lineHeight : defaults.lineHeight;
  normalized.tabIndentSize = normalizeTabIndentSize(normalized.tabIndentSize);
  normalized.wideEditor = normalizeToggle(normalized.wideEditor, defaults.wideEditor);
  normalized.treePanelCollapsed = normalizeToggle(normalized.treePanelCollapsed, defaults.treePanelCollapsed);
  normalized.sidebarCollapsed = normalizeToggle(normalized.sidebarCollapsed, defaults.sidebarCollapsed);
  normalized.showBacklinks = normalizeToggle(normalized.showBacklinks, defaults.showBacklinks);
  normalized.enableShortcuts = normalizeToggle(normalized.enableShortcuts, defaults.enableShortcuts);
  normalized.showTags = normalizeToggle(normalized.showTags, defaults.showTags);
  normalized.showSidebarAssist = normalizeToggle(normalized.showSidebarAssist, defaults.showSidebarAssist);
  normalized.server = normalizeServerSettings(normalized.server, defaults.server);
  normalized.features = normalizeFeatureSettings(normalized.features, defaults.features);
  normalized.features.backlinks = normalized.showBacklinks;
  normalized.features.tags = normalized.showTags;
  normalized.features.shortcuts = normalized.enableShortcuts;
  normalized.shortcuts = normalizeShortcutSettings(normalized.shortcuts, defaults.shortcuts);
  normalized.openTreeTabs = normalizeIdList(normalized.openTreeTabs, 100);
  normalized.closedTreeTabs = normalizeIdList(normalized.closedTreeTabs, 10);
  normalized.pinnedTreeTabs = normalizeIdList(normalized.pinnedTreeTabs, 10);
  normalized.graph = normalizeGraphSettings(normalized.graph, defaults.graph);
  normalized.properties = normalizePropertyViewSettings(normalized.properties, defaults.properties);
  normalized.workspaces = normalizeWorkspaceSettings(normalized.workspaces, defaults.workspaces);
  normalized.openTreeTabs = limitOpenTreeTabs(normalized.openTreeTabs, 10, normalized.pinnedTreeTabs);
  normalized.treeListWidth = Math.min(460, Math.max(180, Number(normalized.treeListWidth) || 280));
  return normalized;
}

function normalizeGraphSettings(graph = {}, defaults = defaultGraphSettings()) {
  const source = graph && typeof graph === "object" ? graph : {};
  const normalized = {
    ...defaults,
    ...source,
  };
  normalized.mode = normalized.mode === "local" ? "local" : "global";
  normalized.depth = Math.min(3, Math.max(1, Number(normalized.depth) || defaults.depth));
  normalized.filter = typeof normalized.filter === "string" ? normalized.filter : "";
  normalized.tag = typeof normalized.tag === "string" ? normalized.tag : "";
  normalized.group = ["topic", "tag", "share", "analysis"].includes(normalized.group) ? normalized.group : defaults.group;
  normalized.bookmarks = Array.isArray(normalized.bookmarks)
    ? normalized.bookmarks
        .filter((bookmark) => bookmark && typeof bookmark === "object" && typeof bookmark.name === "string")
        .map((bookmark) => ({
          name: bookmark.name.trim().slice(0, 48),
          mode: bookmark.mode === "local" ? "local" : "global",
          depth: Math.min(3, Math.max(1, Number(bookmark.depth) || defaults.depth)),
          filter: typeof bookmark.filter === "string" ? bookmark.filter.slice(0, 80) : "",
          tag: typeof bookmark.tag === "string" ? bookmark.tag.slice(0, 40) : "",
          group: ["topic", "tag", "share", "analysis"].includes(bookmark.group) ? bookmark.group : defaults.group,
        }))
        .filter((bookmark) => bookmark.name)
        .slice(0, 12)
    : [];
  return normalized;
}

function normalizePropertyViewSettings(properties = {}, defaults = defaultPropertyViewSettings()) {
  const source = properties && typeof properties === "object" ? properties : {};
  const normalized = {
    ...defaults,
    ...source,
  };
  normalized.search = typeof normalized.search === "string" ? normalized.search.slice(0, 80) : "";
  normalized.status = propertyStatusKeys().includes(normalized.status) ? normalized.status : "";
  normalized.priority = propertyPriorityKeys().includes(normalized.priority) ? normalized.priority : "";
  normalized.group = propertyGroupKeys().includes(normalized.group) ? normalized.group : defaults.group;
  normalized.savedFilters = Array.isArray(normalized.savedFilters)
    ? normalized.savedFilters
        .filter((filter) => filter && typeof filter === "object" && typeof filter.name === "string")
        .map((filter) => ({
          name: filter.name.trim().slice(0, 48),
          search: typeof filter.search === "string" ? filter.search.slice(0, 80) : "",
          status: propertyStatusKeys().includes(filter.status) ? filter.status : "",
          priority: propertyPriorityKeys().includes(filter.priority) ? filter.priority : "",
          group: propertyGroupKeys().includes(filter.group) ? filter.group : defaults.group,
        }))
        .filter((filter) => filter.name)
        .slice(0, 12)
    : [];
  return normalized;
}

function normalizeWorkspaceSettings(workspaces = {}, defaults = defaultWorkspaceSettings()) {
  const source = workspaces && typeof workspaces === "object" ? workspaces : {};
  const items = Array.isArray(source.items)
    ? source.items
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
          name: normalizeText(item.name || "작업공간").slice(0, 48),
          savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
          state: normalizeWorkspaceState(item.state),
        }))
        .filter((item) => item.name)
        .slice(0, 12)
    : defaults.items;
  const activeId = items.some((item) => item.id === source.activeId) ? source.activeId : "";
  return { activeId, items };
}

function normalizeWorkspaceState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    selectedTreeId: typeof source.selectedTreeId === "string" ? source.selectedTreeId : "",
    search: typeof source.search === "string" ? source.search.slice(0, 120) : "",
    openTreeTabs: normalizeIdList(source.openTreeTabs, 10),
    pinnedTreeTabs: normalizeIdList(source.pinnedTreeTabs, 10),
    graph: normalizeGraphSettings(source.graph),
    properties: normalizePropertyViewSettings(source.properties),
    treePanelCollapsed: Boolean(source.treePanelCollapsed),
    sidebarCollapsed: Boolean(source.sidebarCollapsed),
    wideEditor: source.wideEditor !== false,
    treeListWidth: Math.min(460, Math.max(180, Number(source.treeListWidth) || 280)),
  };
}

function normalizeServerSettings(server = {}, defaults = defaultServerSettings()) {
  const normalized = {
    ...defaults,
    ...(server && typeof server === "object" ? server : {}),
  };
  normalized.mode = normalized.mode === "server" ? "server" : "local";
  normalized.url = typeof normalized.url === "string" ? normalizeServerUrl(normalized.url) : "";
  normalized.token = typeof normalized.token === "string" ? normalized.token : "";
  normalized.userToken = typeof normalized.userToken === "string" ? normalized.userToken : "";
  normalized.webSessionToken = typeof normalized.webSessionToken === "string" ? normalized.webSessionToken : "";
  normalized.autoSync = normalizeToggle(normalized.autoSync, defaults.autoSync);
  normalized.ownerId = normalizeOwnerId(normalized.ownerId || defaults.ownerId);
  normalized.deviceId = typeof normalized.deviceId === "string" && normalized.deviceId.trim() ? normalized.deviceId.trim() : defaults.deviceId;
  normalized.userProfile = normalizeServerUserProfile(normalized.userProfile, defaults.userProfile);
  normalized.capabilities = normalized.capabilities && typeof normalized.capabilities === "object" ? normalized.capabilities : null;
  normalized.publicServerReadiness =
    normalized.publicServerReadiness && typeof normalized.publicServerReadiness === "object"
      ? {
          status: typeof normalized.publicServerReadiness.status === "string" ? normalized.publicServerReadiness.status : "",
          remaining: Array.isArray(normalized.publicServerReadiness.remaining)
            ? normalized.publicServerReadiness.remaining.filter((item) => typeof item === "string")
            : [],
        }
      : null;
  normalized.analysisJobs = Array.isArray(normalized.analysisJobs) ? normalized.analysisJobs.slice(0, 5) : [];
  normalized.userGroups = normalizeServerGroups(normalized.userGroups);
  normalized.groupMessages = Array.isArray(normalized.groupMessages) ? normalized.groupMessages.slice(-100) : [];
  normalized.groupMessengerUnreadCount = Math.max(0, Number(normalized.groupMessengerUnreadCount) || 0);
  normalized.groupMessengerLastReadId = Math.max(0, Number(normalized.groupMessengerLastReadId) || 0);
  normalized.groupMessagesLoadedAt = typeof normalized.groupMessagesLoadedAt === "string" ? normalized.groupMessagesLoadedAt : null;
  normalized.conflicts = Array.isArray(normalized.conflicts)
    ? normalized.conflicts
        .filter((conflict) => conflict && typeof conflict === "object" && typeof conflict.id === "string")
        .slice(0, 20)
    : [];
  normalized.lastCheckedAt = typeof normalized.lastCheckedAt === "string" ? normalized.lastCheckedAt : null;
  normalized.lastSyncedAt = typeof normalized.lastSyncedAt === "string" ? normalized.lastSyncedAt : null;
  normalized.lastStatus = ["idle", "saved", "testing", "ok", "bad"].includes(normalized.lastStatus) ? normalized.lastStatus : "idle";
  normalized.lastMessage = typeof normalized.lastMessage === "string" ? normalized.lastMessage : "";
  normalized.lastMessageKey = typeof normalized.lastMessageKey === "string" ? normalized.lastMessageKey : "";
  normalized.lastMessageParams =
    normalized.lastMessageParams && typeof normalized.lastMessageParams === "object"
      ? normalized.lastMessageParams
      : null;
  return normalized;
}

function normalizeServerGroups(groups = []) {
  if (!Array.isArray(groups)) return [];
  const seen = new Set();
  return groups
    .map((group) => ({
      name: typeof group?.name === "string" ? group.name.trim() : "",
      description: typeof group?.description === "string" ? group.description.trim() : "",
      inviteCodeEnabled: group?.invite_code_enabled === true || group?.inviteCodeEnabled === true,
    }))
    .filter((group) => {
      if (!group.name || seen.has(group.name)) return false;
      seen.add(group.name);
      return true;
    })
    .slice(0, 50);
}

function normalizeServerUserProfile(profile = {}, defaults = defaultServerUserProfile()) {
  const source = profile && typeof profile === "object" ? profile : {};
  return {
    ...defaults,
    email: typeof source.email === "string" ? source.email : defaults.email,
    displayName: typeof source.displayName === "string" ? source.displayName : defaults.displayName,
    timezone: typeof source.timezone === "string" && source.timezone.trim() ? source.timezone.trim() : defaults.timezone,
    groupName: typeof source.groupName === "string" ? source.groupName : defaults.groupName,
    twoFactorEnabled: source.twoFactorEnabled === true,
    isActive: source.isActive !== false,
    lastSeenAt: typeof source.lastSeenAt === "string" ? source.lastSeenAt : null,
    loadedAt: typeof source.loadedAt === "string" ? source.loadedAt : null,
  };
}

function normalizeOwnerId(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || "local_user";
}

function normalizeDeviceId(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || "desktop";
}

function blankToNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function normalizeIdList(value, limit) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id) => typeof id === "string" && id.trim()))).slice(0, limit);
}

function normalizeToggle(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeShortcutSettings(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {};
  SHORTCUT_ACTIONS.forEach((action) => {
    normalized[action.id] = normalizeShortcut(source[action.id] || fallback[action.id] || action.defaultShortcut);
  });
  if (
    shortcutEquals(normalized.search, { ctrl: true, shift: true, key: "f" })
    && shortcutEquals(normalized.noteFind, { ctrl: true, key: "f" })
  ) {
    normalized.search = { ctrl: true, key: "f" };
    normalized.noteFind = { ctrl: true, shift: true, key: "f" };
  }
  if (
    shortcutEquals(normalized.commandPalette, { ctrl: true, shift: true, key: "p" })
    && shortcutEquals(normalized.pinTab, { ctrl: true, shift: true, key: "p" })
  ) {
    normalized.pinTab = { ctrl: true, alt: true, key: "p" };
  }
  return normalized;
}

function normalizeTabIndentSize(value) {
  const size = Number(value);
  return [2, 4, 8].includes(size) ? size : 2;
}

function normalizeFeatureSettings(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    FEATURE_TOGGLES.map((feature) => [
      feature.id,
      typeof source[feature.id] === "boolean" ? source[feature.id] : fallback[feature.id],
    ]),
  );
}

function persistSettings() {
  writeStorage(SETTINGS_KEY, settingsForStorage());
}

function settingsForStorage() {
  if (!isHostedWebClient()) return state.settings;
  return {
    ...state.settings,
    server: {
      ...defaultServerSettings(),
      mode: "server",
      url: defaultHostedServerUrl(),
      deviceId: "web-client",
    },
  };
}

function normalizeData() {
  state.data.daily = state.data.daily && typeof state.data.daily === "object" && !Array.isArray(state.data.daily)
    ? state.data.daily
    : {};
  state.data.archivedDaily = Array.isArray(state.data.archivedDaily) ? state.data.archivedDaily : [];
  state.data.deletedTree = Array.isArray(state.data.deletedTree) ? state.data.deletedTree : [];
  state.data.canvases = Array.isArray(state.data.canvases) ? state.data.canvases : [];
  state.data.captures = Array.isArray(state.data.captures) ? state.data.captures : [];
  state.data.snapshots = Array.isArray(state.data.snapshots) ? state.data.snapshots : [];
  state.data.importReports = Array.isArray(state.data.importReports) ? state.data.importReports : [];
  state.data.publishBundles = Array.isArray(state.data.publishBundles) ? state.data.publishBundles : [];
  state.data.tree = Array.isArray(state.data.tree) ? state.data.tree : [];

  state.data.daily = normalizeDailyNotes(state.data.daily);
  state.data.archivedDaily = state.data.archivedDaily.filter((note) => isPlainObject(note) && isDateKey(note.date));
  state.data.deletedTree = state.data.deletedTree.filter(isPlainObject);
  state.data.canvases = state.data.canvases.filter(isPlainObject).map(normalizeCanvas).slice(0, 12);
  state.data.captures = state.data.captures.filter(isPlainObject).map(normalizeCaptureCard).slice(0, 500);
  state.data.snapshots = state.data.snapshots.filter(isPlainObject).map(normalizeRecoverySnapshot).slice(0, 12);
  state.data.importReports = state.data.importReports.filter(isPlainObject).map(normalizeImportReport).slice(0, 20);
  state.data.publishBundles = state.data.publishBundles.filter(isPlainObject).map(normalizePublishBundle).slice(0, 30);
  state.data.tree = state.data.tree.filter(isPlainObject);

  Object.values(state.data.daily).forEach((note) => {
    note.content = normalizeText(note.content);
    note.status = note.status || "active";
    note.syncState = note.syncState || "synced";
    note.updatedAt = note.updatedAt || new Date().toISOString();
  });
  state.data.archivedDaily.forEach((note) => {
    note.id = note.id || crypto.randomUUID();
    note.content = normalizeText(note.content);
    note.status = note.status || "archived";
    note.syncState = note.syncState || "synced";
    note.archivedAt = note.archivedAt || note.updatedAt || new Date().toISOString();
    note.restoredAt = note.restoredAt || null;
    note.updatedAt = note.updatedAt || note.archivedAt;
  });
  state.data.deletedTree.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = normalizeText(node.title);
    node.content = normalizeText(node.content);
    node.children = [];
    node.status = "deleted";
    node.syncState = node.syncState || "synced";
    node.shared = node.shared !== false;
    node.deletedAt = node.deletedAt || node.updatedAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.deletedAt;
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
  });
  normalizeTreeNodes(state.data.tree, null, 1);
}

function normalizeRecoverySnapshot(snapshot = {}) {
  return {
    id: typeof snapshot.id === "string" && snapshot.id ? snapshot.id : crypto.randomUUID(),
    reason: normalizeText(snapshot.reason).slice(0, 40) || "snapshot",
    createdAt: snapshot.createdAt || new Date().toISOString(),
    summary: isPlainObject(snapshot.summary) ? snapshot.summary : backupSummary(snapshot.data || {}),
    data: isBackupData(snapshot.data) ? backupDataShape(snapshot.data, { includeRecoveryMeta: false }) : defaultData(),
  };
}

function normalizeImportReport(report = {}) {
  return {
    id: typeof report.id === "string" && report.id ? report.id : crypto.randomUUID(),
    source: normalizeText(report.source).slice(0, 80) || "import",
    createdAt: report.createdAt || new Date().toISOString(),
    nodes: Math.max(0, Number(report.nodes) || 0),
    fixes: Math.max(0, Number(report.fixes) || 0),
    warnings: Math.max(0, Number(report.warnings) || 0),
    messages: Array.isArray(report.messages) ? report.messages.map((message) => normalizeText(message).slice(0, 180)).slice(0, 20) : [],
  };
}

function normalizePublishBundle(bundle = {}) {
  const now = new Date().toISOString();
  return {
    id: typeof bundle.id === "string" && bundle.id ? bundle.id : crypto.randomUUID(),
    title: normalizeText(bundle.title).slice(0, 80) || "공개 지식 묶음",
    description: normalizeText(bundle.description).slice(0, 220),
    permalink: slugifyPermalink(bundle.permalink || bundle.title || "nownote-public"),
    cover: normalizeText(bundle.cover).slice(0, 240),
    includeNodeIds: Array.isArray(bundle.includeNodeIds) ? bundle.includeNodeIds.filter((id) => typeof id === "string") : [],
    createdAt: bundle.createdAt || now,
    updatedAt: bundle.updatedAt || now,
  };
}

function normalizeDailyNotes(daily) {
  return Object.entries(daily).reduce((normalized, [dateKey, note]) => {
    const date = isPlainObject(note) && isDateKey(note.date)
      ? note.date
      : dateKey;
    if (!isDateKey(date)) return normalized;
    const entry = isPlainObject(note)
      ? { ...note, date }
      : { date, content: String(note || "") };
    if (normalized[date]) {
      normalized[date] = mergeDailyNote(normalized[date], entry);
    } else {
      normalized[date] = entry;
    }
    return normalized;
  }, {});
}

function mergeDailyNote(current, next) {
  const currentContent = current.content || "";
  const nextContent = next.content || "";
  const content = currentContent.trim() && nextContent.trim()
    ? `${currentContent.trimEnd()}\n\n${nextContent}`
    : currentContent || nextContent;
  return {
    ...current,
    ...next,
    content,
    updatedAt: next.updatedAt || current.updatedAt,
  };
}

function normalizeTreeNodes(nodes, parentId, level) {
  nodes.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = normalizeText(node.title);
    node.content = normalizeText(node.content);
    node.parentId = parentId;
    node.level = level;
    node.children = Array.isArray(node.children) ? node.children.filter(isPlainObject) : [];
    node.status = node.status || "active";
    node.syncState = node.syncState || "synced";
    node.shared = node.shared !== false;
    node.serverShared = node.serverShared === true;
    node.groupSharedReadOnly = node.groupSharedReadOnly === true;
    node.remoteOwnerId = normalizeText(node.remoteOwnerId).slice(0, 80);
    node.remoteLocalId = normalizeText(node.remoteLocalId).slice(0, 120);
    node.unsharedAt = node.shared === false ? (node.unsharedAt || node.updatedAt || null) : null;
    node.favorite = Boolean(node.favorite);
    node.tags = isEncryptedContent(node.content) ? [] : (Array.isArray(node.tags) ? node.tags : extractTags(node.content));
    node.properties = normalizeNoteProperties(node.properties);
    node.createdAt = node.createdAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.createdAt;
    if (node.level >= 3 && node.children.length > 0) {
      node.content = mergeOverflowTreeChildren(node.content, node.children);
      node.children = [];
      node.tags = isEncryptedContent(node.content) ? [] : extractTags(node.content);
    }
    normalizeTreeNodes(node.children, node.id, node.level + 1);
  });
}

function mergeOverflowTreeChildren(content, children) {
  const overflow = flattenTree(children)
    .map((child) => [`### ${noteTitle(child.title)}`, child.content || ""].join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
  return [content || "", overflow].filter((part) => part.trim()).join(`\n\n--- ${t("note.mergeChildrenMarker")} ---\n\n`);
}

function persist() {
  if (!isHostedWebClient()) {
    writeStorage(STORAGE_KEY, state.data);
  }
  scheduleServerSync();
}

function scheduleServerSync(options = {}) {
  if (hostedWebSyncSuspended) return;
  const server = state.settings.server || defaultServerSettings();
  if (server.mode !== "server" || !server.url) return;
  if (isHostedWebClient() && !server.webSessionToken) return;
  if (server.autoSync === false) return;
  if (!options.force && countPendingSyncNotes() === 0) return;
  window.clearTimeout(serverSyncTimer);
  serverSyncTimer = window.setTimeout(() => {
    syncWebNotesToServer(t("settings.server.syncing"), { skipFormSave: true });
  }, options.delay ?? 1200);
}

async function readStorage(key) {
  if (isDesktopClient() && DESKTOP_STORAGE_KEYS.has(key)) {
    const desktopValue = await window.nownoteDesktop.storage.read(key);
    if (desktopValue !== null && desktopValue !== undefined) return desktopValue;
    return migrateLocalStorageToDesktopStore(key);
  }
  return localStorage.getItem(key);
}

function clearStorage(key) {
  if (!isDesktopClient()) {
    localStorage.removeItem(key);
  }
}

async function migrateLocalStorageToDesktopStore(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = await window.nownoteDesktop.storage.write(key, parsed);
    desktopStorageInfo = {
      ...(desktopStorageInfo || {}),
      ...result,
      error: false,
    };
    return parsed;
  } catch {
    return raw;
  }
}

function writeStorage(key, value) {
  if (isDesktopClient() && DESKTOP_STORAGE_KEYS.has(key)) {
    window.nownoteDesktop.storage.write(key, value)
      .then((result) => {
        desktopStorageInfo = {
          ...(desktopStorageInfo || {}),
          ...result,
          error: false,
        };
        renderDesktopStorageStatus();
      })
      .catch(() => {
        desktopStorageInfo = {
          ...(desktopStorageInfo || {}),
          error: true,
        };
        renderDesktopStorageStatus();
        if (!storageWarningShown) {
          storageWarningShown = true;
          showNotice(t("note.desktopStorageFail"), "error");
        }
      });
    return true;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      showNotice(t("note.storageFail"), "error");
    }
    return false;
  }
}

function exportData() {
  downloadCurrentBackup();
}

function exportMarkdown() {
  const restoredArchivedDailyCount = state.data.archivedDaily.filter((note) => note.restoredAt).length;
  const markdown = [
    `# ${t("markdownExport.title")}`,
    "",
    `- ${t("markdownExport.exportedAt")}: ${new Date().toLocaleString(currentLocale())}`,
    `- ${t("markdownExport.treeCount")}: ${flattenTree(state.data.tree).length}`,
    `- ${t("markdownExport.dailyCount")}: ${Object.keys(state.data.daily).length}`,
    `- ${t("markdownExport.archivedDailyCount")}: ${state.data.archivedDaily.length}`,
    ...(restoredArchivedDailyCount ? [`- ${t("markdownExport.restoredArchivedDailyCount")}: ${restoredArchivedDailyCount}`] : []),
    "",
    `## ${t("markdownExport.treeSection")}`,
    "",
    treeToMarkdown(state.data.tree),
    "",
    `## ${t("markdownExport.dailySection")}`,
    "",
    dailyToMarkdown(),
    "",
    `## ${t("markdownExport.archivedDailySection")}`,
    "",
    archivedDailyToMarkdown(),
  ].join("\n");
  downloadText(`nownote-${fileTimestamp(new Date())}.md`, markdown, "text/markdown");
}

function treeToMarkdown(nodes) {
  if (nodes.length === 0) return `${t("markdownExport.emptyTree")}\n`;
  return nodes.map((node) => nodeToMarkdown(node)).join("\n\n");
}

function nodeToMarkdown(node) {
  const headingLevel = Math.min(node.level + 1, 6);
  const tags = node.tags.length ? `\n\n${t("markdownExport.tags")}: ${node.tags.map((tag) => `#${tag}`).join(" ")}` : "";
  const favorite = node.favorite ? `\n\n${t("markdownExport.favorite")}: ${t("markdownExport.yes")}` : "";
  const meta = [
    `${t("markdownExport.path")}: ${treePath(node.id).join(" / ")}`,
    `${t("markdownExport.updated")}: ${formatDateTime(node.updatedAt)}`,
  ].join("\n");
  const content = node.content?.trim() || t("markdownExport.emptyContent");
  const children = node.children.map((child) => nodeToMarkdown(child)).join("\n\n");
  return [
    `${"#".repeat(headingLevel)} [${levelName(node.level)}] ${noteTitle(node.title)}`,
    "",
    meta,
    tags,
    favorite,
    "",
    content,
    "",
    children,
  ].filter((part) => part !== "").join("\n");
}

function dailyToMarkdown() {
  const entries = Object.values(state.data.daily)
    .filter((note) => note.content?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return `${t("markdownExport.emptyDaily")}\n`;
  return entries.map((note) => [
    `### ${markdownDateHeading(note.date)}`,
    "",
    note.content.trim(),
    "",
  ].join("\n")).join("\n");
}

function archivedDailyToMarkdown() {
  const entries = state.data.archivedDaily
    .filter((note) => note.content?.trim())
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.archivedAt || "").localeCompare(b.archivedAt || ""));
  if (entries.length === 0) return `${t("markdownExport.emptyArchivedDaily")}\n`;
  return entries.map((note) => [
    `### ${markdownDateHeading(note.date)}`,
    "",
    `- ${t("markdownExport.archivedAt")}: ${formatDateTime(note.archivedAt || note.updatedAt)}`,
    ...(note.restoredAt ? [`- ${t("markdownExport.restoredAt")}: ${formatDateTime(note.restoredAt)}`] : []),
    "",
    note.content.trim(),
    "",
  ].join("\n")).join("\n");
}

function markdownDateHeading(dateKey) {
  if (normalizeLanguage(state.settings.language) !== "ko") return `${dateKey} · ${longDateLabel(dateKey)}`;
  return longDateLabel(dateKey);
}

function downloadText(filename, content, type) {
  let url = null;
  try {
    const blob = new Blob([content], { type });
    url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  } catch {
    showNotice(t("note.exportDenied"), "error");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parseBackupData(parsed);
      if (!imported.data) {
        showNotice(t("note.backupImportError"), "error");
        return;
      }
      const summary = backupSummary(imported.data);
      if (!(await confirmAction(t("note.backupReplaceConfirm", {
        file: file.name,
        time: imported.exportedAt ? formatBackupTime(imported.exportedAt) : t("note.unknownDate"),
        daily: summary.daily,
        archivedDaily: summary.archivedDaily,
        restoredArchivedDaily: summary.restoredArchivedDaily ? t("note.restoredArchivedDailyCount", { count: summary.restoredArchivedDaily }) : "",
        tree: summary.tree,
        deletedTree: summary.deletedTree,
      })))) {
        return;
      }
      createRecoverySnapshot("before-json-import");
      const preservedSnapshots = state.data.snapshots;
      const preservedReports = state.data.importReports;
      downloadCurrentBackup("nownote-before-import");
      state.data = backupDataShape(imported.data);
      state.data.snapshots = preservedSnapshots;
      state.data.importReports = preservedReports;
      if (imported.settings) {
        state.settings = normalizeSettings(imported.settings);
        persistSettings();
        renderSettings();
        applySettings();
      }
      normalizeData();
      state.selectedTreeId = null;
      persist();
      render();
      showNotice(t("note.importDone"), "success");
    } catch {
      showNotice(t("note.importReadError"), "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    showNotice(t("note.backupFileParseError"), "error");
    event.target.value = "";
  };
  try {
    reader.readAsText(file);
  } catch {
    showNotice(t("note.backupFileOpenError"), "error");
    event.target.value = "";
  }
}

async function importMarkdownData(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  try {
    const imports = (await Promise.all(files.map(async (file) => {
      const content = (await readTextFile(file)).replace(/\r\n/g, "\n");
      if (!content.trim()) return null;
      const treeNodes = parseNowNoteMarkdownTree(content);
      const dailyNotes = parseNowNoteMarkdownDaily(content);
      const archivedDailyNotes = parseNowNoteMarkdownArchivedDaily(content);
      if (treeNodes.length > 0 || dailyNotes.length > 0 || archivedDailyNotes.length > 0) {
        return {
          title: t("note.markdownStructureTitle", { name: file.name }),
          nodes: treeNodes,
          dailyNotes,
          archivedDailyNotes,
        };
      }
      const converted = markdownFileToImportNode(file.name, content);
      return {
        title: converted.title,
        nodes: [converted.node],
        dailyNotes: [],
        archivedDailyNotes: [],
        report: converted.report,
      };
    }))).filter(Boolean);
    if (imports.length === 0) {
      showNotice(t("note.markdownNoContent"), "error");
      return;
    }
    const summary = markdownImportSummary(imports);
    const previewNames = imports.slice(0, 5).map((item) => `- ${item.title}`).join("\n");
    const moreText = imports.length > 5 ? `\n- ${t("note.markdownImportedMore", { count: imports.length - 5 })}` : "";
    if (!(await confirmAction([
      t("note.markdownImportConfirm", { count: imports.length, nodes: summary.nodes, daily: summary.daily, archivedDaily: summary.archivedDaily }),
      "",
      previewNames + moreText,
    ].join("\n")))) {
      return;
    }
    createRecoverySnapshot("before-markdown-import");
    recordImportReport("Markdown 가져오기", imports);
    const nodes = imports.flatMap((item) => item.nodes);
    const dailyNotes = imports.flatMap((item) => item.dailyNotes || []);
    const archivedDailyNotes = imports.flatMap((item) => item.archivedDailyNotes || []);
    if (nodes.length > 0) {
      state.data.tree.push(...nodes);
      state.selectedTreeId = nodes[0].id;
      nodes.forEach((node) => state.expandedTreeIds.add(node.id));
    }
    dailyNotes.forEach((note) => mergeImportedDailyNote(note));
    state.data.archivedDaily.unshift(...archivedDailyNotes);
    persist();
    showMarkdownImportResult(nodes, dailyNotes);
    showNotice(t("note.markdownImportDone", { nodes: nodes.length, daily: dailyNotes.length, archivedDaily: archivedDailyNotes.length }), "success");
  } catch {
    showNotice(t("note.markdownImportError"), "error");
  } finally {
    event.target.value = "";
  }
}

function markdownImportSummary(imports) {
  return imports.reduce((summary, item) => {
    summary.nodes += item.nodes?.length || 0;
    summary.daily += item.dailyNotes?.length || 0;
    summary.archivedDaily += item.archivedDailyNotes?.length || 0;
    return summary;
  }, { nodes: 0, daily: 0, archivedDaily: 0 });
}

function showMarkdownImportResult(nodes, dailyNotes) {
  if (nodes.length > 0) {
    setView("tree");
    return;
  }
  if (dailyNotes.length > 0) {
    state.selectedDate = dailyNotes[0].date;
    const [year, month] = state.selectedDate.split("-").map(Number);
    state.visibleMonth = new Date(year, month - 1, 1);
    render();
    openDailyPopup();
    return;
  }
  render();
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    try {
      reader.readAsText(file);
    } catch (error) {
      reject(error);
    }
  });
}

function markdownFileToImportNode(fileName, content) {
  const { attributes, body, messages, fixes } = parseMarkdownFrontmatter(content);
  const converted = convertObsidianMarkdown(body || content);
  const title = normalizeText(attributes.title).slice(0, 80) || titleFromMarkdownFile(fileName, converted.content);
  const node = createNode(title, converted.content, null, 1);
  node.properties = propertiesFromFrontmatter(attributes);
  node.tags = frontmatterTags(attributes).length ? frontmatterTags(attributes) : extractTags(node.content);
  node.favorite = Boolean(attributes.favorite || attributes.pinned);
  return {
    title,
    node,
    report: {
      fixes: fixes + converted.fixes,
      warnings: messages.length + converted.messages.length,
      messages: [...messages, ...converted.messages],
    },
  };
}

function parseMarkdownFrontmatter(content) {
  const match = String(content || "").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { attributes: {}, body: content, messages: [], fixes: 0 };
  const attributes = {};
  const messages = [];
  match[1].split(/\r?\n/).forEach((line) => {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) {
      if (line.trim()) messages.push(`frontmatter 보류: ${line.trim()}`);
      return;
    }
    const key = field[1].trim();
    let value = field[2].trim();
    if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    attributes[key] = value;
  });
  return { attributes, body: match[2], messages, fixes: Object.keys(attributes).length };
}

function frontmatterTags(attributes) {
  const tags = attributes.tags || attributes.tag;
  if (Array.isArray(tags)) return tags.map((tag) => normalizeText(tag).replace(/^#/, "")).filter(Boolean);
  return normalizeText(tags).split(/[,\s]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean);
}

function propertiesFromFrontmatter(attributes) {
  return normalizeNoteProperties({
    status: attributes.status || attributes.state || "",
    priority: attributes.priority || "",
    type: attributes.type || attributes.category || "",
    project: attributes.project || "",
    source: attributes.source || attributes.url || "",
    author: attributes.author || "",
    due: attributes.due || attributes.dueDate || attributes.deadline || "",
  });
}

function convertObsidianMarkdown(content) {
  const messages = [];
  let fixes = 0;
  let converted = String(content || "");
  converted = converted.replace(/!\[\[([^\]]+)\]\]/g, (_match, target) => {
    fixes += 1;
    messages.push(`첨부 표기 보정: ${target}`);
    return `[첨부: ${target}]`;
  });
  converted = converted.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_match, target) => {
    fixes += 1;
    messages.push(`별칭 링크 보정: ${target}`);
    return `[[${target.trim()}]]`;
  });
  converted = converted.replace(/\[\[#([^\]]+)\]\]/g, (_match, target) => {
    fixes += 1;
    messages.push(`헤딩 링크 보류: ${target}`);
    return `[[${target.trim()}]]`;
  });
  return { content: converted.trim(), fixes, messages };
}

function createRecoverySnapshot(reason = "manual") {
  const snapshot = {
    id: crypto.randomUUID(),
    reason,
    createdAt: new Date().toISOString(),
    summary: backupSummary(state.data),
    data: backupDataShape(state.data, { includeRecoveryMeta: false }),
  };
  state.data.snapshots = [snapshot, ...(state.data.snapshots || [])].slice(0, 12);
  return snapshot;
}

async function restoreSelectedSnapshot() {
  const snapshotId = elements.snapshotSelect?.value || "";
  const snapshot = (state.data.snapshots || []).find((item) => item.id === snapshotId);
  if (!snapshot) return;
  if (!(await confirmAction(t("note.snapshotRestoreConfirm")))) return;
  createRecoverySnapshot("before-restore");
  const preservedSnapshots = state.data.snapshots;
  const preservedReports = state.data.importReports;
  state.data = backupDataShape(snapshot.data);
  state.data.snapshots = preservedSnapshots;
  state.data.importReports = preservedReports;
  normalizeData();
  state.selectedTreeId = null;
  persist();
  render();
  showNotice(t("note.snapshotRestored"), "success");
}

function renderRecoveryPanel() {
  if (!elements.snapshotSelect || !elements.snapshotSummary || !elements.importReportList) return;
  const snapshots = Array.isArray(state.data.snapshots) ? state.data.snapshots : [];
  const selected = elements.snapshotSelect.value;
  elements.snapshotSelect.replaceChildren(
    optionElement("", "스냅샷 선택"),
    ...snapshots.map((snapshot) => optionElement(snapshot.id, snapshotLabel(snapshot))),
  );
  if (selected && snapshots.some((snapshot) => snapshot.id === selected)) {
    elements.snapshotSelect.value = selected;
  }
  elements.snapshotRestoreBtn.disabled = !elements.snapshotSelect.value;
  elements.snapshotSummary.textContent = snapshots.length
    ? `최근 스냅샷 ${snapshots.length}개 · ${snapshotLabel(snapshots[0])}`
    : "스냅샷이 없습니다.";
  const reports = Array.isArray(state.data.importReports) ? state.data.importReports.slice(0, 6) : [];
  if (!reports.length) {
    elements.importReportList.textContent = "가져오기 진단이 없습니다.";
    return;
  }
  elements.importReportList.replaceChildren(...reports.map(importReportElement));
}

function optionElement(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function snapshotLabel(snapshot) {
  const summary = snapshot.summary || backupSummary(snapshot.data || {});
  return `${formatBackupTime(snapshot.createdAt)} · ${snapshot.reason || "snapshot"} · 지식 ${summary.tree || 0}개`;
}

function importReportElement(report) {
  const item = document.createElement("div");
  item.className = "import-report-item";
  const title = document.createElement("strong");
  title.textContent = `${report.source || "Markdown"} · ${formatBackupTime(report.createdAt)}`;
  const meta = document.createElement("span");
  meta.textContent = `추가 ${report.nodes || 0}개 · 보정 ${report.fixes || 0}개 · 경고 ${report.warnings || 0}개`;
  item.append(title, meta);
  (report.messages || []).slice(0, 5).forEach((message) => {
    const line = document.createElement("small");
    line.textContent = message;
    item.append(line);
  });
  return item;
}

function renderPublishPanel() {
  if (!elements.publishBundleSelect || !elements.publishNodeList || !elements.publishPreview) return;
  const bundles = state.data.publishBundles || [];
  if (!state.selectedPublishBundleId && bundles[0]) state.selectedPublishBundleId = bundles[0].id;
  elements.publishBundleSelect.replaceChildren(
    optionElement("", "새 공개 묶음"),
    ...bundles.map((bundle) => optionElement(bundle.id, bundle.title)),
  );
  elements.publishBundleSelect.value = state.selectedPublishBundleId || "";
  const bundle = selectedPublishBundle();
  elements.publishTitleInput.value = bundle?.title || "공개 지식 묶음";
  elements.publishDescriptionInput.value = bundle?.description || "";
  elements.publishPermalinkInput.value = bundle?.permalink || "nownote-public";
  renderPublishNodeList(bundle);
  renderPublishPreview();
}

function renderPublishNodeList(bundle = selectedPublishBundle()) {
  const nodes = flattenTree(state.data.tree);
  const includeIds = new Set(bundle?.includeNodeIds?.length ? bundle.includeNodeIds : publishableTreeNodes().map((node) => node.id));
  if (!nodes.length) {
    elements.publishNodeList.textContent = "공개 가능한 메모가 없습니다.";
    return;
  }
  elements.publishNodeList.replaceChildren(...nodes.map((node) => {
    const excludedReason = publishExclusionReason(node);
    const label = document.createElement("label");
    label.className = "publish-node-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = node.id;
    input.checked = includeIds.has(node.id) && !excludedReason;
    input.disabled = Boolean(excludedReason);
    input.addEventListener("change", renderPublishPreview);
    const text = document.createElement("span");
    text.textContent = excludedReason
      ? `${treePath(node.id).join(" / ")} · 제외: ${excludedReason}`
      : treePath(node.id).join(" / ");
    label.append(input, text);
    return label;
  }));
}

function renderPublishPreview() {
  if (!elements.publishPreview) return;
  const draft = publishBundleFromInputs();
  const content = buildPublishBundleContent(draft);
  const warnings = scanPublishSensitiveContent(content.nodes);
  elements.publishSensitiveList.replaceChildren(...sensitiveWarningElements(warnings));
  if (!content.nodes.length) {
    elements.publishPreview.textContent = "공개 묶음에 포함할 메모가 없습니다.";
    return;
  }
  const previewItems = content.nodes.slice(0, 6)
    .map((node) => `<li>${escapeHtml(treePath(node.id).join(" / "))}</li>`)
    .join("");
  elements.publishPreview.innerHTML = [
    `<h4>${escapeHtml(draft.title)}</h4>`,
    draft.description ? `<p>${escapeHtml(draft.description)}</p>` : "",
    `<p>${escapeHtml(String(content.nodes.length))}개 문서 · permalink: ${escapeHtml(draft.permalink)}</p>`,
    `<ul>${previewItems}</ul>`,
  ].join("");
}

function selectedPublishBundle() {
  return (state.data.publishBundles || []).find((bundle) => bundle.id === state.selectedPublishBundleId) || null;
}

function publishBundleFromInputs() {
  return normalizePublishBundle({
    id: state.selectedPublishBundleId || crypto.randomUUID(),
    title: elements.publishTitleInput?.value,
    description: elements.publishDescriptionInput?.value,
    permalink: elements.publishPermalinkInput?.value,
    includeNodeIds: selectedPublishNodeIds(),
    createdAt: selectedPublishBundle()?.createdAt,
  });
}

function selectedPublishNodeIds() {
  return Array.from(elements.publishNodeList?.querySelectorAll("input[type='checkbox']:checked") || [])
    .map((input) => input.value);
}

function savePublishBundle() {
  const bundle = publishBundleFromInputs();
  const bundles = state.data.publishBundles || [];
  const index = bundles.findIndex((item) => item.id === bundle.id);
  if (index >= 0) {
    bundles[index] = { ...bundles[index], ...bundle, updatedAt: new Date().toISOString() };
  } else {
    bundles.unshift(bundle);
  }
  state.data.publishBundles = bundles;
  state.selectedPublishBundleId = bundle.id;
  persist();
  renderPublishPanel();
  showNotice("공개 묶음을 저장했습니다.", "success");
}

function publishableTreeNodes() {
  return flattenTree(state.data.tree).filter((node) => !publishExclusionReason(node));
}

function publishExclusionReason(node) {
  if (node.shared === false) return "공유 안 함";
  if (isEncryptedContent(node.content)) return "암호화 메모";
  const properties = node.properties || {};
  if (truthyPublishFlag(properties.publicExclude) || truthyPublishFlag(properties.private) || truthyPublishFlag(properties.excludeFromPublish)) {
    return "공개 제외 속성";
  }
  const tags = Array.isArray(node.tags) ? node.tags.map((tag) => normalizeText(tag).toLowerCase()) : [];
  if (tags.some((tag) => ["private", "비공개", "no-publish"].includes(tag))) return "비공개 태그";
  return "";
}

function truthyPublishFlag(value) {
  return value === true || ["true", "yes", "1", "exclude", "private"].includes(normalizeText(value).toLowerCase());
}

function buildPublishBundleContent(bundle) {
  const includeIds = new Set(bundle.includeNodeIds?.length ? bundle.includeNodeIds : publishableTreeNodes().map((node) => node.id));
  const nodes = flattenTree(state.data.tree).filter((node) => includeIds.has(node.id) && !publishExclusionReason(node));
  return { bundle, nodes };
}

function scanPublishSensitiveContent(nodes) {
  const patterns = [
    [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, "이메일"],
    [/(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4}/, "전화번호 후보"],
    [/\b(password|passwd|token|api[_-]?key|secret)\b/i, "비밀번호/토큰 단어"],
    [/\b\d{6}[-\s]?[1-4]\d{6}\b/, "주민등록번호 후보"],
  ];
  return nodes.flatMap((node) => patterns
    .filter(([pattern]) => pattern.test(`${node.title}\n${node.content}`))
    .map(([, label]) => ({ node, label })));
}

function sensitiveWarningElements(warnings) {
  if (!warnings.length) {
    const empty = document.createElement("div");
    empty.className = "publish-sensitive-ok";
    empty.textContent = "민감정보 후보가 없습니다.";
    return [empty];
  }
  return warnings.slice(0, 12).map((warning) => {
    const item = document.createElement("div");
    item.className = "publish-sensitive-item";
    item.textContent = `${warning.label}: ${treePath(warning.node.id).join(" / ")}`;
    return item;
  });
}

function exportPublishHtml() {
  const content = buildPublishBundleContent(publishBundleFromInputs());
  if (!content.nodes.length) {
    showNotice("내보낼 공개 문서가 없습니다.", "error");
    return;
  }
  downloadText(`${content.bundle.permalink || "nownote-public"}.html`, buildPublicHtmlDocument(content), "text/html");
}

function exportPublishSlides() {
  const content = buildPublishBundleContent(publishBundleFromInputs());
  if (!content.nodes.length) {
    showNotice("내보낼 발표 문서가 없습니다.", "error");
    return;
  }
  downloadText(`${content.bundle.permalink || "nownote-slides"}-slides.html`, buildSlidesHtmlDocument(content), "text/html");
}

function buildPublicHtmlDocument({ bundle, nodes }) {
  const items = nodes.map((node) => [
    '<article class="note">',
    `<p class="path">${escapeHtml(treePath(node.id).join(" / "))}</p>`,
    `<h2>${escapeHtml(noteTitle(node.title))}</h2>`,
    markdownToHtml(node.content || ""),
    "</article>",
  ].join("\n")).join("\n");
  return htmlDocumentShell(bundle, `<main class="public-notes">${items}</main>`);
}

function buildSlidesHtmlDocument({ bundle, nodes }) {
  const slides = nodes.flatMap((node) => {
    const parts = String(node.content || "").split(/\n---+\n/).map((part) => part.trim()).filter(Boolean);
    const bodyParts = parts.length ? parts : [node.content || ""];
    return bodyParts.map((body, index) => [
      '<section class="slide">',
      `<p class="path">${escapeHtml(treePath(node.id).join(" / "))}</p>`,
      `<h2>${escapeHtml(index === 0 ? noteTitle(node.title) : `${noteTitle(node.title)} ${index + 1}`)}</h2>`,
      markdownToHtml(body),
      "</section>",
    ].join("\n"));
  }).join("\n");
  return htmlDocumentShell(bundle, `<main class="slides">${slides}</main>`);
}

function htmlDocumentShell(bundle, body) {
  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(bundle.title)}</title>`,
    `<meta name="description" content="${escapeHtml(bundle.description)}">`,
    "<style>",
    "body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f7faf8;color:#17211d;line-height:1.7}",
    "header{padding:48px 7vw 28px;border-bottom:1px solid #d7e2dc;background:#fff}",
    "main{max-width:920px;margin:0 auto;padding:28px 7vw 60px}",
    ".note,.slide{padding:28px 0;border-bottom:1px solid #d7e2dc}",
    ".slide{min-height:78vh;display:flex;flex-direction:column;justify-content:center}",
    ".path{color:#66756f;font-size:13px}",
    "pre{white-space:pre-wrap;background:#edf3f0;padding:14px;border-radius:8px;overflow:auto}",
    "code{background:#edf3f0;padding:2px 5px;border-radius:5px}",
    "blockquote{border-left:4px solid #89a99b;margin-left:0;padding-left:14px;color:#465b52}",
    "</style>",
    "</head>",
    "<body>",
    `<header><h1>${escapeHtml(bundle.title)}</h1>${bundle.description ? `<p>${escapeHtml(bundle.description)}</p>` : ""}</header>`,
    body,
    "</body>",
    "</html>",
  ].join("\n");
}

function slugifyPermalink(value) {
  return normalizeText(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "nownote-public";
}

function recordImportReport(source, imports) {
  const messages = imports.flatMap((item) => item.report?.messages || []);
  const report = {
    id: crypto.randomUUID(),
    source,
    createdAt: new Date().toISOString(),
    nodes: imports.reduce((count, item) => count + (item.nodes?.length || 0), 0),
    fixes: imports.reduce((count, item) => count + (item.report?.fixes || 0), 0),
    warnings: imports.reduce((count, item) => count + (item.report?.warnings || 0), 0),
    messages,
  };
  state.data.importReports = [report, ...(state.data.importReports || [])].slice(0, 20);
  return report;
}

function parseNowNoteMarkdownTree(content) {
  if (!isNowNoteMarkdownExport(content)) return [];
  const treeSection = nowNoteMarkdownSection(content, ["지식 메모", "Knowledge notes"]);
  if (!treeSection) return [];
  const blocks = splitNowNoteTreeBlocks(treeSection);
  if (blocks.length === 0) return [];
  const roots = [];
  const stack = [];
  blocks.forEach((block) => {
    const level = Math.min(3, Math.max(1, block.headingLevel - 1));
    const meta = readNowNoteMarkdownMeta(block.body);
    const node = createNode(block.title, meta.content, null, level);
    node.tags = meta.tags.length ? meta.tags : extractTags(meta.content);
    node.favorite = meta.favorite;
    const parent = stack[level - 2];
    if (level > 1 && parent) {
      node.parentId = parent.id;
      parent.children.push(node);
    } else {
      node.level = 1;
      roots.push(node);
    }
    stack[level - 1] = node;
    stack.length = level;
  });
  return roots;
}

function parseNowNoteMarkdownDaily(content) {
  if (!isNowNoteMarkdownExport(content)) return [];
  const section = nowNoteMarkdownSection(content, ["일자별 메모", "Daily notes"]);
  if (!section) return [];
  return splitNowNoteDateBlocks(section).map((block) => {
    const date = dateKeyFromMarkdownLabel(block.title);
    if (!date) return null;
    const noteContent = cleanNowNoteDateContent(block.body, false);
    if (!noteContent.trim()) return null;
    return {
      date,
      content: noteContent,
      status: "active",
      syncState: "pending",
      updatedAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

function parseNowNoteMarkdownArchivedDaily(content) {
  if (!isNowNoteMarkdownExport(content)) return [];
  const section = nowNoteMarkdownSection(content, ["보관된 일자별 메모", "Archived daily notes"]);
  if (!section) return [];
  return splitNowNoteDateBlocks(section).map((block) => {
    const date = dateKeyFromMarkdownLabel(block.title);
    if (!date) return null;
    const noteContent = cleanNowNoteDateContent(block.body, true);
    if (!noteContent.trim()) return null;
    return {
      id: crypto.randomUUID(),
      date,
      content: noteContent,
      status: "archived",
      syncState: "pending",
      archivedAt: new Date().toISOString(),
      restoredAt: null,
      updatedAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

function isNowNoteMarkdownExport(content) {
  return /^#\s+NowNote\s+(내보내기|Export)\s*$/im.test(content);
}

function nowNoteMarkdownSection(content, titles) {
  for (const title of titles) {
    const section = markdownSectionContent(content, title);
    if (section) return section;
  }
  return "";
}

function markdownSectionContent(content, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`));
  return match ? match[1] : "";
}

function splitNowNoteTreeBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let current = null;
  let inCodeBlock = false;
  lines.forEach((line) => {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
    }
    const heading = !inCodeBlock ? line.match(/^(#{2,4})\s+\[(주제|분류|메모|Topic|Category|Note)\]\s+(.+)\s*$/i) : null;
    if (heading) {
      if (current) blocks.push(current);
      current = {
        headingLevel: heading[1].length,
        title: normalizeText(heading[3]).slice(0, 80) || defaultTitleForLevel(Math.min(3, heading[1].length - 1)),
        body: [],
      };
      return;
    }
    if (current) {
      current.body.push(line);
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function splitNowNoteDateBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let current = null;
  let inCodeBlock = false;
  lines.forEach((line) => {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
    }
    const heading = !inCodeBlock ? line.match(/^###\s+(.+)\s*$/) : null;
    if (heading) {
      if (current) blocks.push(current);
      current = {
        title: normalizeText(heading[1]),
        body: [],
      };
      return;
    }
    if (current) {
      current.body.push(line);
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function cleanNowNoteDateContent(lines, hasArchiveMeta) {
  let readingContent = false;
  const content = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!readingContent && trimmed === "") return;
    if (hasArchiveMeta && !readingContent && /^-\s+((보관|복원)\s*시각|Archived at|Restored at):\s*/i.test(trimmed)) return;
    readingContent = true;
    content.push(line);
  });
  return content.join("\n").trim();
}

function dateKeyFromMarkdownLabel(label) {
  const value = String(label || "");
  const isoMatch = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch && isDateKey(isoMatch[1])) return isoMatch[1];
  const koreanMatch = value.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanMatch) {
    const dateKey = `${koreanMatch[1]}-${koreanMatch[2].padStart(2, "0")}-${koreanMatch[3].padStart(2, "0")}`;
    return isDateKey(dateKey) ? dateKey : "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const dateKey = toDateKey(parsed);
  return isDateKey(dateKey) ? dateKey : "";
}

function mergeImportedDailyNote(note) {
  const current = state.data.daily[note.date];
  if (current?.content?.trim()) {
    state.data.daily[note.date] = mergeDailyNote(current, note);
    state.data.daily[note.date].syncState = "pending";
    state.data.daily[note.date].updatedAt = new Date().toISOString();
  } else {
    state.data.daily[note.date] = note;
  }
}

function readNowNoteMarkdownMeta(lines) {
  const tags = [];
  let favorite = false;
  const content = [];
  let readingContent = false;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!readingContent && trimmed === "") return;
    if (!readingContent && /^(경로|Path):\s*/i.test(trimmed)) return;
    if (!readingContent && /^(수정|Updated):\s*/i.test(trimmed)) return;
    if (!readingContent && /^(태그|Tags):\s*/i.test(trimmed)) {
      trimmed.match(/#[0-9A-Za-z가-힣_-]+/g)?.forEach((tag) => tags.push(tag.slice(1)));
      return;
    }
    if (!readingContent && /^(즐겨찾기:\s*예|Favorite:\s*Yes)/i.test(trimmed)) {
      favorite = true;
      return;
    }
    readingContent = true;
    content.push(line);
  });
  const text = content.join("\n").trim();
  return {
    content: ["_내용 없음_", "_No content_"].includes(text) ? "" : text,
    tags: [...new Set(tags)],
    favorite,
  };
}

function titleFromMarkdownFile(fileName, content) {
  const heading = content.split("\n").find((line) => /^#\s+/.test(line.trim()));
  const title = heading ? heading.replace(/^#\s+/, "").trim() : fileName.replace(/\.(md|markdown|txt)$/i, "").trim();
  return normalizeText(title).slice(0, 80) || t("note.fallbackMarkDownTitle");
}

function backupDataShape(data, options = {}) {
  const shape = {
    daily: data.daily,
    archivedDaily: data.archivedDaily,
    deletedTree: data.deletedTree,
    canvases: data.canvases,
    captures: data.captures,
    publishBundles: data.publishBundles,
    tree: data.tree,
  };
  if (options.includeRecoveryMeta !== false) {
    shape.snapshots = data.snapshots;
    shape.importReports = data.importReports;
  }
  return shape;
}

function parseBackupData(parsed) {
  const data = parsed?.data && isBackupData(parsed.data) ? parsed.data : parsed;
  if (!isBackupData(data)) {
    return { data: null, settings: null };
  }
  return {
    data,
    settings: parsed?.settings || null,
    exportedAt: parsed?.exportedAt || null,
  };
}

function isBackupData(data) {
  return Boolean(isPlainObject(data) && (
    isPlainObject(data.daily)
    || Array.isArray(data.tree)
    || Array.isArray(data.archivedDaily)
    || Array.isArray(data.deletedTree)
    || Array.isArray(data.canvases)
    || Array.isArray(data.captures)
    || Array.isArray(data.snapshots)
    || Array.isArray(data.importReports)
    || Array.isArray(data.publishBundles)
  ));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function backupSummary(data) {
  const archivedDaily = Array.isArray(data.archivedDaily) ? data.archivedDaily : [];
  return {
    daily: isPlainObject(data.daily) ? Object.keys(data.daily).length : 0,
    archivedDaily: archivedDaily.length,
    restoredArchivedDaily: archivedDaily.filter((note) => note?.restoredAt).length,
    tree: Array.isArray(data.tree) ? flattenTree(data.tree).length : 0,
    deletedTree: Array.isArray(data.deletedTree) ? data.deletedTree.length : 0,
  };
}

function formatBackupTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("note.unknownDate");
  const locale = currentLocale();
  return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
}

function downloadCurrentBackup(prefix = "nownote") {
  const backup = {
    app: "NowNote Web",
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state.data,
    settings: state.settings,
  };
  downloadText(`${prefix}-${fileTimestamp(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
}

function showSaved(label) {
  label.textContent = t("saved");
  label.animate(
    [
      { opacity: 0.35 },
      { opacity: 1 },
    ],
    { duration: 280 },
  );
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fileTimestamp(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${toDateKey(date)}-${hours}${minutes}${seconds}`;
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

function currentLocale() {
  return currentLanguageMeta().locale;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "long",
  }).format(date);
}

function longDateLabel(key) {
  const date = new Date(`${key}T00:00:00`);
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function timeLabel(date) {
  return new Intl.DateTimeFormat(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatArchivedAt(value) {
  if (!value) return t("note.dateMissing");
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parseServerDate(value));
}

function formatDateTime(value) {
  if (!value) return t("note.dateMissing");
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseServerDate(value));
}

function relativeTime(value) {
  if (!value) return t("note.dateMissing");
  const date = parseServerDate(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return t("note.dateMissing");
  const diffMs = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return t("relative.now");
  if (diffMs < hour) return t("relative.minutes", { count: Math.floor(diffMs / minute) });
  if (diffMs < day) return t("relative.hours", { count: Math.floor(diffMs / hour) });
  if (diffMs < day * 7) return t("relative.days", { count: Math.floor(diffMs / day) });
  return new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    day: "numeric",
  }).format(date);
}

function parseServerDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
    return new Date(`${text}Z`);
  }
  return new Date(value);
}

function snippet(text, query = "") {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return t("note.emptyContent");
  const term = String(query || "").trim().toLowerCase();
  if (term) {
    const index = normalized.toLowerCase().indexOf(term);
    if (index >= 0) {
      const start = Math.max(0, index - 45);
      const end = Math.min(normalized.length, index + term.length + 75);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < normalized.length ? "..." : "";
      return `${prefix}${normalized.slice(start, end)}${suffix}`;
    }
  }
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}

function extractTags(text) {
  return Array.from(stripMarkdownCode(text).matchAll(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g), (match) => match[2])
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function tagSummary() {
  const counts = new Map();
  flattenTree(state.data.tree).forEach((node) => {
    node.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

function searchableTreeText(node) {
  return `${node.title} ${node.content} ${treePath(node.id).join(" ")} ${node.tags.join(" ")}`.toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");
}

function highlightSearchText(value, query) {
  const text = String(value || "");
  const term = String(query || "").trim();
  if (!term) return escapeHtml(text);
  const pattern = new RegExp(escapeRegExp(term), "gi");
  let lastIndex = 0;
  let highlighted = "";
  text.replace(pattern, (match, offset) => {
    highlighted += escapeHtml(text.slice(lastIndex, offset));
    highlighted += `<mark class="search-hit">${escapeHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });
  if (!highlighted) return escapeHtml(text);
  return highlighted + escapeHtml(text.slice(lastIndex));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
