import 'dart:async';

import 'package:app_core/src/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Saytga chiqarilgan APK (`/downloads/manifest.json` dagi yozuv).
@immutable
class AppRelease {
  const AppRelease({
    required this.version,
    required this.build,
    required this.url,
  });

  final String version;
  final int build;
  final Uri url;
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
      if (build <= await _currentBuild()) return null;
      return AppRelease(
        version: entry['version'] as String,
        build: build,
        url: manifest.resolve(Uri.encodeComponent(entry['file'] as String)),
      );
    } on Object catch (error) {
      debugPrint('[update] $error');
      return null;
    }
  }
}

/// Yangi versiya chiqqanda ilova ustida taklif ko'rsatadi. Ishga tushishda va
/// ilovaga qaytishda tekshiradi.
class UpdateGate extends StatefulWidget {
  const UpdateGate({required this.child, this.checker, this.open, super.key});

  /// "Keyinroq" bosilgach shu versiya haqida qayta eslatish oralig'i.
  static const Duration remindAfter = Duration(hours: 4);

  final Widget child;

  /// Standart — [UpdateChecker.instance].
  final UpdateChecker? checker;

  /// APK havolasini ochadi (standart — brauzer).
  final Future<void> Function(Uri url)? open;

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> with WidgetsBindingObserver {
  AppRelease? _release;
  int? _postponed;
  DateTime? _postponedAt;
  bool _checking = false;

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
    final at = _postponedAt;
    if (release != null &&
        release.build == _postponed &&
        at != null &&
        DateTime.now().difference(at) < UpdateGate.remindAfter) {
      release = null;
    }
    if (mounted) setState(() => _release = release);
  }

  Future<void> _download(Uri url) async {
    final open = widget.open;
    if (open != null) return open(url);
    await launchUrl(url, mode: LaunchMode.externalApplication);
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
        widget.child,
        if (release != null) Positioned.fill(child: _card(context, release)),
      ],
    );
  }

  Widget _card(BuildContext context, AppRelease release) {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final theme = Theme.of(context);
    return ColoredBox(
      key: const Key('app_update_card'),
      color: Colors.black54,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.system_update, size: 40),
                    const SizedBox(height: 12),
                    Text(
                      ru ? 'Вышла новая версия' : 'Yangi versiya chiqdi',
                      style: theme.textTheme.titleLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      ru
                          ? 'Версия ${release.version}. Скачайте файл и '
                                'установите поверх приложения — вход '
                                'сохранится.'
                          : '${release.version} versiya. Faylni yuklab olib, '
                                'ilova ustidan o‘rnating — qayta kirish '
                                'shart emas.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => unawaited(_download(release.url)),
                      child: Text(ru ? 'Скачать' : 'Yuklab olish'),
                    ),
                    TextButton(
                      onPressed: _later,
                      child: Text(ru ? 'Позже' : 'Keyinroq'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
