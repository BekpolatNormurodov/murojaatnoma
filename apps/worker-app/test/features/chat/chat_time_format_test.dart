import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/requests/presentation/widgets/application_card.dart';

void main() {
  test('server UTC timestamps are shown in the local time of the phone', () {
    final iso = DateTime(2026, 11, 25, 0, 30).toUtc().toIso8601String();

    expect(chatTimeLabel(iso), '00:30');
    expect(formatIsoDateTime(iso), endsWith(', 00:30'));
  });
}
