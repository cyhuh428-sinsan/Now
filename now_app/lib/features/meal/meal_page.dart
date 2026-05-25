import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../core/database/app_database.dart';
import '../../repositories/repository_providers.dart';
import '../../repositories/local/capture_repository.dart';
import '../../llm/providers/llm_providers.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/app_bottom_nav.dart';

// ============================================================
// 상수
// ============================================================

const _mealTypes = [
  _MealTypeInfo('breakfast', '아침', '🌅', '07:00 - 09:00'),
  _MealTypeInfo('lunch', '점심', '☀️', '11:30 - 13:30'),
  _MealTypeInfo('dinner', '저녁', '🌙', '18:00 - 20:00'),
  _MealTypeInfo('snack', '간식', '☕', '언제든지'),
];
const _localUserId = 'local_user';

class _MealTypeInfo {
  final String value;
  final String label;
  final String emoji;
  final String timeHint;
  const _MealTypeInfo(this.value, this.label, this.emoji, this.timeHint);
}

// ============================================================
// Provider
// ============================================================

final todayMealsProvider =
    FutureProvider.autoDispose<List<MealRecord>>((ref) async {
  final repo = ref.watch(mealRepositoryProvider);
  return repo.getMealsByDate(_localUserId, DateTime.now());
});


final recentMealsProvider =
    FutureProvider.autoDispose<Map<String, List<MealRecord>>>((ref) async {
  final repo = ref.watch(mealRepositoryProvider);
  final today = DateTime.now();
  final Map<String, List<MealRecord>> result = {};
  for (int i = 1; i <= 7; i++) {
    final date = today.subtract(Duration(days: i));
    final meals = await repo.getMealsByDate(_localUserId, date);
    if (meals.isNotEmpty) {
      final key = DateFormat('M월 d일 EEEE', 'ko').format(date);
      result[key] = meals;
    }
  }
  return result;
});

// ============================================================
// 식사 기록 탭 화면
// ============================================================

class MealPage extends ConsumerWidget {
  const MealPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mealsAsync = ref.watch(todayMealsProvider);
    final now = DateTime.now();
    final dateStr = DateFormat('M월 d일 EEEE', 'ko').format(now);

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
          '식사 기록',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // 헤더 (날짜만)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: Text(
                  dateStr,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ),
            ),

            // 식사 섹션 목록
            mealsAsync.when(
              data: (meals) => SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final mealType = _mealTypes[index];
                    final typeMeals = meals
                        .where((m) => m.mealType == mealType.value)
                        .toList();
                    return _MealSection(
                      mealType: mealType,
                      meals: typeMeals,
                      onAdd: () => _showAddSheet(context, ref,
                          initialType: mealType.value),
                      onDelete: (mealId) async {
                        await ref
                            .read(mealRepositoryProvider)
                            .deleteMeal(mealId);
                        ref.invalidate(todayMealsProvider);
                      },
                    );
                  },
                  childCount: _mealTypes.length,
                ),
              ),
              loading: () => const SliverToBoxAdapter(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: Center(child: Text('오류: $e')),
              ),
            ),

            // 이전 식사 기록
            SliverToBoxAdapter(
              child: _RecentMealsSection(ref: ref),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddSheet(context, ref),
        backgroundColor: const Color(0xFF2563EB),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          '식사 기록',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      bottomNavigationBar: const AppBottomNav(selectedIndex: 1),
    );
  }

  void _showAddSheet(BuildContext context, WidgetRef ref,
      {String? initialType}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddMealSheet(
        initialType: initialType,
        onSaved: () => ref.invalidate(todayMealsProvider),
      ),
    );
  }
}

// ============================================================
// 이전 식사 기록 섹션
// ============================================================

class _RecentMealsSection extends ConsumerWidget {
  final WidgetRef ref;
  const _RecentMealsSection({required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recentAsync = ref.watch(recentMealsProvider);
    return recentAsync.when(
      data: (grouped) {
        if (grouped.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Divider(height: 32, color: Color(0xFFE5E7EB)),
              const Text(
                '이전 기록',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 12),
              ...grouped.entries.map((entry) => _RecentDayGroup(
                    dateLabel: entry.key,
                    meals: entry.value,
                  )),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _RecentDayGroup extends StatelessWidget {
  final String dateLabel;
  final List<MealRecord> meals;
  const _RecentDayGroup({required this.dateLabel, required this.meals});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            dateLabel,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 8),
          ...meals.map((meal) => _RecentMealTile(meal: meal)),
        ],
      ),
    );
  }
}

class _RecentMealTile extends StatelessWidget {
  final MealRecord meal;
  const _RecentMealTile({required this.meal});

  String get _typeLabel {
    return switch (meal.mealType) {
      'breakfast' => '🌅 아침',
      'lunch' => '☀️ 점심',
      'dinner' => '🌙 저녁',
      'snack' => '☕ 간식',
      _ => '🍽️ 식사',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Text(_typeLabel,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              meal.description ?? '기록 없음',
              style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (meal.amount != null) ...[
            const SizedBox(width: 8),
            Text(
              '${NumberFormat('#,###').format(meal.amount)}원',
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================
// 식사 섹션
// ============================================================

class _MealSection extends StatelessWidget {
  final _MealTypeInfo mealType;
  final List<MealRecord> meals;
  final VoidCallback onAdd;
  final void Function(String mealId) onDelete;

  const _MealSection({
    required this.mealType,
    required this.meals,
    required this.onAdd,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 섹션 헤더
          Row(
            children: [
              Text(mealType.emoji,
                  style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(
                mealType.label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                mealType.timeHint,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF9CA3AF),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onAdd,
                child: const Icon(Icons.add_circle_outline,
                    size: 20, color: Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 기록 없음
          if (meals.isEmpty)
            _EmptyMealCard(onTap: onAdd)
          else
            ...meals.map((meal) => _MealCard(
                  meal: meal,
                  onDelete: () => onDelete(meal.mealId),
                )),
        ],
      ),
    );
  }
}

// ============================================================
// 빈 식사 카드
// ============================================================

class _EmptyMealCard extends StatelessWidget {
  final VoidCallback onTap;

  const _EmptyMealCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFFE5E7EB),
            style: BorderStyle.solid,
          ),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, size: 16, color: Color(0xFF9CA3AF)),
            SizedBox(width: 6),
            Text(
              '기록 추가',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 식사 카드
// ============================================================

class _MealCard extends ConsumerWidget {
  final MealRecord meal;
  final VoidCallback onDelete;

  const _MealCard({required this.meal, required this.onDelete});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          // 사진
          if (meal.photoPath != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.file(
                File(meal.photoPath!),
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _PhotoPlaceholder(),
              ),
            )
          else
            _PhotoPlaceholder(),
          const SizedBox(width: 12),
          // 정보
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meal.description ?? '설명 없음',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF111827),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.access_time,
                        size: 12, color: Color(0xFF9CA3AF)),
                    const SizedBox(width: 3),
                    Text(
                      DateFormat('HH:mm').format(meal.eatenAt),
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF)),
                    ),
                    if (meal.locationLabel != null) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.location_on_outlined,
                          size: 12, color: Color(0xFF9CA3AF)),
                      const SizedBox(width: 2),
                      Text(
                        meal.locationLabel!,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF9CA3AF)),
                      ),
                    ],
                  ],
                ),
                if (meal.amount != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '₩${NumberFormat('#,###').format(meal.amount!)}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: meal.isAmountEstimated
                              ? const Color(0xFF9CA3AF)
                              : const Color(0xFF2563EB),
                        ),
                      ),
                      if (meal.isAmountEstimated) ...[
                        const SizedBox(width: 3),
                        const Text('(예측)',
                            style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF9CA3AF))),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          // 수정
          IconButton(
            icon: const Icon(Icons.edit_outlined,
                size: 18, color: Color(0xFF9CA3AF)),
            onPressed: () => _showEditDialog(context, ref),
          ),
          // 삭제
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
    );
  }

  void _showEditDialog(BuildContext context, WidgetRef ref) {
    final descCtrl = TextEditingController(text: meal.description ?? '');
    final amountCtrl = TextEditingController(
        text: meal.amount != null ? meal.amount.toString() : '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('수정', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(labelText: '메뉴'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '금액', suffix: Text('원')),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final amount = int.tryParse(amountCtrl.text.replaceAll(',', ''));
              await (ref.read(mealRepositoryProvider) as dynamic).updateMeal(
                meal.mealId,
                description: descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
                amount: amount,
              );
              ref.invalidate(todayMealsProvider);
            },
            child: const Text('저장', style: TextStyle(color: Color(0xFF2563EB))),
          ),
        ],
      ),
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(Icons.restaurant_outlined,
          size: 24, color: Color(0xFF9CA3AF)),
    );
  }
}

// ============================================================
// 식사 추가 바텀 시트
// ============================================================

class _AddMealSheet extends ConsumerStatefulWidget {
  final String? initialType;
  final VoidCallback onSaved;

  const _AddMealSheet({this.initialType, required this.onSaved});

  @override
  ConsumerState<_AddMealSheet> createState() => _AddMealSheetState();
}

class _AddMealSheetState extends ConsumerState<_AddMealSheet> {
  late String _selectedType;
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  final TextEditingController _amountController = TextEditingController();
  XFile? _pickedImage;
  bool _isSaving = false;
  bool _isEstimating = false;
  bool _isAmountEstimated = false;

  @override
  void initState() {
    super.initState();
    _selectedType = widget.initialType ?? 'lunch';
  }

  @override
  void dispose() {
    _descController.dispose();
    _locationController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: source, imageQuality: 80);
    if (image != null) setState(() => _pickedImage = image);
  }

  Future<void> _estimateAmount() async {
    final desc = _descController.text.trim();
    final location = _locationController.text.trim();
    if (desc.isEmpty && location.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음식 설명이나 장소를 먼저 입력해주세요')),
      );
      return;
    }

    setState(() => _isEstimating = true);
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (!mounted) return;
      if (repo == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요')),
        );
        return;
      }

      final mealLabel = _mealTypes
          .firstWhere((t) => t.value == _selectedType,
              orElse: () => _mealTypes[1])
          .label;

      final prompt = '''
다음 식사 정보를 보고 한국 평균 가격을 추정해주세요.
식사 종류: $mealLabel
${desc.isNotEmpty ? '메뉴: $desc' : ''}
${location.isNotEmpty ? '장소: $location' : ''}

규칙:
- 숫자만 답하세요 (예: 12000)
- 단위, 설명, 기호 없이 숫자만
- 원화 기준
''';

      final result = await repo.chat(prompt);
      final cleaned = result.replaceAll(RegExp(r'[^0-9]'), '');
      if (cleaned.isNotEmpty && mounted) {
        setState(() {
          _amountController.text = cleaned;
          _isAmountEstimated = true;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('예측 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isEstimating = false);
    }
  }

  Future<void> _save() async {
    if (_descController.text.trim().isEmpty && _pickedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('사진이나 설명을 입력해주세요')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final rawAmount = _amountController.text.trim().replaceAll(',', '');
      final parsedAmount = rawAmount.isEmpty ? null : int.tryParse(rawAmount);

      final meal = MealRecordsCompanion(
        mealId: Value(const Uuid().v4()),
        userId: const Value(_localUserId),
        eatenAt: Value(DateTime.now()),
        mealType: Value(_selectedType),
        photoPath: Value(_pickedImage?.path),
        description: Value(_descController.text.trim().isEmpty
            ? null
            : _descController.text.trim()),
        locationLabel: Value(_locationController.text.trim().isEmpty
            ? null
            : _locationController.text.trim()),
        amount: Value(parsedAmount),
        isAmountEstimated: Value(_isAmountEstimated),
      );

      final savedMeal = await ref.read(mealRepositoryProvider).saveMeal(meal);
      // 금액이 있으면 살림 지출에도 저장
      if (parsedAmount != null && parsedAmount > 0) {
        await ref.read(captureRepositoryProvider).saveTransaction(
          extractedId: savedMeal.mealId,
          direction: '지출',
          amount: parsedAmount,
          category: '식비',
          memo: _descController.text.trim().isEmpty ? null : _descController.text.trim(),
        );
      }
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
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // 핸들
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '식사 기록',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            // 식사 종류 선택
            const Text('식사 종류',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            Row(
              children: _mealTypes.map((type) {
                final isSelected = _selectedType == type.value;
                return Expanded(
                  child: GestureDetector(
                    onTap: () =>
                        setState(() => _selectedType = type.value),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF2563EB)
                            : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          Text(type.emoji,
                              style: const TextStyle(fontSize: 16)),
                          const SizedBox(height: 2),
                          Text(
                            type.label,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // 사진
            const Text('사진 (선택)',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            Row(
              children: [
                // 선택된 사진
                if (_pickedImage != null)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(
                          File(_pickedImage!.path),
                          width: 80,
                          height: 80,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () =>
                              setState(() => _pickedImage = null),
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close,
                                size: 12, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                if (_pickedImage == null) ...[
                  // 카메라
                  _PhotoButton(
                    icon: Icons.camera_alt_outlined,
                    label: '카메라',
                    onTap: () => _pickImage(ImageSource.camera),
                  ),
                  const SizedBox(width: 8),
                  // 갤러리
                  _PhotoButton(
                    icon: Icons.photo_library_outlined,
                    label: '갤러리',
                    onTap: () => _pickImage(ImageSource.gallery),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),

            // 메모
            const Text('메모',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            TextField(
              controller: _descController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: '먹은 음식을 기록해보세요 (예: 된장찌개, 밥, 김치)',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFF2563EB)),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 장소
            const Text('장소 (선택)',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            TextField(
              controller: _locationController,
              decoration: InputDecoration(
                hintText: '예: 회사 구내식당, 집',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                prefixIcon: const Icon(Icons.location_on_outlined,
                    size: 18, color: Color(0xFF9CA3AF)),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFF2563EB)),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 금액
            Row(
              children: [
                const Text('금액 (선택)',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280))),
                const Spacer(),
                GestureDetector(
                  onTap: _isEstimating ? null : _estimateAmount,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7C3AED).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: _isEstimating
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF7C3AED)),
                          )
                        : const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('✨', style: TextStyle(fontSize: 12)),
                              SizedBox(width: 3),
                              Text('AI 예측',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF7C3AED))),
                            ],
                          ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() => _isAmountEstimated = false),
              decoration: InputDecoration(
                hintText: '예: 12000',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                prefixIcon: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                  child: Text('₩',
                      style: TextStyle(
                          fontSize: 16,
                          color: Color(0xFF6B7280),
                          fontWeight: FontWeight.w600)),
                ),
                prefixIconConstraints:
                    const BoxConstraints(minWidth: 0, minHeight: 0),
                suffixText: '원',
                suffixStyle: const TextStyle(
                    fontSize: 14, color: Color(0xFF6B7280)),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFF2563EB)),
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
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        '저장',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 사진 버튼
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
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 24, color: const Color(0xFF6B7280)),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 11, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }
}
