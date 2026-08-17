import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:user_app/features/face/data/repositories/face_repository_impl.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';

/// Xotirada ishlaydigan soxta (fake) lokal manba — haqiqiy
/// `FlutterSecureStorage` platform kanaliga bog'liq emas.
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
      ownerId: 'U-2087',
    );

    setUp(() {
      local = _FakeFaceLocalDataSource();
      subject = FaceRepositoryImpl(local: local);
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
        'datasource write failure is wrapped into Left(CacheFailure), '
        'never thrown',
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

      test(
        'datasource read failure is wrapped into Left(CacheFailure), '
        'never thrown',
        () async {
          local.readError = CacheException('platform kanali xatosi');

          final result = await subject.getTemplate();

          result.fold(
            (l) => expect(l, isA<CacheFailure>()),
            (r) => fail('expected Left(CacheFailure), got Right: $r'),
          );
        },
      );
    });
  });
}
