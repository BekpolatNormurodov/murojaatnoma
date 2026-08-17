import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';

/// Fuqaro shaxsiy ma'lumotlarini saqlash (ro'yxatdan o'tishni yakunlash).
///
/// Kirish parametri sifatida to'g'ridan-to'g'ri [CitizenProfile] ishlatiladi
/// — alohida `Params` klass shart emas, chunki
/// [RegistrationRepository.saveProfile] bitta argument oladi
/// (`SubmitCitizenRequest` bilan bir xil naqsh).
class SaveCitizenProfile implements UseCase<Unit, CitizenProfile> {
  SaveCitizenProfile(this.repository);

  final RegistrationRepository repository;

  @override
  Future<Either<Failure, Unit>> call(CitizenProfile params) {
    return repository.saveProfile(params);
  }
}
