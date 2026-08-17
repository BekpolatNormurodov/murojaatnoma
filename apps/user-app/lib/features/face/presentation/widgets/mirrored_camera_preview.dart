import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';

/// Kamera preview'ini KO'RSATADI — old (selfie) kamerada QO'SHIMCHA
/// oynalash (mirror) QO'LLANMAYDI.
///
/// Platforma kamera qatlami (Android — CameraX, iOS — AVFoundation) old
/// kamerani ALLAQACHON tabiiy "oyna" ko'rinishida beradi. Ilgari bu yerdagi
/// `Transform(scaleX: -1)` shu tayyor oynani IKKINCHI marta aylantirib,
/// chap-o'ng teskari qilib qo'yardi (foydalanuvchi: "chapga yursam o'ngga
/// yurgandek"). Endi qo'shimcha oynalash yo'q — platforma ko'rsatgan
/// tabiiy tasvir aynan shundayligicha chiqadi.
///
/// `worker_app/.../mirrored_camera_preview.dart` bilan BIR XIL. Faqat
/// vizual — aniqlash/embedding xom kadr ustida ishlaydi (qarang:
/// `FaceDetectorService` va `FaceCubit._cropTo112` hujjatlari).
class MirroredCameraPreview extends StatelessWidget {
  const MirroredCameraPreview({required this.controller, super.key});

  final CameraController controller;

  @override
  Widget build(BuildContext context) => CameraPreview(controller);
}
