import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/widgets.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// [UtilityType] uchun ikon/rang/nom — barcha to'lov ekranlarida (bosh
/// sahifa, kommunalka ro'yxati, to'lov, tarix) bir xil vizual tilni
/// ta'minlash uchun markazlashtirilgan.
abstract class UtilityTypeMeta {
  static IconData icon(UtilityType type) => switch (type) {
    UtilityType.elektr => AppIcons.electricity,
    UtilityType.gaz => AppIcons.gas,
    UtilityType.suv => AppIcons.water,
    UtilityType.issiqlik => AppIcons.heating,
    UtilityType.chiqindi => AppIcons.trash,
  };

  static Color color(UtilityType type) => switch (type) {
    UtilityType.elektr => AppColors.warning,
    UtilityType.gaz => AppColors.accentDark,
    UtilityType.suv => AppColors.accent,
    UtilityType.issiqlik => AppColors.danger,
    UtilityType.chiqindi => AppColors.primaryDark,
  };

  /// To'liq nom (masalan ro'yxat/karta sarlavhasi uchun).
  static String label(AppLocalizations l10n, UtilityType type) =>
      switch (type) {
        UtilityType.elektr => l10n.utilityTypeElektr,
        UtilityType.gaz => l10n.utilityTypeGaz,
        UtilityType.suv => l10n.utilityTypeSuv,
        UtilityType.issiqlik => l10n.utilityTypeIssiqlik,
        UtilityType.chiqindi => l10n.utilityTypeChiqindi,
      };

  /// Qisqa nom — segmentlangan filtr kabi tor joylar uchun.
  static String shortLabel(AppLocalizations l10n, UtilityType type) =>
      switch (type) {
        UtilityType.elektr => l10n.filterTypeElektr,
        UtilityType.gaz => l10n.filterTypeGaz,
        UtilityType.suv => l10n.filterTypeSuv,
        UtilityType.issiqlik => l10n.filterTypeIssiqlik,
        UtilityType.chiqindi => l10n.filterTypeChiqindi,
      };
}
