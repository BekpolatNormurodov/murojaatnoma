import 'package:app_ui/app_ui.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  blocTest<ThemeCubit, ThemeMode>(
    'setMode(dark) emits ThemeMode.dark and persists',
    build: ThemeCubit.new,
    act: (c) => c.setMode(ThemeMode.dark),
    expect: () => [ThemeMode.dark],
    verify: (_) async {
      final p = await SharedPreferences.getInstance();
      expect(p.getString('app-theme'), 'dark');
    },
  );
}
