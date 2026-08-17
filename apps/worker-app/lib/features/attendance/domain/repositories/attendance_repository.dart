import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';

/// Davomat (attendance) — o'z-o'zini check-in qilish va tarixni o'qish
/// uchun shartnoma.
abstract class AttendanceRepository {
  /// Joriy koordinata va yuz-tasdiqlash skrinshoti bilan bugungi kunga
  /// check-in qiladi.
  ///
  /// Geofence tekshiruvi bu qatlamda EMAS — uni chaqiruvchi (`CheckIn`
  /// usecase) allaqachon bajargan bo'ladi.
  Future<Either<Failure, AttendanceDay>> checkIn(CheckInParams params);

  /// Davomat tarixini o'qiydi.
  Future<Either<Failure, List<AttendanceDay>>> history();
}

/// [AttendanceRepository.checkIn] va `CheckIn` usecase birgalikda
/// ishlatadigan kirish parametrlari.
///
/// Bu klass shu yerda (repository fayli) e'lon qilingan — chunki
/// repository interfeysi uni to'g'ridan-to'g'ri metod imzosida talab
/// qiladi. `CheckIn` usecase uni shu yerdan import qiladi, shunday qilib
/// bog'liqlik yo'nalishi standart bo'yicha saqlanadi (usecase ->
/// repository, hech qachon aksincha).
class CheckInParams extends Equatable {
  const CheckInParams({
    required this.lat,
    required this.lng,
    required this.screenshotPath,
  });

  final double lat;
  final double lng;
  final String screenshotPath;

  @override
  List<Object?> get props => [lat, lng, screenshotPath];
}
