import 'dart:ui';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Ilova tilini (`Locale`) boshqaradi va `SharedPreferences` ichida saqlaydi.
class LocaleCubit extends Cubit<Locale> {
  LocaleCubit() : super(const Locale('uz'));

  static const _key = 'app-lang';

  /// Saqlangan tilni `SharedPreferences`dan yuklaydi.
  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    emit(switch (p.getString(_key)) {
      'ru' => const Locale('ru'),
      _ => const Locale('uz'),
    });
  }

  /// Tilni o'rnatadi va `SharedPreferences`ga saqlaydi.
  Future<void> setLocale(Locale locale) async {
    emit(locale);
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, locale.languageCode);
  }
}
