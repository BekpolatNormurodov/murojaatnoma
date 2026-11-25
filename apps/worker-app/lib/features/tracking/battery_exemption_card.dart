import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/permissions/permission_queue.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Android batareya tejash rejimi fondagi joylashuv kuzatuvini to'xtatib
/// qo'yishi mumkin. Kuzatuv ishlayotgan, lekin ilova istisnoga qo'shilmagan
/// bo'lsa sababini tushuntirib, ruxsat so'raydi.
///
/// Tizim oynasi FAQAT tugma bosilganda ochiladi (o'z-o'zidan emas — rad
/// etgan xodimga tsikl bo'lmasin). "Keyinroq" kartani [snooze] muddatiga
/// yashiradi.
class BatteryExemptionCard extends StatefulWidget {
  const BatteryExemptionCard({
    this.service,
    this.isExempt,
    this.request,
    super.key,
  });

  static const String snoozeKey = 'battery_exemption_snoozed_at';
  static const Duration snooze = Duration(days: 3);

  /// Testlar uchun; standart — DI'dagi xizmat va `permission_handler`.
  final LocationTrackingService? service;
  final Future<bool> Function()? isExempt;
  final Future<bool> Function()? request;

  @override
  State<BatteryExemptionCard> createState() => _BatteryExemptionCardState();
}

class _BatteryExemptionCardState extends State<BatteryExemptionCard>
    with WidgetsBindingObserver {
  /// `false` — karta kerak emas yoki holat hali noma'lum.
  bool _needed = false;
  bool _refused = false;
  bool _requesting = false;

  LocationTrackingService? get _tracking =>
      widget.service ??
      (getIt.isRegistered<LocationTrackingService>()
          ? getIt<LocationTrackingService>()
          : null);

  bool get _android => defaultTargetPlatform == TargetPlatform.android;

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

  Future<bool> _isExempt() async =>
      widget.isExempt?.call() ??
      Permission.ignoreBatteryOptimizations.status.then((s) => s.isGranted);

  Future<bool> _requestExemption() async =>
      widget.request?.call() ??
      Permission.ignoreBatteryOptimizations.request().then((s) => s.isGranted);

  /// Faqat tekshiradi.
  Future<void> _check() async {
    if (!_android) return;
    var needed = false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final snoozedAt = prefs.getInt(BatteryExemptionCard.snoozeKey);
      final snoozed =
          snoozedAt != null &&
          DateTime.now().difference(
                DateTime.fromMillisecondsSinceEpoch(snoozedAt),
              ) <
              BatteryExemptionCard.snooze;
      needed = !snoozed && !await _isExempt();
    } on Object catch (error) {
      debugPrint('[battery] check: $error');
    }
    if (mounted && needed != _needed) setState(() => _needed = needed);
  }

  Future<void> _ask() async {
    if (_requesting) return;
    _requesting = true;
    var granted = false;
    try {
      granted = await queuedPermissionRequest(
        _requestExemption,
      ).timeout(permissionRequestTimeout);
    } on Object catch (error) {
      debugPrint('[battery] request: $error');
    }
    _requesting = false;
    if (!mounted) return;
    setState(() {
      _needed = !granted;
      _refused = !granted;
    });
  }

  Future<void> _later() async {
    setState(() => _needed = false);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
      BatteryExemptionCard.snoozeKey,
      DateTime.now().millisecondsSinceEpoch,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tracking = _tracking;
    if (tracking == null || !_android) return const SizedBox.shrink();
    return ValueListenableBuilder<TrackingStatus>(
      valueListenable: tracking.status,
      builder: (context, status, _) {
        // Kuzatuv bloklangan bo'lsa avval o'sha ogohlantirish.
        if (!_needed || status != TrackingStatus.running) {
          return const SizedBox.shrink();
        }
        return _card(context);
      },
    );
  }

  Widget _card(BuildContext context) {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final text = _refused
        ? (ru
              ? 'Разрешение не выдано. При выключенном экране отслеживание '
                    'может остановиться, и время на территории не '
                    'засчитается.'
              : "Ruxsat berilmadi. Ekran o'chganda kuzatuv to'xtab, "
                    'hududdagi vaqtingiz hisoblanmasligi mumkin.')
        : (ru
              ? 'Чтобы время на территории считалось и при выключенном '
                    'экране, разрешите приложению работать без ограничений '
                    'батареи.'
              : "Ekran o'chganda ham hududdagi vaqtingiz hisoblanishi uchun "
                    'ilovaga batareya cheklovisiz ishlashga ruxsat bering.');
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        key: const Key('battery_exemption_card'),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              ru
                  ? 'Экономия батареи мешает отслеживанию'
                  : 'Batareya tejash kuzatuvga xalaqit beradi',
              style: AppTextStyles.bodyStrong,
            ),
            const SizedBox(height: 4),
            Text(text, style: AppTextStyles.caption),
            const SizedBox(height: 4),
            // `Wrap` — katta shriftda tugmalar ikki qatorga tushadi.
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 4,
              children: [
                TextButton(
                  onPressed: () => unawaited(_later()),
                  child: Text(ru ? 'Позже' : 'Keyinroq'),
                ),
                TextButton(
                  onPressed: () => unawaited(_ask()),
                  child: Text(ru ? 'Разрешить' : 'Ruxsat berish'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
