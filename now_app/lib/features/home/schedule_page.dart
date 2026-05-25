import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:drift/drift.dart' as drift;
import 'package:uuid/uuid.dart';

import '../../core/database/app_database.dart';
import '../../repositories/repository_providers.dart';

class SchedulePage extends ConsumerStatefulWidget {
  const SchedulePage({super.key});

  @override
  ConsumerState<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends ConsumerState<SchedulePage> {
  DateTime _selectedDate = DateTime.now();
  bool _isSyncing = false; // 동기화 로딩 상태

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        // ▼▼▼ [수정] 디자인 통일: iOS 스타일 꺽쇠 아이콘 적용 ▼▼▼
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 18, color: Color(0xFF111827)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text("일정 관리",
            style: TextStyle(
                fontWeight: FontWeight.bold, 
                fontSize: 18, 
                color: Color(0xFF111827) // 타이틀 색상도 통일
            )),
        centerTitle: true, // 타이틀 중앙 정렬 (선호하시면 유지, 아니면 false)
      ),
      body: Column(
        children: [
          // 1. 날짜 및 동기화 헤더
          _buildDateHeader(),

          // 2. 일정 리스트
          Expanded(
            child: FutureBuilder<List<CalendarEvent>>(
              // 날짜가 바뀌거나 화면이 갱신될 때마다 DB 조회
              future: ref
                  .watch(localCalendarEventRepositoryProvider)
                  .getEventsByDate(_selectedDate),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_busy, size: 48, color: Colors.grey[300]),
                        const SizedBox(height: 12),
                        Text(
                          "${DateFormat('M월 d일').format(_selectedDate)} 일정이 없습니다.",
                          style: const TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  );
                }

                final events = snapshot.data!;
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: events.length,
                  itemBuilder: (context, index) {
                    final event = events[index];
                    return _buildEventCard(event);
                  },
                );
              },
            ),
          ),
        ],
      ),
      // 3. 일정 추가 버튼 (우측 하단)
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showEditDialog(context, null), // null = 새 일정
        backgroundColor: const Color(0xFF2563EB),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  /// ============================================================
  /// 위젯 구현부
  /// ============================================================

  // 1. 날짜 헤더 (동기화 버튼 포함)
  Widget _buildDateHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () => setState(() =>
                _selectedDate = _selectedDate.subtract(const Duration(days: 1))),
          ),
          Expanded(
            child: Center(
              child: InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2030),
                  );
                  if (picked != null) setState(() => _selectedDate = picked);
                },
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Text(
                    DateFormat('yyyy년 M월 d일 (E)', 'ko').format(_selectedDate),
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black),
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () => setState(() =>
                _selectedDate = _selectedDate.add(const Duration(days: 1))),
          ),
          // ★ 동기화 버튼
          if (_isSyncing)
            const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2))
          else
            IconButton(
              icon: const Icon(Icons.sync, color: Color(0xFF2563EB)),
              tooltip: '구글 캘린더 연동 (현재 월)',
              onPressed: _syncCurrentMonth,
            ),
        ],
      ),
    );
  }

  // 2. 일정 카드 아이템
  Widget _buildEventCard(CalendarEvent event) {
    // 구글 캘린더 연동 데이터인지 확인
    final isDevice = event.source == 'device';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 4,
          height: 40,
          decoration: BoxDecoration(
            // 구글 연동은 초록색, 직접 등록은 파란색 등 구분 가능
            color: isDevice ? const Color(0xFF10B981) : const Color(0xFF2563EB),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        title: Text(
          event.title,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          "${DateFormat('HH:mm').format(event.startTime)} ~ ${DateFormat('HH:mm').format(event.endTime)}  ${isDevice ? '(구글 연동)' : ''}",
          style: TextStyle(color: Colors.grey[600], fontSize: 13),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (value) {
            if (value == 'edit') _showEditDialog(context, event);
            if (value == 'delete') _deleteEvent(event);
          },
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'edit', child: Text('수정')),
            const PopupMenuItem(
                value: 'delete',
                child: Text('삭제', style: TextStyle(color: Colors.red))),
          ],
        ),
        onTap: () => _showEditDialog(context, event),
      ),
    );
  }

  /// ============================================================
  /// 기능 로직 구현부
  /// ============================================================

  // 1. 구글 캘린더 동기화 실행
  Future<void> _syncCurrentMonth() async {
    setState(() => _isSyncing = true);
    try {
      final repo = ref.read(localCalendarEventRepositoryProvider);
      final count = await repo.syncEventsByMonth(_selectedDate);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DateFormat('M월').format(_selectedDate)} 일정 $count개를 가져왔습니다.')),
        );
        setState(() {}); // 화면 갱신 (FutureBuilder 재호출)
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('동기화 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  // 2. 일정 삭제
  Future<void> _deleteEvent(CalendarEvent event) async {
    await ref
        .read(localCalendarEventRepositoryProvider)
        .deleteEvent(event.calendarEventId);
    setState(() {}); // 목록 갱신
  }

  // 3. 일정 추가/수정 다이얼로그 표시
  void _showEditDialog(BuildContext context, CalendarEvent? event) {
    final isEditing = event != null;
    final titleCtrl = TextEditingController(text: event?.title ?? '');

    // 시작 시간: 기존 시간 또는 현재 시간의 다음 정각
    DateTime start = event?.startTime ??
        DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day,
            DateTime.now().hour + 1);
    
    // 종료 시간: 시작 1시간 뒤
    DateTime end = event?.endTime ?? start.add(const Duration(hours: 1));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true, // 키보드 올라왔을 때 대응
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        // 다이얼로그 내부에서 상태(시간 변경 등)를 갱신하기 위해 StatefulBuilder 사용
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(
                20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isEditing ? '일정 수정' : '새 일정',
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                
                // 제목 입력
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                    labelText: '일정 제목',
                    hintText: '예: 개발팀 회의',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  autofocus: true,
                ),
                const SizedBox(height: 16),
                
                // 시간 선택 영역
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.access_time),
                        label: Text(DateFormat('HH:mm').format(start)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () async {
                          final time = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.fromDateTime(start));
                          if (time != null) {
                            setModalState(() {
                              start = DateTime(start.year, start.month,
                                  start.day, time.hour, time.minute);
                              // 시작 시간이 종료 시간보다 늦으면 종료 자동 조정
                              if (end.isBefore(start)) {
                                end = start.add(const Duration(hours: 1));
                              }
                            });
                          }
                        },
                      ),
                    ),
                    const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text("~",
                            style: TextStyle(fontWeight: FontWeight.bold))),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.access_time),
                        label: Text(DateFormat('HH:mm').format(end)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () async {
                          final time = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.fromDateTime(end));
                          if (time != null) {
                            setModalState(() {
                              end = DateTime(end.year, end.month, end.day,
                                  time.hour, time.minute);
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                
                // 저장 버튼
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () async {
                      if (titleCtrl.text.trim().isEmpty) return;

                      // DB 모델 생성
                      final entry = CalendarEventsCompanion(
                        calendarEventId: drift.Value(
                            isEditing ? event.calendarEventId : const Uuid().v4()),
                        userId: const drift.Value('local_user'),
                        title: drift.Value(titleCtrl.text),
                        startTime: drift.Value(start),
                        endTime: drift.Value(end),
                        source: drift.Value(isEditing ? event.source : 'manual'),
                      );

                      final repo = ref.read(localCalendarEventRepositoryProvider);
                      
                      if (isEditing) {
                        await repo.updateEvent(entry);
                      } else {
                        await repo.createEvent(entry);
                      }

                      Navigator.pop(ctx);
                      setState(() {}); // 리스트 갱신
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('저장',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
