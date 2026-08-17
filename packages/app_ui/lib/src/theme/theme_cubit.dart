import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Ilova mavzu rejimini (`ThemeMode`) boshqaradi va `SharedPreferences`
/// ichida saqlaydi.
class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit() : super(ThemeMode.light);

  static const _key = 'app-theme';

  /// Saqlangan mavzu rejimini `SharedPreferences`dan yuklaydi.
  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    emit(switch (p.getString(_key)) {
      'dark' => ThemeMode.dark,
      'system' => ThemeMode.system,
      _ => ThemeMode.light,
    });
  }

  /// Mavzu rejimini o'rnatadi va `SharedPreferences`ga saqlaydi.
  Future<void> setMode(ThemeMode mode) async {
    emit(mode);
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, mode.name);
  }
}
