import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';

/// `PointsEntry.at` kabi ISO sana satrini inson o'qiy oladigan ko'rinishga
/// o'giradi; parslab bo'lmasa xom satrni qaytaradi (`ApplicationCard.
/// formatIsoDate` — `requests` moduli — bilan bir xil naqsh).
String formatPointsDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? iso : formatDate(parsed);
}

/// Ball tarixidagi bitta yozuv qatori — sabab + sana (chapda), rangli
/// ikon va delta (o'ng, +yashil/−qizil).
class PointsEntryTile extends StatelessWidget {
  const PointsEntryTile({required this.entry, super.key});

  final PointsEntry entry;

  @override
  Widget build(BuildContext context) {
    final color = entry.positive ? AppColors.success : AppColors.danger;
    // Manfiy yozuvlarning `delta`si allaqachon manfiy son (masalan -5) —
    // qo'shimcha minus belgisi qo'yilmaydi, faqat ijobiylarga "+" qo'shiladi.
    final sign = entry.positive ? '+' : '';

    return AppListTile(
      title: entry.reason,
      titleMaxLines: 2,
      subtitle: formatPointsDate(entry.at),
      leadingIcon: entry.positive ? AppIcons.trendUp : AppIcons.trendDown,
      iconColor: color,
      showChevron: false,
      trailing: Text(
        '$sign${entry.delta}',
        style: AppTextStyles.bodyStrong.copyWith(color: color),
      ),
    );
  }
}
