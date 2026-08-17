import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// [AppSegmented] uchun bitta segment (qiymat + yorliq + ixtiyoriy ikon).
class AppSegment<T> {
  const AppSegment({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// Segmentlangan boshqaruv / "pill" tab'lar.
///
/// Segmentlar soniga qarab rejim AVTOMATIK tanlanadi:
///  * **Kam** (`<= _fillThreshold`) — segmentlar teng kenglikda butun enni
///    to'ldiradi (klassik segmented ko'rinish);
///  * **Ko'p** — segmentlar TABIIY kenglikda bo'lib, gorizontal suriladi
///    (`SingleChildScrollView`). Shu tufayli yorliqlar HECH QACHON kesilib/
///    siqilib qolmaydi (masalan "To'lovlar tarixi"dagi 6 ta kategoriya —
///    ilgari hammasi 1/6 enga siqilib, matn kesilardi).
///
/// Faol segment silliq (200ms) rang o'tishi bilan "pill" (surface + soya)
/// ko'rinishiga o'tadi.
class AppSegmented<T> extends StatelessWidget {
  const AppSegmented({
    required this.segments,
    required this.value,
    required this.onChanged,
    super.key,
  }) : assert(segments.length > 0, "segments bo'sh bo'lmasligi kerak");

  final List<AppSegment<T>> segments;
  final T value;
  final ValueChanged<T> onChanged;

  /// Shu songacha teng-kenglik rejimi; undan ko'pi suriluvchi rejimga o'tadi.
  static const _fillThreshold = 4;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;

    final fill = segments.length <= _fillThreshold;

    final children = [
      for (final segment in segments)
        _Segment<T>(
          segment: segment,
          active: segment.value == value,
          onChanged: onChanged,
        ),
    ];

    return Container(
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: line),
      ),
      child: fill
          ? Row(
              children: [
                for (final child in children) Expanded(child: child),
              ],
            )
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(children: children),
            ),
    );
  }
}

class _Segment<T> extends StatelessWidget {
  const _Segment({
    required this.segment,
    required this.active,
    required this.onChanged,
  });

  final AppSegment<T> segment;
  final bool active;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final color = active
        ? (isDark ? AppColors.darkInk : AppColors.ink)
        : (isDark ? AppColors.darkInkMuted : AppColors.inkMuted);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: active
          ? null
          : () {
              HapticFeedback.selectionClick();
              onChanged(segment.value);
            },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: active ? surface : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (segment.icon != null) ...[
              Icon(segment.icon, size: 16, color: color),
              const SizedBox(width: 6),
            ],
            Text(
              segment.label,
              style: AppTextStyles.label.copyWith(color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
