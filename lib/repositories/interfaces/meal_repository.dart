import '../../core/database/app_database.dart';

abstract class MealRepository {
  /// 식사 기록 저장
  Future<MealRecord> saveMeal(MealRecordsCompanion meal);

  /// 날짜별 식사 기록 조회
  Future<List<MealRecord>> getMealsByDate(String userId, DateTime date);

  /// 식사 기록 삭제
  Future<void> deleteMeal(String mealId);
}
