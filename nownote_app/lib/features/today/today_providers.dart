import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../../shared/note_database_provider.dart';
import 'today_memo_repository.dart';

// LLM provider 구현과 설정 저장은 now_core/lib/llm에 있다. NowNote는 화면에서
// 배선만 한다. now_core는 riverpod에 기대지 않는다.

/// 오늘 메모 탭이 쓰는 [NoteDatabase].
///
/// `noteDatabaseProvider`(`lib/shared/note_database_provider.dart`)가 앱
/// 전체에서 하나뿐인 인스턴스를 만든다. 계층 메모 탭도 같은 provider를
/// 본다 — 두 탭이 각자 인스턴스를 만들면 한쪽에 저장한 값이 다른 쪽에
/// 바로 보이지 않는 문제가 생겼던 것을 통합 검증에서 발견해 이렇게
/// 합쳤다. 이름은 기존 호출부(`today_memo_repository_test.dart` 등)를
/// 그대로 두기 위해 유지하고, 안에서 공용 provider를 그대로 내준다.
/// 위젯 테스트는 `noteDatabaseProvider`를
/// `NoteDatabase.forTesting(NativeDatabase.memory())`로 덮어써서 실제
/// 파일을 건드리지 않는다 — 그 override가 이 provider에도 그대로
/// 전달된다.
final Provider<NoteDatabase> todayNoteDatabaseProvider =
    Provider<NoteDatabase>((ref) {
      return ref.watch(noteDatabaseProvider);
    });

/// 오늘 메모 데이터 접근 계층.
final Provider<TodayMemoRepository> todayMemoRepositoryProvider =
    Provider<TodayMemoRepository>((ref) {
      return TodayMemoRepository(ref.watch(todayNoteDatabaseProvider));
    });

/// 지금 달력에서 고른 날짜(자정 기준). 진입 시 오늘 날짜로 연다.
final StateProvider<DateTime> selectedDateProvider = StateProvider<DateTime>(
  (ref) => TodayMemoRepository.normalizeDate(DateTime.now()),
);

/// 문단을 추가할 때마다 올린다. 아래 두 조회 provider가 이 값을 지켜보고
/// 다시 읽어 온다. DB 자체에는 변경 스트림이 없어 이 값으로 다시 읽기를
/// 신호한다.
final StateProvider<int> todayMemoRefreshTickProvider = StateProvider<int>(
  (ref) => 0,
);

/// 선택된 날짜의 메모 문단 목록.
final FutureProvider<List<TodayMemoParagraph>> selectedDateParagraphsProvider =
    FutureProvider<List<TodayMemoParagraph>>((ref) async {
      ref.watch(todayMemoRefreshTickProvider);
      final date = ref.watch(selectedDateProvider);
      final repo = ref.watch(todayMemoRepositoryProvider);
      return repo.paragraphsForDate(date);
    });

/// 메모가 있는 날짜 전체(자정 기준). 달력 점 표시용.
final FutureProvider<Set<DateTime>> memoDatesProvider =
    FutureProvider<Set<DateTime>>((ref) async {
      ref.watch(todayMemoRefreshTickProvider);
      final repo = ref.watch(todayMemoRepositoryProvider);
      return repo.datesWithMemo();
    });

// ---- 음성 입력(받아쓰기)·읽어주기 배선 ----
// 서버 STT/TTS 접속 설정(VoiceSettings)과 VoiceEngineClient를 만드는 방법은
// `settings/settings_providers.dart`가 이미 갖고 있다(voiceSettingsStoreProvider,
// voiceEngineClientBuilderProvider) — 음성 설정 화면과 같은 것을 그대로 쓴다.
// 여기서는 오늘 메모 화면에서만 쓰는 녹음/재생 서비스 배선만 더한다.

/// 오늘 메모 화면의 "녹음 후 서버로 변환" 받아쓰기가 쓰는 [VoiceRecordingService].
///
/// 위젯 테스트는 이 provider를 override해서 가짜 레코더를 쓰는 서비스로
/// 바꿔 끼울 수 있다.
final Provider<VoiceRecordingService> todayVoiceRecordingServiceProvider =
    Provider<VoiceRecordingService>((ref) => VoiceRecordingService());

/// 문단 읽어주기(TTS)가 [VoiceEngineClient]로부터 [VoicePlaybackService]를
/// 만드는 방법.
///
/// 기본값은 실제 오디오 재생 장치([VoicePlaybackService.withEngine])를 쓴다.
/// 위젯 테스트는 이 provider를 override해서 가짜 재생 장치로 만든 서비스를
/// 그대로 돌려주는 빌더로 바꿔 끼울 수 있다.
final Provider<VoicePlaybackService Function(VoiceEngineClient engine)>
todayVoicePlaybackServiceBuilderProvider =
    Provider<VoicePlaybackService Function(VoiceEngineClient engine)>(
      (ref) => (engine) => VoicePlaybackService.withEngine(engine),
    );

// ---- 사진 입력이 쓰는 LLM 배선 ----
// NowNote는 LLM provider/설정 화면(U18/U22)을 아직 갖고 있지 않다. 설정이
// 비어 있으면 PhotoTextExtractor가 notConfigured로 실패하고 화면은 그
// 안내 문구를 그대로 보여준다.

final Provider<LlmSettingsService> llmSettingsServiceProvider =
    Provider<LlmSettingsService>((ref) => LlmSettingsService());

final FutureProvider<LlmConfig> llmConfigProvider = FutureProvider<LlmConfig>((
  ref,
) async {
  final service = ref.watch(llmSettingsServiceProvider);
  return service.loadConfig();
});

final FutureProvider<LlmRepository?> llmRepositoryProvider =
    FutureProvider<LlmRepository?>((ref) async {
      final config = await ref.watch(llmConfigProvider.future);
      if (!config.isConfigured) return null;
      return switch (config.provider) {
        LlmProvider.groq => GroqLlmRepository(config),
        LlmProvider.deepSeek => DeepSeekLlmRepository(config),
        LlmProvider.gemini => GeminiLlmRepository(config),
        LlmProvider.openAi => OpenAiLlmRepository(config),
        LlmProvider.claude => ClaudeLlmRepository(config),
        LlmProvider.grok => GrokLlmRepository(config),
        LlmProvider.ollama => OllamaLlmRepository(config),
      };
    });
