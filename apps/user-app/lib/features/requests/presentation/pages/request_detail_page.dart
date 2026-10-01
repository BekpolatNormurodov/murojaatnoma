import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/error_view.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/widgets/citizen_request_card.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_tile.dart';
import 'package:user_app/features/requests/presentation/widgets/request_kind_meta.dart';
import 'package:user_app/features/requests/presentation/widgets/request_status_chip.dart';

/// "Murojaat tafsilotlari" sahifasi — to'liq ariza/shikoyat (sarlavha,
/// holat bosqichlari, matn, biriktirmalar) va rasmiy javob (bo'lsa).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan
/// `RequestDetailCubit.load(id)` orqali allaqachon berilgan bo'ladi
/// (`PayPage`/worker `RequestDetailPage` bilan bir xil naqsh).
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
      body: SafeArea(
        child: BlocBuilder<RequestDetailCubit, RequestDetailState>(
          builder: (context, state) => switch (state) {
            RequestDetailLoading() => const _DetailSkeleton(
              key: Key('request_detail_skeleton'),
            ),
            RequestDetailError(:final message) => _DetailErrorView(
              message: message,
            ),
            RequestDetailLoaded(
              :final request,
              :final messages,
              :final sendingMessage,
            ) =>
              _DetailContent(
                request: request,
                messages: messages,
                sendingMessage: sendingMessage,
              ),
          },
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({
    required this.request,
    required this.messages,
    required this.sendingMessage,
  });

  final CitizenRequest request;
  final List<RequestMessage> messages;
  final bool sendingMessage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    // Pastga tortib yangilash — faqat xabarlar thread'ini qayta yuklaydi
    // (murojaatning o'zi sahifa ochilganda allaqachon yuklangan), shu
    // tufayli butun sahifa qayta skeleton holatiga qaytmaydi (qarang:
    // `RequestDetailCubit.reloadMessages`).
    return RefreshIndicator(
      onRefresh: () => context.read<RequestDetailCubit>().reloadMessages(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(request.title, style: AppTextStyles.h2)),
              const SizedBox(width: 10),
              RequestStatusChip(status: request.status),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              AppBadge(
                label: RequestKindMeta.label(l10n, request.kind),
                variant: request.kind == RequestKind.ariza
                    ? AppBadgeVariant.info
                    : AppBadgeVariant.warning,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  request.category,
                  style: AppTextStyles.caption.copyWith(color: inkSoft),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatIsoDate(request.createdAt),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
            ],
          ),
          const SizedBox(height: 24),
          AppCard(
            padding: const EdgeInsets.fromLTRB(8, 16, 8, 14),
            child: _StatusTimeline(request: request),
          ),
          const SizedBox(height: 12),
          _ProgressInfo(request: request),
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestDescriptionTitle),
          const SizedBox(height: 8),
          AppCard(child: Text(request.body, style: AppTextStyles.body)),
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestAttachmentsTitle),
          const SizedBox(height: 8),
          if (request.attachments.isEmpty)
            Text(
              l10n.requestNoAttachments,
              style: AppTextStyles.caption.copyWith(color: inkMuted),
            )
          else
            for (final attachment in request.attachments) ...[
              RequestAttachmentTile(attachment: attachment),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestResponseTitle),
          const SizedBox(height: 8),
          if (messages.isEmpty)
            Text(
              l10n.chatEmptyMessage,
              style: AppTextStyles.caption.copyWith(color: inkMuted),
            )
          else
            // Har bir pufakcha o'z `message.id`si bilan kalitlangan — shu
            // tufayli mavjud xabarlar qayta qurilishda animatsiyasini QAYTA
            // O'YNAMAYDI, faqat YANGI xabar (masalan optimistik yuborilgan)
            // silliq (fade + slide) paydo bo'ladi — "smooth append".
            for (final message in messages) ...[
              _MessageBubble(
                key: ValueKey(message.id),
                message: message,
              ).animate().fadeIn(duration: 220.ms).slideY(begin: 0.12, end: 0),
              const SizedBox(height: 12),
            ],
          // Hal qilingan murojaat: baholash yoki "hal bo'lmadi" (qayta ochish).
          if (request.status == RequestStatus.javobBerildi) ...[
            const SizedBox(height: 8),
            _FeedbackCard(request: request),
          ],
          const SizedBox(height: 8),
          _MessageComposer(sending: sendingMessage),
          if (request.history.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionTitle(_t(context, 'Murojaat tarixi', 'История обращения')),
            const SizedBox(height: 8),
            AppCard(child: _HistoryList(events: request.history)),
          ],
        ],
      ),
    );
  }
}

/// Murojaat hal qilingach — fuqaro 1..5 baho beradi (ixtiyoriy izoh) yoki
/// "Muammo hal bo'lmadi" deb qayta ochadi (xodimga qaytadi).
class _FeedbackCard extends StatefulWidget {
  const _FeedbackCard({required this.request});

  final CitizenRequest request;

  @override
  State<_FeedbackCard> createState() => _FeedbackCardState();
}

class _FeedbackCardState extends State<_FeedbackCard> {
  int _stars = 0;
  final _comment = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars == 0 || _busy) return;
    setState(() => _busy = true);
    final error = await context.read<RequestDetailCubit>().rate(
      _stars,
      comment: _comment.text,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (error != null) {
      AppAlert.error(context, error);
    } else {
      AppAlert.success(context, 'Rahmat! Bahoyingiz qabul qilindi');
    }
  }

  Future<void> _reopen() async {
    final controller = TextEditingController();
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          20 + MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text("Muammo hal bo'lmadimi?", style: AppTextStyles.h3),
            const SizedBox(height: 6),
            Text(
              'Nima hal bo\'lmaganini yozing — murojaat xodimga qaytariladi.',
              style: AppTextStyles.caption,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Masalan: chiroq hali ham yonmayapti',
              ),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: 'Qayta ochish',
              onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (reason == null || reason.length < 3 || !mounted) return;
    setState(() => _busy = true);
    final error = await context.read<RequestDetailCubit>().reopen(reason);
    if (!mounted) return;
    setState(() => _busy = false);
    if (error != null) {
      AppAlert.error(context, error);
    } else {
      AppAlert.success(context, 'Murojaat qayta ochildi');
    }
  }

  @override
  Widget build(BuildContext context) {
    final rated = widget.request.rating;
    if (rated != null) {
      return AppCard(
        child: Row(
          children: [
            for (var i = 1; i <= 5; i++)
              Icon(
                i <= rated ? Icons.star_rounded : Icons.star_outline_rounded,
                color: AppColors.warning,
                size: 22,
              ),
            const SizedBox(width: 10),
            const Expanded(child: Text('Bahoyingiz uchun rahmat')),
          ],
        ),
      );
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Javobdan qoniqdingizmi?', style: AppTextStyles.bodyStrong),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  tooltip: '$i baho',
                  onPressed: _busy ? null : () => setState(() => _stars = i),
                  icon: Icon(
                    i <= _stars
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: AppColors.warning,
                    size: 34,
                  ),
                ),
            ],
          ),
          if (_stars > 0) ...[
            const SizedBox(height: 4),
            TextField(
              controller: _comment,
              maxLines: 2,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText: 'Izoh (ixtiyoriy)',
                counterText: '',
              ),
            ),
            const SizedBox(height: 10),
            AppButton(label: 'Baholash', loading: _busy, onPressed: _submit),
          ],
          const SizedBox(height: 4),
          Center(
            child: TextButton(
              onPressed: _busy ? null : _reopen,
              child: const Text("Muammo hal bo'lmadi"),
            ),
          ),
        ],
      ),
    );
  }
}

/// Thread'dagi bitta xabar — fuqaro xabarlari o'ngga (brend rangida),
/// xodim/tizim xabarlari chapga (neytral qopqoq bilan) tekislanadi —
/// odatiy chat vizual tili.
class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, super.key});

  final RequestMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final isCitizen = message.senderRole == RequestMessageSenderRole.citizen;
    final isSystem = message.senderRole == RequestMessageSenderRole.system;

    final senderName = message.senderName?.trim();
    final senderLabel = isCitizen
        ? l10n.callYou
        : (senderName != null && senderName.isNotEmpty)
        ? senderName
        : (isSystem ? null : l10n.requestResponseTitle);

    return Align(
      alignment: isCitizen ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: isCitizen
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          if (senderLabel != null) ...[
            Text(
              senderLabel,
              style: AppTextStyles.caption.copyWith(
                color: inkMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
          ],
          Container(
            constraints: const BoxConstraints(maxWidth: 280),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isCitizen
                  ? AppColors.primary.withValues(alpha: 0.12)
                  : surface,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: isCitizen ? null : Border.all(color: line),
            ),
            child: Text(message.text, style: AppTextStyles.body),
          ),
          const SizedBox(height: 4),
          Text(
            formatIsoDateTime(message.createdAt),
            style: AppTextStyles.caption.copyWith(
              color: inkMuted,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// Xabarlar thread'iga fuqaro nomidan yangi xabar yozish uchun ixcham
/// forma — matn maydoni + yuborish tugmasi (`RequestRespondPage`
/// (worker-app)dagi bir xil naqsh: matn bo'sh bo'lsa xato ko'rsatiladi,
/// yuborilayotganda tugma loading holatida).
class _MessageComposer extends StatefulWidget {
  const _MessageComposer({required this.sending});

  final bool sending;

  @override
  State<_MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<_MessageComposer> {
  final _controller = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(BuildContext context) async {
    final l10n = context.l10n;
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _errorText = l10n.requestResponseEmptyError);
      return;
    }

    final error = await context.read<RequestDetailCubit>().sendMessage(text);
    if (!context.mounted) return;
    if (error == null) {
      _controller.clear();
      setState(() => _errorText = null);
    } else {
      AppAlert.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          hint: l10n.chatMessageHint,
          controller: _controller,
          maxLines: 3,
          errorText: _errorText,
          enabled: !widget.sending,
          onChanged: (_) {
            if (_errorText != null) setState(() => _errorText = null);
          },
        ),
        const SizedBox(height: 10),
        AppButton(
          label: l10n.requestSendResponse,
          icon: AppIcons.send,
          loading: widget.sending,
          onPressed: widget.sending ? null : () => _send(context),
        ),
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
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    return Text(label, style: AppTextStyles.label.copyWith(color: inkSoft));
  }
}

/// uz/ru matn — sahifaga xos yangi yorliqlar uchun (ARB'ga tegmasdan).
String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;

/// "12.09, 14:05".
String _stamp(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '—';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}, ${two(d.hour)}:${two(d.minute)}';
}

class _Step {
  const _Step(this.label, this.at, {required this.done, this.danger = false});
  final String label;
  final String? at;
  final bool done;
  final bool danger;
}

/// Murojaat yo'li: Yuborildi → Ko'rib chiqilmoqda → Hal qilindi →
/// Baholandi (rad etilsa: Yuborildi → Rad etildi). Har bosqich ostida
/// sodir bo'lgan vaqti — hokimiyat tomonidagi tarixdan.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.request});

  final CitizenRequest request;

  @override
  Widget build(BuildContext context) {
    final r = request;
    String? firstAt(bool Function(RequestHistoryEvent) test) {
      for (final e in r.history) {
        if (test(e)) return e.createdAt;
      }
      return null;
    }

    String? lastAt(bool Function(RequestHistoryEvent) test) {
      for (final e in r.history.reversed) {
        if (test(e)) return e.createdAt;
      }
      return null;
    }

    final rejected = r.status == RequestStatus.yopildi;
    final working = r.status != RequestStatus.yuborilgan;
    final resolved = r.status == RequestStatus.javobBerildi;
    final steps = rejected
        ? [
            _Step(
              _t(context, 'Yuborildi', 'Отправлено'),
              r.createdAt,
              done: true,
            ),
            _Step(
              _t(context, 'Rad etildi', 'Отклонено'),
              lastAt((e) => e.toStatus == 'REJECTED'),
              done: true,
              danger: true,
            ),
          ]
        : [
            _Step(
              _t(context, 'Yuborildi', 'Отправлено'),
              r.createdAt,
              done: true,
            ),
            _Step(
              _t(context, "Ko'rib chiqilmoqda", 'В работе'),
              firstAt(
                (e) => e.type == 'ASSIGNED' || e.toStatus == 'IN_PROGRESS',
              ),
              done: working,
            ),
            _Step(
              _t(context, 'Hal qilindi', 'Решено'),
              r.resolvedAt ?? lastAt((e) => e.toStatus == 'RESOLVED'),
              done: resolved,
            ),
            _Step(
              _t(context, 'Baholandi', 'Оценено'),
              lastAt((e) => e.type == 'RATED'),
              done: r.rating != null,
            ),
          ];
    var current = 0;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].done) current = i;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    Color colorOf(int i) => !steps[i].done
        ? line
        : steps[i].danger
        ? AppColors.danger
        : AppColors.primary;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++)
          Expanded(
            child: Column(
              children: [
                SizedBox(
                  height: 22,
                  child: Row(
                    children: [
                      Expanded(
                        child: i == 0
                            ? const SizedBox.shrink()
                            : Container(height: 2, color: colorOf(i)),
                      ),
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: steps[i].done
                              ? colorOf(i)
                              : Colors.transparent,
                          border: Border.all(color: colorOf(i), width: 2),
                          boxShadow: i == current
                              ? [
                                  BoxShadow(
                                    color: colorOf(i).withValues(alpha: 0.25),
                                    spreadRadius: 4,
                                  ),
                                ]
                              : null,
                        ),
                        child: steps[i].done
                            ? Icon(
                                steps[i].danger
                                    ? AppIcons.close
                                    : AppIcons.tick,
                                size: 13,
                                color: Colors.white,
                              )
                            : null,
                      ),
                      Expanded(
                        child: i == steps.length - 1
                            ? const SizedBox.shrink()
                            : Container(height: 2, color: colorOf(i + 1)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Text(
                    steps[i].label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 11,
                      height: 1.15,
                      color: steps[i].done ? ink : inkMuted,
                      fontWeight: i == current
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  steps[i].done && steps[i].at != null
                      ? _stamp(steps[i].at!)
                      : '—',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    fontSize: 10,
                    color: inkMuted,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Mas'ul xodim, hal qilish muddati va manzil — fuqaro murojaati qayerda
/// ekanini aniq bilsin.
class _ProgressInfo extends StatelessWidget {
  const _ProgressInfo({required this.request});

  final CitizenRequest request;

  @override
  Widget build(BuildContext context) {
    final r = request;
    final open =
        r.status == RequestStatus.yuborilgan ||
        r.status == RequestStatus.korilmoqda;
    final due = r.dueAt == null ? null : DateTime.tryParse(r.dueAt!)?.toLocal();
    final rows = <Widget>[
      AppListTile(
        title:
            r.assigneeName ??
            _t(context, 'Hali biriktirilmagan', 'Ещё не назначен'),
        subtitle: _t(context, "Mas'ul xodim", 'Ответственный'),
        leadingIcon: AppIcons.profile,
        showChevron: false,
      ),
    ];
    if (due != null && open) {
      final left = due.difference(DateTime.now());
      final overdue = left.isNegative;
      final days = left.abs().inDays;
      final hours = left.abs().inHours % 24;
      final span = days > 0
          ? _t(context, '$days kun', '$days дн')
          : _t(context, '$hours soat', '$hours ч');
      rows.add(
        AppListTile(
          title: formatIsoDate(r.dueAt!),
          subtitle: overdue
              ? _t(
                  context,
                  'Muddat $span oldin tugagan',
                  'Срок истёк $span назад',
                )
              : _t(
                  context,
                  'Hal qilish muddati · $span qoldi',
                  'Срок решения · осталось $span',
                ),
          leadingIcon: AppIcons.timer,
          showChevron: false,
        ),
      );
    }
    if ((r.address ?? '').trim().isNotEmpty) {
      rows.add(
        AppListTile(
          title: r.address!.trim(),
          subtitle: _t(context, 'Manzil', 'Адрес'),
          leadingIcon: AppIcons.location,
          showChevron: false,
        ),
      );
    }
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(children: rows),
    );
  }
}

/// Murojaat tarixi — fuqaroga ko'rinadigan bosqichlar (vaqt va izoh bilan).
class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.events});

  final List<RequestHistoryEvent> events;

  String? _label(BuildContext context, RequestHistoryEvent e) =>
      switch (e.type) {
        'CREATED' => _t(context, 'Murojaat qabul qilindi', 'Обращение принято'),
        'ASSIGNED' =>
          e.employeeName != null
              ? _t(
                  context,
                  "Mas'ul xodim: ${e.employeeName}",
                  'Ответственный: ${e.employeeName}',
                )
              : _t(context, 'Xodim biriktirildi', 'Назначен сотрудник'),
        'STATUS_CHANGED' => switch (e.toStatus) {
          'IN_PROGRESS' => _t(
            context,
            "Ko'rib chiqish boshlandi",
            'Взято в работу',
          ),
          'RESOLVED' => _t(context, 'Hal qilindi', 'Решено'),
          'REJECTED' => _t(context, 'Rad etildi', 'Отклонено'),
          'NEW' => _t(
            context,
            "Qayta navbatga qo'yildi",
            'Возвращено в очередь',
          ),
          _ => null,
        },
        'RATED' => _t(context, 'Siz baholadingiz', 'Вы оценили'),
        'REOPENED' => _t(context, 'Siz qayta ochdingiz', 'Вы переоткрыли'),
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final items = [
      for (final e in events)
        if (_label(context, e) case final label?) (e, label),
    ];
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    return Column(
      children: [
        for (var i = 0; i < items.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 5),
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i == items.length - 1 ? AppColors.primary : line,
                      ),
                    ),
                    if (i < items.length - 1)
                      Expanded(child: Container(width: 1.5, color: line)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      bottom: i < items.length - 1 ? 14 : 0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(items[i].$2, style: AppTextStyles.bodyStrong),
                        if ((items[i].$1.note ?? '').trim().isNotEmpty &&
                            items[i].$1.type != 'RATED') ...[
                          const SizedBox(height: 2),
                          Text(
                            items[i].$1.note!.trim(),
                            style: AppTextStyles.caption.copyWith(
                              color: inkSoft,
                            ),
                          ),
                        ],
                        const SizedBox(height: 2),
                        Text(
                          formatIsoDateTime(items[i].$1.createdAt),
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

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerBox(width: double.infinity, height: 24),
          SizedBox(height: 12),
          ShimmerBox(width: 160),
          SizedBox(height: 24),
          ShimmerBox(width: double.infinity, height: 90, radius: AppRadii.lg),
          SizedBox(height: 20),
          ShimmerBox(width: double.infinity, height: 120, radius: AppRadii.lg),
          SizedBox(height: 20),
          ShimmerBox(width: double.infinity, height: 80, radius: AppRadii.lg),
        ],
      ),
    );
  }
}

/// Murojaatni yuklashda xatolik — `ErrorView` ustida quriladi, faqat
/// murojaat topilmadi sarlavhasini `message` oldiga qo'shadi (`ErrorView`ning
/// o'zi faqat bitta matn qatorini qabul qiladi).
class _DetailErrorView extends StatelessWidget {
  const _DetailErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ErrorView(
      message: '${l10n.requestNotFoundTitle}\n$message',
      retryLabel: l10n.retry,
      onRetry: () => context.read<RequestDetailCubit>().retry(),
    );
  }
}
