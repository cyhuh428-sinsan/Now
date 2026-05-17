const STORAGE_KEY = "nownote.web.v1";
const SETTINGS_KEY = "nownote.web.settings.v1";

const ACCENTS = [
  { id: "blue", labelKey: "accent.blue", label: "파랑", value: "#2563eb" },
  { id: "purple", labelKey: "accent.purple", label: "보라", value: "#8b5cf6" },
  { id: "green", labelKey: "accent.green", label: "초록", value: "#14b8a6" },
  { id: "orange", labelKey: "accent.orange", label: "주황", value: "#f97316" },
];

const I18N = {
  ko: {
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
    "app.title": "NowNote Web",
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
    "editor.copyLink": "링크 복사",
    "editor.find": "본문 찾기",
    "editor.findPlaceholder": "본문에서 검색",
    "editor.findTitle": "Enter 다음, Shift+Enter 이전",
    "editor.outline": "개요",
    "editor.insertTime": "시간 넣기",
    "editor.preview": "Markdown 보기",
    "editor.edit": "편집하기",
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
    "settings.server.title": "서버 연결",
    "settings.server.desc": "단독 사용 또는 개인/공용 NowNote 서버 연결 방식을 선택합니다.",
    "settings.server.mode.local": "단독 사용",
    "settings.server.mode.server": "서버 연결",
    "settings.server.mode": "사용 방식",
    "settings.server.url": "서버 주소",
    "settings.server.token": "API 토큰",
    "settings.server.owner": "사용자 ID",
    "settings.server.device": "기기 ID",
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
    "settings.server.fullSyncing": "서버와 전체 동기화를 진행합니다.",
    "settings.server.ok": "서버 연결 확인됨",
    "settings.server.noUrl": "서버 주소를 입력해야 합니다.",
    "settings.server.fail": "서버 연결 실패",
    "settings.server.syncing": "서버로 메모를 동기화하는 중입니다.",
    "settings.server.syncOk": "서버 동기화 완료",
    "settings.server.syncEmpty": "동기화할 메모가 없습니다.",
    "settings.server.mergeSkipped": "로컬 변경 보존",
    "settings.server.mergeSkippedCount": "로컬 변경 보존 {count}개",
    "settings.server.pending": "보류 변경",
    "settings.server.lastSync": "마지막 동기화",
    "settings.server.pendingMeta": "보류 변경 {count}개 · 마지막 동기화 {time}",
    "settings.server.capabilities.none": "서버 기능 확인 전",
    "settings.server.capabilities.sync": "동기화",
    "settings.server.capabilities.recordings": "녹음",
    "settings.server.capabilities.analysis": "분석 작업",
    "settings.server.capabilities.admin": "운영 점검",
    "settings.server.capabilities.users": "사용자 관리",
    "settings.server.capabilities.treeLevel": "계층 {level}단계",
    "settings.server.analysis.title": "분석 작업",
    "settings.server.analysis.desc": "선택한 지식 메모를 서버 분석 큐에 등록하고 최근 상태를 확인합니다.",
    "settings.server.analysis.create": "선택 메모 분석",
    "settings.server.analysis.refresh": "작업 새로고침",
    "settings.server.analysis.none": "분석 작업을 불러오지 않았습니다.",
    "settings.server.analysis.noNote": "분석할 지식 메모를 먼저 선택해야 합니다.",
    "settings.server.analysis.emptyNote": "선택한 메모에 분석할 내용이 없습니다.",
    "settings.server.analysis.creating": "분석 작업을 서버에 등록하는 중입니다.",
    "settings.server.analysis.created": "분석 작업을 등록했습니다.",
    "settings.server.analysis.loading": "분석 작업을 불러오는 중입니다.",
    "settings.server.analysis.loaded": "분석 작업을 불러왔습니다.",
    "settings.server.analysis.item": "#{id} · {type} · {time}",
    "settings.server.analysis.resultPreview": "결과: {text}",
    "settings.server.analysis.inputPreview": "입력: {text}",
    "settings.server.analysis.errorPreview": "오류: {text}",
    "settings.server.analysis.doneNoResult": "완료됐지만 표시할 결과가 없습니다.",
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
    "app.title": "NowNote Web",
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
    "editor.copyLink": "Copy link",
    "editor.find": "Find in note",
    "editor.findPlaceholder": "Find in content",
    "editor.findTitle": "Enter next, Shift+Enter previous",
    "editor.outline": "Outline",
    "editor.insertTime": "Insert time",
    "editor.preview": "Markdown preview",
    "editor.edit": "Edit",
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
    "settings.features.title": "Knowledge features",
    "settings.features.desc": "Hide unused features from the screen and stop their actions.",
    "settings.server.title": "Server connection",
    "settings.server.desc": "Choose standalone use or connect to a personal/public NowNote server.",
    "settings.server.mode.local": "Standalone",
    "settings.server.mode.server": "Server connection",
    "settings.server.mode": "Mode",
    "settings.server.url": "Server URL",
    "settings.server.token": "API token",
    "settings.server.owner": "User ID",
    "settings.server.device": "Device ID",
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
    "settings.server.fullSyncing": "Forcing full sync with server.",
    "settings.server.ok": "Server connection verified",
    "settings.server.noUrl": "Enter a server URL first.",
    "settings.server.fail": "Server connection failed",
    "settings.server.syncing": "Syncing notes to the server.",
    "settings.server.syncOk": "Server sync complete",
    "settings.server.syncEmpty": "There are no notes to sync.",
    "settings.server.mergeSkipped": "Local changes kept",
    "settings.server.mergeSkippedCount": "Local changes kept {count}",
    "settings.server.pending": "Pending changes",
    "settings.server.lastSync": "Last sync",
    "settings.server.pendingMeta": "Pending changes {count} · Last sync {time}",
    "settings.server.capabilities.none": "Server features not checked",
    "settings.server.capabilities.sync": "Sync",
    "settings.server.capabilities.recordings": "Recordings",
    "settings.server.capabilities.analysis": "Analysis jobs",
    "settings.server.capabilities.admin": "Ops checks",
    "settings.server.capabilities.users": "User management",
    "settings.server.capabilities.treeLevel": "{level}-level tree",
    "settings.server.analysis.title": "Analysis jobs",
    "settings.server.analysis.desc": "Queue the selected knowledge note for server analysis and check recent status.",
    "settings.server.analysis.create": "Analyze selected note",
    "settings.server.analysis.refresh": "Refresh jobs",
    "settings.server.analysis.none": "Analysis jobs have not been loaded.",
    "settings.server.analysis.noNote": "Select a knowledge note to analyze first.",
    "settings.server.analysis.emptyNote": "The selected note has no content to analyze.",
    "settings.server.analysis.creating": "Creating an analysis job on the server.",
    "settings.server.analysis.created": "Analysis job created.",
    "settings.server.analysis.loading": "Loading analysis jobs.",
    "settings.server.analysis.loaded": "Analysis jobs loaded.",
    "settings.server.analysis.item": "#{id} · {type} · {time}",
    "settings.server.analysis.resultPreview": "Result: {text}",
    "settings.server.analysis.inputPreview": "Input: {text}",
    "settings.server.analysis.errorPreview": "Error: {text}",
    "settings.server.analysis.doneNoResult": "Done, but no displayable result.",
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

const SHORTCUT_ACTIONS = [
  { id: "addRoot", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.addRoot", label: "새 주제", defaultShortcut: { ctrl: true, key: "n" }, group: "창과 탭" },
  { id: "addChild", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.addChild", label: "아래에 추가", defaultShortcut: { ctrl: true, shift: true, key: "n" }, group: "창과 탭" },
  { id: "search", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.search", label: "검색", defaultShortcut: { ctrl: true, key: "f" }, group: "창과 탭" },
  { id: "noteFind", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.noteFind", label: "본문 찾기", defaultShortcut: { ctrl: true, shift: true, key: "f" }, group: "창과 탭" },
  { id: "quickSwitch", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.quickSwitch", label: "빠른 전환", defaultShortcut: { ctrl: true, key: "k" }, group: "창과 탭" },
  { id: "quickOpen", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.quickOpen", label: "빠른 전환 보조", defaultShortcut: { ctrl: true, key: "o" }, group: "창과 탭" },
  { id: "daily", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.daily", label: "일자별 메모", defaultShortcut: { ctrl: true, key: "d" }, group: "창과 탭" },
  { id: "graph", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.graph", label: "연결 보기", defaultShortcut: { ctrl: true, key: "g" }, group: "창과 탭" },
  { id: "saveState", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.saveState", label: "저장 상태 확인", defaultShortcut: { ctrl: true, key: "s" }, group: "창과 탭" },
  { id: "insertTime", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.insertTime", label: "현재 시간 삽입", defaultShortcut: { ctrl: true, key: ";" }, group: "창과 탭" },
  { id: "closeTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.closeTab", label: "현재 탭 닫기", defaultShortcut: { ctrl: true, key: "w" }, group: "창과 탭" },
  { id: "reopenTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.reopenTab", label: "닫은 탭 다시 열기", defaultShortcut: { ctrl: true, shift: true, key: "t" }, group: "창과 탭" },
  { id: "closeOtherTabs", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.closeOtherTabs", label: "다른 탭 닫기", defaultShortcut: { ctrl: true, shift: true, key: "w" }, group: "창과 탭" },
  { id: "pinTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.pinTab", label: "현재 탭 고정", defaultShortcut: { ctrl: true, shift: true, key: "p" }, group: "창과 탭" },
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
  expandedTreeIds: new Set(),
  selectedDeletedTreeIds: new Set(),
  capturingShortcutId: null,
  search: "",
  data: {
    daily: {},
    archivedDaily: [],
    deletedTree: [],
    tree: [],
  },
  settings: defaultSettings(),
};

let storageWarningShown = false;

function defaultSettings() {
  return {
    language: "ko",
    theme: "system",
    accent: "blue",
    wideEditor: true,
    treeListWidth: 280,
    sidebarCollapsed: false,
    railMode: "icon",
    fontSize: "medium",
    lineHeight: "normal",
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
  };
}

function defaultServerSettings() {
  return {
    mode: "local",
    url: "",
    token: "",
    ownerId: "local_user",
    deviceId: "web-desktop",
    userProfile: defaultServerUserProfile(),
    capabilities: null,
    analysisJobs: [],
    lastCheckedAt: null,
    lastSyncedAt: null,
    lastStatus: "idle",
    lastMessage: "",
  };
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
  const lang = state.settings.language || "ko";
  const value = I18N[lang]?.[key] || I18N.ko[key];
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
    const resolved = vars[token];
    return resolved === undefined ? `{${token}}` : String(resolved);
  });
}

function noteTitle(value) {
  return value ? String(value) : t("note.untitled");
}

function setText(selector, value) {
  const element = typeof selector === "string" ? $(selector) : selector;
  if (element) element.textContent = value;
}

function setPlaceholder(element, value) {
  if (element) element.placeholder = value;
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
  treeLevelLabel: $("#treeLevelLabel"),
  treeSavedLabel: $("#treeSavedLabel"),
  favoriteBtn: $("#favoriteBtn"),
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
  quickSwitchBtn: $("#quickSwitchBtn"),
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
  fontSizeSelect: $("#fontSizeSelect"),
  lineHeightSelect: $("#lineHeightSelect"),
  backlinksToggle: $("#backlinksToggle"),
  tagsToggle: $("#tagsToggle"),
  shortcutsToggle: $("#shortcutsToggle"),
  shortcutEditor: $("#shortcutEditor"),
  featureSettings: $("#featureSettings"),
  serverModeSelect: $("#serverModeSelect"),
  serverUrlInput: $("#serverUrlInput"),
  serverTokenInput: $("#serverTokenInput"),
  ownerIdInput: $("#ownerIdInput"),
  deviceIdInput: $("#deviceIdInput"),
  serverDisplayNameInput: $("#serverDisplayNameInput"),
  serverEmailInput: $("#serverEmailInput"),
  serverTimezoneInput: $("#serverTimezoneInput"),
  serverProfileLoadBtn: $("#serverProfileLoadBtn"),
  serverProfileSaveBtn: $("#serverProfileSaveBtn"),
  serverProfileText: $("#serverProfileText"),
  serverAnalysisCreateBtn: $("#serverAnalysisCreateBtn"),
  serverAnalysisRefreshBtn: $("#serverAnalysisRefreshBtn"),
  serverAnalysisList: $("#serverAnalysisList"),
  serverSaveBtn: $("#serverSaveBtn"),
  serverTestBtn: $("#serverTestBtn"),
  serverSyncBtn: $("#serverSyncBtn"),
  serverFullSyncBtn: $("#serverFullSyncBtn"),
  serverStatusText: $("#serverStatusText"),
  serverMetaText: $("#serverMetaText"),
  serverCapabilitiesText: $("#serverCapabilitiesText"),
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
  graphList: $("#graphList"),
  graphCloseBtn: $("#graphCloseBtn"),
};

load();
loadSettings();
applyLanguageQueryOverride();
bindEvents();
renderSettings();
applySettings();
render();

function bindEvents() {
  elements.navTabs.forEach((button) => {
    button.addEventListener("click", () => {
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

  elements.graphBtn.addEventListener("click", () => {
    toggleGraph();
  });

  elements.exportMarkdownBtn.addEventListener("click", exportMarkdown);

  elements.importMarkdownBtn.addEventListener("click", () => {
    elements.importMarkdownInput.click();
  });

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
  });

  elements.serverTestBtn.addEventListener("click", testServerConnection);

  elements.serverSyncBtn.addEventListener("click", syncWebNotesToServer);
  elements.serverFullSyncBtn.addEventListener("click", syncAllWebNotesToServer);
  elements.serverProfileLoadBtn.addEventListener("click", loadServerUserProfile);
  elements.serverProfileSaveBtn.addEventListener("click", saveServerUserProfile);
  elements.serverAnalysisCreateBtn.addEventListener("click", createSelectedNoteAnalysisJob);
  elements.serverAnalysisRefreshBtn.addEventListener("click", refreshServerAnalysisJobs);

  elements.sidebarAssistToggle.addEventListener("change", () => {
    state.settings.showSidebarAssist = elements.sidebarAssistToggle.checked;
    persistSettings();
    applySettings();
  });

  elements.resetSettingsBtn.addEventListener("click", resetViewSettings);

  elements.addRootBtn.addEventListener("click", () => {
    addRootNote();
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
    syncTreeContentFromEditor();
  });
  elements.treeContent.addEventListener("keydown", handleTreeContentShortcut);

  elements.favoriteBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.favorite = !selected.favorite;
    markTreeNodeChanged(selected);
    persist();
    renderTree();
  });

  elements.copyLinkBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    copyNoteLink(selected);
  });

  elements.noteFindToggleBtn.addEventListener("click", toggleNoteFind);
  elements.noteFindInput.addEventListener("input", () => selectNoteFindMatch(0));
  elements.noteFindInput.addEventListener("keydown", handleNoteFindInputKey);
  elements.noteFindPrevBtn.addEventListener("click", () => moveNoteFindMatch(-1));
  elements.noteFindNextBtn.addEventListener("click", () => moveNoteFindMatch(1));
  elements.noteFindCloseBtn.addEventListener("click", closeNoteFind);
  elements.outlineToggleBtn.addEventListener("click", toggleOutlinePanel);
  elements.insertTimeBtn.addEventListener("click", insertCurrentTimeIntoTreeNote);
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
      renderMarkdownPreview(selected.content);
    } else {
      elements.treeContent.focus();
    }
  });

  elements.addChildBtn.addEventListener("click", addChildToSelectedTreeNode);

  elements.deleteTreeBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (selected.children.length > 0) {
      alert(t("note.nodeDelete.childrenBlocked"));
      return;
    }
    if (!confirm(t("note.nodeDelete.toTrashConfirm", { title: noteTitle(selected.title) }))) return;
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
  elements.searchPopoverInput.addEventListener("input", renderSearchPopoverResults);
  elements.searchPopoverInput.addEventListener("keydown", handleSearchPopoverInputKey);
  elements.searchScopeSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchSortSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchPopoverCloseBtn.addEventListener("click", closeSearchPopover);
  elements.quickInput.addEventListener("input", renderQuickResults);
  elements.quickInput.addEventListener("keydown", handleQuickInputKey);
  elements.quickCloseBtn.addEventListener("click", closeQuickSwitch);
  elements.graphCloseBtn.addEventListener("click", closeGraph);
  bindOverlayDismiss(elements.quickSwitchView, closeQuickSwitch);
  bindOverlayDismiss(elements.searchPopoverView, closeSearchPopover);
  bindOverlayDismiss(elements.graphView, closeGraph);
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

function renderSettings() {
  elements.languageSelect.value = state.settings.language;
  elements.themeSelect.value = state.settings.theme;
  elements.wideEditorToggle.checked = state.settings.wideEditor;
  elements.railModeSelect.value = state.settings.railMode;
  elements.fontSizeSelect.value = state.settings.fontSize;
  elements.lineHeightSelect.value = state.settings.lineHeight;
  elements.backlinksToggle.checked = state.settings.showBacklinks;
  elements.tagsToggle.checked = state.settings.showTags;
  elements.shortcutsToggle.checked = state.settings.enableShortcuts;
  elements.sidebarAssistToggle.checked = state.settings.showSidebarAssist;
  renderServerSettings();
  renderShortcutEditor();
  renderFeatureSettings();
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

function resetViewSettings() {
  if (!confirm(t("settings.resetConfirm"))) {
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
  elements.ownerIdInput.value = server.ownerId;
  elements.deviceIdInput.value = server.deviceId;
  const profile = normalizeServerUserProfile(server.userProfile);
  elements.serverDisplayNameInput.value = profile.displayName;
  elements.serverEmailInput.value = profile.email;
  elements.serverTimezoneInput.value = profile.timezone;
  const isServerMode = server.mode === "server";
  elements.serverTestBtn.disabled = !isServerMode;
  elements.serverSyncBtn.disabled = !isServerMode;
  elements.serverFullSyncBtn.disabled = !isServerMode;
  elements.serverProfileLoadBtn.disabled = !isServerMode;
  elements.serverProfileSaveBtn.disabled = !isServerMode;
  elements.serverAnalysisCreateBtn.disabled = !isServerMode;
  elements.serverAnalysisRefreshBtn.disabled = !isServerMode;
  renderServerStatus(server.lastStatus, server.lastMessage);
  renderServerMeta();
  renderServerCapabilities(server.capabilities);
  renderServerAnalysisJobs(server.analysisJobs);
  renderServerProfileMeta(profile);
}

function saveServerSettingsFromForm(message = t("settings.server.saved")) {
  const previous = state.settings.server || defaultServerSettings();
  const nextUrl = normalizeServerUrl(elements.serverUrlInput.value);
  const nextToken = elements.serverTokenInput.value.trim();
  const nextMode = elements.serverModeSelect.value === "server" ? "server" : "local";
  const connectionChanged = previous.mode !== nextMode || previous.url !== nextUrl || previous.token !== nextToken;
  state.settings.server = {
    ...previous,
    mode: nextMode,
    url: nextUrl,
    token: nextToken,
    ownerId: normalizeOwnerId(elements.ownerIdInput.value),
    deviceId: elements.deviceIdInput.value.trim() || "web-desktop",
    userProfile: {
      ...normalizeServerUserProfile(previous.userProfile),
      displayName: elements.serverDisplayNameInput.value.trim(),
      email: elements.serverEmailInput.value.trim(),
      timezone: elements.serverTimezoneInput.value.trim() || "Asia/Seoul",
    },
    capabilities: connectionChanged ? null : previous.capabilities,
    lastStatus: "saved",
    lastMessage: message,
  };
  persistSettings();
  renderServerSettings();
}

function syncAllWebNotesToServer() {
  if (!confirm(t("settings.server.fullSyncConfirm"))) {
    return;
  }
  const server = state.settings.server || defaultServerSettings();
  server.lastSyncedAt = null;
  persistSettings();
  renderServerSettings();
  syncWebNotesToServer(t("settings.server.fullSyncing"));
}

function renderServerStatus(status, message) {
  const server = state.settings.server || defaultServerSettings();
  const fallback = server.mode === "server" ? t("settings.server.saved") : t("settings.server.local");
  const text = message || fallback;
  elements.serverStatusText.textContent = text;
  elements.serverStatusText.classList.remove("ok", "warn", "bad");
  if (status === "ok") elements.serverStatusText.classList.add("ok");
  if (status === "saved" || status === "testing") elements.serverStatusText.classList.add("warn");
  if (status === "bad") elements.serverStatusText.classList.add("bad");
}

function renderServerMeta() {
  const server = state.settings.server || defaultServerSettings();
  const pendingCount = countPendingSyncNotes();
  const lastSyncedAt = server.lastSyncedAt
    ? new Date(server.lastSyncedAt).toLocaleString(document.documentElement.lang === "en" ? "en-US" : "ko-KR")
    : t("settings.server.never");
  elements.serverMetaText.textContent = t("settings.server.pendingMeta", { count: pendingCount, time: lastSyncedAt });
  elements.serverMetaText.classList.toggle("has-pending", pendingCount > 0);
}

function renderServerCapabilities(capabilities) {
  if (!elements.serverCapabilitiesText) return;
  const chips = serverCapabilityLabels(capabilities).map((label) => {
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

function serverCapabilityLabels(capabilities) {
  if (!capabilities || typeof capabilities !== "object") return [];
  const labels = [];
  if (capabilities.sync) labels.push(t("settings.server.capabilities.sync"));
  if (capabilities.recordings) labels.push(t("settings.server.capabilities.recordings"));
  if (capabilities.analysis_jobs) labels.push(t("settings.server.capabilities.analysis"));
  if (capabilities.admin_ops) labels.push(t("settings.server.capabilities.admin"));
  if (capabilities.user_accounts || capabilities.user_profile) labels.push(t("settings.server.capabilities.users"));
  if (capabilities.max_tree_note_level) {
    labels.push(t("settings.server.capabilities.treeLevel", { level: capabilities.max_tree_note_level }));
  }
  return labels;
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
    ? new Date(profile.lastSeenAt).toLocaleString(document.documentElement.lang === "en" ? "en-US" : "ko-KR")
    : t("settings.server.profile.lastSeenNone");
  elements.serverProfileText.textContent = t("settings.server.profile.summary", {
    group: profile.groupName || "-",
    twoFactor,
    active,
    lastSeen,
  });
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
        type: job.job_type || "-",
        time: formatServerJobTime(time),
      });
      const note = document.createElement("span");
      note.textContent = job.note_local_id || "-";
      info.append(title, note);
      const status = document.createElement("span");
      status.className = `server-analysis-status ${job.status || ""}`;
      status.textContent = job.status || "-";
      item.append(info, status);
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
    if (parsed && Array.isArray(parsed.keywords) && parsed.keywords.length) {
      return parsed.keywords.filter(Boolean).join(", ");
    }
    if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
  } catch (_) {
    return String(resultJson);
  }
  return "";
}

function compactText(value, maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatServerJobTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(document.documentElement.lang === "en" ? "en-US" : "ko-KR");
}

function countPendingSyncNotes() {
  return [
    ...Object.values(state.data.daily),
    ...state.data.archivedDaily,
    ...flattenTree(state.data.tree),
    ...state.data.deletedTree,
  ].filter((item) => item?.syncState === "pending").length;
}

async function testServerConnection() {
  saveServerSettingsFromForm(t("settings.server.testing"));
  const server = state.settings.server;
  if (server.mode !== "server") {
    server.lastStatus = "idle";
    server.lastMessage = t("settings.server.local");
    persistSettings();
    renderServerSettings();
    return;
  }
  if (!server.url) {
    server.lastStatus = "bad";
    server.lastMessage = t("settings.server.noUrl");
    persistSettings();
    renderServerSettings();
    return;
  }

  renderServerStatus("testing", t("settings.server.testing"));
  try {
    const response = await fetch(`${server.url}/api/v1/server`, {
      headers: server.token ? { Authorization: `Bearer ${server.token}` } : {},
    });
    if (!response.ok) throw new Error(await serverResponseError(response));
    const payload = await response.json();
    const serverName = payload.server || "NowNote";
    const apiVersion = payload.api_version ? ` · API ${payload.api_version}` : "";
    server.lastStatus = "ok";
    server.lastCheckedAt = new Date().toISOString();
    server.capabilities = payload.capabilities || null;
    server.lastMessage = `${t("settings.server.ok")}: ${serverName}${apiVersion}`;
  } catch (error) {
    server.lastStatus = "bad";
    server.lastCheckedAt = new Date().toISOString();
    server.capabilities = null;
    server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
  }
  persistSettings();
  renderServerSettings();
}

async function loadServerUserProfile() {
  saveServerSettingsFromForm(t("settings.server.profile.loading"));
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  renderServerStatus("testing", t("settings.server.profile.loading"));
  try {
    const payload = await requestServerJson(
      server,
      `/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    applyServerUserProfile(payload.user);
    server.lastStatus = "ok";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = t("settings.server.profile.loaded");
  } catch (error) {
    server.lastStatus = "bad";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
  }
  persistSettings();
  renderServerSettings();
}

async function saveServerUserProfile() {
  saveServerSettingsFromForm(t("settings.server.profile.saving"));
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
    server.lastStatus = "ok";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = t("settings.server.profile.saved");
  } catch (error) {
    if (!String(error.message).includes("404")) {
      server.lastStatus = "bad";
      server.lastCheckedAt = new Date().toISOString();
      server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
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
      server.lastStatus = "ok";
      server.lastCheckedAt = new Date().toISOString();
      server.lastMessage = t("settings.server.profile.saved");
    } catch (retryError) {
      server.lastStatus = "bad";
      server.lastCheckedAt = new Date().toISOString();
      server.lastMessage = `${t("settings.server.fail")}: ${retryError.message}`;
    }
  }
  persistSettings();
  renderServerSettings();
}

async function createSelectedNoteAnalysisJob() {
  saveServerSettingsFromForm(t("settings.server.analysis.creating"));
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  const selected = getSelectedTreeNode();
  if (!selected) {
    server.lastStatus = "bad";
    server.lastMessage = t("settings.server.analysis.noNote");
    persistSettings();
    renderServerSettings();
    return;
  }
  const inputText = `${selected.title || ""}\n\n${selected.content || ""}`.trim();
  if (!inputText) {
    server.lastStatus = "bad";
    server.lastMessage = t("settings.server.analysis.emptyNote");
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
        job_type: "memo_summary",
        note_local_id: selected.id,
        input_text: inputText,
      }),
    });
    server.analysisJobs = [job, ...(server.analysisJobs || [])].slice(0, 5);
    server.lastStatus = "ok";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = t("settings.server.analysis.created");
  } catch (error) {
    server.lastStatus = "bad";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
  }
  persistSettings();
  renderServerSettings();
}

async function refreshServerAnalysisJobs() {
  saveServerSettingsFromForm(t("settings.server.analysis.loading"));
  const server = state.settings.server;
  if (!prepareServerRequest(server)) return;

  renderServerStatus("testing", t("settings.server.analysis.loading"));
  try {
    const jobs = await requestServerJson(
      server,
      `/api/v1/analysis/jobs?owner_id=${encodeURIComponent(normalizeOwnerId(server.ownerId))}`,
    );
    server.analysisJobs = Array.isArray(jobs) ? jobs.slice(0, 5) : [];
    server.lastStatus = "ok";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = t("settings.server.analysis.loaded");
  } catch (error) {
    server.lastStatus = "bad";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
  }
  persistSettings();
  renderServerSettings();
}

async function syncWebNotesToServer(message = t("settings.server.syncing")) {
  saveServerSettingsFromForm(message);
  const server = state.settings.server;
  if (server.mode !== "server") {
    server.lastStatus = "idle";
    server.lastMessage = t("settings.server.local");
    persistSettings();
    renderServerSettings();
    return;
  }
  if (!server.url) {
    server.lastStatus = "bad";
    server.lastMessage = t("settings.server.noUrl");
    persistSettings();
    renderServerSettings();
    return;
  }

  const notes = buildServerSyncNotes(server);
  renderServerStatus("testing", message);
  try {
    const response = await fetch(`${server.url}/api/v1/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}),
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
      const mergeResult = applyPulledServerNotes(payload.pulled_notes || []);
      const pushedCount = payload.pushed_notes?.length || 0;
      const pulledCount = (payload.pulled_notes || []).length;
      markServerSyncedNotes();
      server.lastStatus = "ok";
      server.lastCheckedAt = new Date().toISOString();
      server.lastSyncedAt = payload.server_time || server.lastCheckedAt;
      if (notes.length === 0 && pushedCount === 0 && pulledCount === 0 && mergeResult.applied === 0) {
        server.lastMessage = t("settings.server.syncEmpty");
      } else {
        const syncSummary = t("note.syncMessage", { sent: pushedCount, received: mergeResult.applied });
        server.lastMessage = `${t("settings.server.syncOk")}: ${syncSummary}${mergeResult.skipped ? `, ${t("settings.server.mergeSkippedCount", { count: mergeResult.skipped })}` : ""}`;
      }
      persist();
      render();
      renderServerMeta();
  } catch (error) {
    server.lastStatus = "bad";
    server.lastCheckedAt = new Date().toISOString();
    server.lastMessage = `${t("settings.server.fail")}: ${error.message}`;
  }
  persistSettings();
  renderServerSettings();
}

function prepareServerRequest(server) {
  if (server.mode !== "server") {
    server.lastStatus = "idle";
    server.lastMessage = t("settings.server.local");
    persistSettings();
    renderServerSettings();
    return false;
  }
  if (!server.url) {
    server.lastStatus = "bad";
    server.lastMessage = t("settings.server.noUrl");
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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(await serverResponseError(response));
  return response.json();
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

function applyPulledDailyNote(note) {
  const date = dailyDateFromServerNote(note);
  if (!date) return false;
  if (note.source === "web-daily-archive" || String(note.local_id || "").startsWith("daily-archive:")) {
    return applyPulledArchivedDailyNote(note, date);
  }
  const current = state.data.daily[date];
  if (current?.syncState === "pending") return false;
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
  if (current?.syncState === "pending") return false;
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
  const current = findTreeNode(state.data.tree, note.local_id);
  if (current?.syncState === "pending") return false;
  const deleted = state.data.deletedTree.find((node) => node.id === note.local_id);
  if (deleted?.syncState === "pending") return false;
  removePulledDeletedTreeNote(note.local_id);
  const parent = note.parent_local_id ? findTreeNode(state.data.tree, note.parent_local_id) : null;
  const nextLevel = Math.min(3, Math.max(1, note.level || (parent ? parent.level + 1 : 1)));
  const nextParentId = parent && nextLevel > 1 ? parent.id : null;
  if (current) {
    current.title = noteTitle(note.title);
    current.content = note.content || "";
    current.parentId = nextParentId;
    current.level = nextLevel;
    current.status = "active";
    current.syncState = "synced";
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
  const current = findTreeNode(state.data.tree, note.local_id);
  if (current?.syncState === "pending") return false;
  if (current) {
    detachTreeNode(note.local_id);
    removeTreeTabReferences(note.local_id);
  }
  const deleted = state.data.deletedTree.find((node) => node.id === note.local_id);
  if (deleted?.syncState === "pending") return false;
  const next = createPulledTreeNode(note, note.parent_local_id || null, note.level || 1);
  next.status = "deleted";
  next.deletedAt = note.deleted_at || note.updated_at || new Date().toISOString();
  if (deleted) {
    Object.assign(deleted, next);
  } else {
    state.data.deletedTree.unshift(next);
  }
  return true;
}

function createPulledTreeNode(note, parentId, level) {
  return {
    id: note.local_id,
    title: noteTitle(note.title),
    content: note.content || "",
    parentId,
    level,
    children: [],
    status: note.deleted_at ? "deleted" : "active",
    syncState: "synced",
    favorite: false,
    tags: tagsFromServerNote(note),
    createdAt: note.created_at || note.client_updated_at || note.updated_at || new Date().toISOString(),
    updatedAt: note.client_updated_at || note.updated_at || new Date().toISOString(),
  };
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
  state.data.deletedTree = state.data.deletedTree.filter((node) => node.id !== id);
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
      .filter((node) => shouldSendServerNote(node, changedOnly))
      .map((node) => treeNodeToServerNote(node, server, null)),
    ...state.data.deletedTree
      .filter((node) => shouldSendServerNote(node, changedOnly))
      .map((node) => treeNodeToServerNote(node, server, node.deletedAt || new Date().toISOString())),
  ];
  return notes.filter(Boolean);
}

function shouldSendServerNote(item, changedOnly) {
  return !changedOnly || item.syncState === "pending";
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

function markServerSyncedNotes() {
  Object.values(state.data.daily).forEach((note) => {
    note.syncState = "synced";
  });
  state.data.archivedDaily.forEach((note) => {
    note.syncState = "synced";
  });
  flattenTree(state.data.tree).forEach((node) => {
    node.syncState = "synced";
  });
  state.data.deletedTree.forEach((node) => {
    node.syncState = "synced";
  });
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

function applySettings() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = state.settings.theme === "system"
    ? (systemDark ? "dark" : "light")
    : state.settings.theme;
  const accent = ACCENTS.find((item) => item.id === state.settings.accent) || ACCENTS[0];
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.editor = state.settings.wideEditor ? "wide" : "normal";
  document.documentElement.dataset.sidebar = state.settings.sidebarCollapsed ? "collapsed" : "open";
  document.documentElement.dataset.railMode = state.settings.railMode;
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
  document.documentElement.lang = state.settings.language === "en" ? "en" : "ko";
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
  setText("#treeNavBtn", t("nav.tree"));
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
  setText("#settingsBtn", t("side.settings"));
  setText("#helpBtn", t("side.help"));
  setText("#treeEyebrow", t("tree.eyebrow"));
  setText("#treeTitle", t("tree.title"));
  setIconLabel(elements.expandAllBtn, t("tree.expandAll"));
  setIconLabel(elements.collapseAllBtn, t("tree.collapseAll"));
  setIconLabel(elements.addRootBtn, t("tree.addRoot"));
  setText("#emptyTreeEditorTitle", t("tree.emptySelectTitle"));
  setText("#emptyTreeEditorDesc", t("tree.emptySelectDesc"));
  setText("#emptyAddRootBtn", t("tree.createTopic"));
  setPlaceholder(elements.treeTitleInput, t("tree.titlePlaceholder"));
  setPlaceholder(elements.treeContent, t("tree.contentPlaceholder"));
  setText("#copyLinkBtn", t("editor.copyLink"));
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
  setText("#serverSettingDesc", t("settings.server.desc"));
  setText("#serverModeLocalOption", t("settings.server.mode.local"));
  setText("#serverModeServerOption", t("settings.server.mode.server"));
  setText("#serverModeLabel", t("settings.server.mode"));
  setText("#serverUrlLabel", t("settings.server.url"));
  setText("#serverTokenLabel", t("settings.server.token"));
  setText("#ownerIdLabel", t("settings.server.owner"));
  setText("#deviceIdLabel", t("settings.server.device"));
  setText("#serverProfileTitle", t("settings.server.profile.title"));
  setText("#serverProfileDesc", t("settings.server.profile.desc"));
  setText("#serverDisplayNameLabel", t("settings.server.profile.displayName"));
  setText("#serverEmailLabel", t("settings.server.profile.email"));
  setText("#serverTimezoneLabel", t("settings.server.profile.timezone"));
  setText("#serverProfileLoadBtn", t("settings.server.profile.load"));
  setText("#serverProfileSaveBtn", t("settings.server.profile.save"));
  setText("#serverAnalysisTitle", t("settings.server.analysis.title"));
  setText("#serverAnalysisDesc", t("settings.server.analysis.desc"));
  setText("#serverAnalysisCreateBtn", t("settings.server.analysis.create"));
  setText("#serverAnalysisRefreshBtn", t("settings.server.analysis.refresh"));
  setText("#serverSaveBtn", t("settings.server.save"));
  setText("#serverTestBtn", t("settings.server.test"));
  setText("#serverSyncBtn", t("settings.server.sync"));
  setText("#serverFullSyncBtn", t("settings.server.fullSync"));
  setPlaceholder(elements.serverTokenInput, t("settings.server.token"));
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
  if (getSelectedTreeNode()) {
    renderLinkPanel();
    renderNoteStats(getSelectedTreeNode());
  }
  renderRailButtons();
}

function updateHelpLinks() {
  const language = state.settings.language === "en" ? "en" : "ko";
  const helpUrl = `./help.html?lang=${encodeURIComponent(language)}`;
  [elements.helpBtn, elements.settingsHelpBtn].forEach((link) => {
    if (link) link.href = helpUrl;
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
  elements.searchPopoverInput.focus();
}

function closeSearchPopover() {
  elements.searchPopoverView.classList.add("hidden");
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
  if (shortcutMatches(event, "search")) {
    if (!featureEnabled("search")) return;
    event.preventDefault();
    toggleSearchPopover();
  }
  if (shortcutMatches(event, "noteFind")) {
    event.preventDefault();
    openNoteFind();
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

function handleTreeContentShortcut(event) {
  if (event.key === "Enter" && !event.shiftKey && continueMarkdownLineOnEnter()) {
    consumeTreeContentShortcut(event);
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
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => {
      if (direction > 0) return `  ${line}`;
      return line.replace(/^ {1,2}/, "");
    })
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  const delta = nextBlock.length - block.length;
  const nextStart = Math.max(lineStart, selectionStart + (direction > 0 ? 2 : Math.min(0, delta)));
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
  const links = graphLinks();
  if (links.length === 0) {
    elements.graphList.innerHTML = `<div class="empty-compact">${escapeHtml(t("note.graphEmpty"))}</div>`;
    return;
  }
  elements.graphList.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "graph-link";
      const fromTitle = noteTitle(link.from.title);
      const toTitle = noteTitle(link.to.title);
      row.innerHTML = `<strong>${escapeHtml(fromTitle)}</strong><span>→</span><strong>${escapeHtml(toTitle)}</strong>`;
      row.addEventListener("click", () => {
        selectTreeNode(link.to.id);
        closeGraph();
      });
      return row;
    }),
  );
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

function deleteSelectedTreeNodes() {
  pruneDeletedTreeSelection();
  const selectedIds = [...state.selectedDeletedTreeIds];
  if (selectedIds.length === 0) return;
  if (!confirm(t("note.nodeDelete.permanentSelected", { count: selectedIds.length }))) {
    return;
  }
  const selectedSet = new Set(selectedIds);
  state.data.deletedTree = state.data.deletedTree.filter((node) => !selectedSet.has(node.id));
  state.selectedDeletedTreeIds.clear();
  persist();
  renderDeletedTreeList();
  renderDeletedTreeButton();
}

function deleteAllArchivedTreeNodes() {
  const deleted = state.data.deletedTree || [];
  if (deleted.length === 0) return;
  if (!confirm(t("note.nodeDelete.permanentAll", { count: deleted.length }))) {
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
    button.classList.toggle("active", button.dataset.view === view);
  });
  elements.treeView.classList.toggle("active", view === "tree");
  elements.resultsView.classList.toggle("active", view === "results");
  render();
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
  closeDailyPopup();
  closeQuickSwitch();
  closeSearchPopover();
  closeGraph();
  closeDeletedTreeBox();
  closeSettingsPopup();
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
  elements.todayMemoState.textContent = state.data.daily[toDateKey(new Date())]?.content?.trim()
    ? t("note.dailyHasContent")
    : t("note.dailyEmpty");
  renderCalendar();
  renderArchiveList();
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
  showSaved(elements.dailySavedLabel);
}

function archiveSelectedDailyNote() {
  const note = state.data.daily[state.selectedDate];
  if (!note?.content?.trim()) {
    alert(t("note.noArchive"));
    return;
  }
  if (!confirm(t("note.archiveConfirm", { date: longDateLabel(state.selectedDate) }))) return;

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

function restoreArchivedDailyNote(id) {
  const note = state.data.archivedDaily.find((item) => item.id === id);
  if (!note || note.restoredAt) return;
  const active = state.data.daily[note.date];
  const restoredAt = new Date().toISOString();
  if (active?.content?.trim()) {
    const ok = confirm(t("note.archiveRestoreConfirm"));
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
  if (selected.level >= 3) {
    alert(t("note.treeDepthLimit"));
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
  if (state.data.tree.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>${escapeHtml(t("note.emptyTitle"))}</strong><span>${escapeHtml(t("note.emptyDescription"))}</span>`;
    elements.treeList.replaceChildren(empty);
    return;
  }
  elements.treeList.replaceChildren(...state.data.tree.map((node) => treeNodeElement(node)));
}

function treeNodeElement(node) {
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
  addButton.disabled = node.level >= 3;
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (node.level >= 3) return;
    const child = createNode(defaultTitleForLevel(node.level + 1), "", node.id, node.level + 1);
    node.children.push(child);
    state.selectedTreeId = child.id;
    state.expandedTreeIds.add(node.id);
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

function renderTreeEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) {
    renderOpenTreeTabs();
    return;
  }
  addOpenTreeTab(selected.id);

  elements.treeLevelLabel.textContent = levelName(selected.level);
  elements.treeTitleInput.value = selected.title;
  elements.treeContent.value = selected.content;
  renderFavorite(selected);
  renderTags();
  renderNoteStats(selected);
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = t("editor.preview");
  renderTreePath(selected);
  renderMarkdownPreview(selected.content);
  renderOutlinePanel(selected);
  renderLinkPanel();
  elements.addChildBtn.disabled = selected.level >= 3;
  renderTreeMoveButtons(selected);
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

function renderTags() {
  const selected = getSelectedTreeNode();
  if (!selected || !state.settings.showTags) {
    elements.tagList.replaceChildren();
    return;
  }
  selected.tags = extractTags(selected.content);
  if (selected.tags.length === 0) {
    elements.tagList.innerHTML = `<span class="tag-empty">${escapeHtml(t("note.tagEmpty"))}</span>`;
    return;
  }
  elements.tagList.replaceChildren(
    ...selected.tags.map((tag) => {
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
  const text = node.content || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.replace(/\s/g, "").length;
  const lines = text ? text.split("\n").length : 0;
  const outgoing = outgoingLinksFor(node);
  const links = outgoing.length;
  const missingLinks = outgoing.filter((link) => !link.exists).length;
  const backlinks = backlinksFor(node).length;
  const tags = extractTags(text).length;
  elements.noteStats.innerHTML = [
    `<span>${escapeHtml(t("note.stats.backlinks", { count: backlinks }))}</span>`,
    `<span>${escapeHtml(t("note.stats.edit"))}</span>`,
    `<span>${escapeHtml(t("note.stats.words", { count: words }))}</span>`,
    `<span>${escapeHtml(t("note.stats.chars", { count: chars }))}</span>`,
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
  if (selected) renderOutlinePanel(selected);
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
  selectNoteFindMatch(0);
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

function selectNoteFindMatch(index) {
  const query = elements.noteFindInput.value.trim();
  const matches = noteFindMatches();
  if (!query || matches.length === 0) {
    elements.noteFindInput.dataset.index = "0";
    updateNoteFindState(matches, query);
    return;
  }
  const safeIndex = ((index % matches.length) + matches.length) % matches.length;
  const start = matches[safeIndex];
  elements.noteFindInput.dataset.index = String(safeIndex);
  updateNoteFindState(matches, query, safeIndex);
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = t("editor.preview");
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(start, start + query.length);
}

function moveNoteFindMatch(direction) {
  const current = Number(elements.noteFindInput.dataset.index || 0);
  selectNoteFindMatch(current + direction);
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
  const outgoing = outgoingLinksFor(selected);
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

function inlineMarkdown(text) {
  const codeSpans = [];
  const protectedText = text.replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSpans.push(code) - 1;
    return `\u0000CODE${index}\u0000`;
  });
  return protectedText
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      const target = decodeHtml(title.trim());
      return `<button class="wiki-link" type="button" data-wiki-link="${escapeHtml(target)}">${title}</button>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => renderExternalLink(label, url))
    .replace(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g, '$1<span class="tag-inline">#$2</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${codeSpans[Number(index)] || ""}</code>`);
}

function renderExternalLink(label, url) {
  const trimmedUrl = decodeHtml(url.trim());
  if (!/^(https?:\/\/|mailto:)/i.test(trimmedUrl)) {
    return `[${label}](${url})`;
  }
  return `<a href="${escapeHtml(trimmedUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function openWikiLink(title) {
  const normalized = title.trim();
  if (!normalized) return;
  const existing = findTreeNodeByTitle(normalized);
  if (existing) {
    selectTreeNode(existing.id);
    return;
  }
  if (!confirm(t("note.linkCreateConfirm", { title: normalized }))) return;
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
    favorite: false,
    tags: extractTags(content),
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
    syncState: "pending",
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

function permanentlyDeleteTreeNode(id) {
  const index = state.data.deletedTree.findIndex((node) => node.id === id);
  if (index < 0) return;
  const node = state.data.deletedTree[index];
  if (!confirm(t("note.nodeDelete.permanentConfirm", { title: noteTitle(node.title) }))) {
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

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.data.daily = parsed.daily || {};
    state.data.archivedDaily = parsed.archivedDaily || [];
    state.data.deletedTree = parsed.deletedTree || [];
    state.data.tree = parsed.tree || [];
    normalizeData();
    persist();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.settings = normalizeSettings(parsed);
    persistSettings();
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
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
  return ["ko", "en"].includes(language) ? language : "";
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
  normalized.language = ["ko", "en"].includes(normalized.language) ? normalized.language : defaults.language;
  normalized.theme = ["system", "light", "dark"].includes(normalized.theme) ? normalized.theme : defaults.theme;
  normalized.accent = ACCENTS.some((accent) => accent.id === normalized.accent) ? normalized.accent : defaults.accent;
  normalized.railMode = ["icon", "letter"].includes(normalized.railMode) ? normalized.railMode : defaults.railMode;
  normalized.fontSize = ["small", "medium", "large"].includes(normalized.fontSize) ? normalized.fontSize : defaults.fontSize;
  normalized.lineHeight = ["compact", "normal", "relaxed"].includes(normalized.lineHeight) ? normalized.lineHeight : defaults.lineHeight;
  normalized.wideEditor = normalizeToggle(normalized.wideEditor, defaults.wideEditor);
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
  normalized.openTreeTabs = limitOpenTreeTabs(normalized.openTreeTabs, 10, normalized.pinnedTreeTabs);
  normalized.treeListWidth = Math.min(460, Math.max(180, Number(normalized.treeListWidth) || 280));
  return normalized;
}

function normalizeServerSettings(server = {}, defaults = defaultServerSettings()) {
  const normalized = {
    ...defaults,
    ...(server && typeof server === "object" ? server : {}),
  };
  normalized.mode = normalized.mode === "server" ? "server" : "local";
  normalized.url = typeof normalized.url === "string" ? normalizeServerUrl(normalized.url) : "";
  normalized.token = typeof normalized.token === "string" ? normalized.token : "";
  normalized.ownerId = normalizeOwnerId(normalized.ownerId || defaults.ownerId);
  normalized.deviceId = typeof normalized.deviceId === "string" && normalized.deviceId.trim() ? normalized.deviceId.trim() : defaults.deviceId;
  normalized.userProfile = normalizeServerUserProfile(normalized.userProfile, defaults.userProfile);
  normalized.capabilities = normalized.capabilities && typeof normalized.capabilities === "object" ? normalized.capabilities : null;
  normalized.analysisJobs = Array.isArray(normalized.analysisJobs) ? normalized.analysisJobs.slice(0, 5) : [];
  normalized.lastCheckedAt = typeof normalized.lastCheckedAt === "string" ? normalized.lastCheckedAt : null;
  normalized.lastSyncedAt = typeof normalized.lastSyncedAt === "string" ? normalized.lastSyncedAt : null;
  normalized.lastStatus = ["idle", "saved", "testing", "ok", "bad"].includes(normalized.lastStatus) ? normalized.lastStatus : "idle";
  normalized.lastMessage = typeof normalized.lastMessage === "string" ? normalized.lastMessage : "";
  return normalized;
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
  return normalized;
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
  writeStorage(SETTINGS_KEY, state.settings);
}

function normalizeData() {
  state.data.daily = state.data.daily && typeof state.data.daily === "object" && !Array.isArray(state.data.daily)
    ? state.data.daily
    : {};
  state.data.archivedDaily = Array.isArray(state.data.archivedDaily) ? state.data.archivedDaily : [];
  state.data.deletedTree = Array.isArray(state.data.deletedTree) ? state.data.deletedTree : [];
  state.data.tree = Array.isArray(state.data.tree) ? state.data.tree : [];

  state.data.daily = normalizeDailyNotes(state.data.daily);
  state.data.archivedDaily = state.data.archivedDaily.filter((note) => isPlainObject(note) && isDateKey(note.date));
  state.data.deletedTree = state.data.deletedTree.filter(isPlainObject);
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
    node.deletedAt = node.deletedAt || node.updatedAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.deletedAt;
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
  });
  normalizeTreeNodes(state.data.tree, null, 1);
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
    node.favorite = Boolean(node.favorite);
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
    node.createdAt = node.createdAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.createdAt;
    if (node.level >= 3 && node.children.length > 0) {
      node.content = mergeOverflowTreeChildren(node.content, node.children);
      node.children = [];
      node.tags = extractTags(node.content);
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
  writeStorage(STORAGE_KEY, state.data);
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      alert(t("note.storageFail"));
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
  if (state.settings.language === "en") return `${dateKey} · ${longDateLabel(dateKey)}`;
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
    alert(t("note.exportDenied"));
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parseBackupData(parsed);
      if (!imported.data) {
        alert(t("note.backupImportError"));
        return;
      }
      const summary = backupSummary(imported.data);
      if (!confirm(t("note.backupReplaceConfirm", {
        file: file.name,
        time: imported.exportedAt ? formatBackupTime(imported.exportedAt) : t("note.unknownDate"),
        daily: summary.daily,
        archivedDaily: summary.archivedDaily,
        restoredArchivedDaily: summary.restoredArchivedDaily ? t("note.restoredArchivedDailyCount", { count: summary.restoredArchivedDaily }) : "",
        tree: summary.tree,
        deletedTree: summary.deletedTree,
      }))) {
        return;
      }
      downloadCurrentBackup("nownote-before-import");
      state.data = backupDataShape(imported.data);
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
      alert(t("note.importDone"));
    } catch {
      alert(t("note.importReadError"));
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    alert(t("note.backupFileParseError"));
    event.target.value = "";
  };
  try {
    reader.readAsText(file);
  } catch {
    alert(t("note.backupFileOpenError"));
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
      const title = titleFromMarkdownFile(file.name, content);
      return {
        title,
        nodes: [createNode(title, content, null, 1)],
        dailyNotes: [],
        archivedDailyNotes: [],
      };
    }))).filter(Boolean);
    if (imports.length === 0) {
      alert(t("note.markdownNoContent"));
      return;
    }
    const summary = markdownImportSummary(imports);
    const previewNames = imports.slice(0, 5).map((item) => `- ${item.title}`).join("\n");
    const moreText = imports.length > 5 ? `\n- ${t("note.markdownImportedMore", { count: imports.length - 5 })}` : "";
    if (!confirm([
      t("note.markdownImportConfirm", { count: imports.length, nodes: summary.nodes, daily: summary.daily, archivedDaily: summary.archivedDaily }),
      "",
      previewNames + moreText,
    ].join("\n"))) {
      return;
    }
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
    alert(t("note.markdownImportDone", { nodes: nodes.length, daily: dailyNotes.length, archivedDaily: archivedDailyNotes.length }));
  } catch {
    alert(t("note.markdownImportError"));
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

function backupDataShape(data) {
  return {
    daily: data.daily,
    archivedDaily: data.archivedDaily,
    deletedTree: data.deletedTree,
    tree: data.tree,
  };
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
  return state.settings.language === "en" ? "en-US" : "ko-KR";
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
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return t("note.dateMissing");
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeTime(value) {
  if (!value) return t("note.dateMissing");
  const diffMs = Date.now() - new Date(value).getTime();
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
  }).format(new Date(value));
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
