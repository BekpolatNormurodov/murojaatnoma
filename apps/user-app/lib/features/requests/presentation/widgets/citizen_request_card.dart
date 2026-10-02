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

    final stage = _stage(request);
    final rejected = request.status == RequestStatus.yopildi;
    final assignee = request.assigneeName;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: kindColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  RequestKindMeta.icon(request.kind),
                  size: 20,
                  color: kindColor,
                ),
              ),
              const SizedBox(width: 12),
              // Sarlavha butun kenglikda (holat chipi pastga ko'chdi) —
              // avval chip sarlavhani "Oilaviy holat haqida ma'lum…" qilib
              // kesardi.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.title,
                      style: AppTextStyles.bodyStrong.copyWith(height: 1.3),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      assignee == null
                          ? request.category
                          : '${request.category} · ${_t(context, "Mas'ul", 'Отв.')}: $assignee',
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Murojaat yo'li — 5 bosqich (rad etilsa qizil).
          Row(
            children: [
              for (var i = 0; i < 5; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: i < stage
                          ? (rejected ? AppColors.danger : AppColors.primary)
                          : (isDark ? AppColors.darkLine : AppColors.line),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              // Tor ekran / katta shriftda chip keyingi qatorga o'tadi —
              // hech qachon siqilib, chetdan chiqmaydi.
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    AppBadge(
                      label: RequestKindMeta.label(l10n, request.kind),
                      variant: request.kind == RequestKind.ariza
                          ? AppBadgeVariant.info
                          : AppBadgeVariant.warning,
                    ),
                    RequestStatusChip(status: request.status),
                  ],
                ),
              ),
              const SizedBox(width: 8),
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


/// Stepper bilan bir xil bosqichlar: 1 qabul · 2 biriktirildi · 3 jarayonda ·
/// 4 hal qilindi · 5 baholandi (rad etilsa — o'sha joygacha qizil).
int _stage(CitizenRequest r) {
  final assigned = r.assigneeName != null;
  return switch (r.status) {
    RequestStatus.yuborilgan => assigned ? 2 : 1,
    RequestStatus.korilmoqda => 3,
    RequestStatus.javobBerildi => r.rating != null ? 5 : 4,
    RequestStatus.yopildi => assigned ? 3 : 2,
  };
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;
