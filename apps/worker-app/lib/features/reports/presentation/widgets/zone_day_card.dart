import 'package:app_ui/app_ui.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';

/// Bitta kun: hududda / tashqarida bo'lgan vaqt va aniq oraliqlar
/// (`09:12 – 11:40 · Hududda · Olmazor`).
class ZoneDayCard extends StatelessWidget {
  const ZoneDayCard({required this.day, super.key});

  final ZoneDay day;

  bool get _onlyUnassigned =>
      day.unassignedMinutes > 0 &&
      day.zoneMinutes == 0 &&
      day.outsideMinutes == 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final first = day.firstAt;
    final last = day.lastAt;

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Wrap — katta shriftda vaqt oralig'i sarlavha ostiga tushadi
          // (Row'da o'ng tomonga toshib ketardi).
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 2,
            children: [
              Text(formatDayTitle(day.date), style: AppTextStyles.bodyStrong),
              if (first != null && last != null)
                Text(
                  '${formatClock(first)} – ${formatClock(last)}',
                  style: AppTextStyles.caption.copyWith(color: muted),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (day.isEmpty)
            Text(
              "Bu kunda joylashuv ma'lumoti yo'q",
              style: AppTextStyles.caption.copyWith(color: muted),
            )
          else ...[
            // Butun kun hududsiz o'tgan bo'lsa "Hududda 0 / Tashqarida 0"
            // chalg'itadi — ular ko'rsatilmaydi.
            if (!_onlyUnassigned) ...[
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _Metric(
                        label: 'Hududda',
                        value: formatMinutes(day.zoneMinutes),
                        color: AppColors.success,
                      ),
                    ),
                    if (day.officeMinutes > 0) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: _Metric(
                          label: 'Ofisda',
                          value: formatMinutes(day.officeMinutes),
                          color: AppColors.info,
                        ),
                      ),
                    ],
                    const SizedBox(width: 8),
                    Expanded(
                      child: _Metric(
                        label: 'Tashqarida',
                        value: formatMinutes(day.outsideMinutes),
                        color: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (day.officeMinutes > 0)
              _Metric(
                label: 'Ofisda',
                value: formatMinutes(day.officeMinutes),
                color: AppColors.info,
              ),
            if (day.unassignedMinutes > 0) ...[
              const SizedBox(height: 8),
              _Metric(
                label: 'Hudud biriktirilmagan',
                value: formatMinutes(day.unassignedMinutes),
                color: AppColors.inkMuted,
              ),
            ],
            if (day.byMahalla.isNotEmpty) ...[
              const SizedBox(height: 10),
              // Wrap — 360 px'da ham toshmaydi; ko'pi bilan 8 ta.
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final m in day.byMahalla.take(8)) _MahallaChip(m),
                ],
              ),
            ],
            if (day.stretches.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final stretch in day.stretches) _StretchRow(stretch),
            ],
          ],
        ],
      ),
    );
  }
}

class _MahallaChip extends StatelessWidget {
  const _MahallaChip(this.item);

  final MahallaTime item;

  @override
  Widget build(BuildContext context) {
    final color = item.inside
        ? AppColors.success
        : item.office
        ? AppColors.info
        : item.assigned
        ? AppColors.danger
        : AppColors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppRadii.xs),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        '${item.label} · ${formatMinutes(item.minutes)}',
        style: AppTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Uch ustunda "Tashqarida" kesilmasin — sig'masa kichrayadi.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              label,
              style: AppTextStyles.caption.copyWith(color: color),
              maxLines: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTextStyles.bodyStrong,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _StretchRow extends StatelessWidget {
  const _StretchRow(this.stretch);

  final ZoneStretch stretch;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final ink = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final color = stretch.inside
        ? AppColors.success
        : stretch.office
        ? AppColors.info
        : stretch.assigned
        ? AppColors.warning
        : AppColors.inkMuted;
    final parts = <String>[
      '${formatClock(stretch.from)} – ${formatClock(stretch.to)}',
      if (stretch.inside)
        'Hududda'
      else if (stretch.office)
        'Ofisda'
      else if (stretch.assigned)
        'Tashqarida'
      else
        'Hudud biriktirilmagan',
      if (stretch.mahallaName != null) stretch.mahallaName!,
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  parts.join(' · '),
                  style: AppTextStyles.caption.copyWith(color: ink),
                ),
                Text(
                  formatMinutes(stretch.minutes),
                  style: AppTextStyles.caption.copyWith(
                    color: ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
