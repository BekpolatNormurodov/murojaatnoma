import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';

import '../../support/fake_http.dart';

class _Client implements DioClient {
  _Client(this.dio);

  @override
  Dio dio;
}

void main() {
  test('names are made acceptable for the server whitelist', () {
    const jpeg = [0xFF, 0xD8, 0xFF, 0xE0];
    expect(uploadFileName('photo.JFIF', jpeg), 'photo.jpg');
    expect(uploadFileName('1000012345', jpeg), '1000012345.jpg');
    List<int> iso(String brand) => [0, 0, 0, 24, ...'ftyp$brand'.codeUnits];
    expect(uploadFileName('clip', iso('isom')), 'clip.mp4');
    // An iPhone photo or a voice note must not be stored as a video.
    expect(uploadFileName('photo', iso('heic')), 'photo.heic');
    expect(uploadFileName('note', iso('M4A ')), 'note.m4a');
    expect(uploadFileName('movie', iso('qt  ')), 'movie.mov');
    expect(uploadFileName('old', iso('3gp4')), 'old.3gp');
    expect(uploadFileName('hisobot.pdf', jpeg), 'hisobot.pdf');
    // Never disguised: a refused type stays refused.
    expect(uploadFileName('x.svg', jpeg), 'x.svg');
  });

  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('up'));
  tearDown(() => dir.deleteSync(recursive: true));

  Future<UploadException> failure(ResponseBody Function() answer) async {
    final file = File('${dir.path}/a.jpg')..writeAsBytesSync([1, 2, 3]);
    final service = UploadsService(_Client(FakeHttp((_) => answer()).dio()));
    try {
      await service.upload(file);
    } on UploadException catch (e) {
      return e;
    }
    throw StateError('expected a failure');
  }

  test("the server's Uzbek 400 message is shown", () async {
    final e = await failure(
      () => json({'message': 'Bu turdagi fayl qabul qilinmaydi'}, 400),
    );
    expect(e.message, 'Bu turdagi fayl qabul qilinmaydi');
    expect(e.isPermanent, isTrue);
  });

  test('an HTML 413 from nginx still reads in Uzbek', () async {
    final e = await failure(
      () => ResponseBody.fromString('<html>413</html>', 413),
    );
    expect(e.message, 'Fayl hajmi 25 MB dan oshmasligi kerak');
  });
}
