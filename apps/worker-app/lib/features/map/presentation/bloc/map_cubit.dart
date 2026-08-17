import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

part 'map_state.dart';

/// "Xarita" (hudud kuzatuvi) ekranini boshqaruvchi Cubit.
///
/// Jonli joylashuv oqimiga obuna bo'ladi (`positionStream`), har bir yangi
/// pozitsiyani "breadcrumb" iziga (`trail`) qo'shib boradi va
/// `GeofenceService` orqali ish hududi ichida/tashqarisida ekanini
/// hisoblaydi. `AttendanceCubit`dagi `locate` seam bilan bir xil g'oya:
/// ruxsat tekshiruvi (`ensurePermission`) va pozitsiya manbai
/// (`positionStream`) ALOHIDA inyeksiya qilinadigan funksiyalar — testlarda
/// haqiqiy `Geolocator`ga umuman tegilmaydi, standart implementatsiyalar
/// esa faqat qurilmada ishlatiladi.
///
/// Hech qachon uncaught tashlamaydi: ruxsat/oqim xatolari doim mos holatga
/// aylanadi (`MapPermissionDenied` / `MapError`) — hech qachon oq/bo'sh
/// ekran yoki qulagan ilova emas.
class MapCubit extends Cubit<MapState> {
  MapCubit({
    required GeofenceService geofence,
    Stream<Position> Function() positionStream = _defaultPositionStream,
    Future<bool> Function() ensurePermission = _defaultEnsurePermission,
    Future<bool> Function() isPermanentlyDenied = _defaultIsPermanentlyDenied,
  }) : _geofence = geofence,
       _positionStream = positionStream,
       _ensurePermission = ensurePermission,
       _isPermanentlyDenied = isPermanentlyDenied,
       super(const MapInitial());

  final GeofenceService _geofence;
  final Stream<Position> Function() _positionStream;
  final Future<bool> Function() _ensurePermission;

  /// [MapPermissionDenied.permanentlyDenied] uchun qo'shimcha, MUSTAQIL
  /// tekshiruv — [_ensurePermission] o'zi FAQAT berilgan/berilmaganini
  /// (`bool`) qaytaradi, "nega" berilmaganini emas. Alohida seam sifatida
  /// inject qilingan: `_ensurePermission`ni (va uning testlarini)
  /// o'zgartirmasdan, faqat rad etish SABABINI aniqlashtiradi.
  final Future<bool> Function() _isPermanentlyDenied;

  StreamSubscription<Position>? _subscription;
  List<LatLng> _trail = const [];

  /// Har bir [start]/[stop] chaqiruvida oshiriladigan avlod hisoblagichi —
  /// "use-after-cancel" muhofazasi. [start] o'zining `await`laridan KEYIN
  /// (ruxsat so'rovi kabi sekin amallardan so'ng) ushbu raqam hali ham
  /// "joriy"ligini tekshiradi: agar shu kutish oralig'ida [stop] (yoki
  /// yangi [start]) chaqirilgan bo'lsa, o'zini "eskirgan" deb bilib,
  /// pozitsiya oqimiga OBUNA BO'LMAYDI/holat EMIT QILMAYDI. Bunday
  /// muhofazasiz: sekin ruxsat so'rovi STOP tugmasi bosilgandan KEYIN
  /// tugasa, eski `start()` baribir obuna bo'lib, kuzatuvni "qayta
  /// tiriltirib" yuborardi — foydalanuvchiga xuddi STOP "hech narsa
  /// qilmagandek" tuyulardi.
  int _generation = 0;

  /// Kuzatuvni boshlaydi (yoki qayta boshlaydi): avval ruxsatni
  /// tekshiradi/so'raydi ([_ensurePermission] — hech qachon throw
  /// qilmaydi, faqat `true`/`false`), so'ng izni bo'shatib jonli oqimga
  /// obuna bo'ladi. Har doim [MapLoading] bilan boshlanadi — qayta
  /// chaqirilganda ham (masalan "qayta urinish") oldingi holat "muzlab
  /// qolmaydi".
  Future<void> start() async {
    final generation = ++_generation;
    emit(const MapLoading());

    var granted = false;
    try {
      granted = await _ensurePermission();
    } on Object {
      granted = false;
    }
    if (isClosed || generation != _generation) return;
    if (!granted) {
      // "Nega" rad etilgani (vaqtincha / doimiy) ALOHIDA, ikkinchi darajali
      // tekshiruv — bu ham hech qachon uncaught tashlamaydi: xato bo'lsa
      // shunchaki "doimiy emas" deb hisoblanadi (foydalanuvchi hali ham
      // oddiy "Ruxsat berish" CTA'sini ko'radi, tupikka tushmaydi).
      var permanentlyDenied = false;
      try {
        permanentlyDenied = await _isPermanentlyDenied();
      } on Object {
        permanentlyDenied = false;
      }
      if (isClosed || generation != _generation) return;
      emit(MapPermissionDenied(permanentlyDenied: permanentlyDenied));
      return;
    }

    _trail = const [];
    await _subscription?.cancel();
    if (isClosed || generation != _generation) return;
    try {
      _subscription = _positionStream().listen(
        _onPosition,
        onError: _onStreamError,
      );
    } on Object catch (e) {
      if (!isClosed && generation == _generation) {
        emit(MapError(_unexpectedErrorMessage(e)));
      }
    }
  }

  /// Kuzatuvni to'xtatadi: oqim obunasini bekor qiladi (shu jumladan hali
  /// ruxsat kutayotgan/oqimga ulanmagan [start] ham [_generation] orqali
  /// "eskirgan" deb belgilanadi — qarang: uning izohi) va oxirgi ma'lum
  /// pozitsiya/izni "muzlatib" [MapStopped]ga o'tadi (`MapPage`
  /// "Kuzatishni boshlash" CTA'sini qayta ko'rsatadi, marker/iz esa
  /// so'nggi holatida qolaveradi — butunlay yo'qolib ketmaydi). Hali
  /// birorta ham pozitsiya kelmagan bo'lsa (masalan ruxsat kutilayotganda
  /// bosilsa) "muzlatadigan" narsa yo'q — oddiy [MapInitial]ga qaytadi.
  /// Allaqachon [MapStopped] bo'lsa idempotent — qayta chaqirish muzlatib
  /// qo'yilgan izni [MapInitial] bilan almashtirib YUBORMAYDI.
  Future<void> stop() async {
    _generation++;
    await _subscription?.cancel();
    _subscription = null;
    if (isClosed) return;
    final current = state;
    if (current is MapTracking) {
      emit(
        MapStopped(
          position: current.position,
          trail: current.trail,
          insideGeofence: current.insideGeofence,
        ),
      );
    } else if (current is! MapStopped) {
      emit(const MapInitial());
    }
  }

  /// "Joriy joylashuvga markazlashtirish" tugmasi bosilganda chaqiriladi.
  ///
  /// Kuzatuv allaqachon faol bo'lsa hech narsa qilmaydi — joriy pozitsiya
  /// state'da allaqachon bor, kamerani harakatlantirish `MapPage`ning
  /// o'zi (`MapController` orqali) zimmasida. Faol bo'lmasa (masalan
  /// xato/ruxsat rad etilgandan keyin) [start]ni qayta chaqiradi.
  Future<void> recenter() async {
    if (state is MapTracking) return;
    await start();
  }

  /// Xom GPS nuqtasi shu qiymatdan yomonroq aniqlikda (`Position.accuracy`,
  /// metrda) bo'lsa breadcrumb iziga QO'SHILMAYDI — telefon ichkarida/zich
  /// bino yaqinida bo'lganda tez-tez uchraydigan "sakrab turuvchi" nuqtalar
  /// shu yerda filtrlanadi.
  static const _maxAcceptableAccuracyMeters = 30.0;

  /// Oxirgi QO'SHILGAN iz nuqtasidan shu masofadan (metrda) YAQINROQ yangi
  /// nuqta izga QO'SHILMAYDI — foydalanuvchi bir joyda tik turganda GPS
  /// bir necha metr atrofida "titrab" (jitter) noto'g'ri zig-zag chiziqlar
  /// hosil qilishining oldini oladi.
  static const _minTrailPointDistanceMeters = 8.0;

  /// Oxirgi QO'SHILGAN iz nuqtasidan shu masofadan (metrda) UZOQROQ yagona
  /// "sakrash" outlier deb hisoblanib izga QO'SHILMAYDI — piyoda yurish
  /// tezligida ikkita ketma-ket o'lchov orasida buncha katta farq bo'lishi
  /// deyarli imkonsiz, demak bu GPS xatosi. (Tasodifan `kGeofenceRadius`
  /// bilan bir xil son — ikkalasi MUSTAQIL konstantalar, faqat qiymati mos
  /// kelib qolgan.)
  static const _teleportGuardMeters = 150.0;

  void _onPosition(Position position) {
    if (isClosed) return;
    if (_shouldAppendToTrail(position)) {
      _trail = [..._trail, LatLng(position.latitude, position.longitude)];
    }
    // Marker/joriy-pozitsiya HAR DOIM eng so'nggi xom o'lchovga yangilanadi
    // — faqat breadcrumb IZI filtrlanadi, joriy joylashuv ko'rsatkichi emas.
    emit(
      MapTracking(
        position: position,
        trail: _trail,
        insideGeofence: _geofence.isInside(
          position.latitude,
          position.longitude,
        ),
      ),
    );
  }

  /// Yangi [position] breadcrumb iziga qo'shilishi kerakmi — uch bosqichli
  /// filtr (tartib muhim, eng arzon/aniq tekshiruv birinchi):
  /// 1. Aniqlik yomon bo'lsa — yo'q (qarang: [_maxAcceptableAccuracyMeters]).
  /// 2. Iz hali bo'sh bo'lsa (yangi sessiya) — ha, birinchi nuqta doim
  ///    "urug'" sifatida qo'shiladi (solishtiradigan oldingi nuqta yo'q).
  /// 3. Oxirgi QO'SHILGAN nuqtadan masofa: juda uzoq (teleport) — yo'q;
  ///    juda yaqin (jitter) — yo'q; oralig'ida — ha (haqiqiy harakat).
  bool _shouldAppendToTrail(Position position) {
    if (position.accuracy > _maxAcceptableAccuracyMeters) return false;
    if (_trail.isEmpty) return true;

    final last = _trail.last;
    final distance = _geofence.distanceMeters(
      last.latitude,
      last.longitude,
      position.latitude,
      position.longitude,
    );
    if (distance > _teleportGuardMeters) return false;
    return distance >= _minTrailPointDistanceMeters;
  }

  void _onStreamError(Object error) {
    if (isClosed) return;
    emit(MapError(_unexpectedErrorMessage(error)));
  }

  String _unexpectedErrorMessage(Object error) =>
      'Kutilmagan xatolik: $error';

  @override
  Future<void> close() {
    unawaited(_subscription?.cancel());
    return super.close();
  }

  /// `ensurePermission` uchun standart (qurilma-only) implementatsiya —
  /// `AttendanceCubit._defaultLocate` bilan bir xil tekshiruv tartibi
  /// (xizmat yoqilganmi -> ruxsat holati -> kerak bo'lsa so'raydi), lekin
  /// throw qilish o'rniga oddiy `bool` qaytaradi — chaqiruvchi ([start])
  /// buni to'g'ridan-to'g'ri [MapPermissionDenied]ga aylantiradi.
  static Future<bool> _defaultEnsurePermission() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return false;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      return permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    } on Object {
      return false;
    }
  }

  /// `positionStream` uchun standart (qurilma-only) implementatsiya —
  /// o'rtacha aniqlikdagi harakat uchun 5 metrlik filtr bilan doimiy
  /// yangilanish.
  static Stream<Position> _defaultPositionStream() =>
      Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 5,
        ),
      );

  /// `isPermanentlyDenied` uchun standart (qurilma-only) implementatsiya —
  /// `FacePermissionDenied.permanentlyDenied`ni `Permission.camera.request()`
  /// natijasidan to'g'ridan-to'g'ri olgan `FaceCubit`dan farqli, geolocator
  /// paketida "so'ramasdan" holatni bilish uchun alohida `checkPermission()`
  /// chaqiruvi kerak (`requestPermission()`ni qayta chaqirish foydalanuvchini
  /// yana bir marta — keraksiz — so'rov oynasi bilan chalg'itmaydi).
  static Future<bool> _defaultIsPermanentlyDenied() async {
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.deniedForever;
  }
}
