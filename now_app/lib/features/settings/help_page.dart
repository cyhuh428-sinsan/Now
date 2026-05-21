import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HelpPage extends StatelessWidget {
  const HelpPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.chevron_left,
            color: Color(0xFF111827),
            size: 28,
          ),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '사용 안내',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _HelpIntroCard(),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.phone_android_outlined,
            title: '단독 사용자',
            description: '서버에 연결하지 않고 현재 기기 안에서만 메모를 저장합니다.',
            points: [
              '설정 없이 바로 사용할 수 있습니다.',
              '메모가 외부 서버로 올라가지 않습니다.',
              '주기적으로 DB 백업이나 Markdown 내보내기를 해두는 것이 좋습니다.',
              '서버 녹음 저장과 서버 분석 작업은 사용할 수 없습니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.cloud_outlined,
            title: '서버 연결 사용자',
            description: '개인 Docker 서버나 공용 NowNote 서버에 연결해 여러 기기와 동기화합니다.',
            points: [
              '서버 주소, API 토큰, 사용자 ID가 필요합니다.',
              '메모 동기화, 서버 백업, 녹음 저장, 분석 작업을 사용할 수 있습니다.',
              '서버 백업 검증으로 스키마, 체크섬, 필수 항목, 토큰 민감정보 노출 여부를 확인합니다.',
              '서버 설정 화면에서 최근 녹음과 분석 결과를 확인할 수 있습니다.',
              '개인 서버 사용자는 .env의 토큰과 DB 비밀번호를 반드시 변경해야 합니다.',
              '공용 서버 오픈 전에는 운영 점검에서 사용자별 접속 토큰 강제 설정, 공개 HTTPS, reverse proxy 환경을 확인해야 합니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.edit_note_outlined,
            title: '모바일 앱 기준',
            description: '모바일은 빠른 입력과 음성 메모가 중심입니다.',
            points: [
              '홈에서 오늘 메모를 빠르게 확인하고 추가합니다.',
              '일자별 메모는 하루 한 개의 메모장에 계속 추가합니다.',
              '계층 메모는 필요한 주제만 3단계 구조로 정리합니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.backup_outlined,
            title: '백업과 가져오기',
            description: '백업과 가져오기는 목적이 다릅니다.',
            points: [
              'DB 백업은 NowNote 모바일 앱 전체 데이터를 복원할 때 사용합니다.',
              'Markdown 가져오기는 외부 .md/.txt 파일을 새 지식 메모로 추가합니다.',
              '가져온 파일은 원본과 연결하지 않으며, 삭제해도 원본 파일은 남습니다.',
              'Android 자동 클라우드 백업에는 개인 기록과 서버 접속 정보를 포함하지 않습니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.privacy_tip_outlined,
            title: '권한과 개인정보',
            description: '권한은 필요한 기능을 사용할 때만 요청합니다.',
            points: [
              '마이크는 음성 메모와 음성 기록에 사용합니다.',
              '카메라와 사진은 캡처, 식사, 패션, 여행 같은 생활 기록에 사용합니다.',
              '캘린더와 Health Connect는 사용자가 허용한 경우에만 조회합니다.',
              '서버 연결을 켠 경우에만 메모, 녹음, 분석 입력이 지정한 서버로 전송될 수 있습니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.lock_outline,
            title: '암호화 저장',
            description: '암호화 저장은 현재 1차 범위에서는 켜지지 않습니다.',
            points: [
              '향후 서버 로그인 사용자 전용 선택 기능으로 제공하고 기본값은 꺼짐으로 둡니다.',
              '암호화된 메모는 서버 운영자도 원문을 읽을 수 없어야 합니다.',
              '암호화 메모는 기본적으로 LLM 분석에서 제외합니다.',
            ],
          ),
          SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _HelpIntroCard extends StatelessWidget {
  const _HelpIntroCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'NowNote는 로컬 전용으로도, 서버 연결 방식으로도 사용할 수 있습니다.',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1E3A8A),
            ),
          ),
          SizedBox(height: 8),
          Text(
            '처음에는 단독 사용자로 시작하고, 여러 기기 동기화나 서버 분석이 필요해지면 서버를 연결하는 흐름을 권장합니다.',
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: Color(0xFF1D4ED8),
            ),
          ),
        ],
      ),
    );
  }
}

class _HelpSection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final List<String> points;

  const _HelpSection({
    required this.icon,
    required this.title,
    required this.description,
    required this.points,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 18, color: const Color(0xFF2563EB)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF111827),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            description,
            style: const TextStyle(
              fontSize: 13,
              height: 1.45,
              color: Color(0xFF4B5563),
            ),
          ),
          const SizedBox(height: 10),
          ...points.map(
            (point) => Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.only(top: 7, right: 8),
                    decoration: const BoxDecoration(
                      color: Color(0xFF2563EB),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      point,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
