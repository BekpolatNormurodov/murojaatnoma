import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

/// Joriy xodimning bugungi holati + so'nggi hafta tarixini o'qiydi
/// (`GET /attendance/me`). Kirish parametriga muhtoj emas —
/// `NoParams` (`app_core`).
///
/// `AttendanceCubit.load()` hozircha [AttendanceRepository.myAttendance]ni
/// TO'G'RIDAN-TO'G'RI chaqiradi (eski cubit `history()`ni ham usecase'siz
/// shunday chaqirar edi — izchillik saqlangan), lekin bu usecase boshqa
/// consumerlar (masalan kelajakdagi bildirishnoma/widget) uchun ham
/// mavjud bo'lishi uchun qo'shildi.
class GetMyAttendance implements UseCase<MyAttendance, NoParams> {
  GetMyAttendance(this.repository);

  final AttendanceRepository repository;

  @override
  Future<Either<Failure, MyAttendance>> call(NoParams params) =>
      repository.myAttendance();
}
