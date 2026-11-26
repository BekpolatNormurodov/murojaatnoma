// ignore_for_file: lines_longer_than_80_chars, deprecated_member_use
// Shared helpers for the end-to-end suites. Runs against a LOCAL backend only.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider/path_provider.dart';

import 'fakes.dart';

const apiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3555',
);
const adminUser = String.fromEnvironment('E2E_ADMIN_USER');
const adminPassword = String.fromEnvironment('E2E_ADMIN_PASSWORD');

bool _isLocal(String host) =>
    host == '127.0.0.1' || host == 'localhost' || host == '::1';

/// Every `dart:io` connection to a non-loopback host fails before a socket is
/// opened. Blocked hosts are recorded in [blockedHosts].
class LocalOnlyHttpOverrides extends HttpOverrides {
  static final Set<String> blockedHosts = {};

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    client.findProxy = (_) => 'DIRECT';
    client.connectionFactory = (uri, proxyHost, proxyPort) {
      if (!_isLocal(uri.host)) {
        blockedHosts.add(uri.host);
        throw SocketException('E2E: remote host blocked: ${uri.host}');
      }
      return Socket.startConnect(uri.host, uri.port);
    };
    return client;
  }
}

void requireLocalBackend() {
  if (!_isLocal(Uri.parse(apiBase).host)) {
    throw StateError('E2E may only run against a local backend: $apiBase');
  }
  if (adminUser.isEmpty || adminPassword.isEmpty) {
    throw StateError('Pass E2E_ADMIN_USER and E2E_ADMIN_PASSWORD');
  }
}

/// `google_fonts` downloads Inter at first use; with remote hosts blocked that
/// is an uncaught error. If `<E2E_FIXTURES>/fonts.txt` lists the expected cache
/// file names, `font.ttf` is placed there under each name before the app starts.
Future<void> seedFontCache() async {
  await fetchFixtures(const [
    'fonts.txt',
    'font.ttf',
    'photo.jpg',
    'video.mp4',
    'voice.m4a',
    'document.pdf',
  ]);
  final dir = fixturesDir;
  final list = File('$dir/fonts.txt');
  if (!list.existsSync()) return;
  final support = await getApplicationSupportDirectory();
  await support.create(recursive: true);
  for (final name in list.readAsLinesSync()) {
    File('$dir/font.ttf').copySync('${support.path}/$name.ttf');
  }
}

class ApiResponse {
  ApiResponse(this.status, this.body);
  final int status;
  final dynamic body;
}

/// Plain API client used to seed data and to confirm server-side state.
Future<ApiResponse> api(
  String method,
  String path, {
  String? token,
  Object? body,
}) async {
  final client = HttpClient();
  try {
    final request = await client.openUrl(method, Uri.parse('$apiBase$path'));
    if (token != null) {
      request.headers.set('authorization', 'Bearer $token');
    }
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.add(utf8.encode(jsonEncode(body)));
    }
    final response = await request.close();
    final text = await utf8.decodeStream(response);
    dynamic decoded = text;
    try {
      decoded = text.isEmpty ? null : jsonDecode(text);
    } on FormatException {
      // keep raw text
    }
    return ApiResponse(response.statusCode, decoded);
  } finally {
    client.close(force: true);
  }
}

Future<dynamic> apiOk(
  String method,
  String path, {
  String? token,
  Object? body,
}) async {
  final r = await api(method, path, token: token, body: body);
  if (r.status >= 300) {
    throw StateError('$method $path -> ${r.status} ${r.body}');
  }
  return r.body;
}

Future<String> adminToken() async {
  final r = await apiOk(
    'POST',
    '/auth/admin/login',
    body: {'username': adminUser, 'password': adminPassword},
  );
  return (r as Map)['accessToken'] as String;
}

/// Step runner: records PASS/FAIL per step and keeps going, so one run reports
/// every broken flow.
class E2E {
  E2E(this.tester);
  final WidgetTester tester;
  final List<String> failures = [];
  final List<String> uiErrors = [];
  FlutterExceptionHandler? _previous;
  String _current = 'boot';

  /// Brings the app back to a known screen after a failed step.
  Future<void> Function()? recover;

  void captureFlutterErrors() {
    _previous = FlutterError.onError;
    FlutterError.onError = (details) {
      final text = details.exceptionAsString();
      if (text.contains('E2E: remote host blocked')) return;
      final line = '[$_current] ${text.split('\n').take(4).join(' | ')}';
      uiErrors.add(line);
      debugPrint('E2E_UI_ERROR $line');
      debugPrint(details.toString().split('\n').take(25).join('\n'));
    };
  }

  void restoreFlutterErrors() => FlutterError.onError = _previous;

  Future<bool> step(String name, Future<void> Function() body) async {
    _current = name;
    debugPrint('E2E_STEP_START $name');
    try {
      await body();
      debugPrint('E2E_STEP_PASS $name');
      return true;
    } on Object catch (e, s) {
      failures.add('$name: $e');
      debugPrint('E2E_STEP_FAIL $name: $e');
      debugPrint(s.toString().split('\n').take(12).join('\n'));
      debugPrint('E2E_VISIBLE ${visibleTexts()}');
      await shot('FAIL_${failures.length}');
      await recover?.call();
      return false;
    }
  }

  String visibleTexts() => find
      .byType(Text)
      .hitTestable()
      .evaluate()
      .map((e) => (e.widget as Text).data ?? '')
      .where((t) => t.isNotEmpty)
      .take(60)
      .join(' / ');

  Future<void> wait([int ms = 600]) async {
    final end = DateTime.now().add(Duration(milliseconds: ms));
    while (DateTime.now().isBefore(end)) {
      await Future<void>.delayed(const Duration(milliseconds: 80));
      await tester.pump();
    }
  }

  Future<void> until(
    bool Function() condition, {
    int seconds = 20,
    String what = 'condition',
  }) async {
    final end = DateTime.now().add(Duration(seconds: seconds));
    while (!condition()) {
      if (DateTime.now().isAfter(end)) {
        throw StateError('Timed out (${seconds}s) waiting for $what');
      }
      await wait(200);
    }
  }

  Future<void> see(Finder finder, {int seconds = 20}) => until(
    () => finder.evaluate().isNotEmpty,
    seconds: seconds,
    what: finder.describeMatch(Plurality.one),
  );

  Future<void> gone(Finder finder, {int seconds = 20}) => until(
    () => finder.evaluate().isEmpty,
    seconds: seconds,
    what: 'disappearance of ${finder.describeMatch(Plurality.one)}',
  );

  /// Scrolls the visible vertical list until [finder] can be tapped.
  Future<void> reveal(Finder finder) async {
    for (var i = 0; i < 30; i++) {
      if (finder.hitTestable().evaluate().isNotEmpty) return;
      if (finder.evaluate().isNotEmpty) {
        await tester.ensureVisible(finder.first);
        await wait(300);
        if (finder.hitTestable().evaluate().isNotEmpty) return;
      }
      await drag(-320);
    }
    throw StateError('Could not scroll to $finder');
  }

  Future<void> drag(double dy) async {
    final lists = find
        .byWidgetPredicate(
          (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
        )
        .hitTestable();
    if (lists.evaluate().isEmpty) return;
    await tester.drag(lists.first, Offset(0, dy), warnIfMissed: false);
    await wait(350);
  }

  Future<void> tap(Finder finder, {int seconds = 20}) async {
    await see(finder, seconds: seconds);
    await wait(300);
    if (finder.hitTestable().evaluate().isEmpty) await reveal(finder);
    await tester.tap(finder.hitTestable().first);
    await wait();
  }

  Future<void> type(Finder field, String text) async {
    await see(field);
    await tester.enterText(field, text);
    await wait(300);
  }

  void hideKeyboard() => FocusManager.instance.primaryFocus?.unfocus();

  /// The host watches the log and takes a real simulator screenshot.
  Future<void> shot(String name) async {
    await wait(900);
    debugPrint('E2E_SHOT $name');
    await wait(2200);
  }

  /// Simulates leaving the app and coming back.
  Future<void> resumeApp() async {
    for (final s in [
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]) {
      tester.binding.handleAppLifecycleStateChanged(s);
    }
    await wait(1500);
  }

  void finish() {
    debugPrint(
      'E2E_SUMMARY failures=${failures.length} uiErrors=${uiErrors.length} '
      'blockedHosts=${LocalOnlyHttpOverrides.blockedHosts}',
    );
    for (final f in failures) {
      debugPrint('E2E_FAILURE $f');
    }
  }
}
