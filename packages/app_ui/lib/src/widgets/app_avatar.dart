import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

/// Foydalanuvchi avatari.
///
/// Uch bosqichli ustunlik: [image] (mahalliy/xotiradagi manba — masalan
/// ro'yxatdan o'tkazishda saqlangan yuz-rasm uchun `FileImage(File(path))`)
/// berilgan bo'lsa ENG AVVAL shu ko'rsatiladi; aks holda [photoUrl]
/// (tarmoq rasmi) sinab ko'riladi; ikkalasi ham yo'q (yoki yuklanmadi/
/// buzuq) bo'lsa ismning bosh harflari (initials) gradient fonda
/// chiziladi — web-admin'ning `Avatar.tsx` bilan bir xil qoida. Ikkala
/// rasm yo'li ham `errorBuilder` orqali initsiallarga qaytadi — noto'g'ri/
/// o'chirilgan fayl yoki tarmoq xatosi HECH QACHON qulatmaydi.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    required this.name,
    super.key,
    this.image,
    this.photoUrl,
    this.color,
    this.size = 44,
  });

  /// To'liq ism — initials va rasm muqobil matni (semantics) uchun.
  final String name;

  /// Mahalliy/xotiradagi rasm manbai (ixtiyoriy) — masalan `FileImage`
  /// (skanerlangan yuz-rasm) yoki `MemoryImage`. Berilgan bo'lsa
  /// [photoUrl]dan USTUN turadi.
  final ImageProvider? image;

  /// Tarmoqdagi profil rasmi manzili (ixtiyoriy, faqat [image] `null`
  /// bo'lganda ishlatiladi).
  final String? photoUrl;

  /// Initials foni/gradienti (standart: `AppColors.primary`).
  final Color? color;

  /// Avatar diametri.
  final double size;

  String get _initials {
    return name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0])
        .join()
        .toUpperCase();
  }

  Widget _initialsAvatar() => _InitialsAvatar(
    initials: _initials,
    color: color ?? AppColors.primary,
    size: size,
  );

  @override
  Widget build(BuildContext context) {
    final localImage = image;
    if (localImage != null) {
      return ClipOval(
        child: Image(
          // `Image()`ning xom konstruktori (named `Image.file`/`.network`dan
          // farqli) `cacheWidth` OLMAYDI — xuddi shu dekod-vaqtidagi
          // kichraytirish samarasini `ResizeImage` bilan qo'lda o'raymiz
          // (katta original rasmni to'liq o'lchamda dekodlash/keshlashning
          // oldini olish uchun).
          image: ResizeImage(localImage, width: (size * 3).round()),
          width: size,
          height: size,
          fit: BoxFit.cover,
          gaplessPlayback: true,
          semanticLabel: name,
          errorBuilder: (context, error, stackTrace) => _initialsAvatar(),
        ),
      );
    }

    final hasPhoto = photoUrl != null && photoUrl!.isNotEmpty;
    if (!hasPhoto) {
      return _initialsAvatar();
    }

    return ClipOval(
      child: Image.network(
        photoUrl!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        semanticLabel: name,
        errorBuilder: (context, error, stackTrace) => _initialsAvatar(),
      ),
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({
    required this.initials,
    required this.color,
    required this.size,
  });

  final String initials;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, color.withValues(alpha: 0.8)],
        ),
      ),
      child: Text(
        initials,
        style: AppTextStyles.bodyStrong.copyWith(
          color: Colors.white,
          fontSize: size * 0.38,
        ),
      ),
    );
  }
}
