import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';

void main() {
  group(DailyReport, () {
    test('parses the POST/GET /daily-reports shape', () {
      final report = DailyReport.fromJson(const {
        'id': 'r1',
        'employeeId': 'e1',
        'day': '2026-11-24',
        'text': 'Ish qilindi',
        'createdAt': '2026-11-24T13:05:00.000Z',
        'attachments': [
          {
            'kind': 'voice',
            'url': '/uploads/a.m4a',
            'fileName': 'a.m4a',
            'fileSize': 2048,
            'durationSec': 12,
          },
          {'kind': 'file', 'url': '/uploads/b.pdf', 'fileName': 'b.pdf'},
          {'kind': 'image', 'url': 'https://x/c.jpg'},
          {'kind': 'video', 'url': '/uploads/d.mp4', 'durationSec': 30},
        ],
      });

      expect(report.id, 'r1');
      expect(report.employeeId, 'e1');
      expect(report.day, '2026-11-24');
      expect(report.text, 'Ish qilindi');
      expect(report.createdAt.isUtc, isFalse);
      expect(
        report.createdAt.toUtc(),
        DateTime.utc(2026, 11, 24, 13, 5),
      );
      expect(report.attachments, hasLength(4));
      expect(report.attachments[0].kind, ReportAttachmentKind.voice);
      expect(report.attachments[0].durationSec, 12);
      expect(report.attachments[0].fileSize, 2048);
      expect(report.attachments[1].kind, ReportAttachmentKind.file);
      expect(report.attachments[2].kind, ReportAttachmentKind.image);
      expect(report.attachments[3].kind, ReportAttachmentKind.video);
    });

    test('tolerates a full ISO day, missing text and attachments', () {
      final report = DailyReport.fromJson(const {
        'id': 7,
        'day': '2026-11-20T00:00:00.000Z',
        'createdAt': '2026-11-20T10:00:00.000Z',
        'text': null,
      });
      expect(report.id, '7');
      expect(report.day, '2026-11-20');
      expect(report.text, '');
      expect(report.attachments, isEmpty);
    });

    test('unknown attachment kind falls back to file; toJson omits nulls', () {
      final a = ReportAttachment.fromJson(const {'kind': 'gif', 'url': '/u/x'});
      expect(a.kind, ReportAttachmentKind.file);
      expect(a.toJson(), {'kind': 'file', 'url': '/u/x'});

      const voice = ReportAttachment(
        kind: ReportAttachmentKind.voice,
        url: '/u/v.m4a',
        fileName: 'v.m4a',
        fileSize: 10,
        durationSec: 3,
      );
      expect(voice.toJson(), {
        'kind': 'voice',
        'url': '/u/v.m4a',
        'fileName': 'v.m4a',
        'fileSize': 10,
        'durationSec': 3,
      });
    });

    test('canDeleteOn is true only on the local day it was sent', () {
      final report = DailyReport(
        id: 'r',
        day: '2026-11-25',
        createdAt: DateTime(2026, 11, 25, 9, 30),
      );
      expect(report.canDeleteOn(DateTime(2026, 11, 25, 23, 59)), isTrue);
      expect(report.canDeleteOn(DateTime(2026, 11, 26, 0, 1)), isFalse);
    });
  });

  group(ZoneTimeReport, () {
    test('parses days, totals and stretches', () {
      final report = ZoneTimeReport.fromJson(const {
        'gapMinutes': 15,
        'days': [
          {
            'date': '2026-11-25',
            'zoneMinutes': 320,
            'outsideMinutes': 45,
            'activeMinutes': 365,
            'firstAt': '2026-11-25T04:12:00.000Z',
            'lastAt': '2026-11-25T10:17:00.000Z',
            'byMahalla': [
              {'name': 'Bodomzor', 'minutes': 172, 'inside': true},
              {'name': null, 'minutes': 45, 'inside': false},
            ],
            'stretches': [
              {
                'from': '2026-11-25T04:12:00.000Z',
                'to': '2026-11-25T06:40:00.000Z',
                'minutes': 148,
                'inside': true,
                'mahallaName': 'Olmazor',
              },
              {
                'from': '2026-11-25T06:40:00.000Z',
                'to': '2026-11-25T07:25:00.000Z',
                'minutes': 45,
                'inside': false,
                'mahallaName': null,
              },
            ],
          },
          {
            'date': '2026-11-24',
            'zoneMinutes': 0,
            'outsideMinutes': 0,
            'activeMinutes': 0,
            'firstAt': null,
            'lastAt': null,
            'stretches': <dynamic>[],
          },
        ],
      });

      expect(report.gapMinutes, 15);
      expect(report.days, hasLength(2));
      final day = report.days.first;
      expect(day.date, '2026-11-25');
      expect(day.zoneMinutes, 320);
      expect(day.outsideMinutes, 45);
      expect(day.activeMinutes, 365);
      expect(day.firstAt!.toUtc(), DateTime.utc(2026, 11, 25, 4, 12));
      expect(day.isEmpty, isFalse);
      expect(day.stretches, hasLength(2));
      expect(day.stretches[0].inside, isTrue);
      expect(day.stretches[0].mahallaName, 'Olmazor');
      expect(day.stretches[0].minutes, 148);
      expect(day.stretches[1].inside, isFalse);
      expect(day.stretches[1].mahallaName, isNull);

      expect(day.byMahalla, hasLength(2));
      expect(day.byMahalla[0].label, 'Bodomzor');
      expect(day.byMahalla[0].minutes, 172);
      expect(day.byMahalla[0].inside, isTrue);
      expect(day.byMahalla[1].name, isNull);
      expect(day.byMahalla[1].label, 'Tuman tashqarisi');
      expect(day.byMahalla[1].inside, isFalse);

      final empty = report.days.last;
      expect(empty.byMahalla, isEmpty, reason: 'optional field');
      expect(empty.isEmpty, isTrue);
      expect(empty.firstAt, isNull);
      expect(empty.stretches, isEmpty);
    });

    test('missing fields default to zeros / 15 min gap', () {
      final report = ZoneTimeReport.fromJson(const {
        'days': [
          {'date': '2026-11-23'},
        ],
      });
      expect(report.gapMinutes, 15);
      expect(report.days.single.zoneMinutes, 0);
      expect(report.days.single.isEmpty, isTrue);
      expect(ZoneTimeReport.fromJson(const {}).days, isEmpty);
    });
  });
}
