import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/core/widgets/confirm_dialog.dart';
import 'package:user_app/injection.dart';

/// Onboarding ekranlaridagi "Chiqish": tasdiq so'raydi, so'ng to'liq chiqadi.
Future<void> confirmLogout(BuildContext context) async {
  final l10n = context.l10n;
  final confirmed = await showConfirmDialog(
    context: context,
    icon: AppIcons.logout,
    title: l10n.logoutConfirmTitle,
    message: l10n.logoutConfirmMessage,
    confirmLabel: l10n.logoutConfirmCta,
    cancelLabel: l10n.cancel,
    danger: true,
  );
  if (!confirmed || !context.mounted) return;
  await getIt<LogoutService>().logout(router: GoRouter.of(context));
}
