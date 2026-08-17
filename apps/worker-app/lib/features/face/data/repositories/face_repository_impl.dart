import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/features/face/domain/services/face_matcher.dart';

/// `FaceRepository`ning xavfsiz-lokal-saqlash implementatsiyasi.
///
/// Faqat `FaceLocalDataSource` (shifrlangan xotira) va `FaceMatcher`
/// (cosine solishtirish) bilan ishlaydi. `FaceEmbedder` (kamera
/// kadrlaridan embedding hisoblash) bu qatlamga umuman bog'liq emas —
/// `verify`ga keladigan probe allaqachon hisoblangan holda keladi
/// (UI/controller qatlami, Vazifa 16/17 tomonidan).
class FaceRepositoryImpl implements FaceRepository {
  FaceRepositoryImpl({required this.local});

  final FaceLocalDataSource local;

  @override
  Future<Either<Failure, Unit>> enroll(FaceTemplate t) async {
    try {
      await local.write(t);
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
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
