import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_picker.dart';

/// Yangi ariza/shikoyat yuborish sahifasi — tur, kategoriya, sarlavha,
/// matn va biriktirmalar bilan.
class SubmitRequestPage extends StatefulWidget {
  const SubmitRequestPage({super.key});

  @override
  State<SubmitRequestPage> createState() => _SubmitRequestPageState();
}

class _SubmitRequestPageState extends State<SubmitRequestPage> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  RequestKind _kind = RequestKind.ariza;
  String? _category;
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

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  bool _validate() {
    final l10n = context.l10n;
    setState(() {
      _titleError = _titleController.text.trim().isEmpty
          ? l10n.createRequestValidationError
          : null;
      _categoryError = _category == null
          ? l10n.createRequestValidationError
          : null;
      _bodyError = _bodyController.text.trim().isEmpty
          ? l10n.createRequestValidationError
          : null;
    });
    return _titleError == null && _categoryError == null && _bodyError == null;
  }

  void _submit() {
    if (!_validate()) return;
    final category = _category;
    if (category == null) return;

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
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;

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
                Text(l10n.citizenRequestKindLabel, style: AppTextStyles.label),
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
                ),
                const SizedBox(height: 16),
                AppSelect<String>(
                  label: l10n.createRequestCategoryLabel,
                  hint: l10n.createRequestCategoryHint,
                  searchHint: l10n.searchHint,
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
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: l10n.createRequestDescriptionLabel,
                  hint: l10n.createRequestDescriptionHint,
                  controller: _bodyController,
                  maxLines: 5,
                  errorText: _bodyError,
                ),
                const SizedBox(height: 16),
                Text(
                  l10n.createRequestAttachmentsLabel,
                  style: AppTextStyles.label,
                ),
                const SizedBox(height: 8),
                RequestAttachmentPicker(
                  attachments: _attachments,
                  onChanged: (value) => setState(() => _attachments = value),
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
