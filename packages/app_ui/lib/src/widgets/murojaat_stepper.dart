import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

/// Holati: bajarilgan, hozir shu yerda, hali oldinda yoki rad etilgan.
enum AppStepState { done, active, pending, danger }

/// Stepperdagi bitta bosqich.
class AppStepItem {
  const AppStepItem(this.label, this.state, {this.time, this.detail});

  final String label;
  final AppStepState state;

  /// Qachon sodir bo'lgani (formatlangan); oldindagi bosqichda `null`.
  final String? time;

  /// Qisqa izoh: kim biriktirildi, muddat, rad sababi, baho …
  final String? detail;
}

/// Vertikal stepper — har bosqich: belgi + ulovchi chiziq, nom, vaqt va izoh.
/// Mobil ekranda 5 ta bosqich gorizontal sig'masdi (nomlar kesilardi),
/// vertikalda esa har biriga vaqt va izoh uchun joy bor.
class AppVerticalStepper extends StatelessWidget {
  const AppVerticalStepper({required this.steps, super.key});

  final List<AppStepItem> steps;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;

    Color tone(AppStepState s) => switch (s) {
      AppStepState.done || AppStepState.active => AppColors.primary,
      AppStepState.danger => AppColors.danger,
      AppStepState.pending => line,
    };

    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 28,
                  child: Column(
                    children: [
                      _Dot(
                        state: steps[i].state,
                        color: tone(steps[i].state),
                        surface: surface,
                      ),
                      if (i < steps.length - 1)
                        Expanded(
                          child: Container(
                            width: 2,
                            margin: const EdgeInsets.symmetric(vertical: 3),
                            decoration: BoxDecoration(
                              color: steps[i + 1].state == AppStepState.pending
                                  ? line
                                  : tone(steps[i + 1].state),
                              borderRadius: BorderRadius.circular(1),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      top: 3,
                      bottom: i < steps.length - 1 ? 16 : 0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                steps[i].label,
                                style: AppTextStyles.bodyStrong.copyWith(
                                  fontSize: 14,
                                  height: 1.25,
                                  color: switch (steps[i].state) {
                                    AppStepState.pending => inkMuted,
                                    AppStepState.danger => AppColors.danger,
                                    _ => ink,
                                  },
                                  fontWeight:
                                      steps[i].state == AppStepState.active
                                      ? FontWeight.w700
                                      : FontWeight.w600,
                                ),
                              ),
                            ),
                            if (steps[i].time != null) ...[
                              const SizedBox(width: 8),
                              Text(
                                steps[i].time!,
                                style: AppTextStyles.caption.copyWith(
                                  fontSize: 12,
                                  color: inkMuted,
                                ),
                              ),
                            ],
                          ],
                        ),
                        if ((steps[i].detail ?? '').isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            steps[i].detail!,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(
                              fontSize: 12.5,
                              height: 1.35,
                              color: steps[i].state == AppStepState.danger
                                  ? AppColors.danger
                                  : inkSoft,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.state, required this.color, required this.surface});

  final AppStepState state;
  final Color color;
  final Color surface;

  @override
  Widget build(BuildContext context) {
    final filled = state == AppStepState.done || state == AppStepState.danger;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? color : surface,
        border: Border.all(color: color, width: 2),
        boxShadow: state == AppStepState.active
            ? [BoxShadow(color: color.withValues(alpha: 0.22), spreadRadius: 4)]
            : null,
      ),
      alignment: Alignment.center,
      child: switch (state) {
        AppStepState.done => const Icon(
          Icons.check_rounded,
          size: 15,
          color: Colors.white,
        ),
        AppStepState.danger => const Icon(
          Icons.close_rounded,
          size: 15,
          color: Colors.white,
        ),
        AppStepState.active => Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
        AppStepState.pending => null,
      },
    );
  }
}

/* ───────────────────────── Murojaat hayot sikli ───────────────────────── */

/// Murojaat tarixidagi bitta hodisa (backend `ApplicationEvent`):
/// `type` = CREATED | ASSIGNED | STATUS_CHANGED | RATED | REOPENED …
typedef MurojaatEvent = ({
  String type,
  String? toStatus,
  String at,
  String? note,
  String? who,
});

/// Fuqaro ilovasi, xodim ilovasi va web-admin — uchalasida BIR XIL bosqichlar:
/// Qabul qilindi → Biriktirildi → Jarayonda → Hal qilindi → Baholandi
/// (rad etilsa: Qabul qilindi → (Biriktirildi) → Rad etildi).
///
/// [status] — backend qiymati: NEW | IN_PROGRESS | RESOLVED | REJECTED.
/// [forCitizen] — izohlarni fuqaroga ("Baholang") yoki xodimga ("Fuqaro
/// bahosi kutilmoqda") qarab yozadi.
List<AppStepItem> murojaatSteps({
  required bool ru,
  required String status,
  required String createdAt,
  required List<MurojaatEvent> events,
  bool forCitizen = false,
  bool assigned = false,
  String? assigneeName,
  String? resolvedAt,
  String? dueAt,
  int? rating,
  int reopenCount = 0,
}) {
  String t(String uz, String r) => ru ? r : uz;
  MurojaatEvent? first(bool Function(MurojaatEvent) p) {
    for (final e in events) {
      if (p(e)) return e;
    }
    return null;
  }

  MurojaatEvent? last(bool Function(MurojaatEvent) p) {
    for (final e in events.reversed) {
      if (p(e)) return e;
    }
    return null;
  }

  bool to(MurojaatEvent e, String s) => (e.toStatus ?? '').toUpperCase() == s;

  final assignEvent = last((e) => e.type == 'ASSIGNED');
  final isAssigned =
      assigned || assignEvent != null || (assigneeName ?? '').isNotEmpty;
  final who = assigneeName ?? assignEvent?.who;
  final rejected = status == 'REJECTED';
  final resolved = status == 'RESOLVED';
  final working = status == 'IN_PROGRESS' || resolved;
  final rated = rating != null;

  final steps = <AppStepItem>[
    AppStepItem(
      t('Qabul qilindi', 'Принято'),
      AppStepState.done,
      time: murojaatStamp(createdAt),
      detail: forCitizen
          ? t("Murojaatingiz ro'yxatga olindi", 'Обращение зарегистрировано')
          : null,
    ),
  ];

  // Biriktirmasdan to'g'ridan-to'g'ri yopilgan bo'lsa bu bosqich bo'lmagan.
  if (isAssigned || !(rejected || resolved)) {
    steps.add(
      AppStepItem(
        t('Biriktirildi', 'Назначено'),
        isAssigned ? AppStepState.done : AppStepState.active,
        time: murojaatStamp(assignEvent?.at),
        detail: isAssigned
            ? (who == null ? null : t("Mas'ul: $who", 'Ответственный: $who'))
            : t("Mas'ul xodim tayinlanmoqda", 'Назначается ответственный'),
      ),
    );
  }

  if (rejected) {
    final r = last((e) => to(e, 'REJECTED'));
    steps.add(
      AppStepItem(
        t('Rad etildi', 'Отклонено'),
        AppStepState.danger,
        time: murojaatStamp(r?.at),
        detail: (r?.note ?? '').trim().isEmpty ? null : r!.note!.trim(),
      ),
    );
    return steps;
  }

  final workAt = first((e) => to(e, 'IN_PROGRESS'));
  final reopened = last((e) => e.type == 'REOPENED');
  steps.add(
    AppStepItem(
      t('Jarayonda', 'В работе'),
      resolved
          ? AppStepState.done
          : working || isAssigned
          ? AppStepState.active
          : AppStepState.pending,
      time: working ? murojaatStamp(workAt?.at) : null,
      detail: reopenCount > 0 && !resolved
          ? t(
              'Qayta ochildi${reopenCount > 1 ? ' ($reopenCount-marta)' : ''}'
                  '${reopened?.note == null ? '' : ': ${reopened!.note}'}',
              'Открыто повторно${reopenCount > 1 ? ' ($reopenCount)' : ''}'
                  '${reopened?.note == null ? '' : ': ${reopened!.note}'}',
            )
          : working && !resolved
          ? t("Ko'rib chiqilmoqda", 'Рассматривается')
          : null,
    ),
  );

  final due = murojaatStamp(dueAt);
  steps.add(
    AppStepItem(
      t('Hal qilindi', 'Решено'),
      resolved ? AppStepState.done : AppStepState.pending,
      time: resolved
          ? murojaatStamp(resolvedAt ?? last((e) => to(e, 'RESOLVED'))?.at)
          : null,
      detail: !resolved && due != null ? t('Muddat: $due', 'Срок: $due') : null,
    ),
  );

  final rateEvent = last((e) => e.type == 'RATED');
  steps.add(
    AppStepItem(
      t('Baholandi', 'Оценено'),
      rated
          ? AppStepState.done
          : resolved
          ? AppStepState.active
          : AppStepState.pending,
      time: rated ? murojaatStamp(rateEvent?.at) : null,
      detail: rating != null
          ? _stars(rating)
          : resolved
          ? (forCitizen
                ? t('Natijani baholang', 'Оцените результат')
                : t('Fuqaro bahosi kutilmoqda', 'Ожидается оценка'))
          : null,
    ),
  );
  return steps;
}

/// ISO → "02.10, 14:05" (mahalliy vaqt); bo'sh/yaroqsiz bo'lsa `null`.
String? murojaatStamp(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return null;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}, ${two(d.hour)}:${two(d.minute)}';
}

String _stars(int rating) {
  final n = rating < 0 ? 0 : (rating > 5 ? 5 : rating);
  return '${'★' * n}${'☆' * (5 - n)}  $n/5';
}
