import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/dashboard/my_dashboard.dart';

/// Bosh sahifa ko'rsatkichlari. `null` = hali yuklanmagan (UI skeleton/0).
/// Real rejimda `GET /me/dashboard` (oflayn kesh orqali ham ishlaydi); mock
/// rejimda — namunaviy ma'lumot.
class MyDashboardCubit extends Cubit<MyDashboardState> {
  MyDashboardCubit(this._client) : super(const MyDashboardState());

  final DioClient _client;

  Future<void> load() async {
    emit(MyDashboardState(data: state.data, loading: true));
    try {
      final data = AppConfig.useMock
          ? _mock()
          : MyDashboard.fromJson(
              (await _client.dio.get<Map<String, dynamic>>(
                    '/me/dashboard',
                  )).data ??
                  const {},
            );
      if (!isClosed) emit(MyDashboardState(data: data));
    } on Object {
      // Ko'rsatkichlar — yordamchi blok: xato bo'lsa oldingi ma'lumot qoladi.
      if (!isClosed) emit(MyDashboardState(data: state.data, failed: true));
    }
  }

  static MyDashboard _mock() {
    final today = DateTime.now();
    final days = [
      for (var i = 29; i >= 0; i--)
        () {
          final d = DateTime(today.year, today.month, today.day - i);
          final work = d.weekday != DateTime.sunday;
          return DayCell(
            date: d,
            present: work && i % 9 != 4,
            late: work && i % 7 == 3,
            hours: work ? 8.2 : 0,
          );
        }(),
    ];
    return MyDashboard(
      attendance: AttendanceKpi(
        totalHours: 126.5,
        daysPresent: 18,
        daysLate: 2,
        workDaysSoFar: 19,
        onTimeRate: 89,
        attendanceRate: 95,
        avgCheckIn: '08:51',
        onTimeStreak: 6,
        rank: 4,
        rankOf: 29,
        last30: days,
      ),
      murojaat: const MurojaatKpi(
        open: 3,
        newToday: 1,
        overdue: 1,
        resolvedThisMonth: 12,
        avgResolutionHours: 31.5,
        avgRating: 4.6,
        ratedCount: 9,
      ),
      money: const MoneyKpi(
        salaryNet: 5800000,
        premyaThisMonth: 600000,
        points: 22,
      ),
      today: const TodayKpi(meetings: 2, unreadChat: 5, unreadNotifications: 3),
      recent: [
        ActivityItem(
          title: 'Yangi murojaat biriktirildi',
          body: "Ko'cha yoritgichi ishlamayapti",
          type: 'APPLICATION',
          createdAt: today.subtract(const Duration(minutes: 40)),
          isRead: false,
        ),
        ActivityItem(
          title: "Fuqaro baholadi: ★★★★★",
          body: 'Rahmat, tez hal qilindi',
          type: 'APPLICATION',
          createdAt: today.subtract(const Duration(hours: 3)),
          isRead: true,
        ),
        ActivityItem(
          title: 'Davomat qayd etildi',
          body: 'Bugun 08:47 da keldingiz',
          type: 'ATTENDANCE',
          createdAt: today.subtract(const Duration(hours: 6)),
          isRead: true,
        ),
      ],
    );
  }
}

class MyDashboardState extends Equatable {
  const MyDashboardState({
    this.data,
    this.loading = false,
    this.failed = false,
  });

  final MyDashboard? data;
  final bool loading;
  final bool failed;

  @override
  List<Object?> get props => [data, loading, failed];
}
