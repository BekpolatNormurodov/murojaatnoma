// ignore_for_file: lines_longer_than_80_chars, deprecated_member_use
// The iOS simulator has no camera and the system pickers cannot be driven, so
// the platform layer of the recorder and the pickers serves prepared test files.
// Everything above the platform interface (sheet, upload, API) is real.
// ignore_for_file: depend_on_referenced_packages
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:record_platform_interface/record_platform_interface.dart';

/// Directory on the host with `voice.m4a`, `video.mp4`, `photo.jpg` and the
/// documents (a simulator app can read host paths).
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

class FakeRecordPlatform
    with MockPlatformInterfaceMixin
    implements RecordPlatform {
  final Map<String, String> _paths = {};
  final Set<String> _active = {};

  @override
  Future<void> create(String recorderId) async {}

  @override
  Future<void> start(
    String recorderId,
    RecordConfig config, {
    required String path,
  }) async {
    try {
      File('$fixturesDir/voice.m4a').copySync(path);
    } on Object catch (e) {
      debugPrint('E2E_FAKE_RECORD start failed: $e');
      rethrow;
    }
    _paths[recorderId] = path;
    _active.add(recorderId);
  }

  @override
  Future<String?> stop(String recorderId) async {
    _active.remove(recorderId);
    return _paths.remove(recorderId);
  }

  @override
  Future<void> cancel(String recorderId) async {
    _active.remove(recorderId);
    _paths.remove(recorderId);
  }

  @override
  Future<bool> isRecording(String recorderId) async =>
      _active.contains(recorderId);

  @override
  Future<bool> isPaused(String recorderId) async => false;

  @override
  Future<Amplitude> getAmplitude(String recorderId) async =>
      Amplitude(current: -12, max: -6);

  @override
  Future<void> dispose(String recorderId) async {}

  @override
  Stream<RecordState> onStateChanged(String recorderId) =>
      const Stream<RecordState>.empty();

  @override
  dynamic noSuchMethod(Invocation invocation) {
    debugPrint('E2E_FAKE_RECORD unimplemented ${invocation.memberName}');
    return super.noSuchMethod(invocation);
  }
}

class FakeFilePicker extends FilePicker {
  String fileName = 'Dalolatnoma - Asaka mahallasi.pdf';

  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    dynamic Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = true,
    int compressionQuality = 30,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async {
    final copy = File('${Directory.systemTemp.path}/$fileName');
    File('$fixturesDir/document.pdf').copySync(copy.path);
    return FilePickerResult([
      PlatformFile(name: fileName, path: copy.path, size: copy.lengthSync()),
    ]);
  }
}

class FakeImagePicker extends ImagePickerPlatform
    with MockPlatformInterfaceMixin {
  XFile _copy(String name) {
    final copy = '${Directory.systemTemp.path}/$name';
    File('$fixturesDir/$name').copySync(copy);
    return XFile(copy);
  }

  @override
  Future<XFile?> getVideo({
    required ImageSource source,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
    Duration? maxDuration,
  }) async => _copy('video.mp4');

  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async => _copy('photo.jpg');
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
