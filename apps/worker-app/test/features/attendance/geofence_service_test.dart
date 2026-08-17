import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

void main() {
  group('GeofenceService', () {
    final g = GeofenceService();

    // Step 1 tests
    test('same point distance ~0 and inside', () {
      final dist = g.distanceMeters(41.3111, 69.3402, 41.3111, 69.3402);
      expect(dist, closeTo(0, 1));
      expect(g.isInside(41.3111, 69.3402), isTrue);
    });

    test('point ~2km away is outside 150m', () {
      expect(g.isInside(41.33, 69.36), isFalse);
    });

    // Additional tests (robustness)
    test('geofence boundary is inclusive (<=)', () {
      // ~100m north
      final d = g.distanceMeters(41.3111, 69.3402, 41.3120, 69.3402);
      // exactly d → inside
      expect(g.isInside(41.3120, 69.3402, radius: d), isTrue);
      // slightly less → outside
      expect(g.isInside(41.3120, 69.3402, radius: d - 1), isFalse);
    });

    test('AttendanceDay round-trips including null times', () {
      const d = AttendanceDay(
        date: '2026-07-24',
        checkIn: null,
        checkOut: null,
        status: AttendanceStatus.present,
        hours: 8,
        insideGeofence: true,
        selfConfirmed: false,
        confirmedAt: null,
      );
      expect(AttendanceDay.fromJson(d.toJson()), d); // Equatable round-trip
    });

    test('fromJson accepts integer hours JSON (regression)', () {
      final json = {
        'date': '2026-07-24',
        'check_in': null,
        'check_out': null,
        'status': 'late',
        'hours': 8, // integer in JSON
        'inside_geofence': false,
        'self_confirmed': false,
        'confirmed_at': null,
      };
      final d = AttendanceDay.fromJson(json);
      expect(d.hours, 8.0);
      expect(d.status, AttendanceStatus.late);
    });
  });
}
