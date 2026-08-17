import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/entities/region.dart';
import 'package:user_app/features/registration/presentation/bloc/registration_cubit.dart';
import 'package:user_app/features/registration/presentation/utils/passport_input_formatter.dart';
import 'package:user_app/features/registration/presentation/utils/registration_validators.dart';
import 'package:user_app/features/registration/presentation/widgets/region_meta.dart';

/// Shaxsiy ma'lumotlarni to'ldirish sahifasi (`/register`) — Faza 3
/// oqimining OTP tasdiqlangandan KEYIN, yuz ro'yxatdan o'tkazishdan OLDIN
/// joylashgan, bir martalik bosqichi.
///
/// `PinSetPage`/`FaceEnrollPage` bilan bir xil naqsh: muvaffaqiyat
/// animatsiyasi bir zum ko'rsatiladi, so'ng `AuthCubit.markRegistered()`
/// chaqiriladi (bu router'ning `refreshListenable`ini ishga tushirib,
/// `resolveAuthRedirect`ni qayta baholaydi) VA qo'shimcha kafolat sifatida
/// aniq `context.go('/face/onboarding')` (`FaceEnrollPage._proceedToPinSetup`
/// bilan bir xil "kechiktirilgan mark + qo'shimcha go" naqshi).
class RegistrationPage extends StatefulWidget {
  const RegistrationPage({super.key});

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _fullNameController = TextEditingController();
  final _pinflController = TextEditingController();
  final _passportController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _addressController = TextEditingController();

  DocumentType _documentType = DocumentType.pinfl;
  String? _regionCode;
  String? _districtCode;

  String? _fullNameError;
  String? _documentError;
  String? _birthDateError;
  String? _regionError;
  String? _districtError;
  String? _addressError;

  @override
  void dispose() {
    _fullNameController.dispose();
    _pinflController.dispose();
    _passportController.dispose();
    _birthDateController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  /// Joriy tanlangan viloyatga tegishli tumanlar — viloyat hali
  /// tanlanmagan bo'lsa bo'sh.
  List<String> get _districtOptions {
    final region = _regionCode;
    if (region == null) return const [];
    for (final candidate in kUzbekistanRegions) {
      if (candidate.code == region) return candidate.districtCodes;
    }
    return const [];
  }

  bool _validate(AppLocalizations l10n) {
    final documentValue = _documentType == DocumentType.pinfl
        ? _pinflController.text
        : _passportController.text;
    final documentValid = _documentType == DocumentType.pinfl
        ? isValidPinfl(documentValue)
        : isValidPassport(documentValue);

    setState(() {
      _fullNameError = isValidFullName(_fullNameController.text)
          ? null
          : l10n.registrationFullNameError;
      _documentError = documentValid
          ? null
          : (_documentType == DocumentType.pinfl
                ? l10n.registrationPinflError
                : l10n.registrationPassportError);
      _birthDateError = parseBirthDate(_birthDateController.text) == null
          ? l10n.registrationBirthDateError
          : null;
      _regionError = _regionCode == null
          ? l10n.registrationRegionError
          : null;
      _districtError = _districtCode == null
          ? l10n.registrationDistrictError
          : null;
      _addressError = isValidAddress(_addressController.text)
          ? null
          : l10n.registrationAddressError;
    });

    return _fullNameError == null &&
        _documentError == null &&
        _birthDateError == null &&
        _regionError == null &&
        _districtError == null &&
        _addressError == null;
  }

  void _submit() {
    final l10n = context.l10n;
    if (!_validate(l10n)) return;

    final birthDate = parseBirthDate(_birthDateController.text)!;
    final region = _regionCode!;
    final district = _districtCode!;
    final documentNumber =
        (_documentType == DocumentType.pinfl
                ? _pinflController.text
                : _passportController.text)
            .trim();

    context.read<RegistrationCubit>().submit(
      CitizenProfile(
        fullName: _fullNameController.text.trim(),
        documentType: _documentType,
        documentNumber: documentNumber,
        birthDate:
            '${birthDate.year.toString().padLeft(4, '0')}-'
            '${birthDate.month.toString().padLeft(2, '0')}-'
            '${birthDate.day.toString().padLeft(2, '0')}',
        regionCode: region,
        districtCode: district,
        address: _addressController.text.trim(),
      ),
    );
  }

  Future<void> _proceedToFaceOnboarding(BuildContext context) async {
    await Future<void>.delayed(const Duration(milliseconds: 1100));
    if (!context.mounted) return;
    context.read<AuthCubit>().markRegistered();
    if (!context.mounted) return;
    context.go('/face/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<RegistrationCubit, RegistrationState>(
        listener: (context, state) {
          if (state is RegistrationSuccess) {
            unawaited(_proceedToFaceOnboarding(context));
          } else if (state is RegistrationError) {
            AppAlert.error(context, state.message);
          }
        },
        builder: (context, state) {
          if (state is RegistrationSuccess) {
            return const _RegistrationSuccessView();
          }
          return _RegistrationForm(
            fullNameController: _fullNameController,
            pinflController: _pinflController,
            passportController: _passportController,
            birthDateController: _birthDateController,
            addressController: _addressController,
            documentType: _documentType,
            onDocumentTypeChanged: (value) => setState(() {
              _documentType = value;
              _documentError = null;
            }),
            regionCode: _regionCode,
            districtCode: _districtCode,
            districtOptions: _districtOptions,
            onRegionChanged: (value) => setState(() {
              _regionCode = value;
              _regionError = null;
              _districtCode = null;
              _districtError = null;
            }),
            onDistrictChanged: (value) => setState(() {
              _districtCode = value;
              _districtError = null;
            }),
            fullNameError: _fullNameError,
            documentError: _documentError,
            birthDateError: _birthDateError,
            regionError: _regionError,
            districtError: _districtError,
            addressError: _addressError,
            submitting: state is RegistrationSubmitting,
            onSubmit: _submit,
          );
        },
      ),
    );
  }
}

/// Forma tanasi — `AppFormScaffold` orqali klaviatura-xavfsiz (hech qanday
/// maydon klaviatura orqasida yashirin qolmaydi) va aylanuvchi.
class _RegistrationForm extends StatelessWidget {
  const _RegistrationForm({
    required this.fullNameController,
    required this.pinflController,
    required this.passportController,
    required this.birthDateController,
    required this.addressController,
    required this.documentType,
    required this.onDocumentTypeChanged,
    required this.regionCode,
    required this.districtCode,
    required this.districtOptions,
    required this.onRegionChanged,
    required this.onDistrictChanged,
    required this.fullNameError,
    required this.documentError,
    required this.birthDateError,
    required this.regionError,
    required this.districtError,
    required this.addressError,
    required this.submitting,
    required this.onSubmit,
  });

  final TextEditingController fullNameController;
  final TextEditingController pinflController;
  final TextEditingController passportController;
  final TextEditingController birthDateController;
  final TextEditingController addressController;
  final DocumentType documentType;
  final ValueChanged<DocumentType> onDocumentTypeChanged;
  final String? regionCode;
  final String? districtCode;
  final List<String> districtOptions;
  final ValueChanged<String> onRegionChanged;
  final ValueChanged<String> onDistrictChanged;
  final String? fullNameError;
  final String? documentError;
  final String? birthDateError;
  final String? regionError;
  final String? districtError;
  final String? addressError;
  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppFormScaffold(
      actionBar: AppButton(
        label: l10n.registrationSubmit,
        icon: AppIcons.arrowRight,
        loading: submitting,
        onPressed: submitting ? null : onSubmit,
      ),
      children: [
        const SizedBox(height: 12),
        const Center(child: _HeaderIcon()),
        const SizedBox(height: 20),
        Text(
          l10n.registrationHeadline,
          style: AppTextStyles.h1,
          textAlign: TextAlign.center,
        ).animate().fadeIn().slideY(begin: 0.15, end: 0),
        const SizedBox(height: 8),
        Text(
          l10n.registrationSubtitle,
          style: AppTextStyles.body.copyWith(color: inkMuted),
          textAlign: TextAlign.center,
        ).animate(delay: 100.ms).fadeIn(),
        const SizedBox(height: 28),
        AppTextField(
          label: l10n.registrationFullNameLabel,
          hint: l10n.registrationFullNameHint,
          icon: AppIcons.profile,
          controller: fullNameController,
          keyboardType: TextInputType.name,
          textInputAction: TextInputAction.next,
          errorText: fullNameError,
        ),
        const SizedBox(height: 16),
        Text(l10n.registrationDocumentTypeLabel, style: AppTextStyles.label),
        const SizedBox(height: 8),
        AppSegmented<DocumentType>(
          value: documentType,
          segments: [
            AppSegment(
              value: DocumentType.pinfl,
              label: l10n.registrationDocumentTypePinfl,
            ),
            AppSegment(
              value: DocumentType.passport,
              label: l10n.registrationDocumentTypePassport,
            ),
          ],
          onChanged: onDocumentTypeChanged,
        ),
        const SizedBox(height: 16),
        if (documentType == DocumentType.pinfl)
          AppTextField(
            key: const ValueKey('registration-pinfl-field'),
            label: l10n.registrationPinflLabel,
            hint: l10n.registrationPinflHint,
            icon: AppIcons.card,
            controller: pinflController,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(14),
            ],
            errorText: documentError,
          )
        else
          AppTextField(
            key: const ValueKey('registration-passport-field'),
            label: l10n.registrationPassportLabel,
            hint: l10n.registrationPassportHint,
            icon: AppIcons.card,
            controller: passportController,
            keyboardType: TextInputType.text,
            textInputAction: TextInputAction.next,
            inputFormatters: const [PassportInputFormatter()],
            errorText: documentError,
          ),
        const SizedBox(height: 16),
        AppTextField(
          label: l10n.registrationBirthDateLabel,
          hint: l10n.registrationBirthDateHint,
          icon: AppIcons.calendar,
          controller: birthDateController,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.next,
          inputFormatters: const [DateInputFormatter()],
          errorText: birthDateError,
        ),
        const SizedBox(height: 16),
        AppSelect<String>(
          label: l10n.registrationRegionLabel,
          hint: l10n.registrationRegionHint,
          searchHint: l10n.searchHint,
          icon: AppIcons.location,
          value: regionCode,
          options: [
            for (final region in kUzbekistanRegions)
              AppSelectOption(
                value: region.code,
                label: RegionMeta.regionLabel(l10n, region.code),
              ),
          ],
          onChanged: onRegionChanged,
          errorText: regionError,
        ),
        const SizedBox(height: 16),
        AppSelect<String>(
          label: l10n.registrationDistrictLabel,
          hint: regionCode == null
              ? l10n.registrationDistrictHintNoRegion
              : l10n.registrationDistrictHint,
          searchHint: l10n.searchHint,
          icon: AppIcons.location,
          enabled: regionCode != null,
          value: districtCode,
          options: [
            for (final district in districtOptions)
              AppSelectOption(
                value: district,
                label: RegionMeta.districtLabel(l10n, district),
              ),
          ],
          onChanged: onDistrictChanged,
          errorText: districtError,
        ),
        const SizedBox(height: 16),
        AppTextField(
          label: l10n.registrationAddressLabel,
          hint: l10n.registrationAddressHint,
          icon: AppIcons.building,
          controller: addressController,
          keyboardType: TextInputType.streetAddress,
          textInputAction: TextInputAction.done,
          maxLines: 2,
          errorText: addressError,
        ),
      ],
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            AppIcons.profileBold,
            color: AppColors.primary,
            size: 32,
          ),
        )
        .animate()
        .scale(
          duration: 380.ms,
          curve: Curves.easeOutBack,
          begin: const Offset(0.7, 0.7),
          end: const Offset(1, 1),
        )
        .fadeIn();
  }
}

class _RegistrationSuccessView extends StatelessWidget {
  const _RegistrationSuccessView();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    AppIcons.tick,
                    color: AppColors.primary,
                    size: 56,
                  ),
                )
                .animate()
                .scale(
                  duration: 420.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.6, 0.6),
                  end: const Offset(1, 1),
                )
                .fadeIn(),
            const SizedBox(height: 24),
            Text(
              context.l10n.registrationSuccessTitle,
              style: AppTextStyles.h3,
              textAlign: TextAlign.center,
            ).animate(delay: 150.ms).fadeIn(),
          ],
        ),
      ),
    );
  }
}
