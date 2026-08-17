/// Bitta kamera kadridan olingan yuz-sifat signali — ML Kit'ning
/// klassifikatsiya natijalaridan (`worker_app`dagi
/// `liveness_challenge.dart`ning `FaceSignal`i bilan bir xil shakl).
///
/// Fuqaro ilovasida liveness challenge (ko'z qisish/bosh burish) YO'Q —
/// faqat sifat-gate (markazda + ko'zlar ochiq + frontal) uchun ishlatiladi.
class FaceSignal {
  const FaceSignal({this.leftEye, this.rightEye, this.headEulerY, this.smile});

  final double? leftEye;
  final double? rightEye;
  final double? headEulerY;
  final double? smile;
}
