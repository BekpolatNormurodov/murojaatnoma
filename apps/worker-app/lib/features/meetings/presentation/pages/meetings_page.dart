import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meetings_cubit.dart';
import 'package:worker_app/features/meetings/presentation/widgets/meeting_card.dart';

/// "Majlislar" sahifasi — Zoom-uslubidagi ichki yig'ilishlar ro'yxati:
/// holat bo'yicha tab (Barchasi/Jonli/Rejalashtirilgan) + majlis kartalari.
/// `MeetingsCubit`ning barcha holatlari (yuklanish/bo'sh/xato/yuklandi) shu
/// yerda ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, ro'yxatdan (masalan bosh sahifadagi "Tezkor"
/// tugmalari) PUSH qilinadigan to'liq ekranli sahifa — shuning uchun
/// `RequestDetailPage`/`CreateRequestPage` bilan bir xil naqsh: o'z
/// `AppBar`i + `AppBackButton`.
class MeetingsPage extends StatelessWidget {
  const MeetingsPage({super.key});

  Future<void> _openDetail(BuildContext context, String id) async {
    await context.push('/meetings/$id');
    // Detailda qo'shilish (join) sodir bo'lgan bo'lishi mumkin — ro'yxat
    // eskirmasin.
    if (context.mounted) {
      unawaited(context.read<MeetingsCubit>().reload());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.watch<MeetingsCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.meetingsPageTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AppSegmented<MeetingStatus?>(
                value: cubit.statusFilter,
                segments: [
                  AppSegment(value: null, label: l10n.meetingsFilterAll),
                  AppSegment(
                    value: MeetingStatus.jonli,
                    label: l10n.meetingStatusLive,
                  ),
                  AppSegment(
                    value: MeetingStatus.rejalashtirilgan,
                    label: l10n.meetingStatusScheduled,
                  ),
                ],
                onChanged: (value) => cubit.load(status: value),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: switch (cubit.state) {
                MeetingsLoading() => const AppSkeletonList(
                  key: Key('meetings_skeleton'),
                ),
                MeetingsError(:final message) => _MeetingsErrorView(
                  message: message,
                  onRetry: cubit.reload,
                ),
                MeetingsEmpty() => const _MeetingsEmptyView(),
                MeetingsLoaded(:final items) => RefreshIndicator(
                  onRefresh: cubit.reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final meeting = items[index];
                      return MeetingCard(
                        meeting: meeting,
                        onTap: () => _openDetail(context, meeting.id),
                      );
                    },
                  ),
                ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MeetingsEmptyView extends StatelessWidget {
  const _MeetingsEmptyView();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyState(
      icon: AppIcons.video,
      title: l10n.meetingsEmptyTitle,
      message: l10n.meetingsEmptyMessage,
    );
  }
}

class _MeetingsErrorView extends StatelessWidget {
  const _MeetingsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.meetingsErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
