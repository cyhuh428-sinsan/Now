import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';
import '../interfaces/item_repository.dart';

class LocalItemRepository implements ItemRepository {
  final AppDatabase _db;

  LocalItemRepository(this._db);

  @override
  Future<void> saveItems(List<ExtractedItem> items) async {
    await _db.batch((batch) {
      batch.insertAll(_db.extractedItems, items,
          mode: InsertMode.insertOrReplace);
    });
  }

  @override
  Future<List<ExtractedItem>> getItemsByMeeting(String meetingId) async {
    return await (_db.select(_db.extractedItems)
          ..where((t) => t.meetingId.equals(meetingId))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  @override
  Future<List<ExtractedItem>> getTodayPendingItems(String userId) async {
    // confirmed 또는 scheduled 상태의 미완료 아이템
    return await (_db.select(_db.extractedItems)
          ..where((t) =>
              t.status.equals('confirmed') | t.status.equals('scheduled'))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  @override
  Future<void> confirmItem(String itemId) async {
    await (_db.update(_db.extractedItems)
          ..where((t) => t.itemId.equals(itemId)))
        .write(ExtractedItemsCompanion(
      status: const Value('confirmed'),
      confirmedAt: Value(DateTime.now()),
      updatedAt: Value(DateTime.now()),
    ));
  }

  @override
  Future<void> archiveItem(String itemId) async {
    await (_db.update(_db.extractedItems)
          ..where((t) => t.itemId.equals(itemId)))
        .write(ExtractedItemsCompanion(
      status: const Value('archived'),
      archivedAt: Value(DateTime.now()),
      updatedAt: Value(DateTime.now()),
    ));
  }

  @override
  Future<void> completeItem(String itemId) async {
    await (_db.update(_db.extractedItems)
          ..where((t) => t.itemId.equals(itemId)))
        .write(ExtractedItemsCompanion(
      status: const Value('completed'),
      completedAt: Value(DateTime.now()),
      updatedAt: Value(DateTime.now()),
    ));
  }
}
