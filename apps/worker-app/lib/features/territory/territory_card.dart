import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/territory/territory_service.dart';
import 'package:worker_app/injection.dart';

/// "Mening hududim" — biriktirilgan mahallalar NOMLARI. Hudud noma'lum
/// bo'lsa (yuklanmagan / xato) hech narsa ko'rsatilmaydi.
class TerritoryCard extends StatefulWidget {
  const TerritoryCard({this.service, this.padding, super.key});

  /// Testlar uchun; standart — DI'dagi xizmat.
  final TerritoryService? service;

  /// Karta ko'ringandagi tashqi bo'shliq.
  final EdgeInsetsGeometry? padding;

  @override
  State<TerritoryCard> createState() => _TerritoryCardState();
}

class _TerritoryCardState extends State<TerritoryCard> {
  /// Yig'ilgan holatda ko'rsatiladigan mahallalar soni.
  static const _collapsed = 6;

  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final service =
        widget.service ??
        (getIt.isRegistered<TerritoryService>()
            ? getIt<TerritoryService>()
            : null);
    if (service == null) return const SizedBox.shrink();
    return ValueListenableBuilder<Territory?>(
      valueListenable: service.territory,
      builder: (context, territory, _) {
        if (territory == null) return const SizedBox.shrink();
        return Padding(
          padding: widget.padding ?? EdgeInsets.zero,
          child: _body(context, territory),
        );
      },
    );
  }

  Widget _body(BuildContext context, Territory territory) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final all = territory.mahallas;
    final shown = _expanded ? all : all.take(_collapsed).toList();
    final rest = all.length - shown.length;

    return AppCard(
      key: const Key('territory_card'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(AppIcons.map, size: 20, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  ru ? 'Моя территория' : 'Mening hududim',
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              if (all.isNotEmpty)
                Text(
                  ru ? '${all.length} махалл' : '${all.length} ta mahalla',
                  style: AppTextStyles.caption.copyWith(color: muted),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (territory.wholeDistrict)
            Text(
              ru ? 'Весь район' : 'Butun tuman',
              style: AppTextStyles.body.copyWith(color: ink),
            )
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final m in shown)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(AppRadii.xs),
                    ),
                    child: Text(
                      m.name,
                      style: AppTextStyles.caption.copyWith(
                        color: ink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          if (all.length > _collapsed)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(
                  _expanded
                      ? (ru ? 'Свернуть' : "Yig'ish")
                      : (ru ? 'Ещё $rest' : 'Yana $rest ta'),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
