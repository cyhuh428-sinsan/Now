import 'package:flutter/material.dart';

/// NowNote 도움말 화면.
///
/// Now의 `help_page.dart`와 카드 구조는 비슷하지만 내용은 NowNote 실제
/// 기능(오늘 메모, 계층 메모, 3단계 제한, 사진 입력, 그룹 메신저, 메모
/// 암호화, 서버 연결/단독 사용, 다크 모드)에 맞게 새로 썼다.
class HelpPage extends StatelessWidget {
  const HelpPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('도움말')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _HelpIntroCard(),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.today_outlined,
            title: '오늘 메모',
            description: '하루 한 개의 메모장에 문단을 계속 이어 씁니다.',
            points: [
              '날짜를 골라 그날의 메모를 확인하고 새 문단을 추가합니다.',
              '메모가 있는 날짜는 달력에 표시됩니다.',
              '사진을 넣으면 사진 읽기 설정에 등록한 LLM이 내용을 텍스트로 바꿔 줍니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.account_tree_outlined,
            title: '계층 메모',
            description: '주제별로 트리 구조의 메모를 만듭니다.',
            points: [
              '메모는 최대 3단계까지만 하위 메모를 가질 수 있습니다.',
              '3단계보다 더 깊게 나누고 싶으면 새 최상위 메모로 분리하세요.',
              '사진 입력은 오늘 메모와 같은 방식으로 편집기 안에서 바로 텍스트로 바뀝니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.chat_bubble_outline,
            title: '그룹 메신저',
            description: '같은 서버 그룹에 속한 사람들과 대화합니다.',
            points: [
              '서버 설정에서 서버 비밀번호로 로그인해야 메신저를 쓸 수 있습니다.',
              '방을 골라 메시지를 보내고, 5초마다 새 메시지를 자동으로 확인합니다.',
              '서버 연결이 없으면 메신저 화면에 안내 문구만 보이고 입력이 막힙니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.cloud_outlined,
            title: '서버 연결과 단독 사용',
            description: '서버에 연결하지 않고도 기기 안에서만 메모를 쓸 수 있습니다.',
            points: [
              '단독 사용은 설정 없이 바로 쓸 수 있고, 메모가 외부로 나가지 않습니다.',
              '여러 기기 동기화나 그룹 메신저가 필요하면 설정 > 서버 설정에서 연결하세요.',
              '서버 주소, 사용자 ID, 필요하면 비밀번호와 2단계 인증 코드가 필요합니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.lock_outline,
            title: '메모 암호화',
            description: '메모 단위로 암호화해서 저장할 수 있습니다.',
            points: [
              '암호화 키는 앱이나 서버에 저장하지 않습니다. 키를 잊으면 원문을 복구할 수 없습니다.',
              '같은 메모를 다른 기기나 프로그램에서 열려면 같은 키를 입력해야 합니다.',
            ],
          ),
          SizedBox(height: 14),
          _HelpSection(
            icon: Icons.dark_mode_outlined,
            title: '다크 모드',
            description: '설정 화면 위쪽에서 테마를 바로 바꿀 수 있습니다.',
            points: [
              '시스템, 라이트, 다크 3가지 중 골라 즉시 반영됩니다.',
              '고른 테마는 기기에 저장되어 앱을 다시 켜도 그대로 유지됩니다.',
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
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'NowNote는 오늘 메모와 계층 메모를 중심으로 하는 메모 앱입니다.',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '서버 없이 단독으로 쓰거나, 서버에 연결해 여러 기기와 그룹 메신저를 함께 씁니다.',
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: colorScheme.onPrimaryContainer,
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
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 18, color: colorScheme.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              description,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: colorScheme.onSurfaceVariant,
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
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        point,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.4,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
