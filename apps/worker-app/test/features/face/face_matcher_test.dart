import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/services/face_matcher.dart';

void main() {
  final m = FaceMatcher();
  test('identical vectors → similarity 1.0, passed', () {
    final v = [0.1, 0.2, 0.3, 0.4];
    final r = m.match(v, v);
    expect(r.similarity, closeTo(1.0, 1e-9));
    expect(r.passed, isTrue);
  });
  test('orthogonal vectors → similarity 0, not passed', () {
    final r = m.match([1, 0], [0, 1]);
    expect(r.similarity, closeTo(0.0, 1e-9));
    expect(r.passed, isFalse);
  });
  test('threshold boundary at 0.7', () {
    // 0.7 dan past → fail, 0.7 va undan yuqori → pass
    expect(m.match([1, 0], [0.6, 0.8]).passed, isFalse); // cos≈0.6
    expect(m.match([1, 0], [0.8, 0.6]).passed, isTrue);  // cos≈0.8
  });
  test('exact 0.7 boundary (>= includes equality)', () {
    final probe = [1.0, 0.0];
    // unit-length, cosine exactly 0.7
    final template = [0.7, 0.714142842854285];
    final result = m.match(probe, template);
    expect(result.similarity, closeTo(0.7, 1e-9));
    expect(result.passed, isTrue); // >= 0.7 includes equality
  });
  test('fromJson with integer embedding (regression)', () {
    final json = {
      'embedding': [1, 0, 1, 2],
      'enrolled_at': DateTime(2026).toIso8601String(),
      'worker_id': 'W-1',
    };
    final template = FaceTemplate.fromJson(json);
    expect(template.embedding, equals([1.0, 0.0, 1.0, 2.0]));
  });
}
