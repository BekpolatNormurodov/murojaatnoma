import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';

/// [SuggestionStatus]ni rangli chip sifatida ko'rsatadi — ro'yxat
/// kartalarida ishlatiladi (`StatusChip` — `requests` moduli — bilan bir
/// xil naqsh: [colorOf]/[labelOf] shu tufayli ochiq (public) static).
class SuggestionStatusChip extends StatelessWidget {
  const SuggestionStatusChip({required this.status, super.key});

  final SuggestionStatus status;

  /// `ApplicationStatus` bilan bir xil semantika: `yangi` — ko'k,
  /// `korilmoqda` — sariq (jarayonda), `qabulQilindi` — yashil (ijobiy
  /// yakun), `rad` — qizil (salbiy yakun).
  static Color colorOf(SuggestionStatus status) => switch (status) {
    SuggestionStatus.yangi => AppColors.info,
    SuggestionStatus.korilmoqda => AppColors.warning,
    SuggestionStatus.qabulQilindi => AppColors.success,
    SuggestionStatus.rad => AppColors.danger,
  };

  static String labelOf(BuildContext context, SuggestionStatus status) {
    final l10n = context.l10n;
    return switch (status) {
      SuggestionStatus.yangi => l10n.suggestionStatusYangi,
      SuggestionStatus.korilmoqda => l10n.suggestionStatusKorilmoqda,
      SuggestionStatus.qabulQilindi => l10n.suggestionStatusQabulQilindi,
      SuggestionStatus.rad => l10n.suggestionStatusRad,
    };
  }

  @override
  Widget build(BuildContext context) {
    return AppChip(
      label: labelOf(context, status),
      color: colorOf(status),
      filled: true,
    );
  }
}
