import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';

/// Kamera preview'ini KO'RSATADI — old (selfie) kamerada QO'SHIMCHA oynalash
/// (mirror) QO'LLANMAYDI.
///
/// Muhim: platforma kamera qatlami (Android — CameraX `PreviewView`, iOS —
/// AVFoundation `AVCaptureVideoPreviewLayer`) old kamerani ALLAQACHON tabiiy
/// "oyna" (mirror) ko'rinishida ko'rsatadi. Ilgari bu yerga qo'shilgan
/// `Transform(scaleX: -1)` shu tayyor oynani IKKINCHI marta aylantirib,
/// tasvir chap-o'ng teskari (yozuv teskari o'qiladigan) ko'rinib qolardi —
/// foydalanuvchi buni "kamera teskari ishlayapti" deb bildirgan. Shuning
/// uchun endi hech qanday qo'shimcha oynalash yo'q: platforma ko'rsatgan
/// tasvir aynan shundayligicha chiqadi.
///
/// **Faqat vizual**: bu widget faqat render daraxtini ko'rsatadi. ML Kit
/// aniqlash (`FaceDetectorService.detect()`) va embedding uchun 112x112
/// kesish (`FaceCubit._cropTo112`) DOIM xom `CameraImage` kadr baytlari
/// ustida ishlaydi — preview ko'rinishi ularga umuman ta'sir qilmaydi, shu
/// bois yuz tanish (enroll VA verify) hech qachon "teskari" natija bermaydi.
class MirroredCameraPreview extends StatelessWidget {
  const MirroredCameraPreview({required this.controller, super.key});

  final CameraController controller;

  @override
  Widget build(BuildContext context) => CameraPreview(controller);
}
