import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/widgets.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// [RequestKind] uchun ikon/rang/nom — ro'yxat, tafsilot va yuborish
/// sahifalarida bir xil vizual tilni ta'minlash uchun markazlashtirilgan
/// (`UtilityTypeMeta` bilan bir xil naqsh).
abstract class RequestKindMeta {
  static IconData icon(RequestKind kind) => switch (kind) {
    RequestKind.ariza => AppIcons.documentUpload,
    RequestKind.shikoyat => IconsaxPlusLinear.warning_2,
  };

  static Color color(RequestKind kind) => switch (kind) {
    RequestKind.ariza => AppColors.accent,
    RequestKind.shikoyat => AppColors.warning,
  };

  static String label(AppLocalizations l10n, RequestKind kind) =>
      switch (kind) {
        RequestKind.ariza => l10n.requestKindAriza,
        RequestKind.shikoyat => l10n.requestKindShikoyat,
      };
}
