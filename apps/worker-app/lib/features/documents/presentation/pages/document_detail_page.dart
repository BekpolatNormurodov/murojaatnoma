import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/presentation/bloc/document_detail_cubit.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_card.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_status_chip.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_type_chip.dart';

/// "Hujjat tafsilotlari" sahifasi — to'liq hujjat ma'lumotlari (kod,
/// sarlavha, tur, holat, muallif, hudud, sana, hajm, sahifalar soni).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan
/// `DocumentDetailCubit.load(id)` orqali allaqachon berilgan bo'ladi
/// (`MeetingDetailPage`/`RequestDetailPage` bilan bir xil naqsh).
class DocumentDetailPage extends StatelessWidget {
  const DocumentDetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text('Hujjat tafsilotlari', style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<DocumentDetailCubit, DocumentDetailState>(
          builder: (context, state) => switch (state) {
            DocumentDetailLoading() => const _DetailSkeleton(
              key: Key('document_detail_skeleton'),
            ),
            DocumentDetailError(:final message) => _DetailErrorView(
              message: message,
            ),
            DocumentDetailLoaded(:final document) => _DetailContent(
              document: document,
            ),
          },
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.document});

  final DocumentItem document;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        Text(
          document.code,
          style: AppTextStyles.caption.copyWith(color: inkSoft),
        ),
        const SizedBox(height: 4),
        Text(document.title, style: AppTextStyles.h2),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            DocumentTypeChip(type: document.type),
            DocumentStatusChip(status: document.status),
          ],
        ),
        const SizedBox(height: 20),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: Column(
            children: [
              AppListTile(
                title: document.author,
                subtitle: 'Muallif',
                leadingIcon: AppIcons.profile,
                showChevron: false,
              ),
              const Divider(height: 1),
              AppListTile(
                title: document.region,
                subtitle: 'Hudud',
                leadingIcon: AppIcons.location,
                showChevron: false,
              ),
              const Divider(height: 1),
              AppListTile(
                title: formatDocumentDate(document.createdAt),
                subtitle: 'Yaratilgan sana',
                leadingIcon: AppIcons.calendar,
                showChevron: false,
              ),
              const Divider(height: 1),
              AppListTile(
                title: formatFileSize(document.sizeKb),
                subtitle: 'Fayl hajmi',
                leadingIcon: IconsaxPlusLinear.document_text,
                showChevron: false,
              ),
              const Divider(height: 1),
              AppListTile(
                title: '${document.pages}',
                subtitle: 'Sahifalar soni',
                leadingIcon: AppIcons.receipt,
                showChevron: false,
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
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSkeleton(width: 120, height: 14),
          const SizedBox(height: 10),
          const AppSkeleton(width: double.infinity, height: 24),
          const SizedBox(height: 14),
          const AppSkeleton(width: 160),
          const SizedBox(height: 24),
          AppSkeleton(
            width: double.infinity,
            height: 260,
            borderRadius: radius,
          ),
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
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: 'Hujjat topilmadi',
        message: message,
        action: AppButton(
          label: 'Qayta urinish',
          expand: false,
          onPressed: () => context.read<DocumentDetailCubit>().retry(),
        ),
      ),
    );
  }
}
