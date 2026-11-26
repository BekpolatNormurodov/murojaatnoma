import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/core/permissions/permission_queue.dart';
import 'package:worker_app/features/tracking/device_status.dart';

/// Sozlash ekranidagi tugmalar bajaradigan tizim amallari.
class TrackingSetupActions {
  const TrackingSetupActions();

  Future<void> enableGps() => Geolocator.openLocationSettings();

  /// Avval oddiy ruxsat, keyin "Doim" (Android 11+ da sozlamalar sahifasi
  /// ochiladi). Tizim oyna ko'rsatmasa — ilova sozlamalariga o'tadi.
  Future<void> allowLocation() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await queuedPermissionRequest(Geolocator.requestPermission);
    }
    if (permission == LocationPermission.whileInUse) {
      await queuedPermissionRequest(Permission.locationAlways.request);
      permission = await Geolocator.checkPermission();
    }
    if (permission != LocationPermission.always) await openAppSettings();
    // Doimiy bildirishnoma ko'rinishi uchun (Android 13+); majburiy emas.
    await queuedPermissionRequest(Permission.notification.request);
  }

  Future<void> exemptBattery() =>
      queuedPermissionRequest(Permission.ignoreBatteryOptimizations.request);

  Future<void> openSettings() => openAppSettings();
}

/// Joylashuv uzluksiz ketishi uchun shart bo'lgan sozlamalar bajarilmaguncha
/// ilovani to'sib turadi: GPS, "Doim" ruxsati va batareya istisnosi.
class TrackingSetupGate extends StatefulWidget {
  const TrackingSetupGate({
    required this.check,
    required this.child,
    this.onReady,
    this.actions = const TrackingSetupActions(),
    this.poll = const Duration(seconds: 3),
    super.key,
  });

  /// Holatni o'qiydi (va serverga bildiradi); `null` — o'qib bo'lmadi.
  final Future<DeviceStatus?> Function() check;

  /// To'siq ochilganda (yoki boshidan hammasi joyida bo'lsa) chaqiriladi.
  final VoidCallback? onReady;
  final TrackingSetupActions actions;
  final Duration poll;
  final Widget child;

  @override
  State<TrackingSetupGate> createState() => _TrackingSetupGateState();
}

class _TrackingSetupGateState extends State<TrackingSetupGate>
    with WidgetsBindingObserver {
  DeviceStatus? _status;
  Timer? _timer;
  bool _checking = false;
  bool _acting = false;

  bool get _blocked => _status != null && !_status!.ready;

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
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _check() async {
    if (_checking) return;
    _checking = true;
    final status = await widget.check();
    _checking = false;
    if (!mounted || status == null) return;
    final wasReady = _status?.ready ?? false;
    setState(() => _status = status);
    // To'siq turganda tez-tez tekshiramiz: GPS tezkor paneldan yoqilsa
    // "ilovaga qaytish" hodisasi kelmaydi.
    if (status.ready) {
      _timer?.cancel();
      _timer = null;
      if (!wasReady) widget.onReady?.call();
    } else {
      _timer ??= Timer.periodic(widget.poll, (_) => unawaited(_check()));
    }
  }

  Future<void> _act(Future<void> Function() action) async {
    if (_acting) return;
    _acting = true;
    try {
      await action();
    } on Object catch (error) {
      debugPrint('[tracking-setup] $error');
    }
    _acting = false;
    await _check();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Bola daraxtdan olinmaydi — holati (tab, scroll) saqlanadi.
        ExcludeSemantics(excluding: _blocked, child: widget.child),
        if (_blocked) Positioned.fill(child: _screen(context, _status!)),
      ],
    );
  }

  Widget _screen(BuildContext context, DeviceStatus status) {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final actions = widget.actions;
    return Material(
      key: const Key('tracking_setup_gate'),
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 24),
          children: [
            const Icon(Icons.location_on, size: 56, color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              ru ? 'Настройте отслеживание' : 'Joylashuvni sozlang',
              style: AppTextStyles.h2,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              ru
                  ? 'Без этих настроек время работы на территории не '
                        'засчитывается. Включите все пункты.'
                  : 'Bu sozlamalarsiz hududda ishlagan vaqtingiz '
                        'hisoblanmaydi. Hamma bandni yoqing.',
              style: AppTextStyles.body,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            _Step(
              id: 'gps',
              done: status.gpsEnabled,
              title: ru ? 'Включите GPS' : 'GPS’ni yoqing',
              hint: ru
                  ? 'Геолокация телефона должна быть включена.'
                  : 'Telefonda joylashuv xizmati yoqilgan bo‘lsin.',
              button: ru ? 'Включить' : 'Yoqish',
              onTap: () => unawaited(_act(actions.enableGps)),
            ),
            _Step(
              id: 'permission',
              done: status.permission == DeviceStatus.always,
              title: ru
                  ? 'Разрешите геолокацию «Всегда»'
                  : 'Joylashuvga «Doim ruxsat» bering',
              hint: ru
                  ? 'В открывшемся окне выберите «Разрешить в любом режиме».'
                  : 'Ochilgan oynada «Har doim ruxsat berish»ni tanlang.',
              button: ru ? 'Разрешить' : 'Ruxsat berish',
              onTap: () => unawaited(_act(actions.allowLocation)),
            ),
            _Step(
              id: 'battery',
              done: status.batteryExempt,
              title: ru
                  ? 'Снимите ограничение батареи'
                  : 'Batareya cheklovini olib tashlang',
              hint: ru
                  ? 'Иначе телефон остановит отслеживание при выключенном '
                        'экране.'
                  : 'Aks holda ekran o‘chganda telefon kuzatuvni to‘xtatadi.',
              button: ru ? 'Разрешить' : 'Ruxsat berish',
              onTap: () => unawaited(_act(actions.exemptBattery)),
            ),
            const SizedBox(height: 8),
            Text(
              ru
                  ? 'Xiaomi, Redmi, Oppo, Vivo, Huawei: в настройках '
                        'приложения также включите «Автозапуск».'
                  : 'Xiaomi, Redmi, Oppo, Vivo, Huawei telefonlarida ilova '
                        'sozlamalaridan «Avtomatik ishga tushirish»ni ham '
                        'yoqing.',
              style: AppTextStyles.caption,
              textAlign: TextAlign.center,
            ),
            TextButton(
              onPressed: () => unawaited(_act(actions.openSettings)),
              child: Text(ru ? 'Настройки приложения' : 'Ilova sozlamalari'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.id,
    required this.done,
    required this.title,
    required this.hint,
    required this.button,
    required this.onTap,
  });

  final String id;
  final bool done;
  final String title;
  final String hint;
  final String button;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  done ? Icons.check_circle : Icons.radio_button_unchecked,
                  key: Key('setup_${id}_${done ? 'done' : 'todo'}'),
                  color: done ? AppColors.primary : AppColors.inkMuted,
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(title, style: AppTextStyles.bodyStrong)),
              ],
            ),
            if (!done) ...[
              const SizedBox(height: 6),
              Text(hint, style: AppTextStyles.caption),
              const SizedBox(height: 8),
              FilledButton(
                key: Key('setup_${id}_button'),
                onPressed: onTap,
                child: Text(button),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
