import 'dart:async';

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:app_ui/src/widgets/app_button.dart';
import 'package:app_ui/src/widgets/app_chip.dart';
import 'package:app_ui/src/widgets/app_search_field.dart';
import 'package:app_ui/src/widgets/app_select.dart';
import 'package:app_ui/src/widgets/app_sheet.dart';
import 'package:app_ui/src/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Yagona dizaynli ko'p-tanlov (multi-select) maydoni — bosilganda
/// belgilash (checkbox) ro'yxati bilan pastki varaq ochiladi; tanlanganlar
/// olib-tashlanadigan chip'lar sifatida ([AppChip]) pastda ko'rsatiladi.
class AppMultiSelect<T> extends StatefulWidget {
  const AppMultiSelect({
    required this.options,
    super.key,
    this.values = const [],
    this.onChanged,
    this.label,
    this.hint = 'Tanlang',
    this.icon,
    this.searchable = true,
    this.searchHint = 'Qidirish',
    this.doneLabel = 'Tayyor',
    this.enabled = true,
    this.errorText,
  });

  final List<AppSelectOption<T>> options;
  final List<T> values;
  final ValueChanged<List<T>>? onChanged;
  final String? label;
  final String hint;

  /// Maydon chap tomonidagi ixtiyoriy ikon.
  final IconData? icon;

  /// true bo'lsa varaq ichida qidiruv maydoni ko'rsatiladi.
  final bool searchable;
  final String searchHint;

  /// Varaq pastidagi "Tayyor" tugmasi matni.
  final String doneLabel;
  final bool enabled;
  final String? errorText;

  @override
  State<AppMultiSelect<T>> createState() => _AppMultiSelectState<T>();
}

class _AppMultiSelectState<T> extends State<AppMultiSelect<T>> {
  bool _pressed = false;

  List<AppSelectOption<T>> get _selectedOptions => widget.options
      .where((option) => widget.values.contains(option.value))
      .toList();

  Future<void> _open() async {
    unawaited(HapticFeedback.selectionClick());
    final result = await showAppSheet<List<T>>(
      context: context,
      title: widget.label ?? widget.hint,
      child: _AppMultiSelectSheetBody<T>(
        options: widget.options,
        selectedValues: widget.values,
        searchable: widget.searchable,
        searchHint: widget.searchHint,
        doneLabel: widget.doneLabel,
      ),
    );
    if (result != null) widget.onChanged?.call(result);
  }

  void _remove(T value) {
    widget.onChanged?.call(widget.values.where((v) => v != value).toList());
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedOptions;
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final enabled = widget.enabled;
    final summary = selected.isEmpty
        ? widget.hint
        : '${selected.length} ta tanlandi';
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
                        summary,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: selected.isEmpty ? inkMuted : ink,
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
        if (selected.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in selected)
                AppChip(
                  label: option.label,
                  selected: true,
                  icon: IconsaxPlusLinear.close_circle,
                  onTap: enabled ? () => _remove(option.value) : null,
                ),
            ],
          ),
        ],
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

/// [AppMultiSelect] pastki varag'ining tanasi — qidiruv + belgilash
/// (checkbox) ro'yxati; "Tayyor" bosilganda joriy to'plam bilan yopiladi.
class _AppMultiSelectSheetBody<T> extends StatefulWidget {
  const _AppMultiSelectSheetBody({
    required this.options,
    required this.selectedValues,
    required this.searchable,
    required this.searchHint,
    required this.doneLabel,
  });

  final List<AppSelectOption<T>> options;
  final List<T> selectedValues;
  final bool searchable;
  final String searchHint;
  final String doneLabel;

  @override
  State<_AppMultiSelectSheetBody<T>> createState() =>
      _AppMultiSelectSheetBodyState<T>();
}

class _AppMultiSelectSheetBodyState<T>
    extends State<_AppMultiSelectSheetBody<T>> {
  late final Set<T> _selected = widget.selectedValues.toSet();
  String _query = '';

  List<AppSelectOption<T>> get _filtered {
    if (_query.isEmpty) return widget.options;
    final query = _query.toLowerCase();
    return widget.options
        .where((o) => o.label.toLowerCase().contains(query))
        .toList();
  }

  void _toggle(T value) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selected.contains(value)) {
        _selected.remove(value);
      } else {
        _selected.add(value);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
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
                    return _CheckOptionRow<T>(
                      option: option,
                      checked: _selected.contains(option.value),
                      onTap: () => _toggle(option.value),
                    );
                  },
                ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: widget.doneLabel,
          onPressed: () => Navigator.of(context).pop(_selected.toList()),
        ),
      ],
    );
  }
}

class _CheckOptionRow<T> extends StatelessWidget {
  const _CheckOptionRow({
    required this.option,
    required this.checked,
    required this.onTap,
  });

  final AppSelectOption<T> option;
  final bool checked;
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
          color: checked
              ? AppColors.primary.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Row(
          children: [
            Icon(
              checked ? IconsaxPlusBold.tick_square : IconsaxPlusLinear.square,
              size: 22,
              color: checked ? AppColors.primary : inkMuted,
            ),
            const SizedBox(width: 12),
            if (option.icon != null) ...[
              Icon(
                option.icon,
                size: 20,
                color: checked ? AppColors.primary : inkMuted,
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(
                option.label,
                style: AppTextStyles.bodyStrong.copyWith(
                  color: checked ? AppColors.primary : ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
