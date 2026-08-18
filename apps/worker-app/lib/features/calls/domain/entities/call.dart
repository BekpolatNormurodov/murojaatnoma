import 'package:equatable/equatable.dart';

/// Qo'ng'iroq turi — ovozli yoki video.
enum CallMedia {
  audio,
  video;

  /// Kontrakt qatori (`'audio'|'video'`).
  String get wire => name;

  /// Kontrakt qatoridan ([CallMedia]) — noma'lum bo'lsa [audio].
  static CallMedia fromWire(String? value) =>
      value == 'video' ? CallMedia.video : CallMedia.audio;
}

/// Qo'ng'iroq yo'nalishi — kiruvchi (bizga chaqirilgan) yoki chiquvchi
/// (biz chaqirgan).
enum CallDirection { incoming, outgoing }

/// Suhbatdosh (peer) — kiruvchi qo'ng'iroqda `call:incoming.from`, chiquvchida
/// biz chaqirgan xodim.
class CallPeer extends Equatable {
  const CallPeer({required this.id, required this.name, this.avatar});

  factory CallPeer.fromJson(Map<String, dynamic> json) => CallPeer(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
    avatar: json['avatar'] as String?,
  );

  final String id;
  final String name;
  final String? avatar;

  @override
  List<Object?> get props => [id, name, avatar];
}

/// Qo'ng'iroq tarixi yozuvi (`GET /calls` — `CallLog`). Tarix UI (kiruvchi/
/// chiquvchi/o'tkazib yuborilgan belgilari) uchun.
class CallLogEntry extends Equatable {
  const CallLogEntry({
    required this.id,
    required this.callerId,
    required this.callerName,
    required this.calleeId,
    required this.calleeName,
    required this.media,
    required this.status,
    required this.startedAt,
    this.durationSec = 0,
  });

  factory CallLogEntry.fromJson(Map<String, dynamic> json) => CallLogEntry(
    id: json['id'] as String? ?? '',
    callerId: json['callerId'] as String? ?? '',
    callerName: json['callerName'] as String? ?? '',
    calleeId: json['calleeId'] as String? ?? '',
    calleeName: json['calleeName'] as String? ?? '',
    media: CallMedia.fromWire(json['media'] as String?),
    status: json['status'] as String? ?? '',
    startedAt: json['startedAt'] as String? ?? '',
    durationSec: (json['durationSec'] as num?)?.toInt() ?? 0,
  );

  final String id;
  final String callerId;
  final String callerName;
  final String calleeId;
  final String calleeName;
  final CallMedia media;

  /// `ringing|accepted|rejected|missed|cancelled|ended|busy`.
  final String status;
  final String startedAt;
  final int durationSec;

  @override
  List<Object?> get props => [
    id,
    callerId,
    callerName,
    calleeId,
    calleeName,
    media,
    status,
    startedAt,
    durationSec,
  ];
}
