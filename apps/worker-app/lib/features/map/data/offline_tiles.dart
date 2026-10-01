import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:worker_app/features/map/data/yandex_map.dart';

/// Diskka keshlanadigan xarita plitkalari — sekin/yo'q internetda ham
/// xarita ochiladi.
///
///  * Ko'rilgan har bir plitka avtomatik saqlanadi (`tiles/z/x/y.png`) va
///    keyingi safar tarmoqsiz ko'rsatiladi; 30 kundan eski plitka onlayn
///    bo'lsa fonda yangilanadi.
///  * [prefetch] — tuman hududini (z12–15) oldindan yuklab qo'yish.
///  * Hajm chegaralangan: [maxTiles] dan oshsa eng eskilari o'chiriladi.
class OfflineTileProvider extends TileProvider {
  OfflineTileProvider({required this.userAgent}) : super(headers: {});

  final String userAgent;

  static const int maxTiles = 6000;
  static const Duration _staleAfter = Duration(days: 30);

  static final Future<Directory> _dir = () async {
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/tiles');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }();

  static final HttpClient _http = HttpClient()
    ..connectionTimeout = const Duration(seconds: 15);

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    return _CachedTileImage(
      url: getTileUrl(coordinates, options),
      z: coordinates.z,
      x: coordinates.x,
      y: coordinates.y,
      userAgent: userAgent,
    );
  }

  static Future<File> _fileFor(int z, int x, int y) async =>
      File('${(await _dir).path}/$z/$x/$y.png');

  static Future<Uint8List> _download(String url, String userAgent) async {
    final req = await _http.getUrl(Uri.parse(url));
    req.headers.set(HttpHeaders.userAgentHeader, userAgent);
    final res = await req.close().timeout(const Duration(seconds: 25));
    if (res.statusCode != 200) {
      throw HttpException('tile ${res.statusCode}', uri: Uri.parse(url));
    }
    final builder = BytesBuilder(copy: false);
    await for (final chunk in res) {
      builder.add(chunk);
    }
    return builder.takeBytes();
  }

  static Future<void> _store(File file, Uint8List bytes) async {
    try {
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes, flush: false);
    } on Object {
      // disk to'la va h.k. — kesh yordamchi
    }
  }

  /// Tuman chegarasidagi plitkalarni ([minZoom]..[maxZoom]) oldindan yuklaydi.
  /// [onProgress] (bajarildi, jami). Allaqachon bor plitkalar o'tkazib
  /// yuboriladi. 4 ta parallel yuklash.
  static Future<int> prefetch({
    required LatLngBounds bounds,
    required String urlTemplate,
    required String userAgent,
    int minZoom = 12,
    int maxZoom = 15,
    void Function(int done, int total)? onProgress,
  }) async {
    const crs = Epsg3395();
    final jobs = <(int, int, int)>[];
    for (var z = minZoom; z <= maxZoom; z++) {
      final nw = crs.latLngToPoint(bounds.northWest, z.toDouble());
      final se = crs.latLngToPoint(bounds.southEast, z.toDouble());
      final x0 = (math.min(nw.x, se.x) / 256).floor();
      final x1 = (math.max(nw.x, se.x) / 256).floor();
      final y0 = (math.min(nw.y, se.y) / 256).floor();
      final y1 = (math.max(nw.y, se.y) / 256).floor();
      for (var x = x0; x <= x1; x++) {
        for (var y = y0; y <= y1; y++) {
          jobs.add((z, x, y));
        }
      }
    }
    var done = 0;
    var fetched = 0;
    final queue = [...jobs];
    Future<void> worker() async {
      while (queue.isNotEmpty) {
        final (z, x, y) = queue.removeLast();
        final file = await _fileFor(z, x, y);
        if (!file.existsSync()) {
          final url = urlTemplate
              .replaceAll('{z}', '$z')
              .replaceAll('{x}', '$x')
              .replaceAll('{y}', '$y');
          try {
            await _store(file, await _download(url, userAgent));
            fetched++;
          } on Object {
            // bitta plitka o'tmasa — davom etamiz
          }
        }
        onProgress?.call(++done, jobs.length);
      }
    }

    await Future.wait(List.generate(4, (_) => worker()));
    unawaited(_trim());
    return fetched;
  }

  /// Keshdagi plitkalar soni (sozlamalar/diagnostika uchun).
  static Future<int> cachedCount() async {
    try {
      return (await _dir).listSync(recursive: true).whereType<File>().length;
    } on Object {
      return 0;
    }
  }

  static Future<void> _trim() async {
    try {
      final files = (await _dir).listSync(recursive: true).whereType<File>()
          .toList();
      if (files.length <= maxTiles) return;
      files.sort(
        (a, b) => a.statSync().modified.compareTo(b.statSync().modified),
      );
      for (final f in files.take(files.length - maxTiles)) {
        f.deleteSync();
      }
    } on Object {
      // ignore
    }
  }
}

class _CachedTileImage extends ImageProvider<_CachedTileImage> {
  const _CachedTileImage({
    required this.url,
    required this.z,
    required this.x,
    required this.y,
    required this.userAgent,
  });

  final String url;
  final int z;
  final int x;
  final int y;
  final String userAgent;

  @override
  Future<_CachedTileImage> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture(this);

  @override
  ImageStreamCompleter loadImage(
    _CachedTileImage key,
    ImageDecoderCallback decode,
  ) {
    return MultiFrameImageStreamCompleter(
      codec: _load(decode),
      scale: 1,
      debugLabel: url,
    );
  }

  Future<ui.Codec> _load(ImageDecoderCallback decode) async {
    final file = await OfflineTileProvider._fileFor(z, x, y);
    Uint8List? bytes;
    if (file.existsSync()) {
      bytes = await file.readAsBytes();
      // Eskirgan bo'lsa — fonda yangilaymiz (ko'rsatish kutmaydi).
      if (DateTime.now().difference(file.lastModifiedSync()) >
          OfflineTileProvider._staleAfter) {
        unawaited(
          OfflineTileProvider._download(url, userAgent)
              .then((b) => OfflineTileProvider._store(file, b))
              .catchError((Object _) {}),
        );
      }
    } else {
      bytes = await OfflineTileProvider._download(url, userAgent);
      unawaited(OfflineTileProvider._store(file, bytes));
    }
    return decode(await ui.ImmutableBuffer.fromUint8List(bytes));
  }

  @override
  bool operator ==(Object other) =>
      other is _CachedTileImage && other.url == url;

  @override
  int get hashCode => url.hashCode;
}
