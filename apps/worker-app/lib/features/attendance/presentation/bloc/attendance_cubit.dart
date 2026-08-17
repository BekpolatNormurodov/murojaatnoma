import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

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
    Future<Position> Function() locate = _defaultLocate,
  }) : _repository = repository,
       _geofence = geofence,
       _locate = locate,
       super(const AttendanceLoading());

  final AttendanceRepository _repository;
  final GeofenceService _geofence;
  final Future<Position> Function() _locate;

  /// Davomat holatini yuklaydi (yoki qayta yuklaydi — masalan pull-to-
  /// refresh). Har doim [AttendanceLoading] bilan boshlanadi, shunda
  /// qayta yuklashda ham eski ma'lumot ustida "muzlab qolgan" holat
  /// ko'rinmaydi.
  Future<void> load() async {
    emit(const AttendanceLoading());
    try {
      final result = await _repository.myAttendance();
      result.fold(
        (failure) => emit(AttendanceError(failure.message)),
        (attendance) => emit(_loadedStateFor(attendance)),
      );
    } on Object catch (e) {
      emit(AttendanceError('Kutilmagan xatolik: $e'));
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
    if (attendance.week.isEmpty) return const AttendanceEmpty();

    final today = attendance.today.checkIn == null ? null : attendance.today;
    return AttendanceLoaded(today: today, week: attendance.week);
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
    return Geolocator.getCurrentPosition();
  }
}
