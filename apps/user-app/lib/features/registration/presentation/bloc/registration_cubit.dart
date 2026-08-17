import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/usecases/save_citizen_profile.dart';

part 'registration_state.dart';

/// Fuqaro ro'yxatdan o'tish (shaxsiy ma'lumotlar) oqimini boshqaruvchi
/// Cubit — `/register` sahifasining forma yuborilishini boshqaradi.
///
/// `AuthCubit`dan ATAYLAB MUSTAQIL (uni bilmaydi, chaqirmaydi) — xuddi
/// `PinCubit`/`FaceCubit` kabi: muvaffaqiyatli saqlangach `AuthCubit
/// .markRegistered()`ni CHAQIRUVCHI TOMON (`RegistrationPage`,
/// `BlocConsumer.listener`da) chaqiradi, bu Cubit emas — shu tufayli qatlam
/// mustaqilligi saqlanadi va bu Cubit `AuthCubit`siz ham to'liq
/// unit-testlanadi.
class RegistrationCubit extends Cubit<RegistrationState> {
  RegistrationCubit({required SaveCitizenProfile saveCitizenProfile})
    : _saveCitizenProfile = saveCitizenProfile,
      super(const RegistrationIdle());

  final SaveCitizenProfile _saveCitizenProfile;

  /// Tayyorlangan (sahifada allaqachon validatsiya qilingan) [profile]ni
  /// xavfsiz xotiraga yuboradi/saqlaydi.
  Future<void> submit(CitizenProfile profile) async {
    emit(const RegistrationSubmitting());
    final result = await _saveCitizenProfile(profile);
    result.fold(
      (failure) => emit(RegistrationError(failure.message)),
      (_) => emit(RegistrationSuccess(profile)),
    );
  }
}
