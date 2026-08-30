import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';
import 'package:now_core/now_core.dart';
import 'package:now/repositories/repository_providers.dart';
import 'package:now/services/note_store_migration_service.dart';
import 'package:now/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ko', null); // 한국어 날짜 포맷
  await NotificationService.init(); // ← 추가

  final container = ProviderContainer();
  // 노트 저장소를 now_core NoteDatabase로 옮긴 뒤 첫 실행 시 한 번 이전한다.
  await NoteStoreMigrationService(
    container.read(appDatabaseProvider),
    container.read(noteDatabaseProvider),
  ).migrateIfNeeded();
  // 옛 whisper_server_url에 남아 있는 STT 주소를 VoiceSettings로 한 번 옮긴다.
  await VoiceSettingsMigration().migrateIfNeeded();
  // 2.3.5까지 코드에 박혀 있던 Ollama 기본 주소가 저장돼 있으면 한 번 지운다.
  // 사용자가 고른 적 없는 남의 서버로 계속 요청하지 않게 한다.
  await LlmSettingsMigration().migrateIfNeeded();

  runApp(
    UncontrolledProviderScope(container: container, child: const NowApp()),
  );
}
