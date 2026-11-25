import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';

void main() {
  String sent(String name) =>
      ReportAttachment(
            kind: ReportAttachmentKind.file,
            url: '/uploads/a.pdf',
            fileName: name,
          ).toJson()['fileName']!
          as String;

  test('a very long file name is cut to the server limit', () {
    final long = '${'a' * 300}.pdf';
    expect(sent(long), hasLength(200));
    expect(sent(long), endsWith('.pdf'));
    expect(sent('Dalolatnoma.pdf'), 'Dalolatnoma.pdf');
    // Never splits a surrogate pair.
    final emoji = '${'a' * 195}\u{1F600}${'b' * 20}.pdf';
    expect(sent(emoji), '${'a' * 195}.pdf');
  });
}
