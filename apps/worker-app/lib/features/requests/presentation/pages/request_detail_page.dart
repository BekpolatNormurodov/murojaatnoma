import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:worker_app/features/requests/presentation/widgets/application_card.dart';
import 'package:worker_app/features/requests/presentation/widgets/attachment_tile.dart';
import 'package:worker_app/features/requests/presentation/widgets/status_chip.dart';

/// "Murojaat tafsilotlari" — xodim uchun to'liq ish kartasi: jarayon
/// bosqichlari (vaqtlari bilan), SLA muddati, fuqaro + manzil (qo'ng'iroq,
/// xaritada ochish), tavsif va fayllar, fuqaro bilan yozishma (oraliq xabar
/// yozish), fuqaro bahosi va to'liq holatlar tarixi. Pastda — asosiy amal
/// ("Hal qilish" — yakuniy javob + isbot).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan
/// `RequestDetailCubit.load(id)` orqali allaqachon berilgan bo'ladi.
class RequestDetailPage extends StatelessWidget {
  const RequestDetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.requestDetailTitle, style: AppTextStyles.h3),
      ),
      body: BlocBuilder<RequestDetailCubit, RequestDetailState>(
        builder: (context, state) => switch (state) {
          RequestDetailLoading() => const SafeArea(
            child: _DetailSkeleton(key: Key('request_detail_skeleton')),
          ),
          RequestDetailError(:final message) => SafeArea(
            child: _DetailErrorView(message: message),
          ),
          RequestDetailLoaded(:final application, :final submitting) =>
            _DetailLoadedView(application: application, submitting: submitting),
        },
      ),
    );
  }
}

/// uz/ru matn — sahifaga xos yangi yorliqlar uchun (ARB'ga tegmasdan).
String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;

bool _isOpen(ApplicationStatus s) =>
    s == ApplicationStatus.yangi || s == ApplicationStatus.jarayonda;

class _DetailLoadedView extends StatelessWidget {
  const _DetailLoadedView({
    required this.application,
    required this.submitting,
  });

  final Application application;
  final bool submitting;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => context.read<RequestDetailCubit>().retry(),
            child: _DetailContent(
              application: application,
              submitting: submitting,
            ),
          ),
        ),
        if (_isOpen(application.status))
          _DetailBottomBar(application: application, submitting: submitting),
      ],
    );
  }
}

/// Pastki amal paneli: fuqaroga qo'ng'iroq + "Hal qilish" (yakuniy javob).
class _DetailBottomBar extends StatelessWidget {
  const _DetailBottomBar({required this.application, required this.submitting});

  final Application application;
  final bool submitting;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surface,
        border: Border(top: BorderSide(color: line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: Row(
            children: [
              Expanded(
                flex: 2,
                child: AppButton(
                  label: _t(context, "Qo'ng'iroq", 'Позвонить'),
                  variant: AppButtonVariant.secondary,
                  icon: AppIcons.call,
                  onPressed: () => _call(context, application.citizenPhone),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 3,
                child: AppButton(
                  label: _t(context, 'Hal qilish', 'Решить'),
                  icon: AppIcons.tick,
                  loading: submitting,
                  onPressed: submitting
                      ? null
                      : () => context.push(
                          '/requests/${application.id}/respond',
                          extra: context.read<RequestDetailCubit>(),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _call(BuildContext context, String phone) async {
  final digits = phone.replaceAll(RegExp('[^0-9+]'), '');
  var ok = false;
  if (digits.isNotEmpty) {
    try {
      ok = await launchUrl(Uri(scheme: 'tel', path: digits));
    } on Object {
      ok = false;
    }
  }
  if (!ok && context.mounted) {
    AppAlert.error(
      context,
      _t(context, "Qo'ng'iroq qilib bo'lmadi", 'Не удалось позвонить'),
    );
  }
}

/// Yandex Xaritalar ilovasida (bo'lmasa brauzerda) nuqtani ochadi.
Future<void> _openMap(BuildContext context, Application a) async {
  final Uri web;
  if (a.hasLocation) {
    final ll = '${a.longitude},${a.latitude}';
    final app = Uri.parse('yandexmaps://maps.yandex.ru/?pt=$ll&z=17&l=map');
    try {
      if (await launchUrl(app, mode: LaunchMode.externalApplication)) return;
    } on Object {
      // ilova yo'q — brauzerga tushamiz
    }
    web = Uri.parse('https://yandex.uz/maps/?pt=$ll&z=17&l=map');
  } else {
    web = Uri.https('yandex.uz', '/maps/', {
      'text': "${a.address}, Mirzo Ulug'bek, Toshkent",
    });
  }
  var ok = false;
  try {
    ok = await launchUrl(web, mode: LaunchMode.externalApplication);
  } on Object {
    ok = false;
  }
  if (!ok && context.mounted) {
    AppAlert.error(
      context,
      _t(context, "Xaritani ochib bo'lmadi", 'Не удалось открыть карту'),
    );
  }
}

Color _priorityColor(ApplicationPriority priority) => switch (priority) {
  ApplicationPriority.past => AppColors.inkMuted,
  ApplicationPriority.orta => AppColors.warning,
  ApplicationPriority.yuqori => AppColors.danger,
};

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.application, required this.submitting});

  final Application application;
  final bool submitting;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final a = application;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final showThread =
        a.messages.isNotEmpty || a.status != ApplicationStatus.rad;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        Text(a.title, style: AppTextStyles.h2),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            AppChip(
              label: ApplicationCard.priorityLabel(context, a.priority),
              color: _priorityColor(a.priority),
              filled: true,
            ),
            AppChip(label: a.category),
            if (a.isComplaint)
              AppChip(
                label: _t(context, 'Shikoyat', 'Жалоба'),
                color: AppColors.danger,
              ),
            StatusChip(status: a.status),
          ],
        ),
        const SizedBox(height: 20),
        AppCard(child: _StatusTimeline(application: a)),
        if (a.deadline != null && a.status != ApplicationStatus.rad) ...[
          const SizedBox(height: 12),
          _SlaCard(application: a),
        ],
        const SizedBox(height: 20),
        _SectionTitle(l10n.requestDescriptionTitle),
        const SizedBox(height: 8),
        AppCard(child: Text(a.description, style: AppTextStyles.body)),
        const SizedBox(height: 20),
        _SectionTitle(l10n.requestCitizenInfoTitle),
        const SizedBox(height: 8),
        _CitizenCard(application: a),
        if (a.attachments.isNotEmpty) ...[
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestAttachmentsTitle),
          const SizedBox(height: 8),
          for (final attachment in a.attachments) ...[
            AttachmentTile(attachment: attachment),
            const SizedBox(height: 8),
          ],
        ],
        if (a.rating != null) ...[
          const SizedBox(height: 20),
          _SectionTitle(_t(context, 'Fuqaro bahosi', 'Оценка гражданина')),
          const SizedBox(height: 8),
          _RatingCard(rating: a.rating!, comment: a.ratingComment),
        ],
        if (showThread) ...[
          const SizedBox(height: 20),
          _SectionTitle(_t(context, 'Yozishma', 'Переписка')),
          const SizedBox(height: 8),
          _ThreadCard(application: a, submitting: submitting),
        ] else if (a.response case final response?) ...[
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestResponseTitle),
          const SizedBox(height: 8),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(response.text, style: AppTextStyles.body),
                const SizedBox(height: 8),
                Text(
                  formatIsoDateTime(response.respondedAt),
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                ),
              ],
            ),
          ),
        ],
        if (a.history.isNotEmpty) ...[
          const SizedBox(height: 20),
          _SectionTitle(_t(context, 'Holatlar tarixi', 'История')),
          const SizedBox(height: 8),
          AppCard(child: _HistoryList(events: a.history)),
        ],
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      label,
      style: AppTextStyles.label.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
    );
  }
}

/* ───────────────────────── Jarayon bosqichlari ───────────────────────── */

/// Murojaat yo'li — fuqaro ilovasi va web bilan BIR XIL bosqichlar
/// (umumiy `murojaatSteps`): Qabul qilindi → Biriktirildi → Jarayonda →
/// Hal qilindi → Baholandi (rad etilsa … → Rad etildi), vaqt va izohi bilan.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.application});

  final Application application;

  @override
  Widget build(BuildContext context) {
    final a = application;
    return AppVerticalStepper(
      steps: murojaatSteps(
        ru: Localizations.localeOf(context).languageCode == 'ru',
        status: switch (a.status) {
          ApplicationStatus.yangi => 'NEW',
          ApplicationStatus.jarayonda => 'IN_PROGRESS',
          ApplicationStatus.javobBerildi ||
          ApplicationStatus.yopildi => 'RESOLVED',
          ApplicationStatus.rad => 'REJECTED',
        },
        createdAt: a.createdAt,
        events: [
          for (final e in a.history)
            (
              type: e.type,
              toStatus: e.toStatus,
              at: e.createdAt,
              note: e.note,
              who: e.toEmployeeName ?? e.actorName,
            ),
        ],
        assigned: a.assignedToMe,
        resolvedAt: a.resolvedAt,
        dueAt: a.deadline,
        rating: a.rating,
        reopenCount: a.reopenCount,
      ),
    );
  }
}

/* ───────────────────────── SLA ───────────────────────── */

/// Hal qilish muddati: qolgan / o'tib ketgan vaqt + jarayon chizig'i.
class _SlaCard extends StatelessWidget {
  const _SlaCard({required this.application});

  final Application application;

  @override
  Widget build(BuildContext context) {
    final a = application;
    final created = DateTime.tryParse(a.createdAt)?.toLocal();
    final due = DateTime.tryParse(a.deadline!)?.toLocal();
    if (created == null || due == null) return const SizedBox.shrink();
    final resolvedAt = a.resolvedAt == null
        ? null
        : DateTime.tryParse(a.resolvedAt!)?.toLocal();
    final open = _isOpen(a.status);
    final end = resolvedAt ?? DateTime.now();
    final left = due.difference(end);
    final total = due.difference(created).inMinutes.clamp(1, 1 << 30);
    final progress = (end.difference(created).inMinutes / total).clamp(
      0.0,
      1.0,
    );
    final overdue = left.isNegative;

    final Color color;
    final String headline;
    if (!open) {
      color = overdue ? AppColors.danger : AppColors.primary;
      headline = overdue
          ? _t(
              context,
              '${_span(context, left.abs())} kechikib hal qilindi',
              'Решено с опозданием ${_span(context, left.abs())}',
            )
          : _t(context, 'Muddatida hal qilindi', 'Решено в срок');
    } else if (overdue) {
      color = AppColors.danger;
      headline = _t(
        context,
        '${_span(context, left.abs())} kechikdi',
        'Просрочено на ${_span(context, left.abs())}',
      );
    } else {
      color = left.inHours < 24 ? AppColors.warning : AppColors.primary;
      headline = _t(
        context,
        '${_span(context, left)} qoldi',
        'Осталось ${_span(context, left)}',
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final line = isDark ? AppColors.darkLine : AppColors.line;

    return AppCard(
      color: overdue && open
          ? AppColors.danger.withValues(alpha: isDark ? 0.14 : 0.06)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(AppIcons.timer, size: 18, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  headline,
                  style: AppTextStyles.body.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: open ? progress : 1,
              minHeight: 6,
              color: color,
              backgroundColor: line,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${_t(context, 'Muddat', 'Срок')}: ${formatIsoDateTime(a.deadline!)}',
            style: AppTextStyles.caption.copyWith(color: inkMuted),
          ),
        ],
      ),
    );
  }
}

/// 2 kun 4 soat / 5 soat / 20 daqiqa.
String _span(BuildContext context, Duration d) {
  final ru = Localizations.localeOf(context).languageCode == 'ru';
  final days = d.inDays;
  final hours = d.inHours % 24;
  if (days > 0) {
    final h = hours > 0 ? (ru ? ' $hours ч' : ' $hours soat') : '';
    return ru ? '$days дн$h' : '$days kun$h';
  }
  if (d.inHours > 0) return ru ? '${d.inHours} ч' : '${d.inHours} soat';
  final m = d.inMinutes.clamp(1, 59);
  return ru ? '$m мин' : '$m daqiqa';
}

/* ───────────────────────── Fuqaro + manzil ───────────────────────── */

class _CitizenCard extends StatelessWidget {
  const _CitizenCard({required this.application});

  final Application application;

  @override
  Widget build(BuildContext context) {
    final a = application;
    final hasAddress = (a.address ?? '').trim().isNotEmpty;
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          AppListTile(
            title: a.citizenName,
            subtitle: a.citizenPhotoUrl == null
                ? a.citizenPhone
                : '${a.citizenPhone} · '
                      '${_t(context, 'selfi bilan', 'с селфи')}',
            // Murojaat yuborilgan paytdagi selfi — kim yozganini ko'rish uchun;
            // bosilsa to'liq o'lchamda ochiladi.
            leading: a.citizenPhotoUrl == null
                ? null
                : GestureDetector(
                    onTap: () => _showPhoto(
                      context,
                      a.citizenPhotoUrl!,
                      a.citizenName,
                    ),
                    child: AppAvatar(
                      name: a.citizenName,
                      photoUrl: a.citizenPhotoUrl,
                    ),
                  ),
            leadingIcon: AppIcons.profile,
            showChevron: false,
            trailing: IconButton(
              tooltip: _t(context, "Qo'ng'iroq", 'Позвонить'),
              onPressed: () => _call(context, a.citizenPhone),
              icon: const Icon(AppIcons.call, color: AppColors.primary),
            ),
          ),
          if (hasAddress || a.hasLocation)
            AppListTile(
              title: hasAddress
                  ? a.address!
                  : _t(context, 'Joylashuv', 'Местоположение'),
              subtitle: a.hasLocation
                  ? _t(
                      context,
                      'Fuqaro joylashuvni yuborgan',
                      'Гражданин отправил точку',
                    )
                  : _t(
                      context,
                      'Aniq nuqta yuborilmagan',
                      'Точка не отправлена',
                    ),
              leadingIcon: AppIcons.location,
              showChevron: false,
              trailing: TextButton.icon(
                onPressed: () => _openMap(context, a),
                icon: const Icon(AppIcons.routing, size: 18),
                label: Text(_t(context, 'Xaritada', 'На карте')),
              ),
            ),
        ],
      ),
    );
  }
}

void _showPhoto(BuildContext context, String url, String name) {
  showDialog<void>(
    context: context,
    builder: (ctx) => Dialog(
      clipBehavior: Clip.antiAlias,
      insetPadding: const EdgeInsets.all(24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 3 / 4,
            child: InteractiveViewer(
              child: Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    const Center(child: Icon(AppIcons.imageIcon, size: 40)),
              ),
            ),
          ),
          ListTile(
            title: Text(name, style: AppTextStyles.bodyStrong),
            subtitle: Text(
              _t(
                ctx,
                'Murojaat yuborilgan paytdagi selfi',
                'Селфи при отправке',
              ),
            ),
            trailing: IconButton(
              tooltip: _t(ctx, 'Yopish', 'Закрыть'),
              onPressed: () => Navigator.of(ctx).pop(),
              icon: const Icon(AppIcons.close),
            ),
          ),
        ],
      ),
    ),
  );
}

/* ───────────────────────── Baho ───────────────────────── */

class _RatingCard extends StatelessWidget {
  const _RatingCard({required this.rating, this.comment});

  final int rating;
  final String? comment;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 1; i <= 5; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 2),
                  child: Icon(
                    AppIcons.star,
                    size: 22,
                    color: i <= rating ? AppColors.warning : line,
                  ),
                ),
              const SizedBox(width: 8),
              Text('$rating / 5', style: AppTextStyles.h3),
            ],
          ),
          if ((comment ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '“${comment!.trim()}”',
              style: AppTextStyles.body.copyWith(
                color: inkSoft,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/* ───────────────────────── Yozishma ───────────────────────── */

class _ThreadCard extends StatefulWidget {
  const _ThreadCard({required this.application, required this.submitting});

  final Application application;
  final bool submitting;

  @override
  State<_ThreadCard> createState() => _ThreadCardState();
}

class _ThreadCardState extends State<_ThreadCard> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || widget.submitting) return;
    FocusScope.of(context).unfocus();
    final error = await context.read<RequestDetailCubit>().sendMessage(text);
    if (!mounted) return;
    if (error == null) {
      _controller.clear();
    } else {
      AppAlert.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.application;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final surface2 = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final canWrite = a.status != ApplicationStatus.rad;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (a.messages.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                _t(
                  context,
                  "Hali xabar yo'q. Fuqaroga holat haqida qisqa xabar yozing.",
                  'Сообщений пока нет. Напишите гражданину о ходе работ.',
                ),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
            )
          else
            for (final m in a.messages) ...[
              _Bubble(message: m),
              const SizedBox(height: 8),
            ],
          if (canWrite) ...[
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 1000,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: _t(
                        context,
                        'Fuqaroga xabar…',
                        'Сообщение гражданину…',
                      ),
                      counterText: '',
                      isDense: true,
                      filled: true,
                      fillColor: surface2,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.md),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 46,
                  height: 46,
                  child: IconButton.filled(
                    onPressed: widget.submitting ? null : _send,
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary,
                    ),
                    icon: widget.submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            AppIcons.send,
                            color: Colors.white,
                            size: 20,
                          ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ThreadMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = !message.fromCitizen;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final bg = mine
        ? AppColors.primary.withValues(alpha: isDark ? 0.22 : 0.10)
        : (isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt);
    final name =
        message.senderName ??
        (mine
            ? _t(context, 'Xodim', 'Сотрудник')
            : _t(context, 'Fuqaro', 'Гражданин'));
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.72,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: Radius.circular(mine ? 14 : 4),
              bottomRight: Radius.circular(mine ? 4 : 14),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: mine ? AppColors.primary : inkMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(message.text, style: AppTextStyles.body),
                if (message.attachmentUrl != null) ...[
                  const SizedBox(height: 6),
                  AttachmentTile(
                    attachment: AttachmentRef(
                      type: AttachmentType.image,
                      path: message.attachmentUrl!,
                      name: message.attachmentUrl!.split('/').last,
                    ),
                  ),
                ],
                const SizedBox(height: 2),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    murojaatStamp(message.createdAt) ?? '—',
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 10.5,
                      color: inkMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/* ───────────────────────── Tarix ───────────────────────── */

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.events});

  final List<ApplicationHistoryEvent> events;

  String _status(BuildContext context, String? s) => switch (s) {
    'NEW' => _t(context, 'Yangi', 'Новая'),
    'IN_PROGRESS' => _t(context, 'Jarayonda', 'В работе'),
    'RESOLVED' => _t(context, 'Hal qilindi', 'Решено'),
    'REJECTED' => _t(context, 'Rad etildi', 'Отклонено'),
    _ => s ?? '—',
  };

  ({IconData icon, Color color, String label}) _meta(
    BuildContext context,
    ApplicationHistoryEvent e,
  ) => switch (e.type) {
    'CREATED' => (
      icon: AppIcons.documentUpload,
      color: AppColors.info,
      label: _t(context, 'Murojaat kelib tushdi', 'Обращение поступило'),
    ),
    'ASSIGNED' => (
      icon: AppIcons.people,
      color: AppColors.primary,
      label: e.toEmployeeName != null
          ? _t(
              context,
              'Biriktirildi: ${e.toEmployeeName}',
              'Назначено: ${e.toEmployeeName}',
            )
          : _t(context, 'Xodim biriktirildi', 'Назначен сотрудник'),
    ),
    'STATUS_CHANGED' => (
      icon: AppIcons.arrowRight,
      color: AppColors.warning,
      label:
          '${_status(context, e.fromStatus)} → ${_status(context, e.toStatus)}',
    ),
    'RATED' => (
      icon: AppIcons.star,
      color: AppColors.warning,
      label: _t(context, 'Fuqaro baholadi', 'Гражданин оценил'),
    ),
    'REOPENED' => (
      icon: AppIcons.turnLeft,
      color: AppColors.danger,
      label: _t(context, 'Fuqaro qayta ochdi', 'Гражданин переоткрыл'),
    ),
    _ => (
      icon: AppIcons.sms,
      color: AppColors.inkMuted,
      label: _t(context, 'Izoh', 'Комментарий'),
    ),
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    return Column(
      children: [
        for (var i = 0; i < events.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Builder(
                      builder: (context) {
                        final m = _meta(context, events[i]);
                        return Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: m.color.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(m.icon, size: 15, color: m.color),
                        );
                      },
                    ),
                    if (i < events.length - 1)
                      Expanded(child: Container(width: 1.5, color: line)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      top: 4,
                      bottom: i < events.length - 1 ? 14 : 0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _meta(context, events[i]).label,
                          style: AppTextStyles.body.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if ((events[i].note ?? '').trim().isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            events[i].note!.trim(),
                            style: AppTextStyles.caption.copyWith(
                              color: inkSoft,
                            ),
                          ),
                        ],
                        const SizedBox(height: 2),
                        Text(
                          [
                            if (events[i].actorName != null)
                              events[i].actorName!,
                            formatIsoDateTime(events[i].createdAt),
                          ].join(' · '),
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 11,
                            color: inkMuted,
                          ),
                        ),
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

/* ───────────────────────── Yuklanish / xato ───────────────────────── */

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        const AppSkeleton(width: 260, height: 24),
        const SizedBox(height: 14),
        const Row(
          children: [
            AppSkeleton(width: 70, height: 26),
            SizedBox(width: 8),
            AppSkeleton(width: 90, height: 26),
            SizedBox(width: 8),
            AppSkeleton(width: 80, height: 26),
          ],
        ),
        const SizedBox(height: 22),
        AppSkeleton(width: double.infinity, height: 92, borderRadius: radius),
        const SizedBox(height: 12),
        AppSkeleton(width: double.infinity, height: 84, borderRadius: radius),
        const SizedBox(height: 22),
        const AppSkeleton(width: 110, height: 14),
        const SizedBox(height: 10),
        AppSkeleton(width: double.infinity, height: 96, borderRadius: radius),
        const SizedBox(height: 22),
        const AppSkeleton(width: 130, height: 14),
        const SizedBox(height: 10),
        AppSkeleton(width: double.infinity, height: 120, borderRadius: radius),
      ],
    );
  }
}

class _DetailErrorView extends StatelessWidget {
  const _DetailErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.requestNotFoundTitle,
        message: message,
        action: AppButton(
          label: l10n.retry,
          expand: false,
          onPressed: () => context.read<RequestDetailCubit>().retry(),
        ),
      ),
    );
  }
}
