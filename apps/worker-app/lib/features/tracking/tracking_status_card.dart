import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Bosh sahifadagi jonli holat: joylashuv ketyaptimi, oxirgi marta qachon
/// ketdi va internet yo'qligida nechta nuqta navbatda turibdi. Kuzatuv
/// ishlamayotganda ko'rinmaydi (u holda ogohlantirish kartasi chiqadi).
class TrackingStatusCard extends StatefulWidget {
  const TrackingStatusCard({
    this.service,
    this.refresh = const Duration(seconds: 10),
    this.now = DateTime.now,
    super.key,
  });

  /// Testlarda almashtiriladigan soat.
  final DateTime Function() now;

  /// Har daqiqada bir nuqta ketadi; shundan uzoq jimlik — muammo.
  static const Duration staleAfter = Duration(minutes: 5);

  /// Testlar uchun; standart — DI'dagi xizmat.
  final LocationTrackingService? service;
  final Duration refresh;

  @override
  State<TrackingStatusCard> createState() => _TrackingStatusCardState();
}

class _TrackingStatusCardState extends State<TrackingStatusCard>
    with WidgetsBindingObserver {
  Timer? _timer;
  DateTime? _sentAt;
  int _queued = 0;
  bool _foreground = true;
  bool _visible = true;

  /// Kuzatuv qachondan beri ishlayapti — hali bitta ham nuqta ketmagan
  /// holatda "jimlik" shu paytdan o'lchanadi.
  DateTime? _runningSince;

  LocationTrackingService? get _service =>
      widget.service ??
      (getIt.isRegistered<LocationTrackingService>()
          ? getIt<LocationTrackingService>()
          : null);

  bool get _running => _service?.status.value == TrackingStatus.running;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _service?.status.addListener(_onStatus);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Boshqa tabda turganda animatsiyalar (va bu o'qish) o'chiriladi.
    _visible = TickerMode.of(context);
    _schedule();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _schedule();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _service?.status.removeListener(_onStatus);
    _timer?.cancel();
    super.dispose();
  }

  void _onStatus() {
    _schedule();
    if (mounted) setState(() {});
  }

  /// Faqat kuzatuv ishlab, karta ko'rinib turganda o'qiydi.
  void _schedule() {
    if (!_running) {
      _runningSince = null;
    } else {
      _runningSince ??= widget.now();
    }
    final wanted = _running && _foreground && _visible;
    if (wanted && _timer == null) {
      _timer = Timer.periodic(widget.refresh, (_) => unawaited(_read()));
      unawaited(_read());
    } else if (!wanted) {
      _timer?.cancel();
      _timer = null;
    }
  }

  Future<void> _read() async {
    final delivery = await _service?.delivery();
    if (!mounted || delivery == null) return;
    // Har safar qayta chiziladi: "N daqiqa oldin" vaqt o'tishi bilan o'zgaradi.
    setState(() {
      _sentAt = delivery.sentAt;
      _queued = delivery.queued;
    });
  }

  static String _two(int n) => '$n'.padLeft(2, '0');

  static String _ago(DateTime at, bool ru) {
    final now = DateTime.now();
    final minutes = now.difference(at).inMinutes;
    if (minutes < 1) return ru ? 'только что' : 'hozirgina';
    if (minutes < 60) {
      return ru ? '$minutes мин назад' : '$minutes daqiqa oldin';
    }
    final time = '${_two(at.hour)}:${_two(at.minute)}';
    final today =
        at.year == now.year && at.month == now.month && at.day == now.day;
    return today ? time : '${_two(at.day)}.${_two(at.month)} $time';
  }

  @override
  Widget build(BuildContext context) {
    if (!_running) return const SizedBox.shrink();
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final sent = _sentAt;
    final waiting = _queued > 0;
    final since = sent ?? _runningSince;
    final stale =
        since != null &&
        widget.now().difference(since) > TrackingStatusCard.staleAfter;
    final color = waiting || stale ? AppColors.warning : AppColors.primary;
    final title = waiting
        ? (ru ? 'Ждём связь' : 'Aloqa kutilmoqda')
        : stale
        ? (ru ? 'Геолокация не уходит' : 'Joylashuv yuborilmayapti')
        : sent == null
        ? (ru ? 'Ищем местоположение' : 'Joylashuv aniqlanmoqda')
        : (ru ? 'Геолокация передаётся' : 'Joylashuv yuborilmoqda');
    final last = sent == null
        ? null
        : '${ru ? 'Последняя отправка' : 'Oxirgi yuborish'}: '
              '${_ago(sent, ru)}';
    final detail = waiting
        ? (ru
              ? 'Точек сохранено: $_queued. Отправятся сами.'
              : '$_queued ta nuqta saqlandi, o‘zi yuboriladi.')
        : stale
        ? [
            if (last != null) '$last.',
            if (ru)
              'Проверьте GPS и интернет.'
            else
              'GPS va internetni tekshiring.',
          ].join(' ')
        : last ?? (ru ? 'Это займёт немного времени…' : 'Biroz vaqt oladi…');

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AnimatedContainer(
        key: const Key('tracking_status_card'),
        duration: const Duration(milliseconds: 400),
        padding: const EdgeInsets.fromLTRB(8, 10, 14, 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.09),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            PulsingDot(color: color),
            const SizedBox(width: 6),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                layoutBuilder: (current, previous) => Stack(
                  alignment: Alignment.centerLeft,
                  children: [...previous, ?current],
                ),
                child: Column(
                  key: ValueKey('$title|$detail'),
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.bodyStrong),
                    const SizedBox(height: 2),
                    Text(detail, style: AppTextStyles.caption),
                  ],
                ),
              ),
            ),
            Icon(
              waiting
                  ? IconsaxPlusBold.cloud_add
                  : stale
                  ? IconsaxPlusBold.warning_2
                  : IconsaxPlusBold.location,
              size: 20,
              color: color,
            ),
          ],
        ),
      ),
    );
  }
}
