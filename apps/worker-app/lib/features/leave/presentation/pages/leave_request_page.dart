import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';
import 'package:worker_app/features/leave/presentation/widgets/amount_stepper.dart';

/// "Javob so'rash" — xodim ish vaqtidan (soatlab yoki kunlab) ozod
/// bo'lishni so'raydigan TO'LIQ EKRANLI sahifa.
///
/// MOCK-FIRST: HAQIQIY backend/repository YO'Q — yuborish qisqa kechikish
/// bilan simulyatsiya qilinadi (`SubmitSuggestionPage` bilan bir xil
/// darajadagi "bitta martalik amal" — lekin u yerda usecase HAQIQIY,
/// bu yerda esa hali yo'q, shuning uchun to'g'ridan-to'g'ri
/// `Future.delayed`). Validatsiya mantig'i sof funksiyalarga
/// ([LeaveRequestValidation]) ajratilgan — widget testlarisiz ham
/// sinaladi.
class LeaveRequestPage extends StatefulWidget {
  const LeaveRequestPage({super.key});

  @override
  State<LeaveRequestPage> createState() => _LeaveRequestPageState();
}

class _LeaveRequestPageState extends State<LeaveRequestPage> {
  final _reasonController = TextEditingController();

  var _type = LeaveDurationType.hours;
  var _amount = LeaveRequestValidation.minAmount;
  var _startDate = DateTime.now();
  TimeOfDay? _startTime;
  String? _reasonError;
  var _submitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _onTypeChanged(LeaveDurationType type) {
    setState(() {
      _type = type;
      _amount = LeaveRequestValidation.clamp(_amount, type);
      if (type == LeaveDurationType.days) _startTime = null;
    });
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate.isBefore(today) ? today : _startDate,
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (picked != null && mounted) setState(() => _startDate = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime ?? TimeOfDay.now(),
    );
    if (picked != null && mounted) setState(() => _startTime = picked);
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final reasonText = _reasonController.text;
    final valid = LeaveRequestValidation.isReasonValid(reasonText);
    setState(
      () => _reasonError = valid ? null : l10n.leaveRequestReasonEmptyError,
    );
    if (!valid) return;

    setState(() => _submitting = true);
    // Real backend hali yo'q — mock muvaffaqiyatli javobni simulyatsiya
    // qilamiz (qisqa tarmoq-kechikishi kabi).
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() => _submitting = false);

    await AppDialog.success(
      context: context,
      title: l10n.leaveRequestSuccessTitle,
      message: l10n.leaveRequestSuccessMessage,
      buttonLabel: l10n.closeLabel,
    );
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final unitLabel = _type == LeaveDurationType.hours
        ? l10n.leaveRequestHoursUnit
        : l10n.leaveRequestDaysUnit;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.leaveRequestPageTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            _SectionTitle(l10n.leaveRequestDurationTypeLabel),
            const SizedBox(height: 8),
            AppSegmented<LeaveDurationType>(
              value: _type,
              segments: [
                AppSegment(
                  value: LeaveDurationType.hours,
                  label: l10n.leaveRequestDurationHours,
                  icon: AppIcons.clock,
                ),
                AppSegment(
                  value: LeaveDurationType.days,
                  label: l10n.leaveRequestDurationDays,
                  icon: AppIcons.calendar,
                ),
              ],
              onChanged: _onTypeChanged,
            ),
            const SizedBox(height: 20),
            _SectionTitle(l10n.leaveRequestAmountLabel),
            const SizedBox(height: 8),
            AppCard(
              child: AmountStepper(
                value: _amount,
                unitLabel: unitLabel,
                min: LeaveRequestValidation.minAmount,
                max: LeaveRequestValidation.maxAmount(_type),
                onChanged: (value) => setState(() => _amount = value),
              ),
            ),
            const SizedBox(height: 20),
            _SectionTitle(l10n.leaveRequestStartDateLabel),
            const SizedBox(height: 8),
            AppCard(
              padding: const EdgeInsets.symmetric(
                vertical: 4,
                horizontal: 8,
              ),
              child: AppListTile(
                title: l10n.leaveRequestStartDateLabel,
                subtitle: formatDate(_startDate),
                leadingIcon: AppIcons.calendar,
                onTap: _pickDate,
              ),
            ),
            if (_type == LeaveDurationType.hours) ...[
              const SizedBox(height: 12),
              AppCard(
                padding: const EdgeInsets.symmetric(
                  vertical: 4,
                  horizontal: 8,
                ),
                child: AppListTile(
                  title: l10n.leaveRequestStartTimeLabel,
                  subtitle: _startTime == null
                      ? '--:--'
                      : _startTime!.format(context),
                  leadingIcon: AppIcons.clock,
                  onTap: _pickTime,
                ),
              ),
            ],
            const SizedBox(height: 20),
            _SectionTitle(l10n.leaveRequestReasonLabel),
            const SizedBox(height: 8),
            AppTextField(
              hint: l10n.leaveRequestReasonHint,
              controller: _reasonController,
              maxLines: 5,
              errorText: _reasonError,
              onChanged: (_) {
                if (_reasonError != null) {
                  setState(() => _reasonError = null);
                }
              },
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(AppIcons.info, size: 16, color: mutedColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n.leaveRequestMaxNote,
                    style: AppTextStyles.caption.copyWith(color: mutedColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            AppButton(
              label: l10n.leaveRequestSubmitCta,
              icon: AppIcons.send,
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bo'lim sarlavhasi — `RequestDetailPage._SectionTitle` bilan bir xil
/// naqsh.
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
