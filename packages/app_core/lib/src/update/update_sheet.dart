import 'dart:async';
import 'dart:io';

import 'package:app_core/src/update/app_update.dart';
import 'package:app_core/src/update/update_installer.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

enum _Stage { offer, downloading, ready, failed }

/// Yangilash oynasi: nima yangi → yuklash (foizi bilan) → o'rnatish.
class UpdateSheet extends StatefulWidget {
  const UpdateSheet({
    required this.release,
    required this.installer,
    this.onLater,
    this.openInBrowser,
    super.key,
  });

  final AppRelease release;
  final UpdateInstaller installer;

  /// `null` — majburiy yangilanish, "Keyinroq" ko'rsatilmaydi.
  final VoidCallback? onLater;
  final Future<void> Function(Uri url)? openInBrowser;

  @override
  State<UpdateSheet> createState() => _UpdateSheetState();
}

class _UpdateSheetState extends State<UpdateSheet> {
  _Stage _stage = _Stage.offer;
  double _progress = 0;
  File? _file;
  CancelToken? _cancel;

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  Future<void> _download() async {
    final cancel = _cancel = CancelToken();
    setState(() {
      _stage = _Stage.downloading;
      _progress = 0;
    });
    try {
      final file = await widget.installer.download(
        widget.release,
        cancel: cancel,
        onProgress: (value) {
          // Har baytda emas — har 1% da qayta chiziladi.
          if (mounted && (value - _progress >= 0.01 || value >= 1)) {
            setState(() => _progress = value);
          }
        },
      );
      if (!mounted || cancel.isCancelled) return;
      setState(() {
        _file = file;
        _stage = _Stage.ready;
      });
      await _install();
    } on Object catch (error) {
      debugPrint('[update] download: $error');
      if (mounted && !cancel.isCancelled) {
        setState(() => _stage = _Stage.failed);
      }
    }
  }

  Future<void> _install() async {
    final file = _file;
    if (file == null) return;
    var opened = false;
    try {
      opened = await widget.installer.install(file);
    } on Object catch (error) {
      debugPrint('[update] install: $error');
    }
    if (!opened && mounted) setState(() => _stage = _Stage.failed);
  }

  void _stop() {
    _cancel?.cancel();
    setState(() => _stage = _Stage.offer);
  }

  Future<void> _browser() async {
    final url = widget.release.url;
    final open = widget.openInBrowser;
    if (open != null) return open(url);
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  static String _mb(num bytes) => '${(bytes / 1048576).round()} MB';

  @override
  Widget build(BuildContext context) {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final release = widget.release;

    return Material(
      key: const Key('app_update_card'),
      color: Colors.black.withValues(alpha: 0.6),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Material(
                color: colors.surface,
                borderRadius: BorderRadius.circular(24),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _header(ru, theme),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final note in release.notes) _note(note, theme),
                          if (release.notes.isNotEmpty)
                            const SizedBox(height: 8),
                          Text(
                            _hint(ru),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: _stage == _Stage.failed
                                  ? colors.error
                                  : colors.onSurfaceVariant,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 14),
                          ..._actions(ru, theme),
                        ],
                      ),
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

  Widget _header(bool ru, ThemeData theme) {
    final release = widget.release;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary,
            Color.lerp(theme.colorScheme.primary, Colors.black, 0.28)!,
          ],
        ),
      ),
      child: Column(
        children: [
          const CircleAvatar(
            radius: 30,
            backgroundColor: Colors.white24,
            child: Icon(Icons.system_update, size: 32, color: Colors.white),
          ),
          const SizedBox(height: 12),
          Text(
            widget.onLater == null
                ? (ru ? 'Нужно обновить приложение' : 'Ilovani yangilash kerak')
                : (ru ? 'Вышла новая версия' : 'Yangi versiya chiqdi'),
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            [
              '${ru ? 'Версия' : 'Versiya'} ${release.version}',
              if (release.size > 0) _mb(release.size),
            ].join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70),
          ),
        ],
      ),
    );
  }

  Widget _note(String note, ThemeData theme) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.check_circle, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: 10),
        Expanded(child: Text(note, style: theme.textTheme.bodyMedium)),
      ],
    ),
  );

  String _hint(bool ru) => switch (_stage) {
    _Stage.offer =>
      ru
          ? 'Вход и данные сохранятся.'
          : 'Kirish va ma’lumotlar saqlanib qoladi.',
    _Stage.downloading => ru ? 'Не закрывайте приложение.' : 'Ilovani yopmang.',
    _Stage.ready =>
      ru
          ? 'Если появится вопрос, разрешите установку из этого источника, '
                'затем нажмите «Установить».'
          : 'So‘ralsa, shu manbadan o‘rnatishga ruxsat bering, so‘ng '
                '«O‘rnatish»ni bosing.',
    _Stage.failed =>
      ru
          ? 'Не получилось. Проверьте интернет и свободное место.'
          : 'Amalga oshmadi. Internet va telefondagi bo‘sh joyni tekshiring.',
  };

  List<Widget> _actions(bool ru, ThemeData theme) {
    final later = widget.onLater;
    Widget primary(String label, IconData icon, VoidCallback onPressed) =>
        FilledButton.icon(
          key: const Key('update_primary'),
          onPressed: onPressed,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          icon: Icon(icon, size: 20),
          label: Text(label),
        );
    Widget secondary(String label, VoidCallback onPressed) =>
        TextButton(onPressed: onPressed, child: Text(label));
    final postpone = [
      if (later != null) secondary(ru ? 'Позже' : 'Keyinroq', later),
    ];

    return switch (_stage) {
      _Stage.offer => [
        primary(
          ru ? 'Обновить' : 'Yangilash',
          Icons.download,
          () => unawaited(_download()),
        ),
        ...postpone,
      ],
      _Stage.downloading => [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            key: const Key('update_progress'),
            value: _progress > 0 ? _progress : null,
            minHeight: 10,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          widget.release.size > 0
              ? '${(_progress * 100).round()}% · '
                    '${_mb(widget.release.size * _progress)} / '
                    '${_mb(widget.release.size)}'
              : '${(_progress * 100).round()}%',
          textAlign: TextAlign.center,
          style: theme.textTheme.titleSmall,
        ),
        secondary(ru ? 'Отменить' : 'Bekor qilish', _stop),
      ],
      _Stage.ready => [
        primary(
          ru ? 'Установить' : 'O‘rnatish',
          Icons.install_mobile,
          () => unawaited(_install()),
        ),
        ...postpone,
      ],
      _Stage.failed => [
        primary(
          ru ? 'Повторить' : 'Qayta urinish',
          Icons.refresh,
          () => unawaited(_download()),
        ),
        secondary(
          ru ? 'Скачать через браузер' : 'Brauzerda yuklab olish',
          () => unawaited(_browser()),
        ),
        ...postpone,
      ],
    };
  }
}
