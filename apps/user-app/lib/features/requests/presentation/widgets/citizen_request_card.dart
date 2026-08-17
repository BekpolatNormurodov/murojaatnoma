import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/widgets/request_kind_meta.dart';
import 'package:user_app/features/requests/presentation/widgets/request_status_chip.dart';

/// `CitizenRequest.createdAt` kabi ISO sana satrlarini (`formatDate`
/// yordamida) inson o'qiy oladigan ko'rinishga o'giradi; parslab
/// bo'lmasa xom satrni qaytaradi (mock ma'lumotlar doim to'g'ri formatda,
/// lekin himoya sifatida).
String formatIsoDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? iso : formatDate(parsed);
}

/// [formatIsoDate] bilan bir xil, lekin soat:daqiqani ham qo'shadi —
/// javob berilgan payt kabi to'liq vaqt muhim bo'lgan joylarda.
String formatIsoDateTime(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final hh = parsed.hour.toString().padLeft(2, '0');
  final mm = parsed.minute.toString().padLeft(2, '0');
  return '${formatDate(parsed)}, $hh:$mm';
}

/// Ro'yxatdagi bitta murojaat (ariza/shikoyat) kartasi — turi, sarlavha,
/// kategoriya, holat chipi ([RequestStatusChip]) va sana.
class CitizenRequestCard extends StatelessWidget {
  const CitizenRequestCard({required this.request, super.key, this.onTap});

  final CitizenRequest request;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final kindColor = RequestKindMeta.color(request.kind);

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: kindColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  RequestKindMeta.icon(request.kind),
                  size: 19,
                  color: kindColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.title,
                      style: AppTextStyles.bodyStrong,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      request.category,
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // `Flexible` MAJBURIY: chip `Expanded(title)`dan keyingi
              // kengligi cheklanmagan birodar (sibling) bo'lsa, uzun
              // holat yorlig'i sarlavhani siqib qo'yishi mumkin edi —
              // `loose` moslashuv sarlavhaga ustuvorlik beradi.
              Flexible(
                child: RequestStatusChip(status: request.status),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              AppBadge(
                label: RequestKindMeta.label(l10n, request.kind),
                variant: request.kind == RequestKind.ariza
                    ? AppBadgeVariant.info
                    : AppBadgeVariant.warning,
              ),
              const Spacer(),
              Icon(AppIcons.calendar, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Text(
                formatIsoDate(request.createdAt),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
