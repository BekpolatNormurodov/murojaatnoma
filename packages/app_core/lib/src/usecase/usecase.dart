import 'package:app_core/src/error/failures.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

/// Barcha UseCase'lar uchun umumiy shartnoma.
///
/// [Result] — muvaffaqiyatli natija turi, [Params] — kirish
/// parametrlari turi. Har bir aniq UseCase shu klassdan meros olib,
/// bitta chaqiriladigan (`call`) metodni implement qiladi — shuning
/// uchun bitta abstrakt a'zoga ega bo'lishi qasddan qilingan.
// ignore: one_member_abstracts
abstract class UseCase<Result, Params> {
  Future<Either<Failure, Result>> call(Params params);
}

/// Kirish parametriga muhtoj bo'lmagan UseCase'lar uchun.
class NoParams extends Equatable {
  const NoParams();

  @override
  List<Object?> get props => [];
}
