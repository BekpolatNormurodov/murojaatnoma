import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// So'rovlarga qo'shiladigan telefon ma'lumoti — admin panelda kim qaysi
/// qurilma va ilova versiyasidan kirgani ko'rinadi.
class ClientHeaders {
  ClientHeaders._();

  /// [load] chaqirilmaguncha (testlar, mock rejim) bo'sh.
  static Map<String, String> value = const {};

  /// Hech qachon throw qilmaydi.
  static Future<void> load() async {
    try {
      final package = await PackageInfo.fromPlatform();
      String? device;
      if (defaultTargetPlatform == TargetPlatform.android) {
        final info = await DeviceInfoPlugin().androidInfo;
        device =
            '${info.manufacturer} ${info.model} '
            '(Android ${info.version.release})';
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final info = await DeviceInfoPlugin().iosInfo;
        device = '${info.modelName} (iOS ${info.systemVersion})';
      }
      value = build(
        platform: defaultTargetPlatform.name.toLowerCase(),
        version: '${package.version}+${package.buildNumber}',
        device: device,
      );
    } on Object catch (error) {
      debugPrint('[client-headers] $error');
    }
  }

  /// Sarlavha faqat ASCII qabul qiladi — qiymatlar kodlanadi.
  static Map<String, String> build({
    required String platform,
    required String version,
    String? device,
  }) => {
    'X-App-Platform': platform,
    'X-App-Version': Uri.encodeComponent(version),
    if (device != null) 'X-App-Device': Uri.encodeComponent(device),
  };
}
