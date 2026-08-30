import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:nownote/features/tree/tree_providers.dart';
import 'package:nownote/main.dart';

// TreeMemoPage(U16)가 실제 노트 DB(now_core의 NoteDatabase)를 읽으므로,
// 이 앱 전체 위젯 테스트에서도 계층 메모 탭으로 전환하면 DB에 접근한다.
// 테스트 환경에는 drift_flutter가 쓰는 path_provider 플랫폼 채널이 없어
// 실제 DB를 그대로 열면 실패한다. now_app의 기존 페이지 테스트들이 하던
// 것과 같은 방식으로 메모리 DB로 바꿔 끼운다.
Widget _wrap() {
  return ProviderScope(
    overrides: [
      noteDatabaseProvider.overrideWith(
        (ref) => NoteDatabase.forTesting(NativeDatabase.memory()),
      ),
    ],
    child: const NowNoteApp(),
  );
}

/// 하단 탭(NavigationBar) 안에 있는 라벨 텍스트만 찾는다.
/// AppBar 제목과 텍스트가 같아 [find.text]만 쓰면 모호해진다.
Finder _navLabel(String label) {
  return find.descendant(
    of: find.byType(NavigationBar),
    matching: find.text(label),
  );
}

void main() {
  // U15가 실제 오늘 메모 화면(TableCalendar 포함)으로 채운 뒤로는 로케일
  // 데이터가 필요하다. today_page_test.dart가 이미 이렇게 초기화한다 —
  // 이 통합 테스트에도 같은 초기화가 필요하다.
  setUpAll(() async {
    await initializeDateFormatting('ko_KR');
    // 메신저 화면(U17)이 ServerSettings.load()로 실제 SharedPreferences·
    // flutter_secure_storage 채널을 탄다. 목 핸들러 없이는 pumpAndSettle이
    // 끝나지 않는다 — now_core의 server_settings_test.dart와 같은 방식으로
    // 초기화한다.
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('오늘 메모 탭이 기본 진입 화면이다', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    // U15가 실제 화면을 채운 뒤로는 고정 문구 대신, 메모가 없는 새 DB에서
    // 뜨는 안내문으로 확인한다(today_page_test.dart와 같은 문구).
    expect(find.text('이 날의 메모가 없습니다.'), findsOneWidget);
  });

  testWidgets('계층 메모 탭을 누르면 화면이 전환된다', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(_navLabel('계층 메모'));
    await tester.pumpAndSettle();

    // U16이 실제 화면을 채운 뒤로는 고정 문구 대신 계층 메모 입력 바로 확인한다.
    expect(find.byKey(const Key('tree-input-field')), findsOneWidget);
    expect(find.text('오늘 메모 화면입니다'), findsNothing);
  });

  testWidgets('오늘 메모 탭과 계층 메모 탭을 오가도 동작한다', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(_navLabel('계층 메모'));
    await tester.pumpAndSettle();
    await tester.tap(_navLabel('오늘 메모'));
    await tester.pumpAndSettle();

    expect(find.text('이 날의 메모가 없습니다.'), findsOneWidget);
  });

  testWidgets('메신저 아이콘을 누르면 메신저 화면으로 이동한다', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('메신저'));
    await tester.pumpAndSettle();

    // U17이 실제 화면을 채운 뒤로는 고정 문구 대신, 서버 설정이 없는 테스트
    // 환경에서 뜨는 안내문으로 확인한다(messenger_page_test.dart와 같은 문구).
    expect(find.text('서버 설정이 필요합니다'), findsOneWidget);
  });

  testWidgets('설정 아이콘을 누르면 설정 화면으로 이동한다', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('설정'));
    await tester.pumpAndSettle();

    // U18이 실제 화면을 채운 뒤로는 고정 문구 대신, 설정 허브의 목록 타일로
    // 확인한다(settings_page_test.dart와 같은 문구).
    expect(find.text('서버 설정'), findsOneWidget);
    expect(find.text('도움말'), findsOneWidget);
  });
}
