import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/face/data/datasources/face_remote_data_source.dart';

void main() {
  // Faqat Mock impl sinaladi — Api impl jonli backend talab qiladi
  // (`AttendanceRemoteDataSourceApiImpl`/`AuthApiImpl` bilan bir xil
  // pretsedent — qarang: `attendance_remote_data_source_test.dart`).
  group(FaceRemoteDataSourceMockImpl, () {
    test(
      'uploadEmbedding completes without throwing (no-op backend)',
      () async {
        final subject = FaceRemoteDataSourceMockImpl();

        await expectLater(
          subject.uploadEmbedding('W-1042', const [0.1, 0.2, 0.3]),
          completes,
        );
      },
    );
  });
}
