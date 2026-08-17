import 'dart:io';
import 'dart:ui';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:user_app/features/face/domain/entities/face_signal.dart';

/// `FaceDetectorService.detect` natijasi: aniqlangan yuzning chegara
/// to'rtburchagi (`boundingBox`) va `FaceCubit`ning sifat-gate'iga
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
/// `worker_app/features/face/data/services/face_detector_service.dart`
/// bilan bir xil — bu klass kamera UI'si, ruxsatlar yoki kadr-oqimi
/// logikasini bilmaydi, faqat bitta tayyor kadrni qayta ishlaydi.
class FaceDetectorService {
  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      // landmarks o'chiq (standart) + `performanceMode` standart `fast` —
      // aniqlash tez va barqaror (accurate/landmarks past quvvatli qurilmada
      // aniqlashni "uzuq-yuluq" qilib qo'yardi).
      enableClassification: true,
    ),
  );

  /// Kadrni ML Kit orqali qayta ishlaydi va birinchi topilgan yuzni
  /// qaytaradi; yuz topilmasa yoki kadr formati qo'llab-quvvatlanmasa
  /// `null`.
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

    final faces = await _detector.processImage(inputImage);
    if (kDebugMode) {
      debugPrint(
        'FACE: format=${image.format.raw} planes=${image.planes.length} '
        'rot=$rotation faces=${faces.length}',
      );
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

  /// `CameraImage`ni ML Kit kutgan `InputImage`ga aylantiradi — iOS
  /// `bgra8888`, Android `nv21` (bitta tekislik) yoki `yuv420_888` (uch
  /// tekislik -> [_yuv420ToNv21] orqali NV21'ga). Ba'zi qurilmalar `nv21`
  /// so'ralsa ham `yuv420` beradi — ilgari bu holat `null` qaytarib, yuz
  /// UMUMAN aniqlanmasdi.
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

  /// `yuv420_888` (Y + alohida U/V) kadrini NV21 (Y so'ng interleaved V,U)
  /// baytlariga aylantiradi — plane stride/pixelStride hisobga olinadi.
  Uint8List _yuv420ToNv21(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final yPlane = image.planes[0];
    final uPlane = image.planes[1];
    final vPlane = image.planes[2];

    final out = Uint8List(width * height + (width * height ~/ 2));
    var idx = 0;

    final yRowStride = yPlane.bytesPerRow;
    for (var row = 0; row < height; row++) {
      final rowStart = row * yRowStride;
      for (var col = 0; col < width; col++) {
        out[idx++] = yPlane.bytes[rowStart + col];
      }
    }

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
