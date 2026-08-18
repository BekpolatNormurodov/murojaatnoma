import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/premya/domain/entities/bonus_request.dart';
import 'package:worker_app/features/premya/domain/repositories/premya_repository.dart';

/// Joriy xodimning premya so'rovlari ro'yxatini (eng yangisi birinchi)
/// olish.
class GetMyPremya implements UseCase<List<BonusRequest>, NoParams> {
  GetMyPremya(this.repository);

  final PremyaRepository repository;

  @override
  Future<Either<Failure, List<BonusRequest>>> call(NoParams params) {
    return repository.myRequests();
  }
}
