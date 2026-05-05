import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../repository_providers.dart';

const _uuid = Uuid();
const _userId = 'local_user';

class CaptureRepository {
  final AppDatabase _db;
  CaptureRepository(this._db);

  // ── 1. CaptureItem 저장 ──
  Future<String> saveCaptureItem({
    required String sourceType, // voice | photo | text
    String? rawText,
    String? assetUri,
  }) async {
    final id = _uuid.v4();
    await _db.into(_db.captureItems).insert(
      CaptureItemsCompanion.insert(
        captureId: id,
        userId: _userId,
        sourceType: sourceType,
        rawText: Value(rawText),
        assetUri: Value(assetUri),
        status: const Value('captured'),
      ),
    );
    return id;
  }

  // ── 2. ExtractedCapture 저장 ──
  Future<String> saveExtractedCapture({
    required String captureId,
    required String domain,
    required Map<String, dynamic> entities,
    required double confidence,
  }) async {
    final id = _uuid.v4();
    await _db.into(_db.extractedCaptures).insert(
      ExtractedCapturesCompanion.insert(
        extractedId: id,
        captureId: captureId,
        domain: domain,
        entitiesJson: Value(entities.toString()),
        confidence: confidence,
      ),
    );
    return id;
  }

  // ── 3. 살림 → Transaction 저장 ──
  Future<void> saveTransaction({
    required String extractedId,
    required String direction, // 수입 | 지출
    required int amount,
    String? category,
    String? memo,
    DateTime? occurredAt,
  }) async {
    await _db.into(_db.transactions).insert(
      TransactionsCompanion.insert(
        transactionId: _uuid.v4(),
        userId: _userId,
        extractedId: Value(extractedId),
        direction: direction,
        amount: amount,
        category: Value(category),
        memo: Value(memo),
        occurredAt: Value(occurredAt ?? DateTime.now()),
        source: const Value('capture'),
      ),
    );
  }

  // ── 4. 메모 저장 ──
  Future<void> saveMemo({
    required String extractedId,
    required String content,
    String? tags,
  }) async {
    await _db.into(_db.memos).insert(
      MemosCompanion.insert(
        memoId: _uuid.v4(),
        userId: _userId,
        content: content,
        tags: Value(tags),
        extractedId: Value(extractedId),
        source: const Value('capture'),
      ),
    );
  }

  // ── 5. CaptureItem 상태 업데이트 ──
  Future<void> updateCaptureStatus(String captureId, String status) async {
    await (_db.update(_db.captureItems)
          ..where((t) => t.captureId.equals(captureId)))
        .write(CaptureItemsCompanion(status: Value(status)));
  }
}

// Provider
final captureRepositoryProvider = Provider<CaptureRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CaptureRepository(db);
});
