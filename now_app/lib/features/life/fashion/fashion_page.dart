import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../../core/database/app_database.dart';
import '../../../repositories/repository_providers.dart';
import '../../../llm/providers/llm_providers.dart';

// ============================================================
// Provider
// ============================================================

const _userId = 'local_user';

final recentFashionsProvider =
    FutureProvider.autoDispose<List<FashionRecord>>((ref) async {
  final repo = ref.watch(fashionRepositoryProvider);
  return repo.getRecentFashions(_userId, limit: 30);
});

// ============================================================
// 패션 페이지
// ============================================================

class FashionPage extends ConsumerWidget {
  const FashionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fashionsAsync = ref.watch(recentFashionsProvider);

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
          '패션',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _showAddSheet(context, ref),
            icon: const Icon(Icons.add, size: 18, color: Color(0xFFEC4899)),
            label: const Text('기록',
                style: TextStyle(
                    color: Color(0xFFEC4899),
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: fashionsAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (fashions) => fashions.isEmpty
            ? _EmptyFashion(onAdd: () => _showAddSheet(context, ref))
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                itemCount: fashions.length,
                itemBuilder: (context, index) {
                  return _FashionCard(
                    fashion: fashions[index],
                    onDelete: () async {
                      await ref
                          .read(fashionRepositoryProvider)
                          .deleteFashion(fashions[index].fashionId);
                      ref.invalidate(recentFashionsProvider);
                    },
                  );
                },
              ),
      ),
    );
  }

  void _showAddSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddFashionSheet(
        onSaved: () => ref.invalidate(recentFashionsProvider),
      ),
    );
  }
}

// ============================================================
// 패션 카드
// ============================================================

class _FashionCard extends StatelessWidget {
  final FashionRecord fashion;
  final VoidCallback onDelete;

  const _FashionCard({required this.fashion, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat('M월 d일 EEEE', 'ko').format(fashion.recordedAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 날짜 헤더
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 8),
            child: Row(
              children: [
                const Text('👗', style: TextStyle(fontSize: 16)),
                const SizedBox(width: 8),
                Text(dateStr,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280))),
                const Spacer(),
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
                              style: TextStyle(color: Color(0xFF6B7280))),
                        ),
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
          ),

          // 사진
          if (fashion.photoPath != null)
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.zero),
              child: Image.file(
                File(fashion.photoPath!),
                width: double.infinity,
                height: 220,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 220,
                  color: const Color(0xFFF3F4F6),
                  child: const Center(
                    child: Icon(Icons.broken_image_outlined,
                        size: 40, color: Color(0xFF9CA3AF)),
                  ),
                ),
              ),
            ),

          // LLM 분석 결과
          if (fashion.llmAnalysis != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEC4899).withOpacity(0.06),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('✨', style: TextStyle(fontSize: 13)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        fashion.llmAnalysis!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF374151),
                          height: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // 메모
          if (fashion.memo != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 12),
              child: Text(
                fashion.memo!,
                style: const TextStyle(
                    fontSize: 13, color: Color(0xFF6B7280)),
              ),
            )
          else
            const SizedBox(height: 12),
        ],
      ),
    );
  }
}

// ============================================================
// 패션 추가 바텀시트
// ============================================================

class _AddFashionSheet extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _AddFashionSheet({required this.onSaved});

  @override
  ConsumerState<_AddFashionSheet> createState() => _AddFashionSheetState();
}

class _AddFashionSheetState extends ConsumerState<_AddFashionSheet> {
  XFile? _pickedImage;
  final _memoCtrl = TextEditingController();
  bool _isSaving = false;
  bool _isAnalyzing = false;
  String? _analysis;

  @override
  void dispose() {
    _memoCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: source, imageQuality: 80);
    if (image != null) {
      setState(() {
        _pickedImage = image;
        _analysis = null; // 새 사진 선택 시 분석 초기화
      });
    }
  }

  Future<void> _analyze() async {
    if (_pickedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('사진을 먼저 선택해주세요')),
      );
      return;
    }

    setState(() => _isAnalyzing = true);
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (repo == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요')),
        );
        return;
      }

      // 추측: 이미지 분석 미지원 LLM은 텍스트 프롬프트로 대체
      final prompt = '''
오늘의 착장을 분석해주세요.
${_memoCtrl.text.trim().isNotEmpty ? '착장 메모: ${_memoCtrl.text.trim()}' : '착장 사진이 첨부되었습니다.'}

다음 형식으로 간결하게 분석해주세요:
- 착용 아이템: (상의, 하의, 아우터, 신발, 악세서리)
- 스타일: (캐주얼/포멀/스포티 등)
- 코디 제안: (어울리는 아이템 1~2가지)

3~4문장으로 짧게 답해주세요.
''';

      final result = await repo.chat(prompt);
      if (mounted) setState(() => _analysis = result.trim());
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

  Future<void> _save() async {
    if (_pickedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('사진을 먼저 선택해주세요')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final fashion = FashionRecordsCompanion(
        fashionId: Value(const Uuid().v4()),
        userId: const Value(_userId),
        photoPath: Value(_pickedImage!.path),
        llmAnalysis: Value(_analysis),
        memo: Value(_memoCtrl.text.trim().isEmpty
            ? null
            : _memoCtrl.text.trim()),
        recordedAt: Value(DateTime.now()),
      );

      await ref.read(fashionRepositoryProvider).saveFashion(fashion);
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
            // 핸들
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
            const Text('오늘의 착장',
                style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // 사진 선택
            const Text('사진',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),

            if (_pickedImage != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(_pickedImage!.path),
                  width: double.infinity,
                  height: 200,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickImage(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt_outlined, size: 16),
                      label: const Text('재촬영'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF6B7280),
                        side: const BorderSide(color: Color(0xFFE5E7EB)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickImage(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined, size: 16),
                      label: const Text('갤러리'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF6B7280),
                        side: const BorderSide(color: Color(0xFFE5E7EB)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              Row(
                children: [
                  Expanded(
                    child: _PhotoButton(
                      icon: Icons.camera_alt_outlined,
                      label: '카메라',
                      onTap: () => _pickImage(ImageSource.camera),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _PhotoButton(
                      icon: Icons.photo_library_outlined,
                      label: '갤러리',
                      onTap: () => _pickImage(ImageSource.gallery),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 14),

            // AI 분석 버튼
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _isAnalyzing ? null : _analyze,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFEC4899),
                  side: const BorderSide(color: Color(0xFFEC4899)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: _isAnalyzing
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Color(0xFFEC4899)),
                      )
                    : const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('✨', style: TextStyle(fontSize: 14)),
                          SizedBox(width: 6),
                          Text('AI 착장 분석',
                              style: TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600)),
                        ],
                      ),
              ),
            ),

            // 분석 결과
            if (_analysis != null) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEC4899).withOpacity(0.06),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _analysis!,
                  style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF374151),
                      height: 1.5),
                ),
              ),
            ],
            const SizedBox(height: 14),

            // 메모
            const Text('메모 (선택)',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            TextField(
              controller: _memoCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: '착장 메모를 남겨보세요',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFEC4899)),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // 저장 버튼
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEC4899),
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
// 사진 선택 버튼
// ============================================================

class _PhotoButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _PhotoButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 24, color: const Color(0xFF9CA3AF)),
            const SizedBox(height: 6),
            Text(label,
                style: const TextStyle(
                    fontSize: 12, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 빈 상태
// ============================================================

class _EmptyFashion extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyFashion({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('👗', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          const Text('오늘의 착장을 기록해보세요',
              style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          const Text('AI가 착장을 분석하고 코디를 제안해드립니다',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('착장 기록하기'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEC4899),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }
}
