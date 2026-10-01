import 'dart:math' as math;

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/dashboard/my_dashboard.dart';

const _monthsUz = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

Color _muted(BuildContext c) => Theme.of(c).brightness == Brightness.dark
    ? AppColors.darkInkMuted
    : AppColors.inkMuted;

Color _line(BuildContext c) => Theme.of(c).brightness == Brightness.dark
    ? AppColors.darkLine
    : AppColors.line;

/// "Mening ko'rsatkichlarim" — shu oy: o'z vaqtida %, davomat %, soat,
/// o'rtacha kelish vaqti, seriya, reyting va 30 kunlik davomat taqvimi.
class PerformanceCard extends StatelessWidget {
  const PerformanceCard({required this.data, super.key});

  final AttendanceKpi data;

  @override
  Widget build(BuildContext context) {
    final muted = _muted(context);
    final month = _monthsUz[DateTime.now().month - 1];
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "Mening ko'rsatkichlarim",
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              Text(month, style: AppTextStyles.caption.copyWith(color: muted)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _Ring(
                  value: data.onTimeRate,
                  label: "O'z vaqtida",
                  color: AppColors.success,
                ),
              ),
              Expanded(
                child: _Ring(
                  value: data.attendanceRate,
                  label: 'Davomat',
                  color: AppColors.primary,
                ),
              ),
              Expanded(
                child: _Ring(
                  value: data.rank == null || data.rankOf == 0
                      ? null
                      : (100 * (data.rankOf - data.rank! + 1) / data.rankOf)
                            .round(),
                  label: data.rank == null
                      ? 'Reyting'
                      : '#${data.rank} / ${data.rankOf}',
                  color: AppColors.warning,
                  centerText: data.rank == null ? '—' : '#${data.rank}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _MiniKpi(
                value: data.totalHours.toStringAsFixed(
                  data.totalHours % 1 == 0 ? 0 : 1,
                ),
                label: 'soat ishladi',
              ),
              _MiniKpi(value: data.avgCheckIn ?? '—', label: "o'rtacha kelish"),
              _MiniKpi(
                value: '${data.onTimeStreak}',
                label: 'kun seriya',
                accent: data.onTimeStreak >= 5 ? AppColors.success : null,
              ),
              _MiniKpi(
                value: '${data.daysLate}',
                label: 'kechikish',
                accent: data.daysLate > 0 ? AppColors.warning : null,
              ),
            ],
          ),
          if (data.last30.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              "So'nggi 30 kun",
              style: AppTextStyles.caption.copyWith(color: muted),
            ),
            const SizedBox(height: 8),
            _Calendar30(days: data.last30),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                _Legend(color: AppColors.success, label: "o'z vaqtida"),
                _Legend(color: AppColors.warning, label: 'kechikkan'),
                _Legend(
                  color: AppColors.danger.withValues(alpha: 0.35),
                  label: 'kelmagan',
                ),
                _Legend(color: _line(context), label: 'dam olish'),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({
    required this.value,
    required this.label,
    required this.color,
    this.centerText,
  });

  final int? value;
  final String label;
  final Color color;
  final String? centerText;

  @override
  Widget build(BuildContext context) {
    final v = (value ?? 0).clamp(0, 100) / 100;
    return Semantics(
      label: '$label: ${value == null ? "ma'lumot yo'q" : '$value%'}',
      child: Column(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: CustomPaint(
              painter: _RingPainter(
                progress: v,
                color: color,
                track: _line(context),
              ),
              child: Center(
                child: Text(
                  centerText ?? (value == null ? '—' : '$value%'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 15),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: _muted(context)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.color,
    required this.track,
  });

  final double progress;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 7.0;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawArc(r, 0, 2 * math.pi, false, base);
    if (progress <= 0) return;
    final fg = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(r, -math.pi / 2, 2 * math.pi * progress, false, fg);
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.color != color || old.track != track;
}

class _MiniKpi extends StatelessWidget {
  const _MiniKpi({required this.value, required this.label, this.accent});

  final String value;
  final String label;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: AppTextStyles.bodyStrong.copyWith(
              fontSize: 16,
              color: accent,
            ),
            maxLines: 1,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(
              color: _muted(context),
              fontSize: 11.5,
            ),
            maxLines: 2,
          ),
        ],
      ),
    );
  }
}

/// 30 kun — 3 qator × 10 katak (eski → yangi). Yakshanba "dam olish".
class _Calendar30 extends StatelessWidget {
  const _Calendar30({required this.days});

  final List<DayCell> days;

  @override
  Widget build(BuildContext context) {
    final line = _line(context);
    final today = DateTime.now();
    return LayoutBuilder(
      builder: (context, c) {
        const cols = 10;
        const gap = 5.0;
        final size = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final d in days)
              Tooltip(
                message:
                    '${d.date.day}.${d.date.month.toString().padLeft(2, '0')}'
                    '${d.present ? ' · ${d.hours.toStringAsFixed(1)} soat' : ''}',
                child: Container(
                  width: size,
                  height: math.min(size, 22),
                  decoration: BoxDecoration(
                    color: _colorFor(d, line, today),
                    borderRadius: BorderRadius.circular(5),
                    border: _isToday(d.date, today)
                        ? Border.all(color: AppColors.primaryDark, width: 1.5)
                        : null,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  static bool _isToday(DateTime d, DateTime t) =>
      d.year == t.year && d.month == t.month && d.day == t.day;

  static Color _colorFor(DayCell d, Color line, DateTime today) {
    if (d.present) return d.late ? AppColors.warning : AppColors.success;
    if (d.date.weekday == DateTime.sunday) return line;
    if (_isToday(d.date, today))
      return line; // bugun hali kelmagan bo'lishi mumkin
    return AppColors.danger.withValues(alpha: 0.35);
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: _muted(context),
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

/// "Murojaatlarim" — faol / muddati o'tgan / shu oy hal qilingan / fuqaro
/// bahosi. Bosilsa — murojaatlar ro'yxati.
class MurojaatKpiCard extends StatelessWidget {
  const MurojaatKpiCard({required this.data, required this.money, super.key});

  final MurojaatKpi data;
  final MoneyKpi money;

  String _som(int v) => v.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ' ',
  );

  @override
  Widget build(BuildContext context) {
    final muted = _muted(context);
    return AppCard(
      onTap: () => context.go('/requests'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Murojaatlarim', style: AppTextStyles.bodyStrong),
              ),
              if (data.newToday > 0) AppBadge(label: 'bugun +${data.newToday}'),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded, color: muted, size: 20),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _Tile(
                value: '${data.open}',
                label: 'faol',
                color: AppColors.info,
              ),
              _Tile(
                value: '${data.overdue}',
                label: "muddati o'tgan",
                color: data.overdue > 0 ? AppColors.danger : muted,
              ),
              _Tile(
                value: '${data.resolvedThisMonth}',
                label: 'shu oy hal qildi',
                color: AppColors.success,
              ),
              _Tile(
                value: data.avgRating == null
                    ? '—'
                    : '${data.avgRating!.toStringAsFixed(1)}★',
                label: data.ratedCount > 0
                    ? '${data.ratedCount} ta baho'
                    : 'baho',
                color: AppColors.warning,
              ),
            ],
          ),
          if (data.avgResolutionHours != null ||
              money.salaryNet != null ||
              money.premyaThisMonth > 0) ...[
            const SizedBox(height: 14),
            Divider(height: 1, color: _line(context)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 6,
              children: [
                if (data.avgResolutionHours != null)
                  _Fact(
                    icon: Icons.timer_outlined,
                    text:
                        "o'rtacha ${data.avgResolutionHours!.toStringAsFixed(0)} soatda hal qiladi",
                  ),
                if (money.salaryNet != null)
                  _Fact(
                    icon: Icons.account_balance_wallet_outlined,
                    text: "oylik ${_som(money.salaryNet!)} so'm",
                  ),
                if (money.premyaThisMonth > 0)
                  _Fact(
                    icon: Icons.card_giftcard_rounded,
                    text: "premya +${_som(money.premyaThisMonth)}",
                  ),
                _Fact(icon: Icons.stars_rounded, text: '${money.points} ball'),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.value, required this.label, required this.color});

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: AppTextStyles.h3.copyWith(color: color, fontSize: 20),
            maxLines: 1,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: AppTextStyles.caption.copyWith(
              color: _muted(context),
              fontSize: 11.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final muted = _muted(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: muted),
        const SizedBox(width: 4),
        Text(text, style: AppTextStyles.caption.copyWith(color: muted)),
      ],
    );
  }
}
