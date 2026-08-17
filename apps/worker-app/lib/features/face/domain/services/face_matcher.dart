import 'dart:math' as math;

import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';

class FaceMatcher {
  double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) {
      throw ArgumentError(
        "embedding o'lchamlari mos emas: ${a.length} vs ${b.length}",
      );
    }
    var dot = 0.0;
    var na = 0.0;
    var nb = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na == 0 || nb == 0) return 0;
    return dot / (math.sqrt(na) * math.sqrt(nb));
  }

  FaceMatchResult match(
    List<double> probe,
    List<double> template, {
    double threshold = kFaceMatchThreshold,
  }) {
    final s = cosineSimilarity(probe, template);
    return FaceMatchResult(s, passed: s >= threshold);
  }
}
