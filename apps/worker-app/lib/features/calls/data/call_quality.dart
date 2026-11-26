import 'package:flutter_webrtc/flutter_webrtc.dart';

/// Mikrofon: aks-sado, shovqin va balandlik tizim tomonidan tozalanadi.
const Map<String, dynamic> kCallAudio = {
  'echoCancellation': true,
  'noiseSuppression': true,
  'autoGainControl': true,
};

/// 1:1 qo'ng'iroq videosi — HD. Kamera qo'llamasa eng yaqinini beradi.
const Map<String, dynamic> kCallVideo = {
  'facingMode': 'user',
  'width': {'ideal': 1280},
  'height': {'ideal': 720},
  'frameRate': {'ideal': 30},
};

/// 720p30 uchun yuqori chegara; tarmoq sustlashsa WebRTC o'zi pasaytiradi.
const int kCallMaxVideoBitrate = 2500000;

/// Ovoz uchun (Opus) yuqori chegara.
const int kCallMaxAudioBitrate = 64000;

/// Yuboriladigan oqimlarning chegarasini ko'taradi. Qo'llab-quvvatlamaydigan
/// qurilmada sifat avtomatik qoladi.
Future<void> raiseCallQuality(RTCPeerConnection pc) async {
  try {
    for (final sender in await pc.getSenders()) {
      final kind = sender.track?.kind;
      if (kind != 'video' && kind != 'audio') continue;
      final bitrate = kind == 'video'
          ? kCallMaxVideoBitrate
          : kCallMaxAudioBitrate;
      final params = sender.parameters;
      final encodings = params.encodings;
      if (encodings == null || encodings.isEmpty) {
        params.encodings = [RTCRtpEncoding(maxBitrate: bitrate)];
      } else {
        encodings.first.maxBitrate = bitrate;
      }
      await sender.setParameters(params);
    }
  } on Object {
    // Sifat sozlanmasa ham qo'ng'iroq davom etadi.
  }
}
