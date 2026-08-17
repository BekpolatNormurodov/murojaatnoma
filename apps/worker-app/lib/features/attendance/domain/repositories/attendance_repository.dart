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
    this.employeeId,
    this.embedding,
  });

  final double lat;
  final double lng;
  final String screenshotPath;

  /// Ishchi ID — jonli backend (`useMock == false`) uchun: server
  /// `/attendance/check-in`da moslikni shu ID bo'yicha saqlangan
  /// shablon bilan hisoblaydi. Mock oqimda (standart) `null`.
  final String? employeeId;

  /// Liveness tekshiruvida hisoblangan probe yuz embeddingi — jonli
  /// backendga yuboriladi (server o'zi >=0.7 moslikni hisoblaydi va
  /// tekshiradi). Mock oqimda (standart) `null` — mahalliy moslik
  /// (`FaceMatcher`) allaqachon `FaceCubit.verifyAndCheckIn`da tekshirib
  /// bo'lgan.
  final List<double>? embedding;

  @override
  List<Object?> get props => [
    lat,
    lng,
    screenshotPath,
    employeeId,
    embedding,
  ];
}
