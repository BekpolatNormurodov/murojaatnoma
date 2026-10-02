import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/injection.dart';

/// "Shaxsiy ma'lumotlar" — xodim o'zi haqida tizimda nima saqlanganini
/// ko'radi: kimligi, ish tartibi (server qiymati), qayerdan keldi-ketdi
/// qabul qilinadi va yuz holati. Tahrirlash — hokimiyat administratorida.
class PersonalInfoPage extends StatefulWidget {
  const PersonalInfoPage({super.key});

  @override
  State<PersonalInfoPage> createState() => _PersonalInfoPageState();
}

class _PersonalInfoPageState extends State<PersonalInfoPage> {
  MyAttendance? _work;

  @override
  void initState() {
    super.initState();
    if (getIt.isRegistered<AttendanceRepository>()) {
      getIt<AttendanceRepository>().myAttendance().then((r) {
        if (mounted) r.fold((_) {}, (w) => setState(() => _work = w));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final session = context.watch<AuthCubit>().state.session;
    final w = _work;
    final name = session?.name ?? '';
    final phone = session?.phone ?? '';
    final radius = w?.officeRadiusM;
    final hours = w != null && w.workStartTime.isNotEmpty
        ? '${w.workStartTime}–${w.workEndTime.isEmpty ? '18:00' : w.workEndTime}'
        : null;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(_t(context, "Shaxsiy ma'lumotlar", 'Личные данные')),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Center(
              child: AppAvatar(
                name: name.isEmpty ? '?' : name,
                photoUrl: session?.avatarUrl,
                size: 96,
              ),
            ),
            const SizedBox(height: 12),
            Text(name, textAlign: TextAlign.center, style: AppTextStyles.h2),
            const SizedBox(height: 2),
            Text(
              session?.position ?? '',
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(
                color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
              ),
            ),
            const SizedBox(height: 22),
            _Group(
              title: _t(context, 'Kimligi', 'Личность'),
              rows: [
                _Row(AppIcons.profile, _t(context, 'F.I.Sh.', 'Ф.И.О.'), name),
                _Row(
                  AppIcons.tasks,
                  _t(context, 'Lavozim', 'Должность'),
                  session?.position ?? '—',
                ),
                _Row(
                  AppIcons.building,
                  _t(context, "Bo'lim", 'Отдел'),
                  (w?.department ?? '').isEmpty ? '—' : w!.department,
                ),
                _Row(
                  AppIcons.call,
                  _t(context, 'Telefon', 'Телефон'),
                  phone.isEmpty || phone.startsWith('+99800') ? '—' : phone,
                ),
                _Row(
                  AppIcons.location,
                  _t(context, 'Tuman', 'Район'),
                  (session?.district ?? '').isEmpty
                      ? "Mirzo Ulug'bek"
                      : session!.district!,
                ),
              ],
            ),
            const SizedBox(height: 16),
            _Group(
              title: _t(context, 'Ish tartibi', 'Режим работы'),
              rows: [
                _Row(
                  AppIcons.timer,
                  _t(context, 'Ish vaqti', 'Рабочее время'),
                  hours ?? '…',
                ),
                _Row(
                  AppIcons.map,
                  _t(context, 'Ish hududi', 'Рабочая зона'),
                  w == null
                      ? '…'
                      : w.zonesCount > 0
                      ? _t(
                          context,
                          '${w.zonesCount} ta mahalla',
                          '${w.zonesCount} махалли',
                        )
                      : _t(context, 'Butun tuman', 'Весь район'),
                ),
                _Row(
                  AppIcons.building,
                  _t(context, 'Keldi-ketdi', 'Отметка'),
                  radius == null
                      ? _t(
                          context,
                          'Ofis yoki mahallangizdan',
                          'Из офиса или махалли',
                        )
                      : _t(
                          context,
                          'Ofisdan $radius m ichida yoki mahallangizda',
                          'В $radius м от офиса или в махалле',
                        ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _Group(
              title: _t(context, 'Yuz tasdiqlash', 'Подтверждение лица'),
              rows: [
                _Row(
                  AppIcons.scan,
                  _t(context, 'Holati', 'Статус'),
                  (session?.hasFace ?? false)
                      ? _t(context, "Ro'yxatdan o'tgan", 'Зарегистрировано')
                      : _t(
                          context,
                          "Ro'yxatdan o'tmagan",
                          'Не зарегистрировано',
                        ),
                ),
              ],
              footer: AppButton(
                label: (session?.hasFace ?? false)
                    ? _t(context, 'Yuzni yangilash', 'Обновить лицо')
                    : _t(
                        context,
                        "Yuzni ro'yxatdan o'tkazish",
                        'Зарегистрировать лицо',
                      ),
                icon: AppIcons.scan,
                variant: AppButtonVariant.secondary,
                onPressed: () => context.push('/face/enroll'),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _t(
                context,
                "Ma'lumot noto'g'ri bo'lsa — hokimiyat administratoriga murojaat qiling.",
                'Если данные неверны — обратитесь к администратору хокимията.',
              ),
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(
                color: isDark ? AppColors.darkInkMuted : AppColors.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row {
  const _Row(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.rows, this.footer});

  final String title;
  final List<_Row> rows;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.label.copyWith(color: inkSoft)),
        const SizedBox(height: 8),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(rows[i].icon, size: 20, color: AppColors.primary),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 96,
                        child: Text(
                          rows[i].label,
                          style: AppTextStyles.body.copyWith(color: inkMuted),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          rows[i].value,
                          textAlign: TextAlign.right,
                          style: AppTextStyles.bodyStrong,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (footer != null) ...[
                const SizedBox(height: 4),
                footer!,
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;
