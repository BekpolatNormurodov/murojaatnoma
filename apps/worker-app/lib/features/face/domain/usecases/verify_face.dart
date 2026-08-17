import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';

/// Probe (allaqachon hisoblangan) yuz embeddingini saqlangan shablon
/// bilan solishtirib tekshirish (verify).
class VerifyFace implements UseCase<FaceMatchResult, VerifyFaceParams> {
  VerifyFace(this.repository);

  final FaceRepository repository;

  @override
  Future<Either<Failure, FaceMatchResult>> call(VerifyFaceParams params) {
    return repository.verify(params.probe, threshold: params.threshold);
  }
}

class VerifyFaceParams extends Equatable {
  const VerifyFaceParams(this.probe, {this.threshold = kFaceMatchThreshold});

  final List<double> probe;

  /// `FaceEmbedder.isFallback`ga qarab chaqiruvchi (`FaceCubit`) tanlaydi
  /// — qarang: `FaceRepository.verify` hujjatlari.
  final double threshold;

  @override
  List<Object?> get props => [probe, threshold];
}
