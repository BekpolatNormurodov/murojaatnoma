/// Data qatlamida (`AttendanceRemoteDataSourceApiImpl`) uloqtiriladigan,
/// `/attendance/check-in`/`/attendance/check-out`ning ANIQ HTTP holat
/// kodlariga mos keladigan past darajali xatoliklar. `AttendanceRepositoryImpl`
/// bularni tegishli `Failure` turlariga aylantiradi (qarang:
/// `domain/errors/attendance_failures.dart`) — umumiy `ServerException`
/// (`app_core`) dan ATAYLAB alohida, chunki chaqiruvchi (`FaceCubit`) bu
/// ikki holatni (allaqachon belgilangan / umuman server xatosi) turlicha
/// ko'rsatishi kerak bo'lishi mumkin.
library;

/// `POST /attendance/check-in` 409 qaytardi — bugun allaqachon check-in
/// qilingan. [message] backend javobining `{message}` maydonidan (`uz`
/// tilida).
class AlreadyCheckedInException implements Exception {
  AlreadyCheckedInException([
    this.message = 'Bugun allaqachon keldingiz belgilangan',
  ]);

  final String message;
}

/// `POST /attendance/check-out` 409 qaytardi — bugun allaqachon
/// check-out qilingan.
class AlreadyCheckedOutException implements Exception {
  AlreadyCheckedOutException([
    this.message = 'Bugun allaqachon ketganingiz belgilangan',
  ]);

  final String message;
}

/// `POST /attendance/check-out` 400 qaytardi — bugun hali check-in
/// qilinmagan.
class NotCheckedInException implements Exception {
  NotCheckedInException([
    this.message = 'Avval kelganingizni belgilashingiz kerak',
  ]);

  final String message;
}
