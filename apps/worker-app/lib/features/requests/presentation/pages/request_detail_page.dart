import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:worker_app/features/requests/presentation/widgets/application_card.dart';
import 'package:worker_app/features/requests/presentation/widgets/attachment_tile.dart';
import 'package:worker_app/features/requests/presentation/widgets/status_chip.dart';

/// "Murojaat tafsilotlari" sahifasi — to'liq murojaat (sarlavha, holat
/// bosqichlari, tavsif, biriktirmalar, fuqaro ma'lumoti), xodim javobi
/// (bo'lsa) va xodim uchun amallar (javob yozish / ball qo'yish).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan
/// `RequestDetailCubit.load(id)` orqali allaqachon berilgan bo'ladi
/// (`HomePage`/`AttendanceCubit` bilan bir xil naqsh).
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
            RequestDetailLoaded(:final application, :final submitting) =>
              _DetailContent(application: application, submitting: submitting),
          },
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.application, required this.submitting});

  final Application application;
  final bool submitting;

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
            Expanded(child: Text(application.title, style: AppTextStyles.h2)),
            const SizedBox(width: 10),
            StatusChip(status: application.status),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            AppBadge(
              label: ApplicationCard.priorityLabel(
                context,
                application.priority,
              ),
              variant: ApplicationCard.priorityVariant(application.priority),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                application.category,
                style: AppTextStyles.caption.copyWith(color: inkSoft),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        AppCard(child: _StatusTimeline(status: application.status)),
        const SizedBox(height: 20),
        _SectionTitle(l10n.requestDescriptionTitle),
        const SizedBox(height: 8),
        AppCard(
          child: Text(application.description, style: AppTextStyles.body),
        ),
        const SizedBox(height: 20),
        _SectionTitle(l10n.requestCitizenInfoTitle),
        const SizedBox(height: 8),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: Column(
            children: [
              AppListTile(
                title: application.citizenName,
                subtitle: application.citizenPhone,
                leadingIcon: AppIcons.profile,
                showChevron: false,
              ),
              if (application.deadline != null)
                AppListTile(
                  title: l10n.requestDeadlineLabel,
                  subtitle: formatIsoDate(application.deadline!),
                  leadingIcon: AppIcons.calendar,
                  showChevron: false,
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SectionTitle(l10n.requestAttachmentsTitle),
        const SizedBox(height: 8),
        if (application.attachments.isEmpty)
          Text(
            l10n.requestNoAttachments,
            style: AppTextStyles.caption.copyWith(color: inkMuted),
          )
        else
          for (final attachment in application.attachments) ...[
            AttachmentTile(attachment: attachment),
            const SizedBox(height: 8),
          ],
        if (application.response case final response?) ...[
          const SizedBox(height: 20),
          _SectionTitle(l10n.requestResponseTitle),
          const SizedBox(height: 8),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(response.text, style: AppTextStyles.body),
                if (response.attachments.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  for (final attachment in response.attachments) ...[
                    AttachmentTile(attachment: attachment),
                    const SizedBox(height: 8),
                  ],
                ],
                const SizedBox(height: 8),
                Text(
                  formatIsoDateTime(response.respondedAt),
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 28),
        _DetailActions(application: application, submitting: submitting),
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

/// Murojaat holatining bosqichma-bosqich vizual ko'rsatkichi. Haqiqiy
/// holat-tarixi (har bosqich qachon sodir bo'lgani) domenda saqlanmaydi —
/// shu tufayli bu FAQAT joriy holatning oqim ichidagi o'rnini ko'rsatadi,
/// tarixiy jurnal emas.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.status});

  final ApplicationStatus status;

  static const _flow = [
    ApplicationStatus.yangi,
    ApplicationStatus.jarayonda,
    ApplicationStatus.javobBerildi,
    ApplicationStatus.yopildi,
  ];

  @override
  Widget build(BuildContext context) {
    final steps = status == ApplicationStatus.rad
        ? const [ApplicationStatus.yangi, ApplicationStatus.rad]
        : _flow;
    final currentIndex = steps.indexOf(status);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i <= currentIndex
                        ? StatusChip.colorOf(steps[i])
                        : line,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  StatusChip.labelOf(context, steps[i]),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: i <= currentIndex ? ink : inkMuted,
                    fontWeight: i == currentIndex
                        ? FontWeight.w700
                        : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (i != steps.length - 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Container(
                width: 20,
                height: 2,
                color: i < currentIndex ? StatusChip.colorOf(steps[i]) : line,
              ),
            ),
        ],
      ],
    );
  }
}

class _DetailActions extends StatelessWidget {
  const _DetailActions({required this.application, required this.submitting});

  final Application application;
  final bool submitting;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (application.status == ApplicationStatus.rad) {
      return const SizedBox.shrink();
    }

    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: l10n.requestRespondCta,
            variant: AppButtonVariant.secondary,
            icon: AppIcons.send,
            loading: submitting,
            onPressed: submitting
                ? null
                : () => context.push(
                    '/requests/${application.id}/respond',
                    extra: context.read<RequestDetailCubit>(),
                  ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AppButton(
            label: l10n.requestRateCta,
            icon: AppIcons.star,
            loading: submitting,
            onPressed: submitting ? null : () => _openRateSheet(context),
          ),
        ),
      ],
    );
  }
}

Future<void> _openRateSheet(BuildContext context) async {
  final cubit = context.read<RequestDetailCubit>();
  final l10n = context.l10n;
  const pointsPerStar = 10;
  final state = cubit.state;
  var stars = state is RequestDetailLoaded
      ? (state.application.points / pointsPerStar).round().clamp(0, 5)
      : 0;

  await showAppSheet<void>(
    context: context,
    title: l10n.requestRateSheetTitle,
    subtitle: l10n.requestRateHint,
    child: StatefulBuilder(
      builder: (sheetContext, setSheetState) {
        final isDark = Theme.of(sheetContext).brightness == Brightness.dark;
        final line = isDark ? AppColors.darkLine : AppColors.line;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 1; i <= 5; i++)
                  GestureDetector(
                    onTap: () => setSheetState(() => stars = i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Icon(
                        AppIcons.star,
                        size: 36,
                        color: i <= stars ? AppColors.warning : line,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '${stars * pointsPerStar} ${l10n.pointsSuffix}',
              style: AppTextStyles.h3,
            ),
            const SizedBox(height: 20),
            AppButton(
              label: l10n.requestRateSubmit,
              onPressed: stars == 0
                  ? null
                  : () async {
                      final error = await cubit.rate(stars * pointsPerStar);
                      if (!context.mounted) return;
                      if (sheetContext.mounted) {
                        Navigator.of(sheetContext).pop();
                      }
                      if (error == null) {
                        await AppDialog.success(
                          context: context,
                          title: l10n.requestRateSuccessTitle,
                          message: l10n.requestRateSuccessMessage,
                          buttonLabel: l10n.closeLabel,
                        );
                      } else {
                        AppAlert.error(context, error);
                      }
                    },
            ),
          ],
        );
      },
    ),
  );
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
