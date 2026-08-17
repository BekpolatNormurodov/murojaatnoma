import 'dart:async';

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:app_ui/src/widgets/app_search_field.dart';
import 'package:app_ui/src/widgets/app_sheet.dart';
import 'package:app_ui/src/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// [AppSelect] va AppMultiSelect uchun bitta tanlov varianti.
class AppSelectOption<T> {
  const AppSelectOption({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// Yagona dizaynli bitta-tanlov (single-select) maydoni — bosilganda
/// qidiruvli pastki varaq ([showAppSheet]) ochiladi.
class AppSelect<T> extends StatefulWidget {
  const AppSelect({
    required this.options,
    super.key,
    this.value,
    this.onChanged,
    this.label,
    this.hint = 'Tanlang',
    this.icon,
    this.searchable = true,
    this.searchHint = 'Qidirish',
    this.enabled = true,
    this.errorText,
  });

  final List<AppSelectOption<T>> options;
  final T? value;
  final ValueChanged<T>? onChanged;
  final String? label;
  final String hint;

  /// Maydon chap tomonidagi ixtiyoriy ikon.
  final IconData? icon;

  /// true bo'lsa varaq ichida qidiruv maydoni ko'rsatiladi.
  final bool searchable;
  final String searchHint;
  final bool enabled;
  final String? errorText;

  @override
  State<AppSelect<T>> createState() => _AppSelectState<T>();
}

class _AppSelectState<T> extends State<AppSelect<T>> {
  bool _pressed = false;

  AppSelectOption<T>? get _selected {
    for (final option in widget.options) {
      if (option.value == widget.value) return option;
    }
    return null;
  }

  Future<void> _open() async {
    unawaited(HapticFeedback.selectionClick());
    final result = await showAppSheet<T>(
      context: context,
      title: widget.label ?? widget.hint,
      child: _AppSelectSheetBody<T>(
        options: widget.options,
        selectedValue: widget.value,
        searchable: widget.searchable,
        searchHint: widget.searchHint,
      ),
    );
    if (result != null) widget.onChanged?.call(result);
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final enabled = widget.enabled;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(widget.label!, style: AppTextStyles.label),
          const SizedBox(height: 8),
        ],
        GestureDetector(
          onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
          onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
          onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
          onTap: enabled ? _open : null,
          child: AnimatedScale(
            scale: _pressed ? 0.98 : 1,
            duration: const Duration(milliseconds: 120),
            child: AnimatedOpacity(
              opacity: enabled ? 1 : 0.5,
              duration: const Duration(milliseconds: 150),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: hasError ? AppColors.danger : line,
                  ),
                ),
                child: Row(
                  children: [
                    if (widget.icon != null) ...[
                      Icon(widget.icon, size: 20, color: inkMuted),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Text(
                        selected?.label ?? widget.hint,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: selected == null ? inkMuted : ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      IconsaxPlusLinear.arrow_down_1,
                      size: 18,
                      color: inkMuted,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(
                IconsaxPlusLinear.info_circle,
                size: 14,
                color: AppColors.danger,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  widget.errorText!,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.danger,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// [AppSelect] pastki varag'ining tanasi — ixtiyoriy qidiruv + filtrlangan
/// variantlar ro'yxati. Variant bosilishi bilanoq [Navigator.pop] chaqiradi.
class _AppSelectSheetBody<T> extends StatefulWidget {
  const _AppSelectSheetBody({
    required this.options,
    required this.selectedValue,
    required this.searchable,
    required this.searchHint,
  });

  final List<AppSelectOption<T>> options;
  final T? selectedValue;
  final bool searchable;
  final String searchHint;

  @override
  State<_AppSelectSheetBody<T>> createState() => _AppSelectSheetBodyState<T>();
}

class _AppSelectSheetBodyState<T> extends State<_AppSelectSheetBody<T>> {
  String _query = '';

  List<AppSelectOption<T>> get _filtered {
    if (_query.isEmpty) return widget.options;
    final query = _query.toLowerCase();
    return widget.options
        .where((o) => o.label.toLowerCase().contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.searchable) ...[
          AppSearchField(
            hint: widget.searchHint,
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: 12),
        ],
        Flexible(
          child: filtered.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: EmptyState(
                    icon: IconsaxPlusLinear.search_normal_1,
                    title: 'Natija topilmadi',
                  ),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final option = filtered[index];
                    return _OptionRow<T>(
                      option: option,
                      selected: option.value == widget.selectedValue,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        Navigator.of(context).pop(option.value);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _OptionRow<T> extends StatelessWidget {
  const _OptionRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final AppSelectOption<T> option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Row(
          children: [
            if (option.icon != null) ...[
              Icon(
                option.icon,
                size: 20,
                color: selected ? AppColors.primary : inkMuted,
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Text(
                option.label,
                style: AppTextStyles.bodyStrong.copyWith(
                  color: selected ? AppColors.primary : ink,
                ),
              ),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 150),
              child: selected
                  ? const Icon(
                      IconsaxPlusBold.tick_circle,
                      key: ValueKey('checked'),
                      size: 20,
                      color: AppColors.primary,
                    )
                  : const SizedBox(key: ValueKey('unchecked'), width: 20),
            ),
          ],
        ),
      ),
    );
  }
}
