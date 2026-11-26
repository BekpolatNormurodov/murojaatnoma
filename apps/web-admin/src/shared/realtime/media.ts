/* Qo'ng'iroq sifati: kamera/mikrofon talablari va yuborish chegaralari. */

/** Aks-sado, shovqin va balandlikni brauzer tozalaydi. */
export const CALL_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** HD; kamera qo'llamasa eng yaqinini beradi. */
export const CALL_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

/** 1:1 qo'ng'iroqda yuqori chegaralar; tarmoq sustlashsa WebRTC o'zi pasaytiradi. */
export const MAX_VIDEO_BITRATE = 2_500_000;
export const MAX_AUDIO_BITRATE = 64_000;

/** Qo'llab-quvvatlamaydigan brauzerda sifat avtomatik qoladi. */
export async function raiseCallQuality(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    const kind = sender.track?.kind;
    if (!kind) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = kind === 'video' ? MAX_VIDEO_BITRATE : MAX_AUDIO_BITRATE;
      await sender.setParameters(params);
    } catch {
      /* brauzer ruxsat bermadi — avtomatik sifat */
    }
  }
}
