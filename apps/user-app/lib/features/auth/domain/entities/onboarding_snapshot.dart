import 'package:equatable/equatable.dart';

/// Qurilmada saqlangan, joriy fuqaroga tegishli onboarding holati.
class OnboardingSnapshot extends Equatable {
  const OnboardingSnapshot({
    this.registered = false,
    this.faceEnrolled = false,
    this.pinSet = false,
    this.fullName,
  });

  final bool registered;
  final bool faceEnrolled;
  final bool pinSet;

  /// Ro'yxatdan o'tishdagi F.I.Sh. — sarlavhalarda telefon o'rniga.
  final String? fullName;

  @override
  List<Object?> get props => [registered, faceEnrolled, pinSet, fullName];
}
