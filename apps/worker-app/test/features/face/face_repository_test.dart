import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/repositories/face_repository_impl.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';

/// Xotirada ishlaydigan soxta (fake) lokal manba — haqiqiy
/// `FlutterSecureStorage` platform kanaliga bog'liq emas. `readError`/
/// `writeError` orqali platformadagi xatoliklarni simulyatsiya qiladi.
class _FakeFaceLocalDataSource implements FaceLocalDataSource {
  FaceTemplate? stored;
  Exception? readError;
  Exception? writeError;

  @override
  Future<FaceTemplate?> read() async {
    final err = readError;
    if (err != null) throw err;
    return stored;
  }

  @override
  Future<void> write(FaceTemplate template) async {
    final err = writeError;
    if (err != null) throw err;
    stored = template;
  }
}

void main() {
  group(FaceRepositoryImpl, () {
    late _FakeFaceLocalDataSource local;
    late FaceRepositoryImpl subject;

    final template = FaceTemplate(
      embedding: const [0.8, 0.6],
      enrolledAt: DateTime(2026),
      workerId: 'W-1042',
    );

    setUp(() {
      local = _FakeFaceLocalDataSource();
      subject = FaceRepositoryImpl(local: local);
    });

    group('verify', () {
      test(
        'stored template + matching probe -> Right with real cosine '
        'similarity (passed)',
        () async {
          local.stored = template; // embedding [0.8, 0.6] — unit length

          // probe [1,0] · [0.8,0.6] = 0.8; ikkalasi ham birlik uzunlikda
          // -> cos = 0.8 (haqiqiy FaceMatcher hisobi, mock emas).
          final result = await subject.verify([1.0, 0.0]);

          result.fold((l) => fail('expected Right, got Left: $l'), (match) {
            expect(match.similarity, closeTo(0.8, 1e-9));
            expect(match.passed, isTrue); // 0.8 >= 0.7 chegarasi
          });
        },
      );

      test(
        'stored template + non-matching probe -> Right with passed=false '
        '(0.7 chegarasidan past)',
        () async {
          local.stored = FaceTemplate(
            embedding: const [0.6, 0.8],
            enrolledAt: DateTime(2026),
            workerId: 'W-1042',
          );

          // probe [1,0] · [0.6,0.8] = 0.6 -> cos = 0.6 < 0.7
          final result = await subject.verify([1.0, 0.0]);

          result.fold((l) => fail('expected Right, got Left: $l'), (match) {
            expect(match.similarity, closeTo(0.6, 1e-9));
            expect(match.passed, isFalse);
          });
        },
      );

      test(
        'a custom (fallback-mode) threshold changes the pass/fail outcome '
        'for the exact same real cosine similarity — proves the threshold '
        'is genuinely plumbed through to FaceMatcher, not hardcoded',
        () async {
          local.stored = FaceTemplate(
            embedding: const [0.6, 0.8],
            enrolledAt: DateTime(2026),
            workerId: 'W-1042',
          );

          // probe [1,0] · [0.6,0.8] = 0.6 -> cos = 0.6, which fails the
          // default 0.7 threshold (see the sibling test above) but passes
          // a lower, fallback-mode threshold — same real similarity value.
          final result = await subject.verify([1.0, 0.0], threshold: 0.5);

          result.fold((l) => fail('expected Right, got Left: $l'), (match) {
            expect(match.similarity, closeTo(0.6, 1e-9));
            expect(match.passed, isTrue);
          });
        },
      );

      test('no stored template -> Left(CacheFailure)', () async {
        final result = await subject.verify([1.0, 0.0]);

        result.fold(
          (l) => expect(l, isA<CacheFailure>()),
          (r) => fail('expected Left(CacheFailure), got Right: $r'),
        );
      });

      test(
        'datasource read failure is wrapped into Left(CacheFailure), '
        'never thrown',
        () async {
          local.readError = CacheException('platform kanali xatosi');

          final result = await subject.verify([1.0, 0.0]);

          result.fold(
            (l) => expect(l, isA<CacheFailure>()),
            (r) => fail('expected Left(CacheFailure), got Right: $r'),
          );
        },
      );
    });

    group('enroll', () {
      test(
        'writes the template to the datasource and returns Right(unit)',
        () async {
          final result = await subject.enroll(template);

          expect(result, equals(const Right<Failure, Unit>(unit)));
          expect(local.stored, equals(template));
        },
      );

      test(
        'datasource write failure is wrapped into Left(CacheFailure)',
        () async {
          local.writeError = CacheException('platform kanali xatosi');

          final result = await subject.enroll(template);

          result.fold(
            (l) => expect(l, isA<CacheFailure>()),
            (r) => fail('expected Left(CacheFailure), got Right: $r'),
          );
        },
      );
    });

    group('getTemplate', () {
      test('round-trips a stored template', () async {
        await subject.enroll(template);

        final result = await subject.getTemplate();

        expect(result, equals(Right<Failure, FaceTemplate?>(template)));
      });

      test('returns Right(null) when nothing is stored', () async {
        final result = await subject.getTemplate();

        expect(result, equals(const Right<Failure, FaceTemplate?>(null)));
      });
    });
  });
}
