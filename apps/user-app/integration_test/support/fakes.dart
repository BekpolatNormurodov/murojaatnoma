// ignore_for_file: lines_longer_than_80_chars, deprecated_member_use
// The system photo picker cannot be driven, so its platform layer serves a
// prepared test file. Everything above it (picker widget, upload, API) is real.
// ignore_for_file: depend_on_referenced_packages
import 'dart:io';

import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// Directory on the host with `photo.jpg` (a simulator app can read it).
String fixturesDir = const String.fromEnvironment('E2E_FIXTURES');

/// Android qurilmasi kompyuter fayllarini o'qiy olmaydi: `E2E_FIXTURES`
/// mahalliy `http://127.0.0.1:...` manzil bo'lsa, fayllar avval yuklab olinadi.
Future<void> fetchFixtures(List<String> names) async {
  if (!fixturesDir.startsWith('http://127.0.0.1')) return;
  final target = Directory('${Directory.systemTemp.path}/e2e-fx')
    ..createSync(recursive: true);
  final client = HttpClient();
  for (final name in names) {
    final request = await client.getUrl(Uri.parse('$fixturesDir/$name'));
    final response = await request.close();
    if (response.statusCode != 200) continue;
    await response.pipe(File('${target.path}/$name').openWrite());
  }
  client.close();
  fixturesDir = target.path;
}

class FakeImagePicker extends ImagePickerPlatform
    with MockPlatformInterfaceMixin {
  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async {
    final copy = '${Directory.systemTemp.path}/photo.jpg';
    File('$fixturesDir/photo.jpg').copySync(copy);
    return XFile(copy);
  }
}

/// Answers camera permission requests without opening the system alert (it
/// cannot be pre-granted or dismissed from a test); other permissions are real.
class CameraDeniedPermissions extends PermissionHandlerPlatform
    with MockPlatformInterfaceMixin {
  CameraDeniedPermissions(this._real);
  final PermissionHandlerPlatform _real;

  @override
  Future<PermissionStatus> checkPermissionStatus(Permission permission) async =>
      permission == Permission.camera
      ? PermissionStatus.permanentlyDenied
      : _real.checkPermissionStatus(permission);

  @override
  Future<Map<Permission, PermissionStatus>> requestPermissions(
    List<Permission> permissions,
  ) async {
    final others = permissions.where((p) => p != Permission.camera).toList();
    return {
      if (others.isNotEmpty) ...await _real.requestPermissions(others),
      if (permissions.contains(Permission.camera))
        Permission.camera: PermissionStatus.permanentlyDenied,
    };
  }

  @override
  Future<bool> openAppSettings() async => true;
}
