import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/datasources/face_remote_data_source.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/features/face/domain/services/face_matcher.dart';

/// `FaceRepository`ning xavfsiz-lokal-saqlash implementatsiyasi.
///
/// Asosan `FaceLocalDataSource` (shifrlangan xotira) va `FaceMatcher`
/// (cosine solishtirish) bilan ishlaydi — solishtirish (`verify`) HAR
/// DOIM mahalliy (offline check-in shu tufayli ishlaydi): `verify`ga
/// keladigan probe allaqachon hisoblangan holda keladi (UI/controller
/// qatlami, Vazifa 16/17 tomonidan). `FaceEmbedder` bu qatlamga umuman
/// bog'liq emas.
///
/// `remote` (ixtiyoriy) — jonli backendga sinxronlash uchun (qarang:
/// [_syncToBackend]). `null` bo'lishi mumkin (masalan testlarda, yoki
/// `AppConfig.useMock == true` bo'lgan mock oqimda `injection.dart` uni
/// umuman ro'yxatdan o'tkazmasligi mumkin) — bunday holda sinxronlash
/// jimgina o'tkazib yuboriladi.
class FaceRepositoryImpl implements FaceRepository {
  FaceRepositoryImpl({required this.local, this.remote});

  final FaceLocalDataSource local;
  final FaceRemoteDataSource? remote;

  @override
  Future<Either<Failure, Unit>> enroll(FaceTemplate t) async {
    // 1) Save the local copy (offline verify uses it).
    try {
      await local.write(t);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
    // 2) The SERVER copy is REQUIRED, not best-effort: server check-in
    //    scores the live face against the SERVER-stored template, so a lost
    //    upload = the employee can never check in. Surface it (local copy is
    //    already saved) so the UI prompts a retry instead of faking success.
    try {
      await _syncToBackend(t);
    } on Exception catch (_) {
      return const Left(
        ServerFailure(
          'Yuz serverga yuklanmadi — internetni tekshirib qayta urining',
        ),
      );
    }
    return const Right(unit);
  }

  /// Mahalliy shablon saqlangandan KEYIN, jonli backendda (`useMock ==
  /// false`) HAM hisoblangan embeddingni yuklashga urinadi (`POST
  /// /employees/:id/face-template`, qarang: `FaceRemoteDataSourceApiImpl`).
  ///
  /// Uploads the computed embedding to the live backend (`POST
  /// /employees/:id/face-template`, see `FaceRemoteDataSourceApiImpl`).
  ///
  /// No-op ONLY when there is genuinely no server to sync to (`useMock == true`
  /// or `remote == null`, e.g. tests/mock flow). Otherwise a failed upload is
  /// REthrown — the server template is mandatory for check-in, so `enroll()`
  /// must surface the failure rather than pretend enrollment succeeded.
  Future<void> _syncToBackend(FaceTemplate t) async {
    final remoteDs = remote;
    if (AppConfig.useMock || remoteDs == null) return;
    await remoteDs.uploadEmbedding(t.workerId, t.embedding);
  }

  @override
  Future<Either<Failure, FaceTemplate?>> getTemplate() async {
    try {
      final template = await local.read();
      return Right(template);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, FaceMatchResult>> verify(
    List<double> probe, {
    double threshold = kFaceMatchThreshold,
  }) async {
    try {
      final template = await local.read();
      if (template == null) {
        return const Left(
          CacheFailure("Yuz shabloni topilmadi: avval ro'yxatdan o'ting"),
        );
      }
      return Right(
        FaceMatcher().match(probe, template.embedding, threshold: threshold),
      );
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }
}
