import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';
import 'package:worker_app/features/salary/presentation/bloc/salary_cubit.dart';
import 'package:worker_app/features/salary/presentation/widgets/salary_month_card.dart';

/// "Oyliklarim" sahifasi — xodimning O'Z oylik maosh tarixi (`GET
/// /salaries/me`): har bir oy uchun sof maosh, asosiy/ustama/ushlab qolish
/// va to'langan/to'lanmagan holati (eng yangi oy birinchi). `SalaryCubit`ning
/// barcha holatlari (yuklanish/bo'sh/xato/yuklandi) shu yerda ko'rsatiladi —
/// hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, profil sahifasidagi "Oyliklarim" qatoridan PUSH
/// qilinadigan to'liq ekranli sahifa — shuning uchun `PointsPage` bilan bir
/// xil naqsh: o'z `AppBar`i + `AppBackButton`.
class SalaryPage extends StatelessWidget {
  const SalaryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.read<SalaryCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text('Oyliklarim', style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<SalaryCubit, SalaryState>(
          builder: (context, state) => switch (state) {
            SalaryLoading() => const _SalarySkeleton(
              key: Key('salary_skeleton'),
            ),
            SalaryError(:final message) => _SalaryErrorView(
              message: message,
              onRetry: cubit.reload,
            ),
            SalaryEmpty() => RefreshIndicator(
              onRefresh: cubit.reload,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 40),
                children: const [
                  EmptyState(
                    icon: AppIcons.wallet,
                    title: "Maosh tarixi yo'q",
                    message:
                        'Hozircha oylik maosh yozuvlari mavjud emas. '
                        "Maosh belgilangach shu yerda ko'rinadi.",
                  ),
                ],
              ),
            ),
            SalaryLoaded(:final salaries) => _SalaryContent(
              salaries: salaries,
              onRefresh: cubit.reload,
            ),
          },
        ),
      ),
    );
  }
}

class _SalaryContent extends StatelessWidget {
  const _SalaryContent({required this.salaries, required this.onRefresh});

  final List<Salary> salaries;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        itemCount: salaries.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) =>
            SalaryMonthCard(salary: salaries[index]),
      ),
    );
  }
}

class _SalarySkeleton extends StatelessWidget {
  const _SalarySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            AppSkeleton(
              width: double.infinity,
              height: 150,
              borderRadius: radius,
            ),
          ],
        ],
      ),
    );
  }
}

class _SalaryErrorView extends StatelessWidget {
  const _SalaryErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: "Maoshni yuklab bo'lmadi",
        message: message,
        action: AppButton(
          label: l10n.retry,
          expand: false,
          onPressed: onRetry,
        ),
      ),
    );
  }
}
