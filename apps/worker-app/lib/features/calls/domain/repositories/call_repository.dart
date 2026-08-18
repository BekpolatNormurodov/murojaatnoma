import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';

/// 1:1 WebRTC qo'ng'iroqlar uchun HTTP shartnoma (signalizatsiya
/// Socket.IO orqali — qarang: `RealtimeSocketService`).
///
/// - `GET /rt/ice-servers` (Public) -> `{ iceServers: RTCIceServer[] }` —
///   media ulanishi uchun STUN (+ ixtiyoriy TURN) serverlari. Qo'ng'iroqdan
///   oldin bir marta olinadi, shunda TURN keyinchalik server tomonda
///   qo'shilsa ilova qayta qurilmaydi.
/// - `GET /calls?userId=&limit=` -> `CallLog[]` — so'nggi qo'ng'iroqlar
///   (kiruvchi/chiquvchi/o'tkazib yuborilgan) tarixi.
abstract class CallRepository {
  /// ICE serverlar ro'yxati (RTCPeerConnection `iceServers` konfiguratsiyasi
  /// uchun tayyor `Map` ro'yxati). Xatoda [Left] — chaqiruvchi standart
  /// STUN'ga tushadi.
  Future<Either<Failure, List<Map<String, dynamic>>>> iceServers();

  /// So'nggi qo'ng'iroqlar tarixi.
  Future<Either<Failure, List<CallLogEntry>>> history({int limit = 50});
}
