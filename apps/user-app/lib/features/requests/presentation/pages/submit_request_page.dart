import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/registration/domain/entities/region.dart';
import 'package:user_app/features/registration/presentation/widgets/region_meta.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_picker.dart';

/// Yangi ariza/shikoyat yuborish sahifasi — tur, kategoriya, sarlavha,
/// matn, (ixtiyoriy) manzil va biriktirmalar bilan.
///
/// Ariza egasining ismi/telefoni BU YERDA SO'RALMAYDI — ular joriy
/// sessiya/ro'yxatdan o'tish profilidan avtomatik olinadi (qarang:
/// `CitizenRequestsApiImpl.submit`), forma faqat murojaatning o'ziga
/// tegishli maydonlarni so'raydi.
class SubmitRequestPage extends StatefulWidget {
  const SubmitRequestPage({super.key});

  @override
  State<SubmitRequestPage> createState() => _SubmitRequestPageState();
}

class _SubmitRequestPageState extends State<SubmitRequestPage> {
  /// Backendning `description` maydoni `@MinLength(10)` talab qiladi —
  /// mos ravishda mijoz tomonida ham TEKSHIRILADI, shu bilan foydalanuvchi
  /// serverga borib qaytishni kutmasdan, darhol aniq xabar oladi.
  static const _minBodyLength = 10;
  static const _minTitleLength = 3;

  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  RequestKind _kind = RequestKind.ariza;
  String? _category;
  String? _regionCode;
  String? _districtCode;
  List<RequestAttachment> _attachments = const [];
  String? _titleError;
  String? _categoryError;
  String? _bodyError;

  /// Kategoriya variantlari — joriy tilga mos (`value` ham `label` ham
  /// lokalizatsiya qilingan matn, chunki bu ariza mock/qurilma-ichi
  /// modelida erkin satr sifatida saqlanadi, alohida enum sifatida emas).
  static List<String> _categories(AppLocalizations l10n) => [
    l10n.createRequestCategoryUtilities,
    l10n.createRequestCategoryRoads,
    l10n.createRequestCategoryReference,
    l10n.createRequestCategorySocialAid,
    l10n.createRequestCategorySanitation,
    l10n.createRequestCategoryEducation,
    l10n.createRequestCategoryConstruction,
    l10n.createRequestCategoryPublicOrder,
  ];

  /// Joriy tanlangan viloyatga tegishli tumanlar — viloyat hali
  /// tanlanmagan bo'lsa bo'sh (`RegistrationPage`dagi bir xil naqsh).
  List<String> get _districtOptions {
    final region = _regionCode;
    if (region == null) return const [];
    for (final candidate in kUzbekistanRegions) {
      if (candidate.code == region) return candidate.districtCodes;
    }
    return const [];
  }

  @override
  void initState() {
    super.initState();
    // Fuqaro RO'YXATDAN O'TGANDA berilgan viloyat/tumanini "Manzil"
    // maydoniga OLDINDAN to'ldiradi — reduce-friction: aksariyat hollarda
    // murojaat o'z yashash hududiga tegishli bo'ladi, foydalanuvchi hech
    // narsa tanlamasdan ham to'g'ri qiymat bilan yuborishi mumkin (lekin
    // xohlasa erkin o'zgartira oladi). Muvaffaqiyatsiz bo'lsa (profil
    // yo'q/o'qib bo'lmadi) jim e'tiborsiz qoldiriladi — bu shunchaki
    // qulaylik, formani hech qachon bloklamaydi.
    unawaited(_prefillLocation());
  }

  Future<void> _prefillLocation() async {
    final profile = await context
        .read<SubmitRequestCubit>()
        .loadDefaultLocation();
    if (!mounted || profile == null) return;
    setState(() {
      _regionCode ??= profile.regionCode;
      _districtCode ??= profile.districtCode;
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  bool _validate() {
    final l10n = context.l10n;
    setState(() {
      final title = _titleController.text.trim();
      _titleError = title.isEmpty
          ? l10n.createRequestValidationError
          : title.length < _minTitleLength
          ? 'Kamida $_minTitleLength ta belgi kiriting'
          : null;
      _categoryError = _category == null
          ? l10n.createRequestValidationError
          : null;
      final body = _bodyController.text.trim();
      _bodyError = body.isEmpty
          ? l10n.createRequestValidationError
          : body.length < _minBodyLength
          ? 'Kamida $_minBodyLength ta belgi kiriting'
          : null;
    });
    return _titleError == null && _categoryError == null && _bodyError == null;
  }

  void _submit() {
    if (!_validate()) return;
    final category = _category;
    if (category == null) return;
    final l10n = context.l10n;

    final regionCode = _regionCode;
    final districtCode = _districtCode;

    context.read<SubmitRequestCubit>().submit(
      CitizenRequest(
        id: '',
        kind: _kind,
        category: category,
        title: _titleController.text.trim(),
        body: _bodyController.text.trim(),
        status: RequestStatus.yuborilgan,
        createdAt: DateTime.now().toIso8601String(),
        attachments: _attachments,
        // Backendga KOD emas, ko'rinadigan NOM yuboriladi (masalan
        // "Toshkent shahri") — `Application.region`/`district` erkin matn
        // maydonlari, qarang: `CitizenRequest.region` hujjati.
        region: regionCode == null
            ? null
            : RegionMeta.regionLabel(l10n, regionCode),
        district: districtCode == null
            ? null
            : RegionMeta.districtLabel(l10n, districtCode),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.citizenRequestSubmitTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocConsumer<SubmitRequestCubit, SubmitRequestState>(
          listener: (context, state) async {
            if (state is SubmitRequestSuccess) {
              await AppDialog.success(
                context: context,
                title: l10n.createRequestSuccessTitle,
                message: l10n.createRequestSuccessMessage,
                onClose: () {
                  if (context.mounted) context.pop();
                },
              );
            } else if (state is SubmitRequestFailure) {
              AppAlert.error(context, state.message);
            }
          },
          builder: (context, state) {
            final submitting = state is SubmitRequestSubmitting;
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                // Yuborish davomida butun forma bloklanadi (IgnorePointer)
                // va xiralashtiriladi (AnimatedOpacity) — aniq "yuborilmoqda,
                // hozircha tahrirlash mumkin emas" signali, tugmaning o'zi
                // (pastda, wrapper tashqarisida) esa o'z loading holatini
                // to'liq yorqinlikda ko'rsatadi.
                AnimatedOpacity(
                  opacity: submitting ? 0.55 : 1,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: submitting,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.citizenRequestKindLabel,
                          style: AppTextStyles.label,
                        ),
                        const SizedBox(height: 8),
                        AppSegmented<RequestKind>(
                          value: _kind,
                          segments: [
                            AppSegment(
                              value: RequestKind.ariza,
                              label: l10n.requestKindAriza,
                            ),
                            AppSegment(
                              value: RequestKind.shikoyat,
                              label: l10n.requestKindShikoyat,
                            ),
                          ],
                          onChanged: (value) => setState(() => _kind = value),
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: l10n.createRequestTitleLabel,
                          hint: l10n.createRequestTitleHint,
                          controller: _titleController,
                          errorText: _titleError,
                          enabled: !submitting,
                          maxLength: 120,
                          textInputAction: TextInputAction.next,
                          onChanged: (value) {
                            if (_titleError != null &&
                                value.trim().length >= _minTitleLength) {
                              setState(() => _titleError = null);
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        AppSelect<String>(
                          label: l10n.createRequestCategoryLabel,
                          hint: l10n.createRequestCategoryHint,
                          searchHint: l10n.searchHint,
                          icon: AppIcons.category,
                          value: _category,
                          options: [
                            for (final category in _categories(l10n))
                              AppSelectOption(value: category, label: category),
                          ],
                          onChanged: (value) => setState(() {
                            _category = value;
                            _categoryError = null;
                          }),
                          errorText: _categoryError,
                          enabled: !submitting,
                        ),
                        const SizedBox(height: 16),
                        Text('Manzil (lokatsiya)', style: AppTextStyles.label),
                        const SizedBox(height: 4),
                        Text(
                          'Ixtiyoriy — muammo tegishli hudud',
                          style: AppTextStyles.caption.copyWith(
                            color: inkMuted,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: AppSelect<String>(
                                hint: l10n.registrationRegionHint,
                                searchHint: l10n.searchHint,
                                icon: AppIcons.location,
                                value: _regionCode,
                                options: [
                                  for (final region in kUzbekistanRegions)
                                    AppSelectOption(
                                      value: region.code,
                                      label: RegionMeta.regionLabel(
                                        l10n,
                                        region.code,
                                      ),
                                    ),
                                ],
                                onChanged: (value) => setState(() {
                                  _regionCode = value;
                                  _districtCode = null;
                                }),
                                enabled: !submitting,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: AppSelect<String>(
                                hint: _regionCode == null
                                    ? l10n.registrationDistrictHintNoRegion
                                    : l10n.registrationDistrictHint,
                                searchHint: l10n.searchHint,
                                icon: AppIcons.location,
                                value: _districtCode,
                                options: [
                                  for (final district in _districtOptions)
                                    AppSelectOption(
                                      value: district,
                                      label: RegionMeta.districtLabel(
                                        l10n,
                                        district,
                                      ),
                                    ),
                                ],
                                onChanged: (value) =>
                                    setState(() => _districtCode = value),
                                enabled: !submitting && _regionCode != null,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: l10n.createRequestDescriptionLabel,
                          hint: l10n.createRequestDescriptionHint,
                          controller: _bodyController,
                          maxLines: 5,
                          maxLength: 2000,
                          errorText: _bodyError,
                          helperText: _bodyError == null
                              ? 'Muammoni imkon qadar aniq va batafsil yozing'
                              : null,
                          enabled: !submitting,
                          onChanged: (value) {
                            if (_bodyError != null &&
                                value.trim().length >= _minBodyLength) {
                              setState(() => _bodyError = null);
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${l10n.createRequestAttachmentsLabel} '
                          '(${_attachments.length}/'
                          '${RequestAttachmentPicker.defaultMaxCount})',
                          style: AppTextStyles.label,
                        ),
                        const SizedBox(height: 8),
                        RequestAttachmentPicker(
                          attachments: _attachments,
                          onChanged: (value) =>
                              setState(() => _attachments = value),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                AppButton(
                  label: l10n.createRequestSubmit,
                  icon: AppIcons.send,
                  loading: submitting,
                  onPressed: submitting ? null : _submit,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
