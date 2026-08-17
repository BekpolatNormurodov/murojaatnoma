import 'package:flutter/material.dart';

/// Klaviatura-xavfsiz forma tanasi.
///
/// To'liq sahifali formalar uchun qayta ishlatiladigan konteyner:
/// `SingleChildScrollView` (`keyboardDismissBehavior: onDrag`) + pastki
/// `viewInsets` bo'yicha bo'shliq + `SafeArea` — shu bilan sahifadagi
/// har qanday forma maydoni klaviatura ochilganda undan yuqoriga aylanib
/// chiqadi (scroll qilib yetish mumkin bo'ladi), hech qachon klaviatura
/// orqasida yashirin qolmaydi.
///
/// [child] yoki [children]dan faqat bittasi beriladi ([children] ustunda —
/// `Column` — tepadan-pastga chiziladi). Ixtiyoriy [actionBar] berilsa
/// (masalan asosiy `AppButton`), u pastda klaviatura ustida "yopishib"
/// turadigan, aylanmaydigan panel sifatida ko'rsatiladi.
///
/// Odatda `Scaffold.body` sifatida ishlatiladi:
/// ```dart
/// Scaffold(
///   appBar: AppBar(title: const Text('Ariza')),
///   body: AppFormScaffold(
///     children: const [AppTextField(label: 'Sarlavha'), ...],
///     actionBar: AppButton(label: 'Yuborish', onPressed: submit),
///   ),
/// )
/// ```
///
/// `Scaffold`ning standart `resizeToAvoidBottomInset: true` xatti-harakati
/// bilan ham to'g'ri ishlaydi: `Scaffold` klaviatura ochilganda `body`
/// maydonini o'zi qisqartiradi va shu maydon uchun `viewInsets`ni nolga
/// tenglashtiradi (`ikki karra bo'shliq` xavfi yo'q) — bu holda
/// klaviatura-xavfsizlikni asosan `SingleChildScrollView` ta'minlaydi.
/// Agar `Scaffold`da `resizeToAvoidBottomInset: false` qo'yilsa (masalan
/// klaviatura ustida "yopishib" turuvchi [actionBar] silliqroq ishlashi
/// uchun), bu vidjetning o'zi klaviatura balandligini pastki bo'shliq
/// sifatida qo'shib, kontentni klaviaturadan yuqoriga suradi.
class AppFormScaffold extends StatelessWidget {
  const AppFormScaffold({
    super.key,
    this.child,
    this.children,
    this.actionBar,
    this.padding = const EdgeInsets.fromLTRB(20, 24, 20, 24),
    this.actionBarPadding = const EdgeInsets.fromLTRB(20, 12, 20, 12),
    this.keyboardDismissBehavior = ScrollViewKeyboardDismissBehavior.onDrag,
    this.physics,
  }) : assert(
         child == null || children == null,
         'AppFormScaffold: provide either child or children, not both.',
       );

  /// Yagona forma tanasi ([children] berilmaganda ishlatiladi).
  final Widget? child;

  /// Bir nechta forma bo'laklari — tepadan-pastga (`Column`) chiziladi.
  final List<Widget>? children;

  /// Ixtiyoriy, klaviatura ustida "yopishib" turadigan pastki panel
  /// (masalan asosiy amal tugmasi) — aylanmaydi, doim ko'rinadi.
  final Widget? actionBar;

  /// Aylanuvchi kontent atrofidagi bo'shliq (pastki `viewInsets`
  /// avtomatik qo'shiladi).
  final EdgeInsetsGeometry padding;

  /// [actionBar] atrofidagi bo'shliq (pastki `viewInsets` avtomatik
  /// qo'shiladi).
  final EdgeInsetsGeometry actionBarPadding;

  /// Aylanuvchi maydonga urilganda klaviaturani yopish xatti-harakati.
  final ScrollViewKeyboardDismissBehavior keyboardDismissBehavior;

  /// Aylanish (scroll) fizikasi — berilmasa platforma standarti ishlatiladi.
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final content = children != null
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children!,
          )
        : (child ?? const SizedBox.shrink());

    final scrollArea = SafeArea(
      top: false,
      bottom: actionBar == null,
      child: SingleChildScrollView(
        keyboardDismissBehavior: keyboardDismissBehavior,
        physics: physics,
        padding: padding.add(EdgeInsets.only(bottom: bottomInset)),
        child: content,
      ),
    );

    if (actionBar == null) return scrollArea;

    return Column(
      children: [
        Expanded(child: scrollArea),
        SafeArea(
          top: false,
          child: Padding(
            padding: actionBarPadding.add(EdgeInsets.only(bottom: bottomInset)),
            child: actionBar,
          ),
        ),
      ],
    );
  }
}
