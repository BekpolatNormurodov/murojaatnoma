import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';

/// [DocumentStatus]ni rangli chip sifatida ko'rsatadi — ro'yxat kartalari,
/// filtr varag'i va tafsilot sahifasida bir xil rang/yorliq sxemasi
/// bilan ishlatiladi (`StatusChip`/`MeetingStatusChip` bilan bir xil
/// naqsh: [colorOf] shu tufayli ochiq (public) static — yorliq esa
/// [DocumentStatusLabel] kengaytmasidan olinadi).
class DocumentStatusChip extends StatelessWidget {
  const DocumentStatusChip({required this.status, super.key});

  final DocumentStatus status;

  /// Har bir holat uchun rang: `draft` — xira kulrang (hali ishlanmoqda),
  /// `review` — sariq/ogohlantirish (kutish talab qiladi), `signed` —
  /// asosiy yashil (yakunlangan/rasmiy), `archived` — ko'k-kulrang
  /// (endi faol emas).
  static Color colorOf(DocumentStatus status) => switch (status) {
    DocumentStatus.draft => AppColors.inkMuted,
    DocumentStatus.review => AppColors.warning,
    DocumentStatus.signed => AppColors.success,
    DocumentStatus.archived => AppColors.info,
  };

  @override
  Widget build(BuildContext context) {
    return AppChip(label: status.label, color: colorOf(status), filled: true);
  }
}
