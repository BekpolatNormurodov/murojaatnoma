import 'package:worker_app/features/points/domain/entities/points.dart';

/// Ball nazorati moduli uchun xotiradagi soxta (mock) "backend" holati.
///
/// `PointsRemoteDataSourceMockImpl` shu qiymatlarni o'qiydi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_applications.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi) — ilova ishlab turgan davrda xotirada
/// saqlanadi, restart'da boshlang'ich holatga qaytadi. `total` — quyidagi
/// `mockPointsHistory`dagi barcha `delta`larning yig'indisi (22).
final List<PointsEntry> mockPointsHistory = [
  const PointsEntry(
    id: 'PTS-1',
    reason: "Ariza o'z vaqtida bajarildi",
    delta: 10,
    at: '2026-07-10T09:00:00',
    positive: true,
  ),
  const PointsEntry(
    id: 'PTS-2',
    reason: 'Kechikish',
    delta: -5,
    at: '2026-07-11T08:45:00',
    positive: false,
  ),
  const PointsEntry(
    id: 'PTS-3',
    reason: 'Fuqarodan ijobiy fikr-mulohaza',
    delta: 15,
    at: '2026-07-13T14:00:00',
    positive: true,
  ),
  const PointsEntry(
    id: 'PTS-4',
    reason: 'Hisobotni muddatida topshirmaslik',
    delta: -10,
    at: '2026-07-15T17:30:00',
    positive: false,
  ),
  const PointsEntry(
    id: 'PTS-5',
    reason: "Qo'shimcha topshiriqni sifatli bajarish",
    delta: 20,
    at: '2026-07-17T11:20:00',
    positive: true,
  ),
  const PointsEntry(
    id: 'PTS-6',
    reason: 'Ish joyiga kechikib kelish',
    delta: -5,
    at: '2026-07-18T09:10:00',
    positive: false,
  ),
  const PointsEntry(
    id: 'PTS-7',
    reason: 'Majlisda faol ishtirok',
    delta: 5,
    at: '2026-07-21T10:00:00',
    positive: true,
  ),
  const PointsEntry(
    id: 'PTS-8',
    reason: 'Murojaatga javob berishda kechikish',
    delta: -8,
    at: '2026-07-23T16:40:00',
    positive: false,
  ),
];

final WorkerPoints mockWorkerPoints = WorkerPoints(
  total: 22,
  rank: 4,
  history: mockPointsHistory,
);
