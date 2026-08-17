import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';

/// [DocumentType]ni belgi (chip emas — tint fon bilan) sifatida
/// ko'rsatadi. `DocumentStatusChip`dan farqli — bu yerda `filled: false`
/// ishlatiladi, chunki bitta kartada ikkala chip (tur + holat) birga
/// chiqadi va status har doim ustuvor (to'liq to'ldirilgan) bo'lishi
/// kerak.
class DocumentTypeChip extends StatelessWidget {
  const DocumentTypeChip({required this.type, super.key});

  final DocumentType type;

  @override
  Widget build(BuildContext context) {
    return AppChip(label: type.label);
  }
}
