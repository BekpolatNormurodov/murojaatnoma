import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';

part 'auth_state.dart';

/// Ishchi avtorizatsiyasini boshqaruvchi Cubit.
///
/// Xodimlar login+parol bilan kiradi (`login`); OTP metodlari
/// (`requestOtp`/`verifyOtp`) fuqaro-oqimidan meros bo'lib qolgan va
/// worker-app'da endi ishlatilmaydi (deprecated — keyingi tozalashda
/// olib tashlanadi).
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.sendOtp,
    required VerifyOtp verifyOtp,
    required LoginEmployee loginEmployee,
    required RestoreSession restoreSession,
  }) : _verifyOtp = verifyOtp,
       _loginEmployee = loginEmployee,
       _restoreSession = restoreSession,
       super(const AuthState());

  /// SMS-OTP kod yuborish UseCase'i.
  final SendOtp sendOtp;

  /// SMS-OTP kodni tasdiqlash UseCase'i (metod nomi bilan to'qnashmasligi
  /// uchun xususiy maydonda saqlanadi).
  final VerifyOtp _verifyOtp;

  /// Xodim login+parol bilan kirish UseCase'i.
  final LoginEmployee _loginEmployee;

  /// Ilova ishga tushganda saqlangan sessiyani tiklash (auto-login)
  /// UseCase'i.
  final RestoreSession _restoreSession;

  /// Xodim login+parol bilan kirishi. Muvaffaqiyatli bo'lsa sessiya
  /// o'rnatiladi (`AuthStatus.authenticated`) — GoRouter `resolveAuthRedirect`
  /// keyingi bosqichga (`/face/enroll` yoki `/home`) yo'naltiradi.
  Future<void> login(String username, String password) async {
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await _loginEmployee(
      LoginEmployeeParams(username: username, password: password),
    );
    result.fold(
      (failure) => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (session) => emit(
        state.copyWith(status: AuthStatus.authenticated, session: session),
      ),
    );
  }

  /// Telefon raqamiga SMS-OTP tasdiqlash kodini yuborish.
  ///
  /// Server javobida `devCode` bo'lsa (faqat `OTP_DEV_ECHO=true` bo'lgan
  /// dev/staging muhitda), u holatga (`AuthState.devCode`) qo'shiladi —
  /// `OtpPage` shu qiymatni foydalanuvchiga ko'rsatadi, real SMS
  /// gateway'siz login qilish imkonini beradi. Production'da (yoki mock
  /// oqimda) `devCode` doim `null` bo'ladi, shuning uchun hech narsa
  /// ko'rsatilmaydi.
  Future<void> requestOtp(String phone) async {
    emit(state.copyWith(status: AuthStatus.loading));
    final result = await sendOtp(SendOtpParams(phone));
    result.fold(
      (failure) => emit(
        state.copyWith(status: AuthStatus.error, errorMessage: failure.message),
      ),
      (devCode) =>
          emit(state.copyWith(status: AuthStatus.otpSent, devCode: devCode)),
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
  ///
  /// `faceEnrolled` bu yerda ATAYLAB o'rnatilmaydi: `AuthSession`
  /// (demak, saqlangan sessiya JSON'i) buni umuman bilmaydi — bu alohida,
  /// mustaqil bosqich (`markFaceEnrolled()`, Vazifa 18) va Face
  /// qatlamiga (`FaceRepository.getTemplate()`) bog'liq; shu sabab bu
  /// tekshiruv `AuthCubit`da EMAS, `bootstrap()`da (ilova ildizida)
  /// amalga oshiriladi — Auth va Face funksiyalari o'rtasida mustaqillikni
  /// saqlab qolish uchun.
  Future<void> restore() async {
    final result = await _restoreSession(const NoParams());
    final session = result.fold((_) => null, (session) => session);
    if (session != null) {
      emit(state.copyWith(status: AuthStatus.authenticated, session: session));
    }
  }

  /// `/face/enroll` muvaffaqiyatli yakunlangach chaqiriladi (Vazifa 18).
  ///
  /// `faceEnrolled`ni `true`ga o'rnatadi — bu `emit` GoRouter'ning
  /// `refreshListenable`ini ishga tushiradi, natijada `resolveAuthRedirect`
  /// joriy manzilni qayta baholaydi va foydalanuvchini `/home`ga
  /// yo'naltiradi. Shu chaqiruvsiz redirect siyosati foydalanuvchini
  /// muvaffaqiyatli ro'yxatdan o'tishdan keyin ham abadiy `/face/enroll`ga
  /// qaytarib turaverar edi (loop'ga o'xshash "tiqilib qolish").
  void markFaceEnrolled() => emit(state.copyWith(faceEnrolled: true));
}
