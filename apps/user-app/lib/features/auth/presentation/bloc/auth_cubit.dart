import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';

part 'auth_state.dart';

/// Fuqaro avtorizatsiyasini boshqaruvchi Cubit — telefon/OTP oqimi.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.sendOtp,
    required VerifyOtp verifyOtp,
    required RestoreSession restoreSession,
  }) : _verifyOtp = verifyOtp,
       _restoreSession = restoreSession,
       super(const AuthState());

  /// SMS-OTP kod yuborish UseCase'i.
  final SendOtp sendOtp;

  /// SMS-OTP kodni tasdiqlash UseCase'i (metod nomi bilan to'qnashmasligi
  /// uchun xususiy maydonda saqlanadi).
  final VerifyOtp _verifyOtp;

  /// Ilova ishga tushganda saqlangan sessiyani tiklash (auto-login)
  /// UseCase'i.
  final RestoreSession _restoreSession;

  /// Telefon raqamiga SMS-OTP tasdiqlash kodini yuborish.
  Future<void> requestOtp(String phone) async {
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await sendOtp(SendOtpParams(phone));
    result.fold(
      (failure) => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (_) => emit(state.copyWith(status: AuthStatus.otpSent)),
    );
  }

  /// Telefonga yuborilgan SMS-OTP kodni tasdiqlash.
  Future<void> verifyOtp(String phone, String code) async {
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await _verifyOtp(VerifyOtpParams(phone: phone, code: code));
    result.fold(
      (failure) => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (session) => emit(
        state.copyWith(status: AuthStatus.authenticated, session: session),
      ),
    );
  }

  /// Holatni boshlang'ich holatga qaytarish (masalan, chiqishda).
  void reset() => emit(const AuthState());

  /// Ilova ishga tushganda (`bootstrap()`) chaqiriladi: saqlangan sessiyani
  /// tiklashga (auto-login) urinadi. Sessiya topilmasa holat
  /// o'zgarmaydi — boshlang'ich (unauthenticated) holatda qoladi, demak
  /// `resolveAuthRedirect` avvalgidek `/login`ga yo'naltiradi.
  ///
  /// **Hech qachon xato tashlamaydi** (`RestoreSession` o'zi hech qachon
  /// uncaught qolmaydi) — shu tufayli `bootstrap()` ichida xavfsiz
  /// `await` qilinishi mumkin.
  Future<void> restore() async {
    final result = await _restoreSession(const NoParams());
    final session = result.fold((_) => null, (session) => session);
    if (session != null) {
      emit(state.copyWith(status: AuthStatus.authenticated, session: session));
    }
  }

  /// `/register` (shaxsiy ma'lumotlar) muvaffaqiyatli yakunlangach
  /// chaqiriladi (Faza 3) — `RegistrationPage`dan, `RegistrationCubit`ning
  /// O'ZIDAN EMAS (qatlamlar bir-biriga bog'liq bo'lib qolmasligi uchun,
  /// `markFaceEnrolled()`/`markPinSet()` bilan bir xil sabab).
  ///
  /// `registered`ni `true`ga o'rnatadi — bu `emit` GoRouter'ning
  /// `refreshListenable`ini ishga tushiradi, natijada `resolveAuthRedirect`
  /// joriy manzilni qayta baholaydi va foydalanuvchini `/face/onboarding`ga
  /// yo'naltiradi (qarang: `redirect_policy.dart`).
  void markRegistered() => emit(state.copyWith(registered: true));

  /// `/face/onboarding` muvaffaqiyatli yakunlangach chaqiriladi (Faza 3).
  ///
  /// `faceEnrolled`ni `true`ga o'rnatadi — bu `emit` GoRouter'ning
  /// `refreshListenable`ini ishga tushiradi, natijada `resolveAuthRedirect`
  /// joriy manzilni qayta baholaydi va foydalanuvchini `/pin/set`ga
  /// yo'naltiradi (qarang: `redirect_policy.dart`).
  void markFaceEnrolled() => emit(state.copyWith(faceEnrolled: true));

  /// `/pin/set` (birinchi marta PIN o'rnatish) muvaffaqiyatli yakunlangach
  /// chaqiriladi.
  ///
  /// `pinUnlocked`ni HAM `true`ga o'rnatadi (`pinSet` bilan BIRGA) —
  /// foydalanuvchi PIN kodni hozirgina ikki marta kiritib isbotladi,
  /// shuning uchun darhol qayta (`/pin/unlock`da) so'ralmaydi.
  void markPinSet() => emit(state.copyWith(pinSet: true, pinUnlocked: true));

  /// Bootstrap paytida (`main.dart`) chaqiriladi: qurilmada AVVALDAN
  /// o'rnatilgan PIN topilganda. `pinUnlocked` ATAYLAB o'rnatilmaydi
  /// (standart `false`da qoladi) — sessiya HALI qulflangan, foydalanuvchi
  /// `/pin/unlock`da PIN kiritishi SHART (`markPinSet()`dan FARQLI: bu
  /// yerda hech kim hozirgina PIN kiritmagan, faqat saqlangan holat
  /// tiklanmoqda).
  void markPinAlreadySet() => emit(state.copyWith(pinSet: true));

  /// `/pin/unlock` muvaffaqiyatli yakunlangach (to'g'ri PIN kiritilgach)
  /// chaqiriladi — joriy sessiya uchun qulfni ochadi.
  void markPinUnlocked() => emit(state.copyWith(pinUnlocked: true));
}
