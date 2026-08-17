import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/payments/domain/entities/saved_card.dart';
import 'package:user_app/features/payments/presentation/widgets/card_network_meta.dart';

/// To'lov sahifasidagi saqlangan (mock) kartalar karuseli — foydalanuvchi
/// qaysi karta bilan to'lashini tanlaydi yoki oxirida turgan "Yangi karta"
/// bo'lagi orqali qo'lda kiritishga o'tadi.
///
/// [selected] `null` bo'lsa — "Yangi karta" bo'lagi faol ko'rsatiladi.
class SavedCardCarousel extends StatelessWidget {
  const SavedCardCarousel({
    required this.cards,
    required this.selected,
    required this.onSelect,
    super.key,
  });

  final List<SavedCard> cards;
  final SavedCard? selected;
  final ValueChanged<SavedCard?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SizedBox(
      height: 128,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: cards.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          if (index == cards.length) {
            return _NewCardTile(
              selected: selected == null,
              label: l10n.addNewCardOption,
              onTap: () => onSelect(null),
            );
          }
          final card = cards[index];
          return _SavedCardChip(
            card: card,
            selected: selected?.id == card.id,
            onTap: () => onSelect(card),
          );
        },
      ),
    );
  }
}

class _SavedCardChip extends StatelessWidget {
  const _SavedCardChip({
    required this.card,
    required this.selected,
    required this.onTap,
  });

  final SavedCard card;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 200,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: CardNetworkMeta.gradient(card.network),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: selected ? Colors.white : Colors.transparent,
            width: 2,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    CardNetworkMeta.label(card.network),
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: Colors.white,
                    ),
                  ),
                ),
                if (selected)
                  const Icon(
                    IconsaxPlusBold.tick_circle,
                    color: Colors.white,
                    size: 20,
                  ),
              ],
            ),
            const Spacer(),
            Text(
              card.maskedNumber,
              style: AppTextStyles.body.copyWith(
                color: Colors.white.withValues(alpha: 0.92),
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              formatSom(card.balance),
              style: AppTextStyles.h3.copyWith(color: Colors.white),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _NewCardTile extends StatelessWidget {
  const _NewCardTile({
    required this.selected,
    required this.label,
    required this.onTap,
  });

  final bool selected;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 140,
        decoration: BoxDecoration(
          color: surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: selected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                AppIcons.add,
                color: selected ? AppColors.primary : inkMuted,
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption.copyWith(
                    color: selected ? AppColors.primary : inkMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
