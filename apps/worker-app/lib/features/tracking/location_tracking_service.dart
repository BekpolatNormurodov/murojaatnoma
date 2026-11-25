import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/permissions/permission_queue.dart';

/// Xodim joylashuvini serverga UZLUKSIZ yuboradi (`POST /locations`) va
/// internet yo'q paytda hisobotlarni qurilmada saqlab turadi (outbox), aloqa
/// tiklanganda ularni `POST /locations/batch` orqali oqizib yuboradi.
///
/// Kuzatuv fonda ham davom etadi (geolocator position stream): Android'da
/// foreground-service, iOS'da fon rejimidagi joylashuv yangilanishlari orqali
/// ilova minimallashtirilganda/ekran o'chganda ham uzilmaydi. [start] ni bir
/// necha bor chaqirish xavfsiz — allaqachon ishlayotgan bo'lsa hech nima
/// qilmaydi.
///
/// Har bir buferlangan nuqta EGASI (xodim id) bilan saqlanadi va faqat o'sha
/// xodim kirgan paytda yuboriladi — logout yoki sessiya tugashida nuqtalar
/// yo'qolmaydi va boshqa xodim nomidan ketmaydi.
class LocationTrackingService {
  LocationTrackingService(
    this._dio, {
    String? Function()? ownerId,
    Future<bool> Function()? ensurePermission,
    Future<bool> Function()? hasPermission,
    Stream<Position> Function()? positions,
    Future<Position> Function()? currentPosition,
  }) : _ownerId = ownerId,
       _permissionOverride = ensurePermission,
       _hasPermissionOverride = hasPermission,
       _positionsOverride = positions,
       _currentOverride = currentPosition;

  final Dio _dio;
  final String? Function()? _ownerId;
  final Future<bool> Function()? _permissionOverride;
  final Future<bool> Function()? _hasPermissionOverride;
  final Stream<Position> Function()? _positionsOverride;
  final Future<Position> Function()? _currentOverride;

  static const String outboxKey = 'location_outbox_v1';
  static const String _ownerField = '_owner';
  static const int _batchSize = 100;
  static const int _distanceFilterMeters = 15;

  /// Oflayn buferda nuqtalar orasidagi eng kichik oraliq — mahallaga kirish
  /// va chiqish vaqti shu aniqlikda saqlanadi.
  static const Duration offlineSpacing = Duration(seconds: 15);

  /// 15 soniyada bitta nuqta bilan ~8 soat uzluksiz yurish. To'lsa boshi
  /// o'chirilmaydi — butun bufer siyraklashtiriladi (qarang: [_compact]).
  static const int maxBuffer = 2000;

  /// Siyraklashtirishning eng katta oralig'i. Server 15 daqiqagacha tanaffusni
  /// uzluksiz deb hisoblaydi — undan ancha kichik.
  static const Duration _maxThinning = Duration(minutes: 8);
  static const Duration _flushInterval = Duration(seconds: 30);

  /// Oqim faqat 15 m yurganda nuqta beradi — joyida o'tirgan xodim umuman
  /// hisobot yubormas, admin xaritasida 5 daqiqada "oflayn", 30 daqiqada
  /// "aloqa yo'q" (soxta ogohlantirish) bo'lib qolardi. Shuncha vaqt hech narsa
  /// yuborilmagan bo'lsa — joriy fiksni o'zimiz olib yuboramiz (heartbeat).
  static const Duration _heartbeatEvery = Duration(minutes: 5);

  StreamSubscription<Position>? _positionSub;
  Timer? _flushTimer;
  bool _running = false;
  Object? _lastError;
  DateTime? _lastSentAt;
  bool _heartbeatInFlight = false;

  /// Har bir [stop]da oshadi — kechikkan ruxsat/fiks natijasi e'tiborsiz.
  int _generation = 0;

  /// UI uchun holat (bosh sahifadagi ogohlantirish).
  final ValueNotifier<TrackingStatus> status = ValueNotifier(
    TrackingStatus.idle,
  );

  bool get isRunning => _running;

  /// Oxirgi kuzatilgan xato (diagnostika uchun).
  Object? get lastError => _lastError;

  /// Ruxsatni tekshiradi/so'raydi va joylashuv oqimini boshlaydi. Joylashuv
  /// xizmati yoki ruxsat mavjud bo'lmasa `false` qaytaradi.
  ///
  /// [prompt] `false` — ruxsat oynasi OCHILMAYDI. Ilovaga qaytishda shunday
  /// chaqiriladi: oynaning o'zi yopilganda ham "qaytish" keladi va rad
  /// etgan xodimdan darhol qayta so'ralardi (Android'da ikkinchi rad —
  /// doimiy taqiq).
  Future<bool> start({bool prompt = true}) {
    if (_running) return Future.value(true);
    // MainShell va MapPage ikkalasi ham start() chaqiradi; ruxsat tekshiruvi
    // davomida ikkinchi chaqiruv `_running`ni hali false ko'rib, IKKINCHI
    // oqim + taymer ochardi. Davom etayotgan ishga tushirishni bo'lishamiz.
    final pending = _starting;
    if (pending != null) return pending;
    late final Future<bool> future;
    future = _start(prompt: prompt).whenComplete(() {
      if (identical(_starting, future)) _starting = null;
    });
    return _starting = future;
  }

  Future<bool>? _starting;

  Future<bool> _start({required bool prompt}) async {
    final generation = _generation;
    var granted = false;
    try {
      // Javobsiz qolgan so'rov [_starting]ni abadiy band qilib qo'ymasin.
      granted =
          await (prompt
                  ? (_permissionOverride ?? _requestPermission)()
                  : (_hasPermissionOverride ?? _checkPermission)())
              .timeout(permissionRequestTimeout);
    } on Object catch (error) {
      // Masalan boshqa ruxsat dialogi ochiq (PermissionRequestInProgress).
      _lastError = error;
    }
    // Kutish davomida stop() chaqirilgan — kuzatuv qayta tirilmasin.
    if (generation != _generation) return false;
    if (!granted) {
      status.value = TrackingStatus.blocked;
      return false;
    }
    if (_running) return true;

    _running = true;
    final stream =
        _positionsOverride?.call() ??
        Geolocator.getPositionStream(locationSettings: _buildSettings());
    _positionSub = stream.listen(
      _onPosition,
      onError: _onStreamError,
      cancelOnError: false,
    );

    _flushTimer = Timer.periodic(_flushInterval, (_) => _tick());
    status.value = TrackingStatus.running;

    // Birinchi hisobotni darhol yuboramiz — admin xaritasi harakatni
    // kutmasdan yonadi.
    unawaited(_reportCurrent());

    return true;
  }

  void _onStreamError(Object error) {
    _lastError = error;
    if (error is LocationServiceDisabledException ||
        error is PermissionDeniedException) {
      // Oqim endi nuqta bermaydi — to'xtatamiz, keyingi start() (ilovaga
      // qaytish) qayta ishga tushiradi.
      unawaited(stop().then((_) => status.value = TrackingStatus.blocked));
    }
  }

  Future<void> stop() async {
    _generation++;
    _starting = null;
    _running = false;
    status.value = TrackingStatus.idle;
    final sub = _positionSub;
    _positionSub = null;
    _flushTimer?.cancel();
    _flushTimer = null;
    await sub?.cancel();
  }

  /// Egasi yozilmagan (eski) nuqtalarga joriy xodimni ega qilib qo'yadi —
  /// chiqishdan oldin chaqiriladi.
  Future<void> claimOutbox() async {
    final owner = _ownerId?.call();
    if (owner == null) return;
    await _locked((prefs) async {
      final buffer = prefs.getStringList(outboxKey);
      if (buffer == null || buffer.isEmpty) return;
      await prefs.setStringList(outboxKey, [
        for (final raw in buffer) _claimed(raw, owner),
      ]);
    });
  }

  static String _claimed(String raw, String owner) {
    final map = _decode(raw);
    if (map == null || map[_ownerField] != null) return raw;
    return jsonEncode({...map, _ownerField: owner});
  }

  static Map<String, dynamic>? _decode(String raw) {
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } on Object {
      return null;
    }
  }

  /// Bufer ustidagi o'qi-yoz amallari ketma-ket bajariladi.
  Future<void> _lock = Future<void>.value();

  Future<void> _locked(Future<void> Function(SharedPreferences prefs) action) {
    final next = _lock.then((_) async {
      await action(await SharedPreferences.getInstance());
    });
    _lock = next.catchError((Object error) {
      _lastError = error;
    });
    return next;
  }

  /// Platformaga mos joylashuv sozlamalari. Android'da foreground-service
  /// (doimiy bildirishnoma), iOS'da esa fon rejimidagi yangilanishlar orqali
  /// oqim ilova minimallashtirilganda/ekran o'chganda ham uzilmaydi.
  LocationSettings _buildSettings() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return AndroidSettings(
          // Aniqlik OCHIQ berilmaydi → `best` (standart) ishlaydi: sun'iy
          // yo'ldosh (GPS) fiksini majburlaydi. Ilgari `high` edi — u ba'zan
          // tarmoq/Wi-Fi asosidagi DAG'AL (~100-500 m) fiksni qaytarib, nuqta
          // qo'shni mahallaga "tushib" ketardi (mahalla ~500 m).
          distanceFilter: _distanceFilterMeters,
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: 'Joylashuv kuzatuvi',
            notificationText: 'Ish vaqtida joylashuvingiz yuborilmoqda',
            notificationIcon: AndroidResource(name: 'ic_stat_notify'),
            enableWakeLock: true,
            setOngoing: true,
          ),
        );
      case TargetPlatform.iOS:
        // Fon rejimidagi yangilanishlar uchun `showBackgroundLocationIndicator`
        // yoqiladi. Qolgan fon xatti-harakati AppleSettings standartlaridan
        // keladi: allowBackgroundLocationUpdates=true (fonda yangilanish),
        // pauseLocationUpdatesAutomatically=false (iOS oqimni to'xtatmaydi),
        // activityType=other. Ular takroriy bo'lgani uchun ochiq yozilmadi.
        return AppleSettings(
          // Aniqlik OCHIQ berilmaydi → `best` (standart). Ilgari `high` edi.
          distanceFilter: _distanceFilterMeters,
          showBackgroundLocationIndicator: true,
        );
      case TargetPlatform.fuchsia:
      case TargetPlatform.linux:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
        // `best` — LocationSettings uchun standart aniqlik, shu bois ochiq
        // yozilmadi.
        return const LocationSettings(distanceFilter: _distanceFilterMeters);
    }
  }

  Future<void> _tick() async {
    await flush();
    final last = _lastSentAt;
    if (_running &&
        !_heartbeatInFlight &&
        (last == null || DateTime.now().difference(last) >= _heartbeatEvery)) {
      _heartbeatInFlight = true;
      try {
        // Faqat HAQIQIY joriy fiks yuboriladi: GPS o'chiq/olinmasa hech narsa
        // yubormaymiz — eski nuqtani "yangi" deb ko'rsatish adminni aldaydi.
        await _reportCurrent();
      } finally {
        _heartbeatInFlight = false;
      }
    }
  }

  Future<void> _reportCurrent() async {
    final generation = _generation;
    try {
      // Darhol yuboriladigan ILK fiks ham ANIQ (best) bo'lsin — vaqt cheklovi
      // (15 s) sun'iy yo'ldoshga ulanishga imkon beradi.
      final current =
          await (_currentOverride?.call() ??
              Geolocator.getCurrentPosition(
                locationSettings: const LocationSettings(
                  timeLimit: Duration(seconds: 15),
                ),
              ));
      if (generation != _generation) return;
      await _onPosition(current);
    } on Object catch (error) {
      _lastError = error;
    }
  }

  Future<bool> _requestPermission() => _permission(request: true);

  Future<bool> _checkPermission() => _permission(request: false);

  Future<bool> _permission({required bool request}) async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (request && permission == LocationPermission.denied) {
      permission = await queuedPermissionRequest(Geolocator.requestPermission);
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<void> _onPosition(Position position) async {
    final owner = _ownerId?.call();
    // Hech kim kirmagan — nuqta hech kimga tegishli emas.
    if (_ownerId != null && owner == null) return;
    final report = _toReport(position);
    _lastSentAt = DateTime.now();
    try {
      await _dio.post<dynamic>('/locations', data: report);
      // Muvaffaqiyatli yuborish = onlayn bo'ldik — bufernikini oqizamiz.
      await flush();
    } on Object catch (error) {
      _lastError = error;
      await _enqueue(report, owner);
    }
  }

  Map<String, dynamic> _toReport(Position p) {
    return <String, dynamic>{
      'latitude': p.latitude,
      'longitude': p.longitude,
      'accuracy': p.accuracy,
      if (p.speed >= 0) 'speed': p.speed,
      if (p.heading >= 0) 'heading': p.heading,
      'source': 'FOREGROUND',
      'recordedAt': p.timestamp.toUtc().toIso8601String(),
    };
  }

  Future<void> _enqueue(Map<String, dynamic> report, String? owner) => _locked((
    prefs,
  ) async {
    final buffer = prefs.getStringList(outboxKey) ?? <String>[];
    if (_tooClose(buffer, report, owner)) return;
    buffer.add(jsonEncode({...report, if (owner != null) _ownerField: owner}));
    await prefs.setStringList(outboxKey, _compact(buffer));
  });

  /// Bufer to'lsa oraliqni ikki baravar oshirib siyraklashtiradi (10% bo'sh
  /// joy qolguncha) — uzoq oflayn kunning boshi ham, oxiri ham saqlanadi.
  /// Shundan keyin ham sig'masa (bir necha kunlik oflayn) eng eskisi ketadi.
  static List<String> _compact(List<String> buffer) {
    if (buffer.length <= maxBuffer) return buffer;
    const target = maxBuffer - maxBuffer ~/ 10;
    var kept = buffer;
    for (
      var spacing = offlineSpacing * 2;
      kept.length > target && spacing <= _maxThinning;
      spacing *= 2
    ) {
      kept = _thin(kept, spacing);
    }
    return kept.length > maxBuffer
        ? kept.sublist(kept.length - maxBuffer)
        : kept;
  }

  /// Har egasining ketma-ket nuqtalari orasida kamida [spacing] qoldiradi;
  /// buzilgan yozuvlar tashlanadi, eng oxirgi nuqta doim qoladi.
  static List<String> _thin(List<String> buffer, Duration spacing) {
    final kept = <String>[];
    Object? owner;
    DateTime? keptAt;
    for (var i = 0; i < buffer.length; i++) {
      final map = _decode(buffer[i]);
      if (map == null) continue;
      final at = DateTime.tryParse('${map['recordedAt']}');
      final previous = keptAt;
      final redundant =
          i < buffer.length - 1 &&
          at != null &&
          previous != null &&
          map[_ownerField] == owner &&
          !at.difference(previous).isNegative &&
          at.difference(previous) < spacing;
      if (redundant) continue;
      kept.add(buffer[i]);
      owner = map[_ownerField];
      keptAt = at;
    }
    return kept;
  }

  /// Shu egasining oxirgi buferlangan nuqtasidan [offlineSpacing] o'tmaganmi.
  static bool _tooClose(
    List<String> buffer,
    Map<String, dynamic> report,
    String? owner,
  ) {
    final at = DateTime.tryParse('${report['recordedAt']}');
    if (at == null || buffer.isEmpty) return false;
    final last = _decode(buffer.last);
    if (last == null || last[_ownerField] != owner) return false;
    final lastAt = DateTime.tryParse('${last['recordedAt']}');
    if (lastAt == null) return false;
    final gap = at.difference(lastAt);
    return !gap.isNegative && gap < offlineSpacing;
  }

  Future<void>? _flushing;

  /// Buferdagi (joriy xodimga tegishli) nuqtalarni yuboradi. Bir vaqtda
  /// bitta oqizish ishlaydi.
  Future<void> flush() => _flushing ??= _flushOutbox().whenComplete(() {
    _flushing = null;
  });

  Future<void> _flushOutbox() async {
    while (true) {
      final owner = _ownerId?.call();
      if (_ownerId != null && owner == null) return;
      final prefs = await SharedPreferences.getInstance();
      final mine = (prefs.getStringList(outboxKey) ?? <String>[])
          .where((raw) {
            final entryOwner = _decode(raw)?[_ownerField];
            return entryOwner == null || entryOwner == owner;
          })
          .take(_batchSize)
          .toList(growable: false);
      if (mine.isEmpty) return;
      if (!await _sendBatch(mine)) return;
    }
  }

  /// `true` — shu yozuvlar buferdan chiqdi (yuborildi yoki server ularni
  /// qat'iyan rad etdi); `false` — keyinroq qayta urinamiz.
  Future<bool> _sendBatch(List<String> entries) async {
    final items = <Map<String, dynamic>>[
      for (final raw in entries)
        if (_decode(raw) case final map?) {...map}..remove(_ownerField),
    ];
    if (items.isEmpty) {
      await _remove(entries); // buzilgan yozuvlar
      return true;
    }
    try {
      await _dio.post<dynamic>(
        '/locations/batch',
        data: <String, dynamic>{'items': items},
      );
    } on DioException catch (error) {
      _lastError = error;
      final code = error.response?.statusCode;
      if (code != 400 && code != 413 && code != 422) return false;
      // Qayta urinish foydasiz: yaroqsiz nuqtani ajratib tashlaymiz, aks
      // holda u butun navbatni abadiy to'sib qo'yardi.
      if (entries.length > 1) {
        final half = entries.length ~/ 2;
        return await _sendBatch(entries.sublist(0, half)) &&
            await _sendBatch(entries.sublist(half));
      }
    } on Object catch (error) {
      _lastError = error;
      return false;
    }
    await _remove(entries);
    return true;
  }

  /// Faqat shu yozuvlarni o'chiradi — yuborish davomida qo'shilganlari qoladi.
  Future<void> _remove(List<String> sent) => _locked((prefs) async {
    final buffer = prefs.getStringList(outboxKey) ?? <String>[];
    sent.forEach(buffer.remove);
    if (buffer.isEmpty) {
      await prefs.remove(outboxKey);
    } else {
      await prefs.setStringList(outboxKey, buffer);
    }
  });
}

/// Kuzatuv holati: ishlayapti / ruxsat yoki GPS yo'qligi sabab to'xtagan.
enum TrackingStatus { idle, running, blocked }
