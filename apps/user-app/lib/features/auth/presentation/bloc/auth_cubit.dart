import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/entities/onboarding_snapshot.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';

part 'auth_state.dart';

/// Qurilmadagi onboarding holatini (shu fuqaro uchun) o'qiydi. [restored] —
/// sessiya saqlangandan tiklandi (`true`) yoki yangi OTP kirish (`false`).
typedef OnboardingLoader =
    Future<OnboardingSnapshot> Function(
      AuthSession session, {
      required bool restored,
    });

/// Fuqaro avtorizatsiyasini boshqaruvchi Cubit — telefon/OTP oqimi.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.sendOtp,
    required VerifyOtp verifyOtp,
    required RestoreSession restoreSession,
    OnboardingLoader? loadOnboarding,
  }) : _verifyOtp = verifyOtp,
       _restoreSession = restoreSession,
       _loadOnboarding = loadOnboarding,
       super(const AuthState());

  /// SMS-OTP kod yuborish UseCase'i.
  final SendOtp sendOtp;

  /// SMS-OTP kodni tasdiqlash UseCase'i (metod nomi bilan to'qnashmasligi
  /// uchun xususiy maydonda saqlanadi).
  final VerifyOtp _verifyOtp;

  /// Ilova ishga tushganda saqlangan sessiyani tiklash (auto-login)
  /// UseCase'i.
  final RestoreSession _restoreSession;

  final OnboardingLoader? _loadOnboarding;

  /// Autentifikatsiya holatini onboarding bayroqlari bilan BITTA `emit`da
  /// chiqaradi — router oraliq (masalan keraksiz `/register`) holatni
  /// ko'rmaydi.
  Future<void> _emitAuthenticated(
    AuthSession session, {
    required bool restored,
  }) async {
    var snapshot = const OnboardingSnapshot();
    final loader = _loadOnboarding;
    if (loader != null) {
      try {
        snapshot = await loader(session, restored: restored);
      } on Object {
        // Tiklab bo'lmasa — onboarding boshidan, ilova qulamaydi.
      }
    }
    if (isClosed) return;
    final name = snapshot.fullName?.trim();
    emit(
      AuthState(
        status: AuthStatus.authenticated,
        session: name == null || name.isEmpty
            ? session
            : session.copyWith(name: name),
        registered: snapshot.registered,
        faceEnrolled: snapshot.faceEnrolled,
        pinSet: snapshot.pinSet,
      ),
    );
  }

  /// Telefon raqamiga SMS-OTP tasdiqlash kodini yuborish.
  ///
  /// So'rov allaqachon bajarilayotgan bo'lsa (`loading`) — e'tiborsiz
  /// qoldiriladi (ikki marta bosish ikki SMS yubormasin).
  Future<void> requestOtp(String phone) async {
    if (state.status == AuthStatus.loading) return;
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await sendOtp(SendOtpParams(phone));
    if (isClosed) return;
    result.fold(
      (failure) => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (_) => emit(state.copyWith(status: AuthStatus.otpSent)),
    );
  }

  /// Telefonga yuborilgan SMS-OTP kodni tasdiqlash.
  ///
  /// `OtpInput.onCompleted` va "Tasdiqlash" tugmasi bir vaqtda ishlashi
  /// mumkin — so'rov bajarilayotganda (`loading`) qayta chaqiruv
  /// e'tiborsiz qoldiriladi (bir kod ikki marta yuborilmasin).
  Future<void> verifyOtp(String phone, String code) async {
    if (state.status == AuthStatus.loading) return;
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await _verifyOtp(VerifyOtpParams(phone: phone, code: code));
    if (isClosed) return;
    await result.fold(
      (failure) async => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (session) => _emitAuthenticated(session, restored: false),
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
      await _emitAuthenticated(session, restored: true);
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
  void markRegistered({String? fullName}) {
    final name = fullName?.trim();
    emit(
      state.copyWith(
        registered: true,
        session: name == null || name.isEmpty
            ? null
            : state.session?.copyWith(name: name),
      ),
    );
  }

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
