import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';

/// Ilova ishga tushganda (bootstrap) saqlangan sessiyani tiklash
/// (auto-login) — `AuthRepository.currentSession()`ning yupqa o'ramchisi.
///
/// Sessiya topilmasa (hali kirilmagan) yoki saqlash qatlamida kutilmagan
/// xato yuz bersa (masalan buzilgan JSON) — ikkalasi ham `Right(null)`
/// qaytaradi: chaqiruvchi (`AuthCubit.restore()`) buni bir xilda "hozircha
/// kirilmagan" deb talqin qiladi va boshlang'ich (unauthenticated) holatda
/// qoladi — hech qachon uncaught qolmaydi.
class RestoreSession implements UseCase<AuthSession?, NoParams> {
  RestoreSession(this.repository);

  final AuthRepository repository;

  @override
  Future<Either<Failure, AuthSession?>> call(NoParams params) async {
    try {
      final session = await repository.currentSession();
      return Right(session);
    } on Exception catch (_) {
      return const Right(null);
    }
  }
}
