import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/chat/data/chat_people.dart';
import 'package:worker_app/injection.dart';

/// Varaqdagi tezkor amal (masalan "Qo'ng'iroq").
class ChatPersonAction {
  const ChatPersonAction(this.icon, this.label, this.onTap);

  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// Chatdagi odam (yoki suhbat) profili — sarlavha yoki guruhdagi ism
/// bosilganda ochiladi: katta rasm (bosilsa to'liq o'lchamda), ism,
/// lavozim, bo'lim va tezkor amallar.
///
/// [personId] berilsa server kartasi (`/chat/my/people/:id`) yuklanadi;
/// bo'lmasa (guruh, fuqaro suhbati) faqat berilgan ma'lumot ko'rsatiladi.
Future<void> showChatPersonSheet(
  BuildContext context, {
  required String name,
  String? personId,
  String? avatarUrl,
  String? subtitle,
  Color? color,
  List<ChatPersonAction> actions = const [],
}) {
  return showAppSheet<void>(
    context: context,
    title: _t(context, 'Profil', 'Профиль'),
    scrollable: true,
    child: _PersonBody(
      name: name,
      personId: personId,
      avatarUrl: avatarUrl,
      subtitle: subtitle,
      color: color,
      actions: actions,
    ),
  );
}

class _PersonBody extends StatefulWidget {
  const _PersonBody({
    required this.name,
    required this.actions,
    this.personId,
    this.avatarUrl,
    this.subtitle,
    this.color,
  });

  final String name;
  final String? personId;
  final String? avatarUrl;
  final String? subtitle;
  final Color? color;
  final List<ChatPersonAction> actions;

  @override
  State<_PersonBody> createState() => _PersonBodyState();
}

class _PersonBodyState extends State<_PersonBody> {
  ChatPersonCard? _card;
  var _loading = false;

  @override
  void initState() {
    super.initState();
    final id = widget.personId;
    if (id != null && !AppConfig.useMock && getIt.isRegistered<ChatPeople>()) {
      _loading = true;
      getIt<ChatPeople>().card(id).then((card) {
        if (mounted) {
          setState(() {
            _card = card;
            _loading = false;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final card = _card;
    final name = (card?.fullName.isNotEmpty ?? false)
        ? card!.fullName
        : widget.name;
    final photo = card?.avatarUrl ?? widget.avatarUrl;
    final role = card?.position ?? widget.subtitle;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: photo != null,
          label: photo != null ? '$name rasmini kattalashtirish' : null,
          child: GestureDetector(
            onTap: photo == null ? null : () => _zoom(context, photo, name),
            child: AppAvatar(
              name: name,
              photoUrl: photo,
              size: 96,
              color: widget.color,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(name, style: AppTextStyles.h3, textAlign: TextAlign.center),
        const SizedBox(height: 4),
        if (_loading)
          Container(
            width: 140,
            height: 12,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: line,
              borderRadius: BorderRadius.circular(6),
            ),
          )
        else if (role != null && role.isNotEmpty)
          Text(
            role,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: inkSoft),
          ),
        if (card?.department case final dept? when dept.isNotEmpty) ...[
          const SizedBox(height: 10),
          AppChip(label: dept),
        ],
        if (widget.actions.isNotEmpty) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              for (var i = 0; i < widget.actions.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(
                  child: _ActionTile(
                    action: widget.actions[i],
                    line: line,
                    ink: inkSoft,
                  ),
                ),
              ],
            ],
          ),
        ],
        if (card != null && !card.isEmployee) ...[
          const SizedBox(height: 14),
          Text(
            _t(
              context,
              "Hokimiyat ma'muriyati bilan shaxsiy suhbat",
              'Личный чат с администрацией хокимията',
            ),
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(color: inkMuted),
          ),
        ],
        const SizedBox(height: 8),
      ],
    );
  }

  void _zoom(BuildContext context, String url, String name) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        clipBehavior: Clip.antiAlias,
        insetPadding: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: InteractiveViewer(
                child: Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      const Center(child: Icon(AppIcons.imageIcon, size: 40)),
                ),
              ),
            ),
            ListTile(
              title: Text(name, style: AppTextStyles.bodyStrong),
              trailing: IconButton(
                tooltip: _t(ctx, 'Yopish', 'Закрыть'),
                onPressed: () => Navigator.of(ctx).pop(),
                icon: const Icon(AppIcons.close),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.action,
    required this.line,
    required this.ink,
  });

  final ChatPersonAction action;
  final Color line;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: () {
          Navigator.of(context).pop();
          action.onTap();
        },
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: line),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(action.icon, color: AppColors.primary, size: 22),
              const SizedBox(height: 4),
              Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  color: ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;
