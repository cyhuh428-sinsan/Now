import 'dart:convert';
import 'package:dio/dio.dart';
import 'interfaces/llm_repository.dart';
import 'models/llm_config.dart';

abstract class BaseLlmRepository implements LlmRepository {
  final Dio _dio;
  BaseLlmRepository() : _dio = Dio();
  Dio get dio => _dio;

  // ============================================================
  // chat() — 단순 텍스트 프롬프트 → 텍스트 응답
  // 각 구현체에서 override 필요
  // ============================================================

  @override
  Future<String> chat(String prompt);

  // ============================================================
  // 프롬프트 — 회의 종료 시점 날짜 포함, 실제 날짜 반환 요청
  // ============================================================

  String buildPrompt(List<String> segments, {String recordType = 'meeting', String participantName = ''}) {
    final now = DateTime.now();
    final today = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final weekday = ['월', '화', '수', '목', '금', '토', '일'][now.weekday - 1];

    final transcript = segments
        .asMap()
        .entries
        .map((e) => '${e.key + 1}. ${e.value}')
        .join('\n');

    // 유형별 프롬프트 분기
    final typeLabel = recordType == 'interview'
        ? '면담${participantName.isNotEmpty ? ' ($participantName)' : ''} 기록'
        : recordType == 'conversation'
            ? '중요 대화${participantName.isNotEmpty ? ' ($participantName)' : ''} 기록'
            : '회의 발언 기록';

    final ruleLabel = recordType == 'meeting'
        ? '- Action Item: 누군가가 해야 할 일\n- Decision: 회의에서 결정된 사항'
        : recordType == 'interview'
            ? '- Action Item: 면담에서 도출된 후속 조치\n- Decision: 면담에서 합의/결정된 사항'
            : '- Action Item: 대화에서 도출된 실행 항목\n- Decision: 합의된 사항 또는 중요 발언';

    return '''
다음은 $typeLabel 내용입니다. 발언자 구분 없이 대화 흐름 전체를 분석하여 Action Item과 Decision을 추출해주세요.

[오늘 날짜] $today ($weekday요일)

[대화 내용]
$transcript

[추출 규칙]
$ruleLabel
- 각 항목은 간결하게 한 문장으로 정리
- confidence는 0.0~1.0 사이 확신도
- dueDate는 반드시 "YYYY-MM-DD" 형식으로 변환해서 반환
  예: "목요일" → 오늘($today) 기준 이번 주 목요일 날짜
  예: "다음 주 월요일" → 실제 날짜
  예: 날짜 언급 없으면 null
- dueTime은 "HH:mm" 형식 또는 null

반드시 아래 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "itemType": "action",
      "content": "항목 내용",
      "confidence": 0.9,
      "ownerLabel": null,
      "dueDate": "2026-02-19",
      "dueTime": "14:00"
    }
  ]
}
''';
  }

  // ============================================================
  // 응답 파싱 — dueDate 형식 검증 및 보정
  // ============================================================

  List<LlmExtractedItem> parseResponse(String responseText) {
    try {
      final jsonMatch = RegExp(r'\{[\s\S]*\}').firstMatch(responseText);
      if (jsonMatch == null) return [];
      final json = jsonDecode(jsonMatch.group(0)!) as Map<String, dynamic>;
      final items = json['items'] as List<dynamic>? ?? [];
      return items.map((item) {
        final map = item as Map<String, dynamic>;
        final rawDate = map['dueDate'] as String?;
        return LlmExtractedItem(
          itemType: map['itemType'] as String? ?? 'action',
          content: map['content'] as String? ?? '',
          confidence: (map['confidence'] as num?)?.toDouble() ?? 0.8,
          ownerLabel: map['ownerLabel'] as String?,
          dueDate: _normalizeDate(rawDate),
          dueTime: map['dueTime'] as String?,
        );
      }).where((item) => item.content.isNotEmpty).toList();
    } catch (e) {
      return [];
    }
  }

  // ============================================================
  // 날짜 정규화
  // ============================================================

  String? _normalizeDate(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
    if (dateRegex.hasMatch(raw)) {
      final parts = raw.split('-');
      final year = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      final day = int.tryParse(parts[2]);
      if (year == null || month == null || day == null) return null;

      try {
        final parsed = DateTime(year, month, day);
        if (parsed.year == year && parsed.month == month && parsed.day == day) {
          return _fmt(parsed);
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    return _resolveRelativeDate(raw);
  }

  String? _resolveRelativeDate(String raw) {
    final now = DateTime.now();
    final lower = raw.trim();

    if (lower == '오늘') return _fmt(now);
    if (lower == '내일') return _fmt(now.add(const Duration(days: 1)));
    if (lower == '모레') return _fmt(now.add(const Duration(days: 2)));

    const weekdayMap = {
      '월요일': 1, '화요일': 2, '수요일': 3,
      '목요일': 4, '금요일': 5, '토요일': 6, '일요일': 7,
    };

    for (final entry in weekdayMap.entries) {
      if (lower.contains(entry.key)) {
        int target = entry.value;
        int current = now.weekday;
        int diff = target - current;
        if (lower.contains('다음 주') || lower.contains('다음주')) {
          diff += 7;
        } else if (diff <= 0) {
          diff += 7;
        }
        return _fmt(now.add(Duration(days: diff)));
      }
    }
    return null;
  }

  String _fmt(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
}
