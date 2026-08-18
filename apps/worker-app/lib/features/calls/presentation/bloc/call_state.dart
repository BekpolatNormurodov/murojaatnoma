part of 'call_cubit.dart';

/// Qo'ng'iroq holat-mashinasi bosqichlari.
enum CallPhase {
  /// Faol qo'ng'iroq yo'q.
  idle,

  /// Chiquvchi — chaqiruv yuborildi, javob kutilmoqda ("Chaqirilmoqda…").
  outgoing,

  /// Kiruvchi — `call:incoming` keldi, jiringlash ekrani (qabul/rad).
  incoming,

  /// Qabul qilingan — SDP/ICE almashinuvi, media hali ulanmagan
  /// ("Ulanmoqda…").
  connecting,

  /// Media P2P oqmoqda — faol suhbat (mm:ss sanog'i).
  active,

  /// Tugadi — sabab ([CallEndReason]) bilan; ekran qisqa vaqtdan so'ng
  /// yopiladi.
  ended,
}

/// Qo'ng'iroq nega tugagani — tugash ekranidagi matn uchun.
enum CallEndReason {
  none,

  /// Biz go'shakni qo'ydik.
  hangup,

  /// Suhbatdosh tugatdi (`call:ended`).
  remoteEnded,

  /// Rad etildi (`call:rejected` yoki biz rad etdik).
  rejected,

  /// Bekor qilindi (`call:cancelled` yoki biz bekor qildik).
  cancelled,

  /// Suhbatdosh band (`call:busy`).
  busy,

  /// Javobsiz (`call:missed`).
  missed,

  /// Media/ruxsat xatosi (masalan kamera/mikrofonga ruxsat berilmadi).
  failed,
}

/// 1:1 qo'ng'iroqning to'liq holati. `RTCVideoRenderer`lar holatda EMAS —
/// ular [CallCubit]da (o'zgaruvchan obyektlar) saqlanadi va getterlar orqali
/// beriladi.
class CallState extends Equatable {
  const CallState({
    this.phase = CallPhase.idle,
    this.callId,
    this.peer,
    this.direction = CallDirection.incoming,
    this.media = CallMedia.audio,
    this.micOn = true,
    this.camOn = true,
    this.frontCamera = true,
    this.remoteVideoReady = false,
    this.elapsed = Duration.zero,
    this.endReason = CallEndReason.none,
    this.errorMessage,
  });

  /// Boshlang'ich (faol qo'ng'iroqsiz) holat.
  const CallState.idle() : this();

  final CallPhase phase;
  final String? callId;
  final CallPeer? peer;
  final CallDirection direction;
  final CallMedia media;

  /// Mikrofon yoniqmi (o'chiq bo'lsa ovoz treki `enabled=false`).
  final bool micOn;

  /// Kamera yoniqmi (video qo'ng'iroqda; o'chiq bo'lsa video treki
  /// `enabled=false`).
  final bool camOn;

  /// Old kamera ishlatilyaptimi (flip tugmasi uchun).
  final bool frontCamera;

  /// Suhbatdoshning video treki keldimi (remote renderer to'ldirildi).
  final bool remoteVideoReady;

  /// Faol suhbat davomiyligi.
  final Duration elapsed;
  final CallEndReason endReason;
  final String? errorMessage;

  bool get isVideo => media == CallMedia.video;

  CallState copyWith({
    CallPhase? phase,
    String? callId,
    CallPeer? peer,
    CallDirection? direction,
    CallMedia? media,
    bool? micOn,
    bool? camOn,
    bool? frontCamera,
    bool? remoteVideoReady,
    Duration? elapsed,
    CallEndReason? endReason,
    String? errorMessage,
  }) {
    return CallState(
      phase: phase ?? this.phase,
      callId: callId ?? this.callId,
      peer: peer ?? this.peer,
      direction: direction ?? this.direction,
      media: media ?? this.media,
      micOn: micOn ?? this.micOn,
      camOn: camOn ?? this.camOn,
      frontCamera: frontCamera ?? this.frontCamera,
      remoteVideoReady: remoteVideoReady ?? this.remoteVideoReady,
      elapsed: elapsed ?? this.elapsed,
      endReason: endReason ?? this.endReason,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => [
    phase,
    callId,
    peer,
    direction,
    media,
    micOn,
    camOn,
    frontCamera,
    remoteVideoReady,
    elapsed,
    endReason,
    errorMessage,
  ];
}
