import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/usecases/submit_suggestion.dart';
import 'package:worker_app/injection.dart';

/// Taklif kategoriyalari — barqaror (til-mustaqil) qiymatlar sifatida ENUM
/// qilib saqlanadi, ko'rsatiladigan LABEL esa [_categoryLabel] orqali
/// `context.l10n`dan olinadi (`CreateRequestPage._RequestCategory` bilan
/// bir xil naqsh — endi o'chirilgan, qarang: git tarixi). `Suggestion.
/// category` erkin matn (enum emas) bo'lgani uchun tanlangan variantning
/// LOKALIZATSIYA QILINGAN yorlig'i to'g'ridan-to'g'ri saqlanadi — xuddi
/// mavjud mock ma'lumotlar (`mock_suggestions.dart`) kabi oddiy, inson
/// o'qiy oladigan satr sifatida.
enum _SuggestionCategory { digital, process, social, infra, other }

String _categoryLabel(AppLocalizations l10n, _SuggestionCategory category) =>
    switch (category) {
      _SuggestionCategory.digital => l10n.suggestionCategoryDigital,
      _SuggestionCategory.process => l10n.suggestionCategoryProcess,
      _SuggestionCategory.social => l10n.suggestionCategorySocial,
      _SuggestionCategory.infra => l10n.suggestionCategoryInfra,
      _SuggestionCategory.other => l10n.suggestionCategoryOther,
    };

/// Yangi taklif (ratsionalizatorlik g'oyasi) yuborish sahifasi — sarlavha,
/// kategoriya va matn bilan.
///
/// `SuggestionsRepository.submit` HAQIQIY implementatsiyaga ega (mock:
/// `mockSuggestions`ga qo'shadi) — shuning uchun `CreateRequestPage`dan
/// farqli o'laroq, yuborish tugmasi HAQIQIY `SubmitSuggestion` usecase'ini
/// chaqiradi (stub/simulyatsiya EMAS).
///
/// Alohida Cubit shart emas — bitta martalik amal (`ProfilePage._logout`
/// bilan bir xil naqsh): usecase to'g'ridan-to'g'ri `getIt` orqali
/// chaqiriladi.
class SubmitSuggestionPage extends StatefulWidget {
  const SubmitSuggestionPage({super.key});

  @override
  State<SubmitSuggestionPage> createState() => _SubmitSuggestionPageState();
}

class _SubmitSuggestionPageState extends State<SubmitSuggestionPage> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  _SuggestionCategory? _category;
  bool _submitting = false;
  String? _titleError;
  String? _categoryError;
  String? _bodyError;

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

  Future<void> _submit() async {
    if (!_validate()) return;
    final l10n = context.l10n;
    final category = _category;
    if (category == null) return;

    setState(() => _submitting = true);
    final draft = Suggestion(
      id: '',
      title: _titleController.text.trim(),
      body: _bodyController.text.trim(),
      category: _categoryLabel(l10n, category),
      status: SuggestionStatus.yangi,
      createdAt: DateTime.now().toIso8601String(),
      votes: 0,
    );
    final result = await getIt<SubmitSuggestion>()(
      SubmitSuggestionParams(draft),
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    result.fold(
      (failure) => AppAlert.error(context, failure.message),
      (_) async {
        await AppDialog.success(
          context: context,
          title: l10n.submitSuggestionSuccessTitle,
          message: l10n.submitSuggestionSuccessMessage,
          buttonLabel: l10n.closeLabel,
        );
        if (mounted) context.pop();
      },
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
        title: Text(l10n.submitSuggestionTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            AppTextField(
              label: l10n.submitSuggestionTitleLabel,
              hint: l10n.submitSuggestionTitleHint,
              controller: _titleController,
              errorText: _titleError,
            ),
            const SizedBox(height: 16),
            AppSelect<_SuggestionCategory>(
              label: l10n.submitSuggestionCategoryLabel,
              hint: l10n.submitSuggestionCategoryHint,
              searchable: false,
              value: _category,
              options: [
                for (final category in _SuggestionCategory.values)
                  AppSelectOption(
                    value: category,
                    label: _categoryLabel(l10n, category),
                  ),
              ],
              onChanged: (value) => setState(() {
                _category = value;
                _categoryError = null;
              }),
              errorText: _categoryError,
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: l10n.submitSuggestionBodyLabel,
              hint: l10n.submitSuggestionBodyHint,
              controller: _bodyController,
              maxLines: 6,
              errorText: _bodyError,
            ),
            const SizedBox(height: 28),
            AppButton(
              label: l10n.submitSuggestionSubmit,
              icon: AppIcons.send,
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
