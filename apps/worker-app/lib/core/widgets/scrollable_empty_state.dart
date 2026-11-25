import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';

/// [EmptyState] — joy yetmasa (klaviatura ochiq, kichik ekran, katta shrift)
/// toshib ketish o'rniga skroll qilinadi; joy yetsa markazda turadi.
class ScrollableEmptyState extends StatelessWidget {
  const ScrollableEmptyState({
    required this.icon,
    required this.title,
    super.key,
    this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      // Bo'sh holatda ham "tortib yangilash" ishlasin.
      physics: const AlwaysScrollableScrollPhysics(),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: constraints.hasBoundedHeight ? constraints.maxHeight : 0,
        ),
        child: EmptyState(
          icon: icon,
          title: title,
          message: message,
          action: action,
        ),
      ),
    ),
  );
}
