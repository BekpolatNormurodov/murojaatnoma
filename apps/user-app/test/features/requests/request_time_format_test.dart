import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/requests/presentation/widgets/citizen_request_card.dart';

void main() {
  test('server UTC timestamps are shown in the local time of the phone', () {
    final local = DateTime(2026, 11, 25, 0, 30);
    final iso = local.toUtc().toIso8601String();

    expect(formatIsoDate(iso), formatDate(local));
    expect(formatIsoDateTime(iso), '${formatDate(local)}, 00:30');
  });
}
