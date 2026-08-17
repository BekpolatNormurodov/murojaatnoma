import 'dart:io';
import 'dart:ui';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';

/// `FaceDetectorService.detect` natijasi: aniqlangan yuzning chegara
/// to'rtburchagi (`boundingBox`) va `LivenessController.feed`ga
/// to'g'ridan-to'g'ri uzatiladigan `FaceSignal`.
class DetectedFace {
  const DetectedFace({required this.boundingBox, required this.signal});

  final Rect boundingBox;
  final FaceSignal signal;
}

/// Google ML Kit (`google_mlkit_face_detection`) ustidagi yuz aniqlash
/// xizmati — bitta kamera kadrini (`CameraImage`) qabul qilib, birinchi
/// topilgan yuzning bbox'i va `FaceSignal`ini qaytaradi.
///
/// Bu klass kamera UI'si, ruxsatlar yoki kadr-oqimi (frame stream)
/// logikasini bilmaydi — faqat bitta tayyor kadrni qayta ishlaydi.
///
/// **MUHIM — oynalash (mirror) shartnomasi (buzilsa "yuz teskari
/// tanilyapti" xatosiga olib keladi)**: [detect] HECH QACHON `image`
/// baytlarini qo'lda oynalamasin (gorizontal flip qilmasin) —
/// [_toInputImage] `image.planes.first.bytes`ni TO'G'RIDAN-TO'G'RI, xom
/// holida ML Kitga uzatadi. Bu ATAYLAB shunday, ikkita sababga ko'ra:
/// (a) old (selfie) kamerada ML Kitning `boundingBox`/landmark/
/// `headEulerAngleY` natijalari "kadr" koordinata tizimiga nisbatan
/// hisoblanadi (Google hujjati: "positive euler y is when the face
/// turns toward the right side of the **image** that is being
/// processed") — agar shu yerda kadr oldindan oynalansa, bu qiymatlar
/// old-kameraga kutilganidan TESKARI chiqadi; (b) [detect] BITTA kod
/// yo'li sifatida ham ro'yxatdan o'tish (`FaceCubit.capture`), ham
/// tekshirish (`FaceCubit._captureAndVerify`) tomonidan chaqiriladi —
/// agar bu yerda oynalash qo'shilsa-yu ikkalasidan biriga tasodifan
/// boshqacha tatbiq qilinsa, ikki oqim ENDI ikki xil orientatsiyada
/// hisoblangan embeddinglarni solishtiradi va moslik deyarli har doim
/// muvaffaqiyatsiz/tasodifiy bo'lib qoladi. Old kamera uchun "tabiiy
/// oyna" (selfie) ko'rinishi FAQAT preview widget qatlamida
/// (`MirroredCameraPreview` — bu klassdan butunlay mustaqil, faqat
/// render daraxtini oynalaydi) ta'minlanadi. Qarang: `FaceCubit
/// ._cropTo112` — embedding uchun 112x112 kesish ham xuddi shu xom,
/// oynalanmagan `CameraImage` baytlaridan, enroll va verify uchun BITTA
/// umumiy kod yo'li orqali ishlaydi — shu ikkala invariant birgalikda
/// "enroll va verify bir xil orientatsiyada" talabini kafolatlaydi.
class FaceDetectorService {
  // `fast` rejim + landmarks O'CHIQ: yuzni ANIQLASH ancha tezroq va
  // barqarorroq bo'ladi (accurate + landmarks past quvvatli qurilmada
  // kadrlarni sekin qayta ishlab, aniqlash "uzuq-yuluq" bo'lib, ekran
  // "Yuzingizni ovalga joylang"da qotib qolardi). Sifat-gate faqat
  // `enableClassification` (ko'z ochiq/yumuq) + bbox + `headEulerAngleY`ni
  // ishlatadi — landmarks umuman kerak emas.
  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: true,
      // `performanceMode` — standart holatda allaqachon `fast`; landmarks
      // ham o'chiq (standart) — shu bois aniqlash tez va barqaror.
    ),
  );

  /// Kadrni ML Kit orqali qayta ishlaydi va birinchi topilgan yuzni
  /// qaytaradi; yuz topilmasa yoki kadr formati qo'llab-quvvatlanmasa
  /// `null`.
  ///
  /// `rotation`ni chaqiruvchi hisoblab beradi (sensor orientatsiyasi +
  /// qurilma orientatsiyasi — bu kamera-UI vazifasi doirasida hal
  /// qilinadi, bu yerda emas).
  ///
  /// **Faqat qurilmada tekshirilgan, unit testda EMAS**: `CameraImage` →
  /// `InputImage` konvertatsiyasi native kamera oqimi baytlariga bog'liq,
  /// bu esa `flutter test`ning VM muhitida mavjud emas.
  Future<DetectedFace?> detect(
    CameraImage image,
    InputImageRotation rotation,
  ) async {
    final inputImage = _toInputImage(image, rotation);
    if (inputImage == null) {
      if (kDebugMode) {
        debugPrint(
          'FACE: unsupported CameraImage format=${image.format.raw} '
          'planes=${image.planes.length} -> InputImage null',
        );
      }
      return null;
    }

    // ML Kit `processImage` bitta kadrда xato tashlasa — jimgina o'tkazamiz
    // (keyingi kadr qayta urinadi), butun oqim to'xtamasin.
    final List<Face> faces;
    try {
      faces = await _detector.processImage(inputImage);
    } on Object catch (e) {
      if (kDebugMode) debugPrint('FACE: processImage ERROR: $e');
      return null;
    }
    if (faces.isEmpty) return null;

    final face = faces.first;
    return DetectedFace(
      boundingBox: face.boundingBox,
      signal: FaceSignal(
        leftEye: face.leftEyeOpenProbability,
        rightEye: face.rightEyeOpenProbability,
        headEulerY: face.headEulerAngleY,
        smile: face.smilingProbability,
      ),
    );
  }

  /// Ichki `FaceDetector`ni yopadi va native resurslarni bo'shatadi.
  Future<void> dispose() => _detector.close();

  /// `CameraImage`ni ML Kit kutgan `InputImage`ga aylantiradi.
  ///
  /// Uch holatni QO'LLAB-QUVVATLAYDI (ba'zi Android qurilmalari `nv21`
  /// so'ralsa ham `yuv420`ni beradi — ilgari bu holat `null` qaytarib,
  /// yuz UMUMAN aniqlanmasdi):
  ///  * iOS — `bgra8888` (bitta tekislik);
  ///  * Android — `nv21` (bitta tekislik) — to'g'ridan-to'g'ri;
  ///  * Android — `yuv420_888` (uch tekislik) — [_yuv420ToNv21] orqali NV21
  ///    baytlariga birlashtirilib uzatiladi.
  InputImage? _toInputImage(CameraImage image, InputImageRotation rotation) {
    final size = Size(image.width.toDouble(), image.height.toDouble());
    final format = InputImageFormatValue.fromRawValue(image.format.raw as int);

    if (Platform.isIOS) {
      if (format != InputImageFormat.bgra8888 || image.planes.length != 1) {
        return null;
      }
      final plane = image.planes.first;
      return InputImage.fromBytes(
        bytes: plane.bytes,
        metadata: InputImageMetadata(
          size: size,
          rotation: rotation,
          format: InputImageFormat.bgra8888,
          bytesPerRow: plane.bytesPerRow,
        ),
      );
    }

    // Android — nv21 (bitta tekislik): eng yaxshi holat.
    if (format == InputImageFormat.nv21 && image.planes.length == 1) {
      final plane = image.planes.first;
      return InputImage.fromBytes(
        bytes: plane.bytes,
        metadata: InputImageMetadata(
          size: size,
          rotation: rotation,
          format: InputImageFormat.nv21,
          bytesPerRow: plane.bytesPerRow,
        ),
      );
    }

    // Android — yuv420_888 (uch tekislik) -> NV21'ga birlashtiramiz.
    if (image.planes.length == 3) {
      return InputImage.fromBytes(
        bytes: _yuv420ToNv21(image),
        metadata: InputImageMetadata(
          size: size,
          rotation: rotation,
          format: InputImageFormat.nv21,
          bytesPerRow: image.width,
        ),
      );
    }

    return null;
  }

  /// `yuv420_888` (Y + alohida U/V tekisliklari) kadrini NV21 (Y so'ng
  /// interleaved V,U) baytlariga aylantiradi — plane stride/pixelStride
  /// hisobga olinadi (aks holda tasvir siljib/buzilib ketardi).
  Uint8List _yuv420ToNv21(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final yPlane = image.planes[0];
    final uPlane = image.planes[1];
    final vPlane = image.planes[2];

    final out = Uint8List(width * height + (width * height ~/ 2));
    var idx = 0;

    // Y tekisligi (rowStride hisobga olingan holda).
    final yRowStride = yPlane.bytesPerRow;
    for (var row = 0; row < height; row++) {
      final rowStart = row * yRowStride;
      for (var col = 0; col < width; col++) {
        out[idx++] = yPlane.bytes[rowStart + col];
      }
    }

    // VU tekisligi (NV21 = avval V, keyin U).
    final uvRowStride = uPlane.bytesPerRow;
    final uvPixelStride = uPlane.bytesPerPixel ?? 1;
    for (var row = 0; row < height ~/ 2; row++) {
      for (var col = 0; col < width ~/ 2; col++) {
        final uvIndex = row * uvRowStride + col * uvPixelStride;
        if (uvIndex >= vPlane.bytes.length || uvIndex >= uPlane.bytes.length) {
          continue;
        }
        out[idx++] = vPlane.bytes[uvIndex];
        out[idx++] = uPlane.bytes[uvIndex];
      }
    }
    return out;
  }
}
