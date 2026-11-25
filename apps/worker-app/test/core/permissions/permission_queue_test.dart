// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/permissions/permission_queue.dart';

void main() {
  test('the next request waits for the open dialog', () async {
    final first = Completer<int>();
    var secondStarted = false;

    final a = queuedPermissionRequest(() => first.future);
    final b = queuedPermissionRequest(() async {
      secondStarted = true;
      return 2;
    });
    await Future<void>.delayed(Duration.zero);
    expect(secondStarted, isFalse);

    first.complete(1);
    expect(await a, 1);
    expect(await b, 2);
  });

  test('a failed request does not block the queue', () async {
    final a = queuedPermissionRequest<int>(() async => throw StateError('x'));
    await expectLater(a, throwsStateError);
    expect(await queuedPermissionRequest(() async => 3), 3);
  });

  test('a request that never answers is given up after the timeout', () {
    fakeAsync((async) {
      var started = false;
      unawaited(queuedPermissionRequest(() => Completer<void>().future));
      unawaited(queuedPermissionRequest(() async => started = true));
      async.elapse(permissionRequestTimeout - const Duration(seconds: 1));
      expect(started, isFalse);
      async.elapse(const Duration(seconds: 2));
      expect(started, isTrue);
    });
  });
}
