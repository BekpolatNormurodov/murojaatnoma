import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';

/// Yuz-shabloni xavfsiz saqlash va tekshirish (enroll/verify) uchun
/// shartnoma.
abstract class FaceRepository {
  /// Yangi yuz shablonini xavfsiz xotiraga yozadi (mavjud bo'lsa,
  /// almashtiradi).
  Future<Either<Failure, Unit>> enroll(FaceTemplate t);

  /// Saqlangan shablonni o'qiydi; hali ro'yxatdan o'tilmagan bo'lsa
  /// `null` qaytaradi.
  Future<Either<Failure, FaceTemplate?>> getTemplate();

  /// Berilgan (allaqachon hisoblangan) probe embeddingni saqlangan
  /// shablon bilan solishtiradi. Shablon topilmasa `Left(CacheFailure)`.
  ///
  /// [threshold] — chaqiruvchi (`FaceCubit`) `FaceEmbedder.isFallback`ga
  /// qarab tanlaydi: haqiqiy model uchun standart `kFaceMatchThreshold`
  /// (0.7, qattiq), model-siz fallback uchun yumshoqroq
  /// `kFaceMatchFallbackThreshold` (0.5) — solishtirish o'zi HAR DOIM
  /// haqiqiy kosinus o'xshashlik orqali amalga oshiriladi (hech qachon
  /// qattiq-kodlangan `passed: true` emas).
  Future<Either<Failure, FaceMatchResult>> verify(
    List<double> probe, {
    double threshold = kFaceMatchThreshold,
  });
}
