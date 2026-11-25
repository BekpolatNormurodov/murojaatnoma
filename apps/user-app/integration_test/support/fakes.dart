// ignore_for_file: lines_longer_than_80_chars, deprecated_member_use
// The system photo picker cannot be driven, so its platform layer serves a
// prepared test file. Everything above it (picker widget, upload, API) is real.
// ignore_for_file: depend_on_referenced_packages
import 'dart:io';

import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// Directory on the host with `photo.jpg` (a simulator app can read it).
const fixturesDir = String.fromEnvironment('E2E_FIXTURES');

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
