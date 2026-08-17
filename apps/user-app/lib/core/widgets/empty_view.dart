import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';

/// Bo'sh holat ko'rinishi — ro'yxat/qidiruv natijasi bo'sh bo'lganda.
///
/// `app_ui`ning [EmptyState] ustida qurilgan yupqa qatlam: shu paket
/// polish agentlari uchun barqaror, oddiy `{icon, title, message}`
/// signaturasini beradi, animatsiya/uslub esa markazlashgan
/// design-system komponentida qoladi.
class EmptyView extends StatelessWidget {
  const EmptyView({
    required this.icon,
    required this.title,
    super.key,
    this.message,
  });

  final IconData icon;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return EmptyState(icon: icon, title: title, message: message);
  }
}
