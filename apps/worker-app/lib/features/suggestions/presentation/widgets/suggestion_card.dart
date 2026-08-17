import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/presentation/widgets/suggestion_status_chip.dart';

/// `Suggestion.createdAt` kabi ISO sana satrini inson o'qiy oladigan
/// ko'rinishga o'giradi; parslab bo'lmasa xom satrni qaytaradi
/// (`ApplicationCard.formatIsoDate` — `requests` moduli — bilan bir xil
/// naqsh).
String formatSuggestionDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? iso : formatDate(parsed);
}

/// Ro'yxatdagi bitta taklif kartasi — sarlavha + holat chipi, matn,
/// kategoriya, sana va ovoz berish tugmasi (`votes` soni bilan).
class SuggestionCard extends StatelessWidget {
  const SuggestionCard({
    required this.suggestion,
    required this.onVote,
    super.key,
    this.voting = false,
  });

  final Suggestion suggestion;
  final VoidCallback onVote;

  /// `true` bo'lsa shu taklif uchun ovoz berish so'rovi hozir bajarilmoqda
  /// — tugma o'rniga kichik yuklanish ko'rsatkichi chiziladi.
  final bool voting;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  suggestion.title,
                  style: AppTextStyles.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              SuggestionStatusChip(status: suggestion.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            suggestion.body,
            style: AppTextStyles.body.copyWith(color: inkSoft),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // `AppChip`ning o'z ichki matni o'ralmaydi (Wrap ichida
              // ishlatilishi mumkinligi uchun ataylab) — shu tufayli
              // chaqiruv joyida `Flexible` bilan o'ralishi SHART (qarang:
              // `app_chip.dart` hujjati), aks holda uzun kategoriya nomi
              // qatorni yorib chiqishi mumkin edi.
              Flexible(child: AppChip(label: suggestion.category)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(AppIcons.calendar, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  formatSuggestionDate(suggestion.createdAt),
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              _VoteButton(
                votes: suggestion.votes,
                voting: voting,
                onTap: onVote,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VoteButton extends StatelessWidget {
  const _VoteButton({
    required this.votes,
    required this.voting,
    required this.onTap,
  });

  final int votes;
  final bool voting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: voting ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: voting
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    AppIcons.like,
                    size: 15,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$votes',
                    style: AppTextStyles.label.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
