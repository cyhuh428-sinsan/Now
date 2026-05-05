import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/database/app_database.dart';
import '../repositories/local/trip_repository.dart';
import '../llm/providers/llm_providers.dart';

class TripService {
  final TripRepository _repo;
  final dynamic _llm;

  TripService(this._repo, this._llm);

  // ── LLM 일정 추천 ──
  Future<Map<String, dynamic>> suggestItinerary({
    required String destination,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    if (_llm == null) return {};
    final days = endDate.difference(startDate).inDays + 1;
    final nights = days > 0 ? days - 1 : 0;
    final prompt = '''
여행지: $destination
기간: ${nights}박 ${days}일 (${startDate.month}/${startDate.day} ~ ${endDate.month}/${endDate.day})

위 여행에 맞는 일정과 준비물을 추천해주세요.

반드시 아래 JSON 형식으로만 응답:
{
  "dayPlans": [
    {"day": 1, "date": "${startDate.month}/${startDate.day}", "plans": ["오전: ...", "오후: ...", "저녁: ..."]},
    {"day": 2, "date": "...", "plans": ["..."]}
  ],
  "checklist": [
    {"category": "서류", "items": ["여권", "항공권 출력"]},
    {"category": "짐", "items": ["상의 3벌", "하의 2벌"]},
    {"category": "기타", "items": ["환전", "유심"]}
  ]
}
''';
    try {
      final response = await _llm.chat(prompt);
      final jsonStr = RegExp(r'\{[\s\S]*\}').firstMatch(response)?.group(0);
      if (jsonStr == null) return {};
      return jsonDecode(jsonStr) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  // ── LLM 여행 요약 생성 ──
  Future<String?> generateTripSummary({
    required Trip trip,
    required List<TripDayPlan> dayPlans,
    required List<TripChecklist> checklists,
    required int totalExpense,
  }) async {
    if (_llm == null) return null;
    final days = trip.endDate.difference(trip.startDate).inDays + 1;
    final donePlans = dayPlans.where((p) => p.status == 'done').length;
    final prompt = '''
여행 요약을 작성해주세요.

여행명: ${trip.name}
목적지: ${trip.destination}
기간: $days일
예산: ${trip.budgetTotal}원 / 실지출: ${totalExpense}원
일정 완료율: $donePlans/${dayPlans.length}

감성적이고 따뜻한 여행 후기 요약을 3~5문장으로 작성해주세요. JSON 없이 텍스트만 응답하세요.
''';
    try {
      return await _llm.chat(prompt);
    } catch (_) {
      return null;
    }
  }
}

final tripServiceProvider = Provider<TripService>((ref) {
  final repo = ref.watch(tripRepositoryProvider);
  final llm = ref.watch(llmRepositoryProvider).valueOrNull;
  return TripService(repo, llm);
});
