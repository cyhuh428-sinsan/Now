import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_android/image_picker_android.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:nownote/features/photo_source_sheet.dart';

void main() {
  testWidgets('갤러리 선택 전에 Android 사진 선택기를 활성화한다', (tester) async {
    final previous = ImagePickerPlatform.instance;
    final androidPicker = ImagePickerAndroid();
    ImagePickerPlatform.instance = androidPicker;
    addTearDown(() => ImagePickerPlatform.instance = previous);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showPhotoSourceSheet(context),
              child: const Text('사진'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('사진'));
    await tester.pumpAndSettle();
    expect(androidPicker.useAndroidPhotoPicker, isTrue);
  });

  for (final (label, source) in [
    ('갤러리에서 선택', ImageSource.gallery),
    ('카메라로 촬영', ImageSource.camera),
  ]) {
    testWidgets('$label 항목은 해당 사진 출처를 반환한다', (tester) async {
      ImageSource? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  selected = await showPhotoSourceSheet(context);
                },
                child: const Text('사진'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('사진'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();

      expect(selected, source);
      expect(find.text(label), findsNothing);
    });
  }
}
