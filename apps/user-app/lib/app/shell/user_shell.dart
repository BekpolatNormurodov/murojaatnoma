import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Fuqaro ilovasining 4-tabli asosiy qobig'i (shell) —
/// `StatefulShellRoute.indexedStack` uchun.
///
/// Har bir tab o'zining mustaqil `Navigator`iga va holatiga ega
/// (`IndexedStack` orqali) — tablar orasida almashganda ekran hech qachon
/// noldan qurilmaydi. Tablar: Bosh sahifa / To'lovlar / Arizalar / Profil.
class UserShell extends StatelessWidget {
  const UserShell({required this.shell, super.key});

  /// GoRouter tomonidan ta'minlangan navigatsiya qobig'i — joriy faol tab
  /// indeksi va tab almashtirish (`goBranch`) shu orqali.
  final StatefulNavigationShell shell;

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
        icon: AppIcons.wallet,
        activeIcon: AppIcons.walletBold,
        label: l10n.paymentsTab,
      ),
      _TabItem(
        icon: AppIcons.requests,
        activeIcon: AppIcons.requestsBold,
        label: l10n.applicationsTab,
      ),
      _TabItem(
        icon: AppIcons.profile,
        activeIcon: AppIcons.profileBold,
        label: l10n.profile,
      ),
    ];

    return Scaffold(
      body: shell,
      bottomNavigationBar: _BottomNav(
        items: items,
        currentIndex: shell.currentIndex,
        onTap: (index) => shell.goBranch(
          index,
          // Allaqachon faol tabga qayta bosilganda uning ILK manziliga
          // qaytaradi — standart go_router shell-navigatsiya konvensiyasi.
          initialLocation: index == shell.currentIndex,
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

/// Tema-mos (light/dark) pastki navigatsiya paneli — silliq animatsion
/// faol-holat ko'rsatkichi bilan.
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
    final color = isActive
        ? AppColors.primary
        : (isDark ? AppColors.darkInkMuted : AppColors.inkMuted);

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        // `FittedBox` + `mainAxisSize: MainAxisSize.min` MAJBURIY: katta
        // tizim shrift o'lchamida (`textScaler`) yoki uzun tarjima
        // yorlig'ida (masalan ruscha "Обращения") ikon+yorliq bloki
        // sobit balandlikdagi (`SizedBox(height: 64)`) pastki navigatsiya
        // panelini "toshib ketishi" (RenderFlex overflow) mumkin edi —
        // `FittedBox` shu blokni kerak bo'lsagina 64px ichiga kichraytirib
        // sig'diradi.
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
