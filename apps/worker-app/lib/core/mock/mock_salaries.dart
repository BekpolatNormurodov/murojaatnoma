import 'package:worker_app/features/salary/domain/entities/salary.dart';

/// "Oyliklarim" moduli uchun xotiradagi soxta (mock) "backend" holati.
///
/// `SalaryRemoteDataSourceMockImpl` shu qiymatlarni o'qiydi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend (`GET /salaries/me`)
/// o'rnini bosadi. Eng yangi oy birinchi (backend `history`/`mine` xuddi
/// shunday `year desc, month desc` tartiblaydi). Oxirgi (joriy) oy hali
/// TO'LANMAGAN (`paidAt: null`) — "To'lanmagan" holatini ko'rsatish uchun.
final List<Salary> mockSalaries = [
  const Salary(
    id: 'SAL-2026-08',
    year: 2026,
    month: 8,
    amount: 5200000,
    bonus: 600000,
    penalty: 0,
    net: 5800000,
    paidAt: null,
    note: "Joriy oy — hali to'lanmagan",
  ),
  const Salary(
    id: 'SAL-2026-07',
    year: 2026,
    month: 7,
    amount: 5200000,
    bonus: 400000,
    penalty: 150000,
    net: 5450000,
    paidAt: '2026-08-05T10:00:00',
  ),
  const Salary(
    id: 'SAL-2026-06',
    year: 2026,
    month: 6,
    amount: 5200000,
    bonus: 0,
    penalty: 0,
    net: 5200000,
    paidAt: '2026-07-05T10:00:00',
  ),
  const Salary(
    id: 'SAL-2026-05',
    year: 2026,
    month: 5,
    amount: 5000000,
    bonus: 800000,
    penalty: 0,
    net: 5800000,
    paidAt: '2026-06-05T10:00:00',
    note: "Qo'shimcha topshiriq uchun ustama",
  ),
];
