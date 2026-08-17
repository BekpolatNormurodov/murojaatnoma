import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';

/// Yangi yuz shablonini ro'yxatdan o'tkazish (enroll).
class EnrollFace implements UseCase<Unit, EnrollFaceParams> {
  EnrollFace(this.repository);

  final FaceRepository repository;

  @override
  Future<Either<Failure, Unit>> call(EnrollFaceParams params) {
    return repository.enroll(params.template);
  }
}

class EnrollFaceParams extends Equatable {
  const EnrollFaceParams(this.template);

  final FaceTemplate template;

  @override
  List<Object?> get props => [template];
}
