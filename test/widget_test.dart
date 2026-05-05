import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_app/widgets/app_bottom_nav.dart';

void main() {
  testWidgets('AppBottomNav shows all primary tabs', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          bottomNavigationBar: AppBottomNav(selectedIndex: 0),
        ),
      ),
    );

    expect(find.text('홈'), findsOneWidget);
    expect(find.text('일상'), findsOneWidget);
    expect(find.text('살림'), findsOneWidget);
    expect(find.text('여행'), findsOneWidget);
    expect(find.text('기록'), findsOneWidget);
  });
}
