import 'dart:ui';

import 'package:app_ui/app_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('brand primary is emerald 0xFF10B981', () {
    expect(AppColors.primary, const Color(0xFF10B981));
    expect(AppColors.accent, const Color(0xFF3B82F6));
    expect(AppColors.darkCanvas, const Color(0xFF0B1220));
  });
}
