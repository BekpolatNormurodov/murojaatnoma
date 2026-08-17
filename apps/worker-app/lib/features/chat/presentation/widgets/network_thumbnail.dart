import 'dart:io';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Rasm thumbnail'ini ko'rsatadi, lekin hech qachon Flutterning "qizil xato"
/// pleysholderini ko'rsatmaydi — yuklash muvaffaqiyatsiz bo'lsa (yoki [url]
/// `null`/bo'sh bo'lsa) silliq ikon-fon ko'rsatadi.
///
/// Manba turini AVTOMATIK aniqlaydi:
/// * `http`/`https` — REAL tarmoq rasmi (`Image.network`) yoki mavjud
///   bo'lmagan mock CDN manzili (xatoda pleysholder);
/// * `mock://...` — haqiqiy fayl yo'q (eski mock biriktirmalar) →
///   pleysholder;
/// * boshqasi — QURILMADAGI LOKAL FAYL yo'li (`Image.file`). Bu MUHIM:
///   kameradan/galereyadan tanlangan rasm yoki yozib olingan video kadri
///   lokal yo'l bilan keladi — ilgari bu yerda faqat `Image.network`
///   ishlatilgani uchun tanlangan rasm umuman ko'rinmasdan pleysholder
///   chiqib qolardi ("rasm ishlamayapti" muammosi).
///
/// `image_bubble.dart` va `round_video_bubble.dart` ikkalasi ham shu
/// widgetni ishlatadi (mos ravishda to'g'ri burchakli/doiraviy `Clip` bilan
/// o'raladi).
class NetworkThumbnail extends StatelessWidget {
  const NetworkThumbnail({
    super.key,
    this.url,
    this.icon = IconsaxPlusLinear.gallery,
    this.fit = BoxFit.cover,
  });

  final String? url;
  final IconData icon;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final source = url;
    if (source == null || source.isEmpty || source.startsWith('mock://')) {
      return _Placeholder(icon: icon);
    }

    if (source.startsWith('http://') || source.startsWith('https://')) {
      return Image.network(
        source,
        fit: fit,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return const _Placeholder(loading: true);
        },
        errorBuilder: (context, error, stackTrace) => _Placeholder(icon: icon),
      );
    }

    // Lokal fayl yo'li — kameradan/galereyadan tanlangan rasm.
    return Image.file(
      File(source),
      fit: fit,
      errorBuilder: (context, error, stackTrace) => _Placeholder(icon: icon),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({
    this.icon = IconsaxPlusLinear.gallery,
    this.loading = false,
  });

  final IconData icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      color: isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt,
      child: Center(
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              )
            : Icon(
                icon,
                color: isDark ? AppColors.darkInkMuted : AppColors.inkMuted,
                size: 28,
              ),
      ),
    );
  }
}
