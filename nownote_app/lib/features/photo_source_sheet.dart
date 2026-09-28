import 'package:flutter/material.dart';
import 'package:image_picker_android/image_picker_android.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';

Future<ImageSource?> showPhotoSourceSheet(BuildContext context) {
  final picker = ImagePickerPlatform.instance;
  if (picker is ImagePickerAndroid) {
    picker.useAndroidPhotoPicker = true;
  }
  return showModalBottomSheet<ImageSource>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('갤러리에서 선택'),
            onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined),
            title: const Text('카메라로 촬영'),
            onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
          ),
        ],
      ),
    ),
  );
}
