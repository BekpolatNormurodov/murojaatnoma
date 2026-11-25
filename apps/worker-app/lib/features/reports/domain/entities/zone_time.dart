import 'package:equatable/equatable.dart';

/// `GET /daily-reports/my/zone-time?days=N` javobi — xodim so'nggi N kunda
/// biriktirilgan hududida (mahallasida) qancha vaqt bo'lgani.
class ZoneTimeReport extends Equatable {
  const ZoneTimeReport({required this.days, this.gapMinutes = 15});

  factory ZoneTimeReport.fromJson(Map<String, dynamic> json) {
    final daysJson = json['days'];
    return ZoneTimeReport(
      gapMinutes: (json['gapMinutes'] as num?)?.toInt() ?? 15,
      days: [
        if (daysJson is List)
          for (final item in daysJson)
            if (item is Map<String, dynamic>) ZoneDay.fromJson(item),
      ],
    );
  }

  /// Shu daqiqadan uzoq GPS uzilishi "faol emas" deb hisoblanadi.
  final int gapMinutes;

  /// Eng yangi kun birinchi.
  final List<ZoneDay> days;

  @override
  List<Object?> get props => [gapMinutes, days];
}

/// Bitta kun bo'yicha hududda/tashqarida bo'lgan vaqt.
class ZoneDay extends Equatable {
  const ZoneDay({
    required this.date,
    this.zoneMinutes = 0,
    this.outsideMinutes = 0,
    this.activeMinutes = 0,
    this.firstAt,
    this.lastAt,
    this.stretches = const [],
    this.byMahalla = const [],
  });

  factory ZoneDay.fromJson(Map<String, dynamic> json) {
    final stretchesJson = json['stretches'];
    final byMahallaJson = json['byMahalla'];
    return ZoneDay(
      date: _day(json['date']),
      zoneMinutes: _int(json['zoneMinutes']),
      outsideMinutes: _int(json['outsideMinutes']),
      activeMinutes: _int(json['activeMinutes']),
      firstAt: _time(json['firstAt']),
      lastAt: _time(json['lastAt']),
      stretches: [
        if (stretchesJson is List)
          for (final item in stretchesJson)
            if (item is Map<String, dynamic>) ZoneStretch.fromJson(item),
      ],
      // Ixtiyoriy (eski backend bermaydi) — eng uzuni birinchi.
      byMahalla: [
        if (byMahallaJson is List)
          for (final item in byMahallaJson)
            if (item is Map<String, dynamic>) MahallaTime.fromJson(item),
      ],
    );
  }

  /// `YYYY-MM-DD`.
  final String date;
  final int zoneMinutes;
  final int outsideMinutes;
  final int activeMinutes;

  /// Kunning birinchi/oxirgi joylashuv nuqtasi (mahalliy vaqt).
  final DateTime? firstAt;
  final DateTime? lastAt;
  final List<ZoneStretch> stretches;

  /// Mahallalar bo'yicha jami vaqt (eng uzuni birinchi).
  final List<MahallaTime> byMahalla;

  /// Bu kunda umuman joylashuv ma'lumoti yo'q.
  bool get isEmpty => activeMinutes <= 0 && stretches.isEmpty;

  @override
  List<Object?> get props => [
    date,
    zoneMinutes,
    outsideMinutes,
    activeMinutes,
    firstAt,
    lastAt,
    stretches,
    byMahalla,
  ];
}

/// Bir kunda bitta mahallada (yoki `name == null` — hech bir mahallada
/// emas, "Tuman tashqarisi") o'tkazilgan jami vaqt.
class MahallaTime extends Equatable {
  const MahallaTime({required this.minutes, required this.inside, this.name});

  factory MahallaTime.fromJson(Map<String, dynamic> json) {
    final name = (json['name'] as String?)?.trim();
    return MahallaTime(
      name: (name == null || name.isEmpty) ? null : name,
      minutes: _int(json['minutes']),
      inside: json['inside'] == true,
    );
  }

  final String? name;
  final int minutes;
  final bool inside;

  /// Ko'rsatiladigan nom.
  String get label => name ?? 'Tuman tashqarisi';

  @override
  List<Object?> get props => [name, minutes, inside];
}

/// Uzluksiz oraliq — hududda yoki tashqarida.
class ZoneStretch extends Equatable {
  const ZoneStretch({
    required this.from,
    required this.to,
    required this.inside,
    this.minutes = 0,
    this.mahallaName,
  });

  factory ZoneStretch.fromJson(Map<String, dynamic> json) {
    final from = _time(json['from']) ?? DateTime.fromMillisecondsSinceEpoch(0);
    final to = _time(json['to']) ?? from;
    final name = (json['mahallaName'] as String?)?.trim();
    return ZoneStretch(
      from: from,
      to: to,
      minutes: _int(json['minutes']),
      inside: json['inside'] == true,
      mahallaName: (name == null || name.isEmpty) ? null : name,
    );
  }

  final DateTime from;
  final DateTime to;
  final int minutes;
  final bool inside;
  final String? mahallaName;

  @override
  List<Object?> get props => [from, to, minutes, inside, mahallaName];
}

String _day(Object? raw) {
  final s = raw is String ? raw : '';
  return s.length >= 10 ? s.substring(0, 10) : s;
}

int _int(Object? raw) => raw is num ? raw.round() : 0;

DateTime? _time(Object? raw) {
  if (raw is! String || raw.isEmpty) return null;
  return DateTime.tryParse(raw)?.toLocal();
}
