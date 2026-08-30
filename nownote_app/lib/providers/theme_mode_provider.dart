import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// [themeModeProvider]가 SharedPreferences에 저장하는 키.
const String themeModeStorageKey = 'nownote_theme_mode';

/// NowNote 앱 전체 테마 모드를 들고 있고 SharedPreferences에 저장/복원한다.
///
/// 생성 시점에 저장된 값을 비동기로 읽어 온다. 위젯 테스트는 [ready]를
/// await해서 복원이 끝난 뒤 상태를 확인할 수 있다.
class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  ThemeModeNotifier() : super(ThemeMode.system) {
    ready = _restore();
  }

  /// 저장된 값 복원이 끝나면 완료되는 future. 테스트에서만 await한다.
  late final Future<void> ready;

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final restored = _fromStorageValue(prefs.getString(themeModeStorageKey));
    if (restored != null) {
      state = restored;
    }
  }

  /// 사용자가 고른 테마로 바꾸고 저장한다.
  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(themeModeStorageKey, _toStorageValue(mode));
  }

  static String _toStorageValue(ThemeMode mode) => mode.name;

  static ThemeMode? _fromStorageValue(String? value) {
    if (value == null) return null;
    for (final mode in ThemeMode.values) {
      if (mode.name == value) return mode;
    }
    return null;
  }
}

/// NowNote 앱 전체 테마 모드.
///
/// 기본값은 시스템 설정을 따르는 [ThemeMode.system]이다. 사용자가
/// 설정 화면에서 고르면 [ThemeModeNotifier.setThemeMode]로 바꾸고, 그 값은
/// SharedPreferences에 저장돼 앱을 다시 켜도 유지된다.
final StateNotifierProvider<ThemeModeNotifier, ThemeMode> themeModeProvider =
    StateNotifierProvider<ThemeModeNotifier, ThemeMode>(
      (ref) => ThemeModeNotifier(),
    );
