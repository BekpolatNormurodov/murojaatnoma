import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/core/session/account_data_store.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/entities/onboarding_snapshot.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';

/// Autentifikatsiya bo'lgan HAR bir o'tishda (sovuq ishga tushirish VA yangi
/// OTP kirish) onboarding holatini (profil → yuz → PIN) tiklaydi — avval
/// qurilmadagi ma'lumot shu fuqaroniki ekanini tekshirib.
///
/// Har bir keyingi bosqich faqat oldingisi bajarilgan bo'lsa tekshiriladi
/// (`resolveAuthRedirect` tartibi). Hech qachon xato tashlamaydi.
class OnboardingRestorer {
  OnboardingRestorer({
    required this.accountData,
    required this.registration,
    required this.face,
    required this.pin,
  });

  final AccountDataStore accountData;
  final RegistrationRepository registration;
  final FaceRepository face;
  final PinRepository pin;
  static const _logger = AppLogger();

  Future<OnboardingSnapshot> call(
    AuthSession session, {
    required bool restored,
  }) async {
    try {
      await accountData.claim(session, restored: restored);
      final profile = (await registration.getProfile()).fold(
        (_) => null,
        (p) => p,
      );
      if (profile == null) return const OnboardingSnapshot();
      final enrolled = (await face.getTemplate()).fold(
        (_) => false,
        (t) => t != null,
      );
      final hasPin =
          enrolled && (await pin.hasPin()).fold((_) => false, (v) => v);
      return OnboardingSnapshot(
        registered: true,
        faceEnrolled: enrolled,
        pinSet: hasPin,
        fullName: profile.fullName,
      );
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'OnboardingRestorer');
      return const OnboardingSnapshot();
    }
  }
}
