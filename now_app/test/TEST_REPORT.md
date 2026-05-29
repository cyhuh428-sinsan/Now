# Now 앱 테스트 보고서

작성일: 2026-05-30
테스터: Claude Sonnet 4.6 (전문 테스터 역할)
대상: now_app (Flutter / Dart)

---

## 1. 테스트 개요

초기 테스트 작성 단계에서는 기존 소스 코드를 수정하지 않고, 신규 테스트 파일만 추가하여 도메인별 핵심 비즈니스 로직을 검증했습니다.
테스트 방식은 Drift 인메모리 SQLite DB를 이용한 **단위 테스트(Unit Test)** 입니다.

---

## 2. 신규 작성 테스트 파일 목록

| 파일 경로 | 대상 클래스 | 테스트 수 |
|---|---|---|
| `test/repositories/capture_repository_test.dart` | CaptureRepository | 7 |
| `test/repositories/local_context_repository_test.dart` | LocalContextRepository | 5 |
| `test/repositories/local_health_repository_test.dart` | LocalHealthRepository | 11 |
| `test/repositories/local_meal_repository_test.dart` | LocalMealRepository | 5 |
| `test/repositories/transaction_repository_extended_test.dart` | TransactionRepository | 8 |

**신규 추가 합계: 36개 테스트**

---

## 3. 기존 테스트 파일 (변경 없음)

| 파일 경로 | 대상 | 테스트 수 |
|---|---|---|
| `test/repositories/local_routine_repository_test.dart` | LocalRoutineRepository | 2 |
| `test/repositories/transaction_repository_test.dart` | TransactionRepository | 2 |
| `test/services/trip_service_test.dart` | TripService | 3 |
| `test/widget_test.dart` | AppBottomNav | 1 |
| `test/features/*` | HomePage, SettingsPage 등 | 複数 |

---

## 4. 테스트 항목 상세

### 4-1. CaptureRepository (`capture_repository_test.dart`)

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | saveCaptureItem creates a record and returns an id | 캡처 저장 후 고유 ID 반환 및 DB 저장 확인 |
| 2 | saveCaptureItem defaults status to captured | 저장 시 기본 상태값 'captured' 확인 |
| 3 | saveExtractedCapture creates a linked extraction record | 캡처와 연결된 추출 결과 저장 확인 |
| 4 | saveTransaction creates a transaction record | 살림 거래 저장 및 source='capture' 확인 |
| 5 | saveMemo creates a memo record | 메모 저장 및 tags, source 확인 |
| 6 | updateCaptureStatus changes the status field | 상태 업데이트 동작 확인 |
| 7 | multiple captures can be saved independently | 복수 캡처 독립 저장 확인 |

### 4-2. LocalContextRepository (`local_context_repository_test.dart`)

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | saveContext stores and returns record | 컨텍스트 저장 및 반환값 확인 |
| 2 | getContextsByDate returns only contexts for the given date | 날짜 필터링 동작 확인 |
| 3 | getContextsByDate returns empty when no records for date | 데이터 없을 때 빈 리스트 반환 |
| 4 | getLatestContext returns the most recent record | 최신 컨텍스트 조회 (recordedAt 기준) |
| 5 | getLatestContext returns null when no records exist | 데이터 없을 때 null 반환 |

### 4-3. LocalHealthRepository (`local_health_repository_test.dart`)

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | saveMedication stores and returns record | 약 복용 저장 및 반환값 확인 |
| 2 | getMedicationsByDate filters by date | 날짜 기준 필터링 확인 |
| 3 | deleteMedication removes the record | 삭제 동작 확인 |
| 4 | saveExercise stores and returns record | 운동 기록 저장 확인 |
| 5 | getExercisesByDate filters by date | 운동 날짜 필터링 확인 |
| 6 | deleteExercise removes the record | 운동 기록 삭제 확인 |
| 7 | saveSleep stores and returns record | 수면 기록 저장 및 반환값 확인 |
| 8 | updateSleep changes qualityScore | 수면 품질 점수 수정 확인 |
| 9 | deleteSleep removes the record | 수면 기록 삭제 확인 |
| 10 | saveHospital with amount creates linked transaction | 병원비 있을 때 살림 지출 자동 생성 확인 |
| 11 | saveHospital without amount does not create transaction | 병원비 없을 때 거래 미생성 확인 |

### 4-4. LocalMealRepository (`local_meal_repository_test.dart`)

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | saveMeal stores and returns a meal record | 식사 저장 및 반환값 확인 |
| 2 | getMealsByDate returns only meals for the given date | 날짜 기준 필터링 확인 |
| 3 | deleteMeal removes the meal record | 식사 기록 삭제 확인 |
| 4 | deleteMeal also removes linked transaction | 식사 삭제 시 연결된 거래도 함께 삭제 확인 |
| 5 | updateMeal syncs amount to linked transaction | 식사 금액 수정 시 연결 거래 동기화 확인 |

### 4-5. TransactionRepository 확장 (`transaction_repository_extended_test.dart`)

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | getByMonth returns only transactions in the given month | 월별 필터링 동작 확인 |
| 2 | getMonthlySummary calculates income and expense correctly | 수입/지출 합계 계산 정확성 확인 |
| 3 | getMonthlySummary returns zeros when no transactions | 데이터 없을 때 0 반환 확인 |
| 4 | updateTransaction updates amount and memo | 금액 및 메모 수정 확인 |
| 5 | updateTransaction syncs amount to linked meal record | 거래 수정 시 연결 식사 금액 동기화 확인 |
| 6 | deleteTransaction removes the record | 거래 삭제 확인 |
| 7 | deleteTransaction also deletes linked meal record | 거래 삭제 시 연결 식사 기록도 삭제 확인 |
| 8 | getCategoryTotals groups expense by category | 카테고리별 지출 집계 정확성 확인 |

---

## 5. 테스트 실행 결과

```
flutter test test/repositories/ --reporter=expanded

40개 테스트 모두 통과 (Pass)
실행 시간: 약 20초
```

### 전체 결과 요약

| 구분 | 수량 |
|---|---|
| 신규 테스트 파일 | 5개 |
| 신규 테스트 케이스 | 36개 |
| 기존 테스트 케이스 (repositories/) | 4개 |
| **레포지토리 테스트 합계** | **40개** |
| 통과 | 40개 |
| 실패 | 0개 |

---

## 6. 테스트 전략 및 방법

### 사용 기술
- `flutter_test` — Dart 표준 테스트 프레임워크
- `drift/native.dart` — `NativeDatabase.memory()` 인메모리 SQLite (테스트 격리)
- `AppDatabase.forTesting()` — 프로덕션 DB 우회, 인메모리 DB 주입

### 원칙
- 기존 소스 파일 **무수정** — 테스트 파일만 신규 추가
- 각 테스트는 독립적 `setUp / tearDown` 으로 DB 상태 격리
- 비즈니스 규칙(연동 삭제, 금액 동기화, 날짜 필터)에 집중한 **블랙박스** 검증

### 커버리지 대상 비즈니스 규칙
1. **Cascade 삭제**: 식사 삭제 → 연결 거래 삭제, 루틴 삭제 → 완료 기록 삭제
2. **금액 동기화**: 식사/거래 금액 수정 시 상호 동기화
3. **중복 방지**: 같은 날짜에 루틴 완료 중복 저장 방지
4. **날짜 필터링**: 각 도메인의 날짜 범위 조회 정확성
5. **병원비 → 거래 자동 생성**: 병원비 입력 시 살림 지출 자동 연동
6. **집계 정확성**: 월별 수입/지출 합계, 카테고리별 집계

---

## 7. 미커버 영역 (향후 테스트 추천)

| 영역 | 이유 |
|---|---|
| 서비스 레이어 (BriefingService, HealthSyncService) | LLM 의존성으로 Mock 객체 필요 |
| Widget 테스트 (MealPage, HealthPage 등) | Riverpod Provider 오버라이드 필요 |
| 통합 테스트 (e2e) | 기기/에뮬레이터 환경 필요 |
| Python 서버 API | 별도 pytest 환경 구성 필요 |

---

## 8. 어울 보완 결과

작성일: 2026-05-30

### 확인 결과
- `flutter test test/repositories/ --reporter=expanded`: 40개 통과
- `flutter test --reporter=expanded`: 기존 Widget 테스트 3개가 현재 UI와 맞지 않아 실패 확인
- 보완 후 `flutter test --reporter=expanded`: 56개 통과

### 보완 내용
- HomePage 테스트: 현재 홈 화면의 스크롤 구조에 맞게 브리핑, 루틴, 할 일, 일정 항목을 순서대로 스크롤하며 검증하도록 수정
- SettingsPage 테스트: 현재 설정 화면의 섹션/타일 표시 방식과 버전 표기에 맞게 기대값 수정
- 설정 화면 백업 카드: 테스트 환경처럼 DB 경로 확인이 실패하는 경우 화면 전체가 깨지지 않고 `-`로 표시되도록 방어 처리
- 테스트 보고서 수량 정정: 신규 테스트 36개, 기존 repository 테스트 4개, 합계 40개
