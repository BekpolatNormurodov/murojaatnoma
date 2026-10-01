import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// 5-tabli asosiy qobiq (shell) — `StatefulShellRoute.indexedStack` uchun.
///
/// Har bir tab o'zining mustaqil `Navigator`iga va holatiga ega
/// (`IndexedStack` orqali) — tablar orasida almashganda ekran hech qachon
/// noldan qurilmaydi (scroll pozitsiyasi, `AttendanceCubit`ning yuklangan
/// ma'lumoti va h.k. saqlanadi).
///
/// Qobiq o'rnatilishi bilan (ya'ni xodim tizimga kirgach) joylashuv kuzatuvi
/// boshlanadi — qaysi tab ochiqligidan qat'i nazar. Ilgari kuzatuv FAQAT
/// "Xarita" tabi ochilganda boshlanardi, shu bois Xaritaga hech kirmagan
/// xodimning lokatsiyasi serverga umuman yuborilmasdi (admin xaritasida
/// "Lokatsiya yo'q" bo'lib qolardi).
class MainShell extends StatefulWidget {
  const MainShell({required this.shell, super.key});

  /// GoRouter tomonidan ta'minlangan navigatsiya qobig'i — joriy faol tab
  /// indeksi va tab almashtirish (`goBranch`) shu orqali.
  final StatefulNavigationShell shell;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  @override
  void initState() {
    super.initState();
    // Tizimga kirish bilanoq joylashuv kuzatuvini boshlaymiz. Idempotent —
    // allaqachon ishlayotgan bo'lsa hech nima qilmaydi. Ruxsat berilmagan
    // bo'lsa "Xarita" tabidagi ruxsat ekrani uni qayta so'raydi.
    unawaited(getIt<LocationTrackingService>().start());
  }

  @override
  void dispose() {
    // Tizimdan chiqilganda (qobiq yo'q qilinganda) kuzatuvni to'xtatamiz —
    // chiqib ketgan qurilma lokatsiya yubormasligi kerak.
    unawaited(getIt<LocationTrackingService>().stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final items = <_TabItem>[
      _TabItem(
        icon: AppIcons.home,
        activeIcon: AppIcons.homeBold,
        label: l10n.home,
      ),
      _TabItem(
        icon: AppIcons.requests,
        activeIcon: AppIcons.requestsBold,
        label: l10n.requests,
      ),
      _TabItem(
        icon: AppIcons.chat,
        activeIcon: AppIcons.chatBold,
        label: l10n.chat,
      ),
      _TabItem(
        icon: AppIcons.map,
        activeIcon: AppIcons.mapBold,
        label: l10n.map,
      ),
      _TabItem(
        icon: AppIcons.profile,
        activeIcon: AppIcons.profileBold,
        label: l10n.profile,
      ),
    ];

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: _BottomNav(
        items: items,
        currentIndex: widget.shell.currentIndex,
        onTap: (index) => widget.shell.goBranch(
          index,
          // Allaqachon faol tabga qayta bosilganda uning ILK manziliga
          // qaytaradi (masalan chuqur navigatsiyadan tab ildiziga) — bu
          // standart go_router shell-navigatsiya konvensiyasi.
          initialLocation: index == widget.shell.currentIndex,
        ),
      ),
    );
  }
}

class _TabItem {
  const _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// Tema-mos (light/dark) pastki navigatsiya paneli — silliq (150-250ms)
/// animatsion faol-holat ko'rsatkichi bilan.
class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.items,
    required this.currentIndex,
    required this.onTap,
  });

  final List<_TabItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        border: Border(top: BorderSide(color: line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                _TabButton(
                  item: items[i],
                  isActive: i == currentIndex,
                  onTap: () => onTap(i),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.item,
    required this.isActive,
    required this.onTap,
  });

  final _TabItem item;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final color = isActive ? AppColors.primary : mutedColor;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        // `FittedBox` + `mainAxisSize: MainAxisSize.min` MAJBURIY: katta
        // tizim shrift o'lchamida (`textScaler`) `maxLines`/`overflow`
        // bo'lsa ham bitta qator matnning balandligi o'sib, sobit
        // balandlikdagi (`SizedBox(height: 64)`) pastki navigatsiya
        // panelini "toshib ketishi" (RenderFlex overflow) mumkin edi —
        // `FittedBox` butun ikon+yorliq blokini shrift o'lchamidan qat'i
        // nazar 64px ichiga sig'dirib, kerak bo'lsagina kichraytiradi.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: isActive
                      ? AppColors.primary.withValues(alpha: 0.12)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  transitionBuilder: (child, animation) =>
                      ScaleTransition(scale: animation, child: child),
                  child: Icon(
                    isActive ? item.activeIcon : item.icon,
                    key: ValueKey(isActive),
                    color: color,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOutCubic,
                style: AppTextStyles.caption.copyWith(
                  color: color,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                ),
                // `maxLines`/`overflow` MAJBURIY: tarjima qilingan yorliq
                // (masalan ruscha "Обращения") tor tab-ustunida ikki
                // qatorga o'ralib ketmasligi uchun.
                child: Text(
                  item.label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
