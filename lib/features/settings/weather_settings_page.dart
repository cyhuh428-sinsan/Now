import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';

// ============================================================
// Provider
// ============================================================

final weatherApiKeyProvider =
    StateNotifierProvider<WeatherSettingsNotifier, WeatherSettings>(
        (ref) => WeatherSettingsNotifier());

class WeatherSettings {
  final String apiKey;
  final String city;
  WeatherSettings({this.apiKey = '', this.city = 'Seoul'});
  WeatherSettings copyWith({String? apiKey, String? city}) =>
      WeatherSettings(
        apiKey: apiKey ?? this.apiKey,
        city: city ?? this.city,
      );
}

class WeatherSettingsNotifier extends StateNotifier<WeatherSettings> {
  static const _keyApiKey = 'weather_api_key';
  static const _keyCity = 'weather_city';

  WeatherSettingsNotifier() : super(WeatherSettings()) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = WeatherSettings(
      apiKey: prefs.getString(_keyApiKey) ?? '',
      city: prefs.getString(_keyCity) ?? 'Seoul',
    );
  }

  Future<void> save({required String apiKey, required String city}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyApiKey, apiKey.trim());
    await prefs.setString(_keyCity, city.trim().isEmpty ? 'Seoul' : city.trim());
    state = state.copyWith(apiKey: apiKey.trim(), city: city.trim());
  }
}

// ============================================================
// 날씨 설정 상세 페이지
// ============================================================

class WeatherSettingsPage extends ConsumerStatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  ConsumerState<WeatherSettingsPage> createState() =>
      _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends ConsumerState<WeatherSettingsPage> {
  late TextEditingController _apiKeyCtrl;
  late TextEditingController _cityCtrl;
  bool _obscure = true;
  bool _isTesting = false;
  String? _testResult;

  @override
  void initState() {
    super.initState();
    final settings = ref.read(weatherApiKeyProvider);
    _apiKeyCtrl = TextEditingController(text: settings.apiKey);
    _cityCtrl = TextEditingController(text: settings.city);
  }

  @override
  void dispose() {
    _apiKeyCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    await ref.read(weatherApiKeyProvider.notifier).save(
          apiKey: _apiKeyCtrl.text,
          city: _cityCtrl.text,
        );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장되었습니다')),
      );
    }
  }

  Future<void> _test() async {
    await _save();
    final apiKey = _apiKeyCtrl.text.trim();
    final city = _cityCtrl.text.trim().isEmpty ? 'Seoul' : _cityCtrl.text.trim();

    if (apiKey.isEmpty) {
      setState(() => _testResult = '❌ API Key를 입력해주세요');
      return;
    }

    setState(() {
      _isTesting = true;
      _testResult = null;
    });

    try {
      final dio = Dio();
      final r = await dio.get(
        'https://api.openweathermap.org/data/2.5/weather',
        queryParameters: {
          'q': city,
          'appid': apiKey,
          'units': 'metric',
          'lang': 'kr',
        },
      );
      if (r.statusCode == 200) {
        final data = r.data;
        final temp = data['main']['temp'].toStringAsFixed(1);
        final desc = data['weather'][0]['description'];
        setState(() => _testResult = '✅ 연결 성공! $city: $temp°C, $desc');
      }
    } catch (e) {
      setState(() => _testResult = '❌ 연결 실패 — API Key 또는 도시명을 확인해주세요');
    } finally {
      if (mounted) setState(() => _isTesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios,
              size: 18, color: Color(0xFF111827)),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '날씨 설정',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 안내
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF06B6D4).withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('💡', style: TextStyle(fontSize: 16)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'OpenWeatherMap 무료 API를 사용합니다.\nopenweathermap.org에서 무료 가입 후 API Key를 발급받으세요.',
                    style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF374151),
                        height: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // API Key
          const _SectionHeader(title: 'API Key'),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            padding: const EdgeInsets.all(14),
            child: TextField(
              controller: _apiKeyCtrl,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'OpenWeatherMap API Key',
                hintText: '49e6571573ebf8ec...',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 13),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF06B6D4)),
                ),
                suffixIcon: IconButton(
                  icon: Icon(
                      _obscure ? Icons.visibility_off : Icons.visibility,
                      size: 18,
                      color: const Color(0xFF9CA3AF)),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // 도시 설정
          const _SectionHeader(title: '도시'),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            padding: const EdgeInsets.all(14),
            child: TextField(
              controller: _cityCtrl,
              decoration: InputDecoration(
                labelText: '도시명 (영문)',
                hintText: 'Seoul, Busan, Jeju...',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 13),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF06B6D4)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 저장 + 테스트
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _save,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF06B6D4),
                    side: const BorderSide(color: Color(0xFF06B6D4)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('저장',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: _isTesting ? null : _test,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF06B6D4),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _isTesting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('연결 테스트',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.white)),
                ),
              ),
            ],
          ),

          // 테스트 결과
          if (_testResult != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _testResult!.startsWith('✅')
                    ? const Color(0xFF10B981).withOpacity(0.1)
                    : const Color(0xFFEF4444).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _testResult!,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: _testResult!.startsWith('✅')
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF6B7280),
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
