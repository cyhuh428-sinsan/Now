import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:sqflite/sqflite.dart' show getDatabasesPath;
import '../core/database/app_database.dart';

// ============================================================
// 백업/복원 서비스
// ============================================================

class BackupService {
  static const _dbName = 'now_app_db';

  // ── DB 파일 경로 (Drift가 실제로 저장하는 위치) ──
  static Future<String> _dbFilePath() async {
    final dir = await getDatabasesPath();
    return p.join(dir, _dbName);
  }

  // ──────────────────────────────────────────────
  // 내보내기: DB 파일 → Share 시트 (구글 드라이브, 카카오톡 등)
  // ──────────────────────────────────────────────
  static Future<void> exportDb() async {
    final dbPath = await _dbFilePath();
    final dbFile = File(dbPath);
    if (!await dbFile.exists()) {
      throw Exception('DB 파일을 찾을 수 없습니다.\n데이터가 아직 없을 수 있습니다.');
    }

    // 임시 디렉터리에 날짜 이름으로 복사
    final tempDir = await getTemporaryDirectory();
    final now = DateFormat('yyyyMMdd_HHmm').format(DateTime.now());
    final exportFile = File(p.join(tempDir.path, 'now_backup_$now.db'));
    await dbFile.copy(exportFile.path);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(exportFile.path, mimeType: 'application/octet-stream')],
        subject: 'Now App 백업 ${DateFormat('yyyy.MM.dd').format(DateTime.now())}',
        text: 'Now App 데이터 백업 파일입니다.\n복원: 설정 > 데이터 관리 > 가져오기',
      ),
    );
  }

  // ──────────────────────────────────────────────
  // 가져오기: .db 파일 선택 → 현재 DB 교체 후 앱 재시작 필요
  // 반환: true=성공, false=취소
  // ──────────────────────────────────────────────
  static Future<bool> importDb(AppDatabase db) async {
    // 파일 선택
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any, // .db 확장자 필터가 플랫폼마다 다름
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty) return false;

    final srcPath = result.files.first.path;
    if (srcPath == null) return false;

    // .db 파일 여부 확인
    if (!srcPath.toLowerCase().endsWith('.db')) {
      throw Exception('.db 형식의 백업 파일만 가져올 수 있습니다.');
    }

    final destPath = await _dbFilePath();

    // 현재 DB 연결 종료 → 파일 교체
    await db.close();
    await File(srcPath).copy(destPath);

    return true; // 앱 재시작 필요
  }

  // ──────────────────────────────────────────────
  // 백업 파일 크기 조회 (UI 표시용)
  // ──────────────────────────────────────────────
  static Future<String> dbFileSize() async {
    final file = File(await _dbFilePath());
    if (!await file.exists()) return '-';
    final bytes = await file.length();
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  // ──────────────────────────────────────────────
  // 앱 강제 종료 (가져오기 후 재시작용)
  // ──────────────────────────────────────────────
  static Future<void> restartApp() async {
    await SystemNavigator.pop();
  }
}

// ============================================================
// Provider
// ============================================================

final backupServiceProvider = Provider<BackupService>((ref) {
  return BackupService();
});
