import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MessengerSafetyStore {
  MessengerSafetyStore(this._prefs);

  final SharedPreferences _prefs;

  String _key(ServerSettings settings, String suffix) {
    final server = Uri.encodeComponent(normalizeBaseUrl(settings.baseUrl));
    final owner = Uri.encodeComponent(normalizeOwnerId(settings.ownerId));
    return 'messenger_safety.$server.$owner.$suffix';
  }

  Future<Set<String>> blockedOwnerIds(ServerSettings settings) async {
    return (_prefs.getStringList(_key(settings, 'blocked')) ?? const <String>[])
        .toSet();
  }

  Future<void> blockOwner(ServerSettings settings, String ownerId) async {
    final blocked = await blockedOwnerIds(settings);
    blocked.add(ownerId);
    await _prefs.setStringList(
      _key(settings, 'blocked'),
      blocked.toList()..sort(),
    );
  }

  Future<void> unblockOwner(ServerSettings settings, String ownerId) async {
    final blocked = await blockedOwnerIds(settings);
    blocked.remove(ownerId);
    await _prefs.setStringList(
      _key(settings, 'blocked'),
      blocked.toList()..sort(),
    );
  }

  Future<bool> hasAcceptedTerms(
    ServerSettings settings, {
    required int version,
  }) async {
    return _prefs.getInt(_key(settings, 'terms_version')) == version;
  }

  Future<void> acceptTerms(
    ServerSettings settings, {
    required int version,
  }) async {
    await _prefs.setInt(_key(settings, 'terms_version'), version);
  }
}
