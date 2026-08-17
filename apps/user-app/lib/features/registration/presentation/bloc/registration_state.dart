part of 'registration_cubit.dart';

/// Ro'yxatdan o'tish sahifasining barcha holatlari (`SubmitRequestState`
/// bilan bir xil naqsh: idle/submitting/success/error).
sealed class RegistrationState extends Equatable {
  const RegistrationState();

  @override
  List<Object?> get props => [];
}

/// Boshlang'ich holat — foydalanuvchi shaklni to'ldirmoqda.
class RegistrationIdle extends RegistrationState {
  const RegistrationIdle();
}

/// Profil saqlanmoqda — tugma loading holatida.
class RegistrationSubmitting extends RegistrationState {
  const RegistrationSubmitting();
}

/// Profil muvaffaqiyatli saqlandi.
class RegistrationSuccess extends RegistrationState {
  const RegistrationSuccess(this.profile);

  final CitizenProfile profile;

  @override
  List<Object?> get props => [profile];
}

/// Profil saqlanmadi — [message] xabar sifatida ko'rsatiladi.
class RegistrationError extends RegistrationState {
  const RegistrationError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
