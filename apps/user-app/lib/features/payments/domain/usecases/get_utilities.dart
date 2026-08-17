import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';

/// Fuqaroning kommunal xizmatlari ro'yxatini olish.
class GetUtilities implements UseCase<List<Utility>, NoParams> {
  GetUtilities(this.repository);

  final PaymentsRepository repository;

  @override
  Future<Either<Failure, List<Utility>>> call(NoParams params) {
    return repository.utilities();
  }
}
