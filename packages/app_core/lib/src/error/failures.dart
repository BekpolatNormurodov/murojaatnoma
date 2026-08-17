import 'package:equatable/equatable.dart';

/// Domen/taqdimot qatlamlarida ishlatiladigan barcha xatoliklarning
/// bazaviy klassi. Repository'lar [Exception]larni ushlab, mos
/// [Failure] turiga aylantirib qaytaradi.
abstract class Failure extends Equatable {
  const Failure([this.message = 'Xatolik yuz berdi']);

  /// Foydalanuvchiga ko'rsatsa bo'ladigan xatolik matni.
  final String message;

  @override
  List<Object?> get props => [message];
}

/// Server (backend) tomonidan qaytarilgan xatolik.
class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Server xatosi']);
}

/// Avtorizatsiya bilan bog'liq xatolik (masalan, 401 yoki eskirgan token).
class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Avtorizatsiya xatosi']);
}

/// Lokal keshni o'qish/yozishda yuz bergan xatolik.
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Keshda xato']);
}

/// Internet aloqasi yo'qligi sabab yuz bergan xatolik.
class NetworkFailure extends Failure {
  const NetworkFailure([super.message = "Internet aloqasi yo'q"]);
}

/// Ish hududidan (geofence) tashqarida check-in urinishi.
class GeofenceFailure extends Failure {
  const GeofenceFailure([super.message = 'Ish hududidan tashqaridasiz']);
}
