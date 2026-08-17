import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:worker_app/features/requests/presentation/widgets/attachment_picker.dart';

/// "Murojaatga javob" — TO'LIQ EKRANLI sahifa (ilgari `request_detail_page`
/// ichidagi tor pastki varaq — `showAppSheet` — edi, endi alohida sahifa,
/// klaviatura ochilganda ko'proq joy va aniqroq fokus beradi).
///
/// Konstruktor parametrsiz: kerakli [RequestDetailCubit] YUQORIDA — router
/// darajasida — `extra` orqali uzatilgan XUDDI SHU instansiya sifatida
/// ta'minlangan (`BlocProvider.value`, qarang: `app_router.dart`). Shu
/// tufayli murojaatni qayta yuklashning hojati yo'q va muvaffaqiyatli
/// javobdan so'ng ortga qaytilganda tafsilot sahifasi allaqachon yangilangan
/// holatni ko'rsatadi (`RequestDetailCubit._mutate` — qarang: cubit).
class RequestRespondPage extends StatefulWidget {
  const RequestRespondPage({super.key});

  @override
  State<RequestRespondPage> createState() => _RequestRespondPageState();
}

class _RequestRespondPageState extends State<RequestRespondPage> {
  final _controller = TextEditingController();
  var _attachments = <AttachmentRef>[];
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _errorText = l10n.requestResponseEmptyError);
      return;
    }

    final cubit = context.read<RequestDetailCubit>();
    final error = await cubit.respond(text, _attachments);
    if (!mounted) return;

    if (error == null) {
      await AppDialog.success(
        context: context,
        title: l10n.requestRespondSuccessTitle,
        message: l10n.requestRespondSuccessMessage,
        buttonLabel: l10n.closeLabel,
      );
      if (mounted) context.pop();
    } else {
      AppAlert.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final state = context.watch<RequestDetailCubit>().state;
    final submitting = state is RequestDetailLoaded && state.submitting;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.requestRespondPageTitle, style: AppTextStyles.h3),
      ),
      // `ListView` (klaviatura-xavfsiz) — matn maydoni fokus olganda
      // klaviatura hech qachon uni yopib qo'ymaydi, sahifa erkin skroll
      // qiladi.
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            AppTextField(
              label: l10n.requestResponseHint,
              hint: l10n.requestResponseHint,
              controller: _controller,
              maxLines: 6,
              autofocus: true,
              errorText: _errorText,
              onChanged: (_) {
                if (_errorText != null) setState(() => _errorText = null);
              },
            ),
            const SizedBox(height: 16),
            AttachmentPicker(
              attachments: _attachments,
              onChanged: (value) => setState(() => _attachments = value),
            ),
            const SizedBox(height: 28),
            AppButton(
              label: l10n.requestSendResponse,
              icon: AppIcons.send,
              loading: submitting,
              onPressed: submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
