import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/presentation/bloc/documents_cubit.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_card.dart';

/// "Hujjatlar" sahifasi — rasmiy hujjatlar ro'yxati: tur/holat bo'yicha
/// filtr varag'i + hujjat kartalari. `DocumentsCubit`ning barcha
/// holatlari (yuklanish/bo'sh/xato/yuklandi) shu yerda ko'rsatiladi —
/// hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, ro'yxatdan (masalan bosh sahifadagi "Tezkor"
/// tugmalari) PUSH qilinadigan to'liq ekranli sahifa — `MeetingsPage`
/// bilan bir xil naqsh: o'z `AppBar`i + `AppBackButton`.
class DocumentsPage extends StatelessWidget {
  const DocumentsPage({super.key});

  void _openDetail(BuildContext context, String id) {
    context.push('/documents/$id');
  }

  Future<void> _openFilterSheet(BuildContext context) async {
    final cubit = context.read<DocumentsCubit>();
    var draftType = cubit.typeFilter;
    var draftStatus = cubit.statusFilter;

    await showAppFilterSheet(
      context: context,
      title: 'Filtr',
      sections: [
        StatefulBuilder(
          builder: (sheetContext, setSheetState) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppSelect<DocumentType?>(
                label: 'Hujjat turi',
                hint: 'Barchasi',
                searchable: false,
                value: draftType,
                options: [
                  const AppSelectOption(value: null, label: 'Barchasi'),
                  for (final type in DocumentType.values)
                    AppSelectOption(value: type, label: type.label),
                ],
                onChanged: (value) => setSheetState(() => draftType = value),
              ),
              const SizedBox(height: 20),
              AppSelect<DocumentStatus?>(
                label: 'Holati',
                hint: 'Barchasi',
                searchable: false,
                value: draftStatus,
                options: [
                  const AppSelectOption(value: null, label: 'Barchasi'),
                  for (final status in DocumentStatus.values)
                    AppSelectOption(value: status, label: status.label),
                ],
                onChanged: (value) =>
                    setSheetState(() => draftStatus = value),
              ),
            ],
          ),
        ),
      ],
      onApply: () => cubit.load(type: draftType, status: draftStatus),
      onReset: cubit.load,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.watch<DocumentsCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text('Hujjatlar', style: AppTextStyles.h3),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _FilterButton(
              active: cubit.hasActiveFilters,
              onTap: () => _openFilterSheet(context),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: switch (cubit.state) {
          DocumentsLoading() => const AppSkeletonList(
            key: Key('documents_skeleton'),
          ),
          DocumentsError(:final message) => _DocumentsErrorView(
            message: message,
            onRetry: cubit.reload,
          ),
          DocumentsEmpty() => _DocumentsEmptyView(
            hasFilters: cubit.hasActiveFilters,
          ),
          DocumentsLoaded(:final items) => RefreshIndicator(
            onRefresh: cubit.reload,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              itemCount: items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final document = items[index];
                return DocumentCard(
                  document: document,
                  onTap: () => _openDetail(context, document.id),
                );
              },
            ),
          ),
        },
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.onTap, this.active = false});

  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppColors.primary.withValues(alpha: 0.12) : surface,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          border: Border.all(color: active ? AppColors.primary : line),
        ),
        child: Icon(
          IconsaxPlusLinear.filter,
          size: 20,
          color: active ? AppColors.primary : inkSoft,
        ),
      ),
    );
  }
}

class _DocumentsEmptyView extends StatelessWidget {
  const _DocumentsEmptyView({required this.hasFilters});

  final bool hasFilters;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: IconsaxPlusLinear.document_text,
      title: 'Hujjatlar topilmadi',
      message: hasFilters
          ? "Tanlangan filtrga mos hujjat yo'q — filtrni o'zgartiring."
          : "Hozircha hech qanday hujjat yo'q.",
    );
  }
}

class _DocumentsErrorView extends StatelessWidget {
  const _DocumentsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: 'Xatolik yuz berdi',
        message: message,
        action: AppButton(
          label: 'Qayta urinish',
          expand: false,
          onPressed: onRetry,
        ),
      ),
    );
  }
}
