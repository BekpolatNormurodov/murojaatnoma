// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/permissions/permission_queue.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

void main() {
  test('an unanswered permission request does not block later starts', () {
    fakeAsync((async) {
      var asked = 0;
      final service = LocationTrackingService(
        Dio(),
        ensurePermission: () {
          asked++;
          return Completer<bool>().future;
        },
        hasPermission: () async => false,
      );
      bool? first;
      unawaited(service.start().then((v) => first = v));
      async.elapse(permissionRequestTimeout + const Duration(seconds: 1));

      expect(first, isFalse);
      expect(service.status.value, TrackingStatus.blocked);
      unawaited(service.start());
      async.flushMicrotasks();
      expect(asked, 2);
    });
  });
}
