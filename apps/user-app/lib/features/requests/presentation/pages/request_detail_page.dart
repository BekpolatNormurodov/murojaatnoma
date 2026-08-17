import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
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

    return ListView(
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
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
          child: _StatusTimeline(status: request.status),
        ),
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
          for (final message in messages) ...[
            _MessageBubble(message: message),
            const SizedBox(height: 12),
          ],
        const SizedBox(height: 8),
        _MessageComposer(sending: sendingMessage),
      ],
    );
  }
}

/// Thread'dagi bitta xabar — fuqaro xabarlari o'ngga (brend rangida),
/// xodim/tizim xabarlari chapga (neytral qopqoq bilan) tekislanadi —
/// odatiy chat vizual tili.
class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

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

/// Murojaat holatining bosqichma-bosqich vizual ko'rsatkichi. Haqiqiy
/// holat-tarixi (har bosqich qachon sodir bo'lgani) domenda saqlanmaydi —
/// shu tufayli bu FAQAT joriy holatning oqim ichidagi o'rnini ko'rsatadi,
/// tarixiy jurnal emas.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.status});

  final RequestStatus status;

  static const _flow = [
    RequestStatus.yuborilgan,
    RequestStatus.korilmoqda,
    RequestStatus.javobBerildi,
    RequestStatus.yopildi,
  ];

  /// Bosqich yorlig'i uchun ATAYLAB kichraytirilgan (`AppTextStyles.caption`
  /// 13sp emas, 10.5sp) uslub — 4 ta teng `Expanded` ustunga sig'ishi
  /// kerak bo'lgan yagona so'zlar ("Ko'rilmoqda", ruscha
  /// "Рассматривается" kabi) BO'SH JOY yo'q, ya'ni Flutter ularni faqat
  /// bitta qatorga sig'masa so'z O'RTASIDAN sindirib tashlaydi ("Yuborilga/
  /// n" kabi chiroyli emas natija). Kichikroq shrift bilan bu so'zlar odatda
  /// bitta qatorga to'liq sig'adi; `overflow: ellipsis` esa faqat haqiqatan
  /// ham sig'may qolgan chekka holatlar (masalan juda tor ekranlarda uzun
  /// ruscha matn) uchun oxirgi chora sifatida qoladi.
  static TextStyle _labelStyle(Color color, {required bool active}) =>
      AppTextStyles.caption.copyWith(
        fontSize: 10.5,
        height: 1.15,
        color: color,
        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
      );

  @override
  Widget build(BuildContext context) {
    final currentIndex = _flow.indexOf(status);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Row(
      children: [
        for (var i = 0; i < _flow.length; i++) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i <= currentIndex
                        ? RequestStatusChip.colorOf(_flow[i])
                        : line,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  RequestStatusChip.labelOf(context, _flow[i]),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  softWrap: true,
                  overflow: TextOverflow.ellipsis,
                  style: _labelStyle(
                    i <= currentIndex ? ink : inkMuted,
                    active: i == currentIndex,
                  ),
                ),
              ],
            ),
          ),
          if (i != _flow.length - 1)
            Padding(
              // Doiraning vertikal markazi bilan tekislash uchun — pastki
              // bo'shliq shu chiziqni doiralar qatoriga ko'taradi (endi
              // yorliq balandligi qisqarganidan bir oz kamroq offset ham
              // yetarli, lekin izchillik uchun oldingi qiymat saqlanadi).
              padding: const EdgeInsets.only(bottom: 24),
              child: Container(
                width: 12,
                height: 2,
                color: i < currentIndex
                    ? RequestStatusChip.colorOf(_flow[i])
                    : line,
              ),
            ),
        ],
      ],
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSkeleton(width: double.infinity, height: 24),
          const SizedBox(height: 12),
          const AppSkeleton(width: 160),
          const SizedBox(height: 24),
          AppSkeleton(width: double.infinity, height: 90, borderRadius: radius),
          const SizedBox(height: 20),
          AppSkeleton(
            width: double.infinity,
            height: 120,
            borderRadius: radius,
          ),
          const SizedBox(height: 20),
          AppSkeleton(width: double.infinity, height: 80, borderRadius: radius),
        ],
      ),
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
