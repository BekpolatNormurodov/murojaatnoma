import 'dart:ui';
import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  blocTest<LocaleCubit, Locale>(
    'setLocale(ru) emits ru and persists',
    build: LocaleCubit.new,
    act: (c) => c.setLocale(const Locale('ru')),
    expect: () => [const Locale('ru')],
    verify: (_) async {
      final p = await SharedPreferences.getInstance();
      expect(p.getString('app-lang'), 'ru');
    },
  );
}
