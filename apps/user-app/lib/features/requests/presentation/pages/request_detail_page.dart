import 'dart:async';

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
              :final messagesFailed,
            ) =>
              _DetailContent(
                request: request,
                messages: messages,
                sendingMessage: sendingMessage,
                messagesFailed: messagesFailed,
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
    required this.messagesFailed,
  });

  final CitizenRequest request;
  final List<RequestMessage> messages;
  final bool sendingMessage;
  final bool messagesFailed;

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
          // Sarlavha butun kenglikda; holat, tur va sana uning ostida —
          // yonma-yon turganda sarlavha 8 qatorga cho'zilardi.
          Text(request.title, style: AppTextStyles.h2),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              RequestStatusChip(status: request.status),
              AppBadge(
                label: RequestKindMeta.label(l10n, request.kind),
                variant: request.kind == RequestKind.ariza
                    ? AppBadgeVariant.info
                    : AppBadgeVariant.warning,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            [
              if (request.category.isNotEmpty) request.category,
              formatIsoDate(request.createdAt),
            ].join(' • '),
            style: AppTextStyles.caption.copyWith(color: inkSoft),
          ),
          const SizedBox(height: 24),
          AppCard(child: _StatusTimeline(request: request)),
          _ProgressInfo(request: request),
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestDescriptionTitle),
          const SizedBox(height: 8),
          AppCard(child: Text(request.body, style: AppTextStyles.body)),
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestAttachmentsTitle),
          const SizedBox(height: 8),
          if (request.attachmentsFailed)
            _InlineLoadError(
              _t(
                context,
                "Biriktirmalarni yuklab bo'lmadi",
                'Не удалось загрузить вложения',
              ),
            )
          else if (request.attachments.isEmpty)
            Text(
              l10n.requestNoAttachments,
              style: AppTextStyles.caption.copyWith(color: inkMuted),
            )
          else
            for (final attachment in request.attachments) ...[
              RequestAttachmentTile(
                attachment: attachment,
                onTap:
                    attachment.type == RequestAttachmentType.image &&
                        attachment.path.startsWith('http')
                    ? () => _showImage(context, attachment)
                    : null,
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 20),
          // Bo'limda fuqaroning o'z xabarlari ham bor — "Xodim javobi" emas.
          _SectionTitle(_t(context, 'Yozishmalar', 'Переписка')),
          const SizedBox(height: 8),
          if (messagesFailed) ...[
            _InlineLoadError(
              _t(
                context,
                "Xabarlarni yuklab bo'lmadi",
                'Не удалось загрузить сообщения',
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (messages.isEmpty && !messagesFailed)
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
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _ReopenSheet(),
    );
    if (reason == null || !mounted) return;
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

/// "Hal bo'lmadi" sababi — controller varaq bilan birga yashaydi (yopilish
/// animatsiyasi paytida dispose qilinib qolmaydi). Sabab 3..500 belgi
/// (backend `ReopenApplicationDto`); qisqa bo'lsa varaq yopilmaydi.
class _ReopenSheet extends StatefulWidget {
  const _ReopenSheet();

  @override
  State<_ReopenSheet> createState() => _ReopenSheetState();
}

class _ReopenSheetState extends State<_ReopenSheet> {
  static const _minLength = 3;
  static const _maxLength = 500;

  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final reason = _controller.text.trim();
    if (reason.length < _minLength) {
      setState(
        () => _error = _t(
          context,
          'Sababni yozing (kamida $_minLength harf)',
          'Укажите причину (минимум $_minLength символа)',
        ),
      );
      return;
    }
    Navigator.of(context).pop(reason);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text("Muammo hal bo'lmadimi?", style: AppTextStyles.h3),
          const SizedBox(height: 6),
          Text(
            "Nima hal bo'lmaganini yozing — murojaat xodimga qaytariladi.",
            style: AppTextStyles.caption,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            minLines: 2,
            maxLines: 4,
            maxLength: _maxLength,
            decoration: InputDecoration(
              hintText: 'Masalan: chiroq hali ham yonmayapti',
              errorText: _error,
            ),
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
          ),
          const SizedBox(height: 12),
          AppButton(label: 'Qayta ochish', onPressed: _submit),
        ],
      ),
    );
  }
}

/// Rasm biriktirmasini to'liq ekranda (kattalashtirish bilan) ko'rsatadi.
void _showImage(BuildContext context, RequestAttachment attachment) {
  unawaited(
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                child: InteractiveViewer(
                  child: Image.network(
                    attachment.path,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Center(
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: Colors.white70,
                        size: 48,
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 4,
                right: 4,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Sahifaning bir bo'limi yuklanmaganda — xabar va qayta urinish.
class _InlineLoadError extends StatelessWidget {
  const _InlineLoadError(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            message,
            style: AppTextStyles.caption.copyWith(color: AppColors.danger),
          ),
        ),
        TextButton(
          onPressed: () => context.read<RequestDetailCubit>().reloadMessages(),
          child: Text(context.l10n.retry),
        ),
      ],
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
          if (_messageFile(message) case final file?) ...[
            const SizedBox(height: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: RequestAttachmentTile(
                attachment: file,
                onTap: file.type == RequestAttachmentType.image
                    ? () => _showImage(context, file)
                    : null,
              ),
            ),
          ],
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

/// Xabarga biriktirilgan fayl (masalan xodim javobidagi isbot rasmi) —
/// server faqat havola beradi, turi kengaytmadan aniqlanadi.
RequestAttachment? _messageFile(RequestMessage message) {
  final url = message.attachmentUrl;
  if (url == null || !url.startsWith('http')) return null;
  final name = Uri.tryParse(url)?.pathSegments.lastOrNull ?? url;
  final ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
  final type = switch (ext) {
    'mp4' || 'mov' || 'm4v' || 'webm' || '3gp' => RequestAttachmentType.video,
    'm4a' || 'mp3' || 'aac' || 'ogg' || 'wav' => RequestAttachmentType.voice,
    'jpg' ||
    'jpeg' ||
    'png' ||
    'webp' ||
    'gif' ||
    'heic' => RequestAttachmentType.image,
    _ => RequestAttachmentType.file,
  };
  return RequestAttachment(type: type, path: url, name: name);
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

    if (widget.sending) return;
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

/// Murojaat yo'li — xodim ilovasi va web bilan BIR XIL bosqichlar
/// (umumiy `murojaatSteps`): Qabul qilindi → Biriktirildi → Jarayonda →
/// Hal qilindi → Baholandi (rad etilsa … → Rad etildi), vaqt va izohi bilan.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.request});

  final CitizenRequest request;

  @override
  Widget build(BuildContext context) {
    final r = request;
    return AppVerticalStepper(
      steps: murojaatSteps(
        ru: Localizations.localeOf(context).languageCode == 'ru',
        forCitizen: true,
        status: _statusToApiName(r.status),
        createdAt: r.createdAt,
        events: [
          for (final e in r.history)
            (
              type: e.type,
              toStatus: e.toStatus,
              at: e.createdAt,
              note: e.note,
              who: e.employeeName,
            ),
        ],
        assigneeName: r.assigneeName,
        resolvedAt: r.resolvedAt,
        dueAt: r.dueAt,
        rating: r.rating,
        reopenCount: r.reopenCount,
      ),
    );
  }
}

String _statusToApiName(RequestStatus s) => switch (s) {
  RequestStatus.yuborilgan => 'NEW',
  RequestStatus.korilmoqda => 'IN_PROGRESS',
  RequestStatus.javobBerildi => 'RESOLVED',
  RequestStatus.yopildi => 'REJECTED',
};

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
    // Mas'ul xodim stepperda ko'rinadi — bu yerda muddat va manzil.
    final rows = <Widget>[];
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
    if (rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(children: rows),
      ),
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
                        color: i < items.length - 1
                            ? line
                            : items[i].$1.toStatus == 'REJECTED'
                            ? AppColors.danger
                            : AppColors.primary,
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

/// Murojaatni yuklashda xatolik. Faqat server/tarmoq xabari: ilgari har
/// qanday xato (hatto internet yo'qligi) "Murojaat topilmadi" deb chiqardi.
class _DetailErrorView extends StatelessWidget {
  const _DetailErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ErrorView(
      message: message,
      retryLabel: context.l10n.retry,
      onRetry: () => context.read<RequestDetailCubit>().retry(),
    );
  }
}
