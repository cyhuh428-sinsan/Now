import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../../core/database/app_database.dart';
import '../../../repositories/repository_providers.dart';
import '../../../llm/providers/llm_providers.dart';
import '../../settings/weather_settings_page.dart';

// ============================================================
// 날씨 데이터 모델
// ============================================================

class WeatherData {
  final double temp;
  final double tempMin;
  final double tempMax;
  final String description;
  final String icon;
  final int humidity;
  final double windSpeed;
  final int? pop; // 강수 확률 (%)

  const WeatherData({
    required this.temp,
    required this.tempMin,
    required this.tempMax,
    required this.description,
    required this.icon,
    required this.humidity,
    required this.windSpeed,
    this.pop,
  });
}

// ============================================================
// Provider
// ============================================================

const _userId = 'local_user';

final weatherProvider =
    FutureProvider.autoDispose<WeatherData?>((ref) async {
  final settings = ref.watch(weatherApiKeyProvider);
  if (settings.apiKey.isEmpty) return null;

  try {
    final dio = Dio();
    final r = await dio.get(
      'https://api.openweathermap.org/data/2.5/weather',
      queryParameters: {
        'q': settings.city.isEmpty ? 'Seoul' : settings.city,
        'appid': settings.apiKey,
        'units': 'metric',
        'lang': 'kr',
      },
    );
    final d = r.data;
    return WeatherData(
      temp: (d['main']['temp'] as num).toDouble(),
      tempMin: (d['main']['temp_min'] as num).toDouble(),
      tempMax: (d['main']['temp_max'] as num).toDouble(),
      description: d['weather'][0]['description'] as String,
      icon: d['weather'][0]['icon'] as String,
      humidity: d['main']['humidity'] as int,
      windSpeed: (d['wind']['speed'] as num).toDouble(),
    );
  } catch (_) {
    return null;
  }
});

final upcomingPreparesProvider =
    FutureProvider.autoDispose<List<PrepareItem>>((ref) async {
  final repo = ref.watch(prepareRepositoryProvider);
  return repo.getUpcomingPrepares(_userId);
});

// ============================================================
// 날씨와 준비물 페이지
// ============================================================

class WeatherPage extends ConsumerStatefulWidget {
  const WeatherPage({super.key});

  @override
  ConsumerState<WeatherPage> createState() => _WeatherPageState();
}

class _WeatherPageState extends ConsumerState<WeatherPage> {
  String? _llmSuggestion;
  bool _isAnalyzing = false;

  Future<void> _analyzePrepare() async {
    final weather = ref.read(weatherProvider).valueOrNull;
    if (weather == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('날씨 정보를 먼저 불러와주세요')),
      );
      return;
    }

    setState(() => _isAnalyzing = true);
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (!mounted) return;
      if (repo == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요')),
        );
        return;
      }

      final settings = ref.read(weatherApiKeyProvider);
      final prompt = '''
오늘 날씨 정보입니다:
- 도시: ${settings.city}
- 현재 기온: ${weather.temp.toStringAsFixed(1)}°C
- 최저/최고: ${weather.tempMin.toStringAsFixed(1)}°C / ${weather.tempMax.toStringAsFixed(1)}°C
- 날씨: ${weather.description}
- 습도: ${weather.humidity}%
- 풍속: ${weather.windSpeed}m/s

이 날씨에 맞는 오늘 준비물을 추천해주세요.
3~5가지를 간결하게 한 줄로 나열해주세요.
예: 우산, 두꺼운 외투, 핫팩, 마스크
설명 없이 준비물만 나열해주세요.
''';

      final result = await repo.chat(prompt);
      if (mounted) setState(() => _llmSuggestion = result.trim());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('분석 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isAnalyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final weatherAsync = ref.watch(weatherProvider);
    final preparesAsync = ref.watch(upcomingPreparesProvider);
    final settings = ref.watch(weatherApiKeyProvider);

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
          '날씨와 준비물',
          style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827)),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _showAddPrepareSheet(context),
            icon: const Icon(Icons.add, size: 18, color: Color(0xFF06B6D4)),
            label: const Text('준비물 추가',
                style: TextStyle(
                    color: Color(0xFF06B6D4),
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          // API 키 미설정 안내
          if (settings.apiKey.isEmpty)
            _NoApiKeyCard(
                onTap: () => context.push('/settings/weather'))
          else ...[
            // 날씨 카드
            weatherAsync.when(
              loading: () => const _WeatherLoadingCard(),
              error: (_, __) => const _WeatherErrorCard(),
              data: (weather) => weather == null
                  ? _NoApiKeyCard(
                      onTap: () => context.push('/settings/weather'))
                  : _WeatherCard(
                      weather: weather,
                      city: settings.city,
                    ),
            ),
            const SizedBox(height: 12),

            // AI 준비물 제안
            _AiSuggestCard(
              suggestion: _llmSuggestion,
              isAnalyzing: _isAnalyzing,
              onAnalyze: _analyzePrepare,
            ),
            const SizedBox(height: 20),
          ],

          // 일정 준비물
          Row(
            children: [
              const Text('📋 일정 준비물',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827))),
              const Spacer(),
              TextButton(
                onPressed: () => _showAddPrepareSheet(context),
                child: const Text('+ 추가',
                    style: TextStyle(
                        fontSize: 13, color: Color(0xFF06B6D4))),
              ),
            ],
          ),
          const SizedBox(height: 8),
          preparesAsync.when(
            loading: () => const Center(
                child: CircularProgressIndicator(strokeWidth: 2)),
            error: (e, _) => Text('오류: $e'),
            data: (prepares) => prepares.isEmpty
                ? _EmptyPrepares(
                    onAdd: () => _showAddPrepareSheet(context))
                : Column(
                    children: prepares
                        .map((p) => _PrepareCard(
                              prepare: p,
                              onDelete: () async {
                                await ref
                                    .read(prepareRepositoryProvider)
                                    .deletePrepare(p.prepareId);
                                ref.invalidate(upcomingPreparesProvider);
                              },
                            ))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }

  void _showAddPrepareSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddPrepareSheet(
        onSaved: () => ref.invalidate(upcomingPreparesProvider),
      ),
    );
  }
}

// ============================================================
// 날씨 카드
// ============================================================

class _WeatherCard extends StatelessWidget {
  final WeatherData weather;
  final String city;
  const _WeatherCard({required this.weather, required this.city});

  String get _weatherEmoji {
    final desc = weather.description;
    if (desc.contains('비') || desc.contains('rain')) return '🌧️';
    if (desc.contains('눈') || desc.contains('snow')) return '❄️';
    if (desc.contains('구름') || desc.contains('cloud')) return '☁️';
    if (desc.contains('안개') || desc.contains('fog')) return '🌫️';
    if (desc.contains('천둥') || desc.contains('thunder')) return '⛈️';
    return '☀️';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF06B6D4), Color(0xFF0EA5E9)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(_weatherEmoji,
                  style: const TextStyle(fontSize: 40)),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${weather.temp.toStringAsFixed(1)}°C',
                    style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: Colors.white),
                  ),
                  Text(
                    weather.description,
                    style: const TextStyle(
                        fontSize: 14, color: Colors.white70),
                  ),
                ],
              ),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(city,
                      style: const TextStyle(
                          fontSize: 13,
                          color: Colors.white,
                          fontWeight: FontWeight.w600)),
                  Text(
                    DateFormat('M월 d일 EEEE', 'ko').format(DateTime.now()),
                    style: const TextStyle(
                        fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _WeatherStat(
                  label: '최저',
                  value: '${weather.tempMin.toStringAsFixed(0)}°'),
              const SizedBox(width: 16),
              _WeatherStat(
                  label: '최고',
                  value: '${weather.tempMax.toStringAsFixed(0)}°'),
              const SizedBox(width: 16),
              _WeatherStat(
                  label: '습도', value: '${weather.humidity}%'),
              const SizedBox(width: 16),
              _WeatherStat(
                  label: '풍속',
                  value: '${weather.windSpeed.toStringAsFixed(1)}m/s'),
            ],
          ),
        ],
      ),
    );
  }
}

class _WeatherStat extends StatelessWidget {
  final String label;
  final String value;
  const _WeatherStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Colors.white70)),
        Text(value,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white)),
      ],
    );
  }
}

// ============================================================
// AI 준비물 제안 카드
// ============================================================

class _AiSuggestCard extends StatelessWidget {
  final String? suggestion;
  final bool isAnalyzing;
  final VoidCallback onAnalyze;

  const _AiSuggestCard({
    required this.suggestion,
    required this.isAnalyzing,
    required this.onAnalyze,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('✨',
                  style: TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              const Text('AI 준비물 제안',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827))),
              const Spacer(),
              GestureDetector(
                onTap: isAnalyzing ? null : onAnalyze,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF06B6D4).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: isAnalyzing
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF06B6D4)),
                        )
                      : const Text('분석',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF06B6D4))),
                ),
              ),
            ],
          ),
          if (suggestion != null) ...[
            const SizedBox(height: 10),
            Text(
              suggestion!,
              style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF374151),
                  height: 1.5),
            ),
          ] else ...[
            const SizedBox(height: 8),
            const Text(
              '날씨를 분석해서 오늘 챙겨야 할 준비물을 알려드립니다',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================
// 일정 준비물 카드
// ============================================================

class _PrepareCard extends StatelessWidget {
  final PrepareItem prepare;
  final VoidCallback onDelete;

  const _PrepareCard({required this.prepare, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final items = (jsonDecode(prepare.itemsJson) as List<dynamic>)
        .map((e) => e.toString())
        .toList();
    final date = DateTime.parse('${prepare.targetDate}T00:00:00');
    final dateStr = DateFormat('M월 d일 EEEE', 'ko').format(date);
    final isToday = prepare.targetDate ==
        DateFormat('yyyy-MM-dd').format(DateTime.now());

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isToday
              ? const Color(0xFF06B6D4)
              : const Color(0xFFE5E7EB),
          width: isToday ? 1.5 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF06B6D4).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text('📋', style: TextStyle(fontSize: 20)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      prepare.title,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827)),
                    ),
                    if (isToday) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF06B6D4).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('오늘',
                            style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF06B6D4))),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(dateStr,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: items
                      .map((item) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(item,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF374151))),
                          ))
                      .toList(),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline,
                size: 18, color: Color(0xFF9CA3AF)),
            onPressed: () => showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                title: const Text('삭제할까요?',
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('취소',
                          style: TextStyle(color: Color(0xFF6B7280)))),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      onDelete();
                    },
                    child: const Text('삭제',
                        style: TextStyle(color: Color(0xFFEF4444))),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 준비물 추가 바텀시트
// ============================================================

class _AddPrepareSheet extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _AddPrepareSheet({required this.onSaved});

  @override
  ConsumerState<_AddPrepareSheet> createState() => _AddPrepareSheetState();
}

class _AddPrepareSheetState extends ConsumerState<_AddPrepareSheet> {
  final _titleCtrl = TextEditingController();
  final _itemCtrl = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  final List<String> _items = [];
  bool _isSaving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _itemCtrl.dispose();
    super.dispose();
  }

  void _addItem() {
    final text = _itemCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _items.add(text);
      _itemCtrl.clear();
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
              primary: Color(0xFF06B6D4)),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('일정명을 입력해주세요')));
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('준비물을 하나 이상 추가해주세요')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final companion = PrepareItemsCompanion(
        prepareId: Value(const Uuid().v4()),
        userId: const Value('local_user'),
        targetDate: Value(dateStr),
        title: Value(_titleCtrl.text.trim()),
        itemsJson: Value(jsonEncode(_items)),
      );
      await ref.read(prepareRepositoryProvider).savePrepare(companion);
      widget.onSaved();
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('일정 준비물 추가',
                style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // 날짜
            const Text('날짜',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined,
                        size: 16, color: Color(0xFF6B7280)),
                    const SizedBox(width: 10),
                    Text(
                      DateFormat('yyyy년 M월 d일 EEEE', 'ko')
                          .format(_selectedDate),
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF111827)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),

            // 일정명
            const Text('일정명',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            TextField(
              controller: _titleCtrl,
              decoration: InputDecoration(
                hintText: '예: 출장, 병원, 등산',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: Color(0xFFE5E7EB))),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: Color(0xFFE5E7EB))),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: Color(0xFF06B6D4))),
              ),
            ),
            const SizedBox(height: 14),

            // 준비물 입력
            const Text('준비물',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _itemCtrl,
                    onSubmitted: (_) => _addItem(),
                    decoration: InputDecoration(
                      hintText: '준비물 입력 후 추가',
                      hintStyle: const TextStyle(
                          color: Color(0xFF9CA3AF), fontSize: 14),
                      filled: true,
                      fillColor: const Color(0xFFF9FAFB),
                      contentPadding: const EdgeInsets.all(12),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB))),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB))),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                              color: Color(0xFF06B6D4))),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _addItem,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF06B6D4),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('추가',
                      style: TextStyle(color: Colors.white)),
                ),
              ],
            ),

            if (_items.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _items
                    .asMap()
                    .entries
                    .map((e) => GestureDetector(
                          onTap: () =>
                              setState(() => _items.removeAt(e.key)),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF06B6D4)
                                  .withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(e.value,
                                    style: const TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF06B6D4))),
                                const SizedBox(width: 4),
                                const Icon(Icons.close,
                                    size: 13,
                                    color: Color(0xFF06B6D4)),
                              ],
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ],
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF06B6D4),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('저장',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 보조 위젯
// ============================================================

class _NoApiKeyCard extends StatelessWidget {
  final VoidCallback onTap;
  const _NoApiKeyCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF06B6D4).withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: const Color(0xFF06B6D4).withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Text('🌤️', style: TextStyle(fontSize: 24)),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('날씨 API 설정이 필요합니다',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF06B6D4))),
                  SizedBox(height: 2),
                  Text('탭하여 설정 페이지로 이동',
                      style: TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios,
                size: 14, color: Color(0xFF06B6D4)),
          ],
        ),
      ),
    );
  }
}

class _WeatherLoadingCard extends StatelessWidget {
  const _WeatherLoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: const Color(0xFF06B6D4).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Center(
          child: CircularProgressIndicator(
              strokeWidth: 2, color: Color(0xFF06B6D4))),
    );
  }
}

class _WeatherErrorCard extends StatelessWidget {
  const _WeatherErrorCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        children: [
          Text('⚠️', style: TextStyle(fontSize: 20)),
          SizedBox(width: 10),
          Text('날씨 정보를 불러올 수 없습니다',
              style:
                  TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }
}

class _EmptyPrepares extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyPrepares({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        children: [
          const Text('📋', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 10),
          const Text('등록된 일정 준비물이 없습니다',
              style:
                  TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onAdd,
            child: const Text('+ 준비물 추가하기',
                style: TextStyle(color: Color(0xFF06B6D4))),
          ),
        ],
      ),
    );
  }
}
