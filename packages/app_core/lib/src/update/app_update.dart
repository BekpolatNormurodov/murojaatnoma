import 'dart:async';

import 'package:app_core/src/config/app_config.dart';
import 'package:app_core/src/update/update_installer.dart';
import 'package:app_core/src/update/update_sheet.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Saytga chiqarilgan APK (`/downloads/manifest.json` dagi yozuv).
@immutable
class AppRelease {
  const AppRelease({
    required this.version,
    required this.build,
    required this.url,
    this.size = 0,
    this.sha256,
    this.notes = const [],
    this.required = false,
  });

  final String version;
  final int build;
  final Uri url;

  /// Baytlarda; 0 — noma'lum.
  final int size;
  final String? sha256;

  /// Nima yangilangani.
  final List<String> notes;

  /// O'rnatilgan versiya endi qo'llab-quvvatlanmaydi — kechiktirib bo'lmaydi.
  final bool required;
}

/// O'rnatilgan ilovadan yangiroq APK saytda borligini tekshiradi.
class UpdateChecker {
  UpdateChecker({
    required this.appKey,
    Uri? manifest,
    Dio? dio,
    Future<int> Function()? currentBuild,
  }) : manifest =
           manifest ??
           Uri.parse(AppConfig.apiBaseUrl).resolve('/downloads/manifest.json'),
       _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 10),
               receiveTimeout: const Duration(seconds: 10),
             ),
           ),
       _currentBuild = currentBuild ?? _installedBuild;

  /// Manifestdagi kalit: `worker` yoki `user`.
  final String appKey;
  final Uri manifest;
  final Dio _dio;
  final Future<int> Function() _currentBuild;

  /// Ilova ishga tushganda o'rnatiladi; `null` — tekshiruv o'chiq (testlar,
  /// mock rejim).
  static UpdateChecker? instance;

  static Future<int> _installedBuild() async =>
      int.parse((await PackageInfo.fromPlatform()).buildNumber);

  /// Yangiroq versiya bo'lsa uni, aks holda `null`. Hech qachon throw
  /// qilmaydi.
  Future<AppRelease?> check() async {
    try {
      final response = await _dio.getUri<dynamic>(manifest);
      final apps = (response.data as Map<String, dynamic>)['apps'];
      final entry = (apps as Map<String, dynamic>)[appKey];
      if (entry is! Map<String, dynamic>) return null;
      final build = entry['build'] as int;
      final current = await _currentBuild();
      if (build <= current) return null;
      final size = entry['size'];
      final sha = entry['sha256'];
      final notes = entry['notes'];
      final minBuild = entry['minBuild'];
      return AppRelease(
        version: entry['version'] as String,
        build: build,
        url: manifest.resolve(Uri.encodeComponent(entry['file'] as String)),
        size: size is int ? size : 0,
        sha256: sha is String ? sha : null,
        notes: notes is List ? notes.whereType<String>().toList() : const [],
        required: minBuild is int && current < minBuild,
      );
    } on Object catch (error) {
      debugPrint('[update] $error');
      return null;
    }
  }
}

/// Yangi versiya chiqqanda ilova ustida yangilash oynasini ko'rsatadi. Ishga
/// tushishda va ilovaga qaytishda tekshiradi.
class UpdateGate extends StatefulWidget {
  const UpdateGate({
    required this.child,
    this.checker,
    this.installer,
    this.openInBrowser,
    super.key,
  });

  /// "Keyinroq" bosilgach shu versiya haqida qayta eslatish oralig'i.
  static const Duration remindAfter = Duration(hours: 4);

  final Widget child;

  /// Standart — [UpdateChecker.instance].
  final UpdateChecker? checker;
  final UpdateInstaller? installer;

  /// Ilova ichida yuklab bo'lmaganda zaxira yo'l.
  final Future<void> Function(Uri url)? openInBrowser;

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> with WidgetsBindingObserver {
  AppRelease? _release;
  int? _postponed;
  DateTime? _postponedAt;
  bool _checking = false;
  late final UpdateInstaller _installer = widget.installer ?? UpdateInstaller();

  UpdateChecker? get _checker => widget.checker ?? UpdateChecker.instance;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_check());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(_check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _check() async {
    final checker = _checker;
    if (checker == null || _checking) return;
    _checking = true;
    var release = await checker.check();
    _checking = false;
    // Tekshirib bo'lmadi (oflayn) — ochiq turgan oyna yopilmaydi.
    if (release == null && _release != null) return;
    final at = _postponedAt;
    if (release != null &&
        !release.required &&
        release.build == _postponed &&
        at != null &&
        DateTime.now().difference(at) < UpdateGate.remindAfter) {
      release = null;
    }
    if (mounted) setState(() => _release = release);
  }

  void _later() => setState(() {
    _postponed = _release?.build;
    _postponedAt = DateTime.now();
    _release = null;
  });

  @override
  Widget build(BuildContext context) {
    final release = _release;
    return Stack(
      children: [
        ExcludeSemantics(excluding: release != null, child: widget.child),
        if (release != null)
          Positioned.fill(
            child: UpdateSheet(
              // Yuklash holati versiyaga bog'liq.
              key: ValueKey(release.build),
              release: release,
              installer: _installer,
              onLater: release.required ? null : _later,
              openInBrowser: widget.openInBrowser,
            ),
          ),
      ],
    );
  }
}
