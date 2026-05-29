import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/capture_repository.dart';

void main() {
  group('CaptureRepository', () {
    late AppDatabase database;
    late CaptureRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = CaptureRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('saveCaptureItem creates a record and returns an id', () async {
      final id = await repository.saveCaptureItem(
        sourceType: 'text',
        rawText: '오늘 점심 비빔밥 9000원',
      );

      expect(id, isNotEmpty);

      final items = await database.select(database.captureItems).get();
      expect(items.length, 1);
      expect(items.first.captureId, id);
      expect(items.first.sourceType, 'text');
      expect(items.first.rawText, '오늘 점심 비빔밥 9000원');
    });

    test('saveCaptureItem defaults status to captured', () async {
      final id = await repository.saveCaptureItem(sourceType: 'voice');

      final item = await (database.select(database.captureItems)
            ..where((t) => t.captureId.equals(id)))
          .getSingle();
      expect(item.status, 'captured');
    });

    test('saveExtractedCapture creates a linked extraction record', () async {
      final captureId = await repository.saveCaptureItem(sourceType: 'text');

      final extractedId = await repository.saveExtractedCapture(
        captureId: captureId,
        domain: '살림',
        entities: {'direction': '지출', 'amount': 9000},
        confidence: 0.95,
      );

      expect(extractedId, isNotEmpty);

      final records = await database.select(database.extractedCaptures).get();
      expect(records.length, 1);
      expect(records.first.captureId, captureId);
      expect(records.first.domain, '살림');
      expect(records.first.confidence, 0.95);
    });

    test('saveTransaction creates a transaction record', () async {
      final captureId = await repository.saveCaptureItem(sourceType: 'text');
      final extractedId = await repository.saveExtractedCapture(
        captureId: captureId,
        domain: '살림',
        entities: {},
        confidence: 0.9,
      );

      await repository.saveTransaction(
        extractedId: extractedId,
        direction: '지출',
        amount: 15000,
        category: '식비',
        memo: '저녁 삼겹살',
      );

      final txs = await database.select(database.transactions).get();
      expect(txs.length, 1);
      expect(txs.first.direction, '지출');
      expect(txs.first.amount, 15000);
      expect(txs.first.category, '식비');
      expect(txs.first.source, 'capture');
    });

    test('saveMemo creates a memo record', () async {
      final captureId = await repository.saveCaptureItem(sourceType: 'text');
      final extractedId = await repository.saveExtractedCapture(
        captureId: captureId,
        domain: '메모',
        entities: {},
        confidence: 0.8,
      );

      await repository.saveMemo(
        extractedId: extractedId,
        content: '내일 미팅 준비물 챙기기',
        tags: '업무,미팅',
      );

      final memos = await database.select(database.memos).get();
      expect(memos.length, 1);
      expect(memos.first.content, '내일 미팅 준비물 챙기기');
      expect(memos.first.tags, '업무,미팅');
      expect(memos.first.source, 'capture');
    });

    test('updateCaptureStatus changes the status field', () async {
      final id = await repository.saveCaptureItem(sourceType: 'voice');

      await repository.updateCaptureStatus(id, 'done');

      final item = await (database.select(database.captureItems)
            ..where((t) => t.captureId.equals(id)))
          .getSingle();
      expect(item.status, 'done');
    });

    test('multiple captures can be saved independently', () async {
      await repository.saveCaptureItem(sourceType: 'text', rawText: '첫 번째');
      await repository.saveCaptureItem(sourceType: 'photo');
      await repository.saveCaptureItem(sourceType: 'voice');

      final items = await database.select(database.captureItems).get();
      expect(items.length, 3);
    });
  });
}
