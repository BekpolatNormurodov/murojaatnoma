import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meeting_detail_cubit.dart';
import 'package:worker_app/features/meetings/presentation/pages/meeting_call_page.dart';
import 'package:worker_app/features/meetings/presentation/widgets/meeting_card.dart';
import 'package:worker_app/features/meetings/presentation/widgets/meeting_status_chip.dart';

/// "Majlis tafsilotlari" sahifasi — to'liq majlis (sarlavha, holat,
/// tashkilotchi, vaqt, tavsif, ishtirokchilar) va katta "Majlisga ulanish"
/// tugmasi (Zoom-uslubidagi "ulanmoqda" holati + qo'shilish havolasi).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan
/// `MeetingDetailCubit.load(id)` orqali allaqachon berilgan bo'ladi
/// (`RequestDetailPage` bilan bir xil naqsh).
class MeetingDetailPage extends StatelessWidget {
  const MeetingDetailPage({super.key});

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
        title: Text(l10n.meetingDetailTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<MeetingDetailCubit, MeetingDetailState>(
          builder: (context, state) => switch (state) {
            MeetingDetailLoading() => const _DetailSkeleton(
              key: Key('meeting_detail_skeleton'),
            ),
            MeetingDetailError(:final message) => _DetailErrorView(
              message: message,
            ),
            MeetingDetailLoaded(:final meeting, :final joining) =>
              _DetailContent(meeting: meeting, joining: joining),
          },
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.meeting, required this.joining});

  final Meeting meeting;
  final bool joining;

  Future<void> _onJoinPressed(BuildContext context) async {
    final cubit = context.read<MeetingDetailCubit>();
    final error = await cubit.join();
    if (!context.mounted) return;
    if (error == null) {
      final state = cubit.state;
      if (state is MeetingDetailLoaded) {
        await showMeetingCallScreen(context, state.meeting);
      }
    } else {
      AppAlert.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final canJoin =
        meeting.status == MeetingStatus.jonli ||
        meeting.status == MeetingStatus.rejalashtirilgan;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(meeting.title, style: AppTextStyles.h2)),
            const SizedBox(width: 10),
            MeetingStatusChip(status: meeting.status),
          ],
        ),
        const SizedBox(height: 14),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: Column(
            children: [
              AppListTile(
                title: meeting.host,
                subtitle: l10n.meetingHostLabel,
                leadingIcon: AppIcons.profile,
                showChevron: false,
              ),
              const Divider(height: 1),
              AppListTile(
                title: formatMeetingDateTime(meeting.startAt),
                subtitle: l10n.meetingDurationLabel(meeting.durationMin),
                leadingIcon: AppIcons.calendar,
                showChevron: false,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SectionTitle(l10n.meetingDescriptionTitle),
        const SizedBox(height: 8),
        AppCard(
          child: Text(
            (meeting.description?.isNotEmpty ?? false)
                ? meeting.description!
                : l10n.meetingNoDescription,
            style: AppTextStyles.body.copyWith(
              color: (meeting.description?.isNotEmpty ?? false)
                  ? null
                  : inkMuted,
            ),
          ),
        ),
        const SizedBox(height: 20),
        _SectionTitle(
          l10n.meetingParticipantsCount(meeting.participants.length),
        ),
        // Backend ba'zan faqat ishtirokchilar SONINI beradi (ismlarsiz).
        // Bunday holda bo'sh avatarlar "devori"ni ko'rsatmaymiz — sarlavhadagi
        // son yetarli. Faqat HAQIQIY (bo'sh bo'lmagan) ismlar ro'yxat bo'lib
        // chiqadi.
        Builder(
          builder: (context) {
            final named = meeting.participants
                .where((p) => p.trim().isNotEmpty)
                .toList();
            if (named.isEmpty) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AppCard(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                child: Column(
                  children: [
                    for (var i = 0; i < named.length; i++) ...[
                      if (i > 0) const Divider(height: 1),
                      AppListTile(
                        title: named[i],
                        leading: AppAvatar(name: named[i], size: 36),
                        showChevron: false,
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 28),
        if (canJoin) ...[
          AppButton(
            label: l10n.meetingJoinCta,
            icon: AppIcons.video,
            loading: joining,
            onPressed: joining ? null : () => _onJoinPressed(context),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: joining
                ? Padding(
                    key: const ValueKey('joining'),
                    padding: const EdgeInsets.only(top: 12),
                    child: Center(
                      child: Text(
                        l10n.meetingJoiningStatus,
                        style: AppTextStyles.caption.copyWith(color: inkSoft),
                      ),
                    ),
                  )
                : const SizedBox.shrink(key: ValueKey('idle')),
          ),
        ] else
          AppCard(
            child: Row(
              children: [
                Icon(AppIcons.close, size: 18, color: inkMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l10n.meetingEndedNotice,
                    style: AppTextStyles.body.copyWith(color: inkMuted),
                  ),
                ),
              ],
            ),
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
    return Text(
      label,
      style: AppTextStyles.label.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
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
          AppSkeleton(width: double.infinity, height: 54, borderRadius: radius),
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
        title: l10n.meetingNotFoundTitle,
        message: message,
        action: AppButton(
          label: l10n.retry,
          expand: false,
          onPressed: () => context.read<MeetingDetailCubit>().retry(),
        ),
      ),
    );
  }
}
