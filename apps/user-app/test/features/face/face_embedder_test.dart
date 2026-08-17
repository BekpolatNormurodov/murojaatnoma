import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/core/constants/face_constants.dart';
import 'package:user_app/features/face/data/services/face_embedder.dart';

// `FaceEmbedder.l2normalize` — sof, statik yordamchi funksiya. Interpreter/
// model hech qachon yuklanmaydi yoki ishga tushirilmaydi
// (`assets/models/mobilefacenet.tflite` hozircha placeholder — haqiqiy
// inference faqat qurilmada tekshiriladi).
//
// `embed()` fallback guruhi esa AYNAN shu placeholder holatni sinaydi: hech
// qachon `load()` chaqirilmaydi (demak `_interpreter` doim `null` qoladi),
// shuning uchun `embed()` HAR DOIM `_fallbackEmbed`ga tushadi.
void main() {
  test('l2 normalize yields unit length', () {
    final out = FaceEmbedder.l2normalize([3, 4]); // ->[0.6,0.8]
    expect(out[0], closeTo(0.6, 1e-9));
    expect(out[1], closeTo(0.8, 1e-9));
  });

  test('l2 normalize guards the zero vector (no division by zero)', () {
    final out = FaceEmbedder.l2normalize([0, 0, 0]);
    expect(out, equals([0.0, 0.0, 0.0]));
  });

  group('embed() fallback (no .tflite loaded — placeholder/demo mode)', () {
    test('isFallback defaults to false until load() is attempted', () {
      // `embed()` must be safe even if a caller forgets to call `load()`
      // first — it degrades to the fallback purely because `_interpreter`
      // is still null, regardless of the `isFallback` flag.
      expect(FaceEmbedder().isFallback, isFalse);
    });

    test('never throws and returns a kFaceEmbeddingSize-length, '
        'L2-normalized vector with zero model', () {
      final embedder = FaceEmbedder();

      final probe = embedder.embed(_facePattern(0));

      expect(probe, hasLength(kFaceEmbeddingSize));
      final norm = math.sqrt(probe.fold<double>(0, (s, v) => s + v * v));
      expect(norm, closeTo(1.0, 1e-9));
    });

    test('is deterministic: the exact same pixels yield the exact same '
        'vector', () {
      final embedder = FaceEmbedder();
      final rgb = _facePattern(0);

      expect(embedder.embed(rgb), equals(embedder.embed(rgb)));
    });

    test('rejects a wrongly-sized buffer (same contract as the real-model '
        'path)', () {
      final embedder = FaceEmbedder();
      expect(
        () => embedder.embed(Uint8List(10)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('same face across two frames (minor per-pixel jitter) yields a '
        'closer embedding than a structurally different face — genuine '
        'discrimination, never a blanket pass', () {
      final embedder = FaceEmbedder();

      // "Enrollment": one captured frame of person A.
      final enrolled = embedder.embed(_facePattern(0));
      // Same person, same geometry, small deterministic per-pixel jitter
      // standing in for real-world lighting/sensor noise between captures.
      final sameLater = embedder.embed(_facePattern(0, jitter: true));
      // A structurally different synthetic face.
      final differentPerson = embedder.embed(_facePattern(1));

      double cosine(List<double> a, List<double> b) {
        var dot = 0.0;
        for (var i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
        }
        return dot; // both already L2-normalized
      }

      final sameSimilarity = cosine(sameLater, enrolled);
      final differentSimilarity = cosine(differentPerson, enrolled);

      expect(
        sameSimilarity,
        greaterThan(differentSimilarity),
        reason:
            'same person (same=$sameSimilarity) must be more similar than '
            'a different person (different=$differentSimilarity)',
      );
    });
  });
}

/// Ikkita aniq farqlanadigan sintetik "yuz" naqshini quradi (`variant`
/// 0/1) — `kFaceInputSize x kFaceInputSize` grayscale-in-RGB piksel
/// bufferi. `jitter: true` bo'lsa, bir xil geometriyaga kichik,
/// deterministik piksel-darajasidagi shovqin qo'shiladi (RNG YO'Q).
Uint8List _facePattern(int variant, {bool jitter = false}) {
  final out = Uint8List(kFaceInputSize * kFaceInputSize * 3);
  for (var y = 0; y < kFaceInputSize; y++) {
    for (var x = 0; x < kFaceInputSize; x++) {
      final dx = (x - 56) / 56;
      final dy = (y - 56) / 56;
      final radial = dx * dx + dy * dy;

      double v;
      if (variant == 0) {
        v = 190 - 70 * radial; // bright center, dark corners
        v -= _blob(x, y, 38, 40, 9, 90); // left eye
        v -= _blob(x, y, 74, 40, 9, 90); // right eye
        v -= _blob(x, y, 56, 74, 16, 60); // mouth
      } else {
        v = 70 + 70 * radial; // dark center, bright corners (inverted)
        v += _blob(x, y, 30, 60, 10, 70);
        v += _blob(x, y, 82, 60, 10, 70);
        v += _blob(x, y, 56, 30, 18, 55);
      }
      if (jitter) {
        v += ((x * 7 + y * 13) % 9) - 4; // deterministic, no RNG
      }

      final channel = v.clamp(0, 255).round();
      final idx = (y * kFaceInputSize + x) * 3;
      out[idx] = channel;
      out[idx + 1] = channel;
      out[idx + 2] = channel;
    }
  }
  return out;
}

/// Doiraviy "blob" (ko'z/og'iz uchun) yorqinlik hissasi.
double _blob(
  int x,
  int y,
  double cx,
  double cy,
  double radius,
  double strength,
) {
  final ddx = x - cx;
  final ddy = y - cy;
  final d2 = ddx * ddx + ddy * ddy;
  final r2 = radius * radius;
  if (d2 > r2) return 0;
  return strength * (1 - d2 / r2);
}
