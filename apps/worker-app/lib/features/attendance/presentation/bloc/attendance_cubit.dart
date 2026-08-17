import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

part 'attendance_state.dart';

/// Bosh sahifa (davomat) dashboard'ini boshqaruvchi Cubit.
///
/// Ikki mustaqil vazifa bajaradi:
/// - [load] — `AttendanceRepository.history()`dan bugungi holat va
///   so'nggi hafta ma'lumotlarini o'qiydi (asosiy `AttendanceState`
///   pipeline'i, `HomePage`ning butun tanasi shunga qarab qurilib
///   qayta quriladi).
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
    DateTime Function() clock = DateTime.now,
    Future<Position> Function() locate = _defaultLocate,
  }) : _repository = repository,
       _geofence = geofence,
       _clock = clock,
       _locate = locate,
       super(const AttendanceLoading());

  final AttendanceRepository _repository;
  final GeofenceService _geofence;
  final DateTime Function() _clock;
  final Future<Position> Function() _locate;

  /// `AttendanceDay.date` bilan bir xil formatda ('yyyy-MM-dd') — faqat
  /// sonli maydonlardan iborat, shuning uchun `intl` mahalliy sana
  /// nomlari (oy/hafta kunlari) yuklanishini talab qilmaydi va istalgan
  /// qurilma/test lokalida xavfsiz ishlaydi.
  static final _dateFormat = DateFormat('yyyy-MM-dd');

  /// Davomat tarixini yuklaydi (yoki qayta yuklaydi — masalan pull-to-
  /// refresh). Har doim [AttendanceLoading] bilan boshlanadi, shunda
  /// qayta yuklashda ham eski ma'lumot ustida "muzlab qolgan" holat
  /// ko'rinmaydi.
  Future<void> load() async {
    emit(const AttendanceLoading());
    try {
      final result = await _repository.history();
      result.fold(
        (failure) => emit(AttendanceError(failure.message)),
        (days) => emit(_loadedStateFor(days)),
      );
    } on Object catch (e) {
      emit(AttendanceError('Kutilmagan xatolik: $e'));
    }
  }

  AttendanceState _loadedStateFor(List<AttendanceDay> days) {
    if (days.isEmpty) return const AttendanceEmpty();

    final sorted = [...days]..sort((a, b) => a.date.compareTo(b.date));
    final todayKey = _dateFormat.format(_clock());
    AttendanceDay? today;
    for (final day in sorted) {
      if (day.date == todayKey) {
        today = day;
        break;
      }
    }
    final week = sorted.length > 7
        ? sorted.sublist(sorted.length - 7)
        : sorted;

    return AttendanceLoaded(today: today, week: week);
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
