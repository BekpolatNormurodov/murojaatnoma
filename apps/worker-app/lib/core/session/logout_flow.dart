import 'dart:async';

// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:worker_app/core/session/session_service.dart';

/// Tasdiqlangan chiqish: server/FCM tozalash internetga bog'liq (sekin
/// tarmoqda ~10 s va undan ko'p) — shu payt yopib bo'lmaydigan progress
/// ko'rsatiladi, ekran "qotib qolgandek" ko'rinmaydi va ostidagi tugmalar
/// qayta bosilmaydi. Tugagach ochiq popup'lar yopiladi; login sahifasiga
/// `AuthNavigationHost` o'tkazadi.
Future<void> logoutWithProgress(BuildContext context) async {
  final rootNav = Navigator.of(context, rootNavigator: true);
  unawaited(
    showDialog<void>(
      context: rootNav.context,
      barrierDismissible: false,
      builder: (_) => const PopScope(
        canPop: false,
        child: Center(child: CircularProgressIndicator()),
      ),
    ),
  );
  await SessionService().logout();
  if (rootNav.mounted) rootNav.popUntil((route) => route is! PopupRoute);
}
