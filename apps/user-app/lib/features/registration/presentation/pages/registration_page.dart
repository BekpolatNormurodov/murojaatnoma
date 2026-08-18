import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/entities/region.dart';
import 'package:user_app/features/registration/presentation/bloc/registration_cubit.dart';
import 'package:user_app/features/registration/presentation/utils/full_name_input_formatter.dart';
import 'package:user_app/features/registration/presentation/utils/passport_input_formatter.dart';
import 'package:user_app/features/registration/presentation/utils/registration_validators.dart';
import 'package:user_app/features/registration/presentation/widgets/region_meta.dart';

/// Shaxsiy ma'lumotlarni to'ldirish sahifasi (`/register`) — Faza 3
/// oqimining OTP tasdiqlangandan KEYIN, yuz ro'yxatdan o'tkazishdan OLDIN
/// joylashgan, bir martalik bosqichi.
///
/// **Faqat [CitizenProfile.fullName] majburiy** — murojaat (`/applications`)
/// yuborish uchun kerakli yagona narsa (telefon OTP orqali allaqachon
/// tasdiqlangan). Hujjat turi/raqami, tug'ilgan sana, viloyat/tuman va
/// manzil — barchasi "Qo'shimcha ma'lumot (ixtiyoriy)" bo'limi ostida,
/// STANDART YOPIQ holatda: fuqaro pasport/JSHSHIR ko'rsatishga MAJBUR
/// emas, xohlasa o'zi ochib to'ldiradi (qarang: `CitizenProfile`
/// hujjatidagi to'liq izoh).
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
  String? _addressError;

  /// "Qo'shimcha ma'lumot" (hujjat/tug'ilgan sana/viloyat-tuman/manzil)
  /// bo'limi kengaytirilganmi. Standart YOPIQ — forma ATAYLAB faqat
  /// F.I.Sh. bilan boshlanadi; qolgan hammasi foydalanuvchi o'zi XOHLASA
  /// ochadigan ixtiyoriy qo'shimcha bosqich (murojaat yuborish uchun shart
  /// emas).
  bool _optionalExpanded = false;

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

  /// Barcha maydonlarni tekshiradi — [CitizenProfile.fullName]dan
  /// TASHQARI hammasi IXTIYORIY: bo'sh qoldirilgan ixtiyoriy maydon hech
  /// qachon xato hisoblanmaydi, faqat TO'LDIRILGAN-VA-NOTO'G'RI qiymat
  /// xato beradi (masalan yarim yozilgan sana).
  bool _validate(AppLocalizations l10n) {
    final fullNameOk = isValidFullName(_fullNameController.text);

    final documentText =
        (_documentType == DocumentType.pinfl
                ? _pinflController.text
                : _passportController.text)
            .trim();
    final documentFilled = documentText.isNotEmpty;
    final documentOk =
        !documentFilled ||
        (_documentType == DocumentType.pinfl
            ? isValidPinfl(documentText)
            : isValidPassport(documentText));

    final birthDateText = _birthDateController.text.trim();
    final birthDateFilled = birthDateText.isNotEmpty;
    final birthDateOk =
        !birthDateFilled || parseBirthDate(birthDateText) != null;

    final addressText = _addressController.text.trim();
    final addressFilled = addressText.isNotEmpty;
    final addressOk = !addressFilled || isValidAddress(addressText);

    setState(() {
      _fullNameError = fullNameOk ? null : l10n.registrationFullNameError;
      _documentError = documentOk
          ? null
          : (_documentType == DocumentType.pinfl
                ? l10n.registrationPinflError
                : l10n.registrationPassportError);
      _birthDateError = birthDateOk ? null : l10n.registrationBirthDateError;
      _addressError = addressOk ? null : l10n.registrationAddressError;
      // Xatolik ixtiyoriy bo'limda topilsa, bo'lim albatta OCHIQ bo'lishi
      // shart — aks holda foydalanuvchi xatoni YOPIQ bo'lim ichida
      // hech qachon ko'rmas edi.
      if (!documentOk || !birthDateOk || !addressOk) {
        _optionalExpanded = true;
      }
    });

    return fullNameOk && documentOk && birthDateOk && addressOk;
  }

  void _submit() {
    final l10n = context.l10n;
    if (!_validate(l10n)) return;

    final documentText =
        (_documentType == DocumentType.pinfl
                ? _pinflController.text
                : _passportController.text)
            .trim();
    final hasDocument = documentText.isNotEmpty;

    final birthDateText = _birthDateController.text.trim();
    final birthDate = birthDateText.isEmpty
        ? null
        : parseBirthDate(birthDateText);

    final addressText = _addressController.text.trim();

    context.read<RegistrationCubit>().submit(
      CitizenProfile(
        fullName: _fullNameController.text.trim(),
        documentType: hasDocument ? _documentType : null,
        documentNumber: hasDocument ? documentText : null,
        birthDate: birthDate == null
            ? null
            : '${birthDate.year.toString().padLeft(4, '0')}-'
                  '${birthDate.month.toString().padLeft(2, '0')}-'
                  '${birthDate.day.toString().padLeft(2, '0')}',
        regionCode: _regionCode,
        districtCode: _districtCode,
        address: addressText.isEmpty ? null : addressText,
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
              _districtCode = null;
            }),
            onDistrictChanged: (value) =>
                setState(() => _districtCode = value),
            fullNameError: _fullNameError,
            documentError: _documentError,
            birthDateError: _birthDateError,
            addressError: _addressError,
            onFullNameChanged: () {
              if (_fullNameError != null) {
                setState(() => _fullNameError = null);
              }
            },
            onDocumentChanged: () {
              if (_documentError != null) {
                setState(() => _documentError = null);
              }
            },
            onBirthDateChanged: () {
              if (_birthDateError != null) {
                setState(() => _birthDateError = null);
              }
            },
            onAddressChanged: () {
              if (_addressError != null) {
                setState(() => _addressError = null);
              }
            },
            optionalExpanded: _optionalExpanded,
            onToggleOptional: () =>
                setState(() => _optionalExpanded = !_optionalExpanded),
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
///
/// Ikki aniq bosqichga bo'lingan: (1) MAJBURIY — faqat to'liq ism, (2)
/// IXTIYORIY — "Qo'shimcha ma'lumot" tugmasi bosilgach ochiladigan
/// hujjat/tug'ilgan sana/viloyat-tuman/manzil guruhi.
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
    required this.addressError,
    required this.onFullNameChanged,
    required this.onDocumentChanged,
    required this.onBirthDateChanged,
    required this.onAddressChanged,
    required this.optionalExpanded,
    required this.onToggleOptional,
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
  final String? addressError;
  final VoidCallback onFullNameChanged;
  final VoidCallback onDocumentChanged;
  final VoidCallback onBirthDateChanged;
  final VoidCallback onAddressChanged;
  final bool optionalExpanded;
  final VoidCallback onToggleOptional;
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
              textInputAction: TextInputAction.done,
              autofocus: true,
              inputFormatters: const [FullNameInputFormatter()],
              errorText: fullNameError,
              helperText: fullNameError == null
                  ? 'Murojaat yuborish uchun shu maydon yetarli — '
                        'qolganlari ixtiyoriy'
                  : null,
              onChanged: (_) => onFullNameChanged(),
              onSubmitted: (_) => onSubmit(),
            )
            .animate(delay: 160.ms)
            .fadeIn()
            .slideY(begin: 0.1, end: 0),
        const SizedBox(height: 24),
        _OptionalSectionToggle(
          expanded: optionalExpanded,
          onTap: onToggleOptional,
        ).animate(delay: 220.ms).fadeIn(),
        if (optionalExpanded) ...[
          const SizedBox(height: 20),
          Text(
            _optionalLabel(l10n.registrationDocumentTypeLabel),
            style: AppTextStyles.label,
          ).animate().fadeIn(),
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
          ).animate().fadeIn(),
          const SizedBox(height: 16),
          if (documentType == DocumentType.pinfl)
            AppTextField(
                  key: const ValueKey('registration-pinfl-field'),
                  label: _optionalLabel(l10n.registrationPinflLabel),
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
                  onChanged: (_) => onDocumentChanged(),
                )
                .animate(delay: 20.ms)
                .fadeIn()
                .slideY(begin: 0.08, end: 0)
          else
            AppTextField(
                  key: const ValueKey('registration-passport-field'),
                  label: _optionalLabel(l10n.registrationPassportLabel),
                  hint: l10n.registrationPassportHint,
                  icon: AppIcons.card,
                  controller: passportController,
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.next,
                  inputFormatters: const [PassportInputFormatter()],
                  errorText: documentError,
                  onChanged: (_) => onDocumentChanged(),
                )
                .animate(delay: 20.ms)
                .fadeIn()
                .slideY(begin: 0.08, end: 0),
          const SizedBox(height: 16),
          AppTextField(
                label: _optionalLabel(l10n.registrationBirthDateLabel),
                hint: l10n.registrationBirthDateHint,
                icon: AppIcons.calendar,
                controller: birthDateController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                inputFormatters: const [DateInputFormatter()],
                errorText: birthDateError,
                onChanged: (_) => onBirthDateChanged(),
              )
              .animate(delay: 60.ms)
              .fadeIn()
              .slideY(begin: 0.08, end: 0),
          const SizedBox(height: 16),
          AppSelect<String>(
                label: _optionalLabel(l10n.registrationRegionLabel),
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
              )
              .animate(delay: 100.ms)
              .fadeIn()
              .slideY(begin: 0.08, end: 0),
          const SizedBox(height: 16),
          AppSelect<String>(
                label: _optionalLabel(l10n.registrationDistrictLabel),
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
              )
              .animate(delay: 140.ms)
              .fadeIn()
              .slideY(begin: 0.08, end: 0),
          const SizedBox(height: 16),
          AppTextField(
                label: _optionalLabel(l10n.registrationAddressLabel),
                hint: l10n.registrationAddressHint,
                icon: AppIcons.building,
                controller: addressController,
                keyboardType: TextInputType.streetAddress,
                textInputAction: TextInputAction.done,
                maxLines: 2,
                errorText: addressError,
                onChanged: (_) => onAddressChanged(),
              )
              .animate(delay: 180.ms)
              .fadeIn()
              .slideY(begin: 0.08, end: 0),
        ],
      ],
    );
  }
}

/// Ixtiyoriy maydon yorlig'iga qisqa "· ixtiyoriy" belgisini qo'shadi —
/// fuqaro bu maydonni to'ldirmasa ham forma to'liq yuborilishini aniq
/// ko'rsatish uchun.
String _optionalLabel(String label) => '$label · ixtiyoriy';

/// "Qo'shimcha ma'lumot" bo'limini och/yop qiluvchi bosiladigan qator —
/// standart YOPIQ holatda forma nima uchun QISQA ko'rinishini (faqat ism)
/// tushuntiradi, bosilganda esa hujjat/sana/manzil maydonlarini ochadi.
class _OptionalSectionToggle extends StatelessWidget {
  const _OptionalSectionToggle({required this.expanded, required this.onTap});

  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          const Icon(AppIcons.card, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              expanded
                  ? "Qo'shimcha ma'lumotni yashirish"
                  : "Qo'shimcha ma'lumot (ixtiyoriy)",
              style: AppTextStyles.bodyStrong,
            ),
          ),
          AnimatedRotation(
            turns: expanded ? 0.5 : 0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(
              IconsaxPlusLinear.arrow_down_1,
              size: 18,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
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
