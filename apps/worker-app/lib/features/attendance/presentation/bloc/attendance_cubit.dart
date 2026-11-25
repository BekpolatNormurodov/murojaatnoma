import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/core/utils/error_text.dart';
import 'package:worker_app/features/attendance/data/attendance_precheck.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/attendance_scan_params.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';

part 'attendance_state.dart';

/// Bosh sahifa (davomat) dashboard'ini boshqaruvchi Cubit.
///
/// Ikki mustaqil vazifa bajaradi:
/// - [load] — `AttendanceRepository.myAttendance()`dan (`GET
///   /attendance/me`) bugungi holat va so'nggi hafta ma'lumotlarini
///   BITTA so'rovda o'qiydi (asosiy `AttendanceState` pipeline'i,
///   `HomePage`ning butun tanasi shunga qarab qurilib qayta quriladi).
///   Eski `history()`dan farqi: server `today`ni O'ZI ajratib beradi —
///   endi bu yerda sana bo'yicha qidirish/`clock` inject qilish shart
///   emas (qarang: [_loadedStateFor]).
/// - [checkGeofence] — "Yuz bilan tasdiqlash" CTA bosilganda bir martalik
///   joylashuv tekshiruvi; `FaceCubit.checkGeofence()` (Vazifa 17) bilan
///   bir xil naqsh: asosiy state pipeline'iga UMUMAN ta'sir qilmaydi
///   (`emit` chaqirmaydi), chaqiruvchi (`HomePage`) natijani to'g'ridan-
///   to'g'ri ishlatadi.
///
/// Har ikkalasi ham hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik
/// har doim mos holat/qiymatga aylanadi (`AttendanceError` / `null`).
class AttendanceCubit extends Cubit<AttendanceState> {
  AttendanceCubit({
    required AttendanceRepository repository,
    required GeofenceService geofence,
    AttendancePrecheck? precheck,
    CheckIn? checkIn,
    CheckOut? checkOut,
    Future<Position> Function() locate = _defaultLocate,
  }) : _repository = repository,
       _geofence = geofence,
       _precheck = precheck,
       _checkIn = checkIn,
       _checkOut = checkOut,
       _locate = locate,
       super(const AttendanceLoading());

  final AttendanceRepository _repository;
  final GeofenceService _geofence;
  final AttendancePrecheck? _precheck;
  final CheckIn? _checkIn;
  final CheckOut? _checkOut;
  final Future<Position> Function() _locate;

  /// Oxirgi `GET /attendance/me` javobidagi `faceRequired` — `false`
  /// bo'lsa keldi/ketdi kamerasiz, [markByLocation] orqali bajariladi.
  /// Hali yuklanmagan/xato bo'lsa `true` (avvalgi xatti-harakat).
  bool _faceRequired = true;
  bool get faceRequired => _faceRequired;

  /// Yuz skaneri O'CHIRILGAN (`faceRequired == false`) paytdagi keldi/ketdi:
  /// kamera ochilmaydi — joriy GPS joylashuvi olinib, `CheckIn`/`CheckOut`
  /// faqat `{latitude, longitude, accuracy}` bilan chaqiriladi (server joy
  /// bo'yicha tekshiradi). Muvaffaqiyatda holat qayta yuklanadi.
  ///
  /// Hech qachon throw qilmaydi — natija [LocationMarkOutcome].
  Future<LocationMarkOutcome> markByLocation({bool checkOut = false}) async {
    final usecaseIn = _checkIn;
    final usecaseOut = _checkOut;
    if ((checkOut ? usecaseOut : usecaseIn) == null) {
      return const LocationMarkOutcome.failure(
        'Bu amal hozircha mavjud emas',
      );
    }
    final Position position;
    try {
      position = await _locate();
    } on Object catch (e) {
      return LocationMarkOutcome.failure(_locationErrorText(e));
    }
    final params = AttendanceScanParams(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    );
    try {
      final result = checkOut
          ? await usecaseOut!(params)
          : await usecaseIn!(params);
      final outcome = result.fold(
        (failure) => LocationMarkOutcome.failure(
          failure.message.isEmpty
              ? 'Ish joyingizdan uzoqdasiz'
              : failure.message,
        ),
        (scan) => scan.isValid
            ? LocationMarkOutcome.success(
                checkOut ? 'Ketganingiz belgilandi' : 'Kelganingiz belgilandi',
              )
            : LocationMarkOutcome.failure(
                (scan.reason ?? '').isEmpty
                    ? "Belgilab bo'lmadi — joylashuvni tekshiring"
                    : humanizeScanReason(scan.reason),
              ),
      );
      // Rad etilganda HAM qayta yuklaymiz: admin sozlamani (yuz majburiy)
      // yoki hududni o'zgartirgan bo'lishi mumkin.
      await load(silent: true);
      return outcome;
    } on Object catch (e) {
      await load(silent: true);
      return LocationMarkOutcome.failure(unexpectedError(e));
    }
  }

  static String _locationErrorText(Object error) {
    if (error is TimeoutException) {
      return "Joylashuv aniqlanmadi — ochiqroq joyga chiqib qayta urining";
    }
    if (error is StateError) return error.message;
    debugPrint('[attendance] locate: $error');
    return "Joylashuvni aniqlab bo'lmadi";
  }

  /// "Keldim/Ketdim" bosilganda: joylashuvni olib, SERVERdan so'raydi —
  /// xodimning o'z ofisi/radiusi yoki biriktirilgan mahallasi bo'yicha.
  /// Hech qachon throw qilmaydi.
  Future<PrecheckOutcome> precheckHere() async {
    final Position position;
    try {
      position = await _locate();
    } on Object catch (e) {
      return PrecheckOutcome.locationError(_locationErrorText(e));
    }
    final precheck = _precheck;
    if (precheck == null) {
      final inside = _geofence.isInside(position.latitude, position.longitude);
      return inside
          ? const PrecheckOutcome.allowed()
          : const PrecheckOutcome.blocked('Ish joyingizdan uzoqdasiz');
    }
    final result = await precheck.check(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    );
    if (result == null) return const PrecheckOutcome.unverified();
    return result.allowed
        ? PrecheckOutcome.allowed(result.message)
        : PrecheckOutcome.blocked(result.message);
  }

  /// Davomat holatini yuklaydi (yoki qayta yuklaydi — masalan pull-to-
  /// refresh). Har doim [AttendanceLoading] bilan boshlanadi, shunda
  /// qayta yuklashda ham eski ma'lumot ustida "muzlab qolgan" holat
  /// ko'rinmaydi.
  ///
  /// [silent] — ekranda ma'lumot bo'lsa skeletonsiz yangilaydi va xatoda eski
  /// ma'lumotni qoldiradi (ilovaga qaytish, belgilashdan keyin).
  Future<void> load({bool silent = false}) async {
    if (isClosed) return;
    final keep =
        silent && (state is AttendanceLoaded || state is AttendanceEmpty);
    if (!keep) emit(const AttendanceLoading());
    try {
      final result = await _repository.myAttendance();
      if (isClosed) return;
      result.fold(
        (failure) {
          if (!keep) emit(AttendanceError(failure.message));
        },
        (attendance) => emit(_loadedStateFor(attendance)),
      );
    } on Object catch (e) {
      if (!isClosed && !keep) emit(AttendanceError(unexpectedError(e)));
    }
  }

  /// `MyAttendance` (`GET /attendance/me`) javobini `AttendanceState`ga
  /// aylantiradi.
  ///
  /// [MyAttendance.today] server tomonidan HAR DOIM beriladi (hattoki
  /// hali check-in qilinmagan bo'lsa ham — `checkIn == null`, status
  /// odatda `'absent'`). Bu yerda ATAYLAB `today.checkIn == null`da
  /// [AttendanceLoaded.today]ni `null`ga tushiramiz — "hali check-in
  /// qilmadi" (neytral, `TodayStatusCard`da kulrang) semantik jihatdan
  /// "kelmadi deb belgilandi" (qizil `absent` chip)dan boshqa narsa, eski
  /// `history()`-based oqimdagi bilan bir xil ajratish saqlanadi (qarang:
  /// `AttendanceState.AttendanceLoaded` hujjati).
  AttendanceState _loadedStateFor(MyAttendance attendance) {
    _faceRequired = attendance.faceRequired;
    if (attendance.week.isEmpty) {
      return AttendanceEmpty(faceRequired: attendance.faceRequired);
    }

    // Ta'til / dam olish kuni — check-in bo'lmasa ham holat ko'rsatiladi.
    final status = attendance.today.status;
    final informative =
        status == AttendanceStatus.leave || status == AttendanceStatus.dayOff;
    final today = attendance.today.checkIn == null && !informative
        ? null
        : attendance.today;
    return AttendanceLoaded(
      today: today,
      week: attendance.week,
      faceRequired: attendance.faceRequired,
    );
  }

  /// "Yuz bilan tasdiqlash" CTA bosilganda chaqiriladi: joriy joylashuvni
  /// oladi va ish hududi ichidami tekshiradi.
  ///
  /// Hech qachon throw qilmaydi: `true` — ichkarida, `false` —
  /// tashqarida, `null` — aniqlab bo'lmadi (ruxsat yo'q/xizmat
  /// o'chirilgan/boshqa xato) — chaqiruvchi (`HomePage`) har uchalasini
  /// ham nazokat bilan ko'rsatadi.
  Future<bool?> checkGeofence() async {
    try {
      final position = await _locate();
      return _geofence.isInside(position.latitude, position.longitude);
    } on Object {
      return null;
    }
  }

  /// `locate` uchun standart (qurilma-only) implementatsiya —
  /// `FaceCubit._defaultLocate` (Vazifa 17) bilan bir xil naqsh: xizmat
  /// yoqilganini va ruxsatni tekshiradi (kerak bo'lsa so'raydi), so'ng
  /// `Geolocator.getCurrentPosition()`ni chaqiradi. Ataylab shu yerda
  /// mustaqil nusxalangan — `FaceCubit`ning xususiy metodi emas
  /// (`attendance` xususiyati `face`ga bog'liq bo'lib qolmasligi uchun);
  /// ikkalasi ham kichik va o'zgarmas bo'lgani uchun bu takror xavfsiz.
  static Future<Position> _defaultLocate() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError("Joylashuv xizmati o'chirilgan");
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Joylashuvga ruxsat berilmagan');
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        timeLimit: Duration(seconds: 20),
      ),
    );
  }
}

/// [AttendanceCubit.precheckHere] natijasi.
class PrecheckOutcome extends Equatable {
  const PrecheckOutcome.allowed([this.message = ''])
    : kind = PrecheckKind.allowed;
  const PrecheckOutcome.blocked(this.message) : kind = PrecheckKind.blocked;

  /// Server bilan bog'lanib bo'lmadi — skaner ochiladi, qarorni server qiladi.
  const PrecheckOutcome.unverified()
    : kind = PrecheckKind.unverified,
      message = '';
  const PrecheckOutcome.locationError(this.message)
    : kind = PrecheckKind.locationError;

  final PrecheckKind kind;
  final String message;

  bool get canScan =>
      kind == PrecheckKind.allowed || kind == PrecheckKind.unverified;

  @override
  List<Object?> get props => [kind, message];
}

enum PrecheckKind { allowed, blocked, unverified, locationError }

/// [AttendanceCubit.markByLocation] natijasi — UI tayyor o'zbekcha
/// [message]ni ko'rsatadi.
class LocationMarkOutcome extends Equatable {
  const LocationMarkOutcome.success(this.message) : success = true;
  const LocationMarkOutcome.failure(this.message) : success = false;

  final bool success;
  final String message;

  @override
  List<Object?> get props => [success, message];
}
