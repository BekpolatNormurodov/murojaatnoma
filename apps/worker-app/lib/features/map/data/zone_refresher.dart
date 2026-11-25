import 'package:worker_app/features/map/data/zone_boundary_loader.dart';

/// Biriktirilgan hudud va chegaralarni yangilab turadi. So'rov muvaffaqiyatsiz
/// bo'lsa avvalgi hudud SAQLANADI — vaqtinchalik server xatosi
/// "mahalla biriktirilmagan" (butun tuman ish hududi) bo'lib ko'rinmasin.
class ZoneRefresher {
  ZoneRefresher({
    required Future<MyZone?> Function() loadZone,
    required Future<ZoneBoundaries> Function(Set<String> codes) loadBoundaries,
  }) : _loadZone = loadZone,
       _loadBoundaries = loadBoundaries;

  final Future<MyZone?> Function() _loadZone;
  final Future<ZoneBoundaries> Function(Set<String> codes) _loadBoundaries;

  ZoneBoundaries boundaries = ZoneBoundaries.empty;

  /// Hozir chizilgan hudud kodlari; `null` — hali aniq ma'lum emas.
  Set<String>? assignedCodes;

  /// Oxirgi muvaffaqiyatli javobdagi server bahosi.
  bool? serverInside;

  Future<bool>? _running;

  /// `true` — chegaralar o'zgardi (qayta chizish kerak).
  Future<bool> refresh() =>
      _running ??= _refresh().whenComplete(() => _running = null);

  Future<bool> _refresh() async {
    final zone = await _loadZone();
    final firstLoad = boundaries.polygons.isEmpty;
    // Xato: avvalgisi bor bo'lsa tegmaymiz.
    if (zone == null && !firstLoad) return false;
    final codes = zone?.assignedMahallaCodes.toSet();
    final known = assignedCodes;
    if (!firstLoad &&
        codes != null &&
        known != null &&
        known.length == codes.length &&
        known.containsAll(codes)) {
      return false;
    }
    final next = await _loadBoundaries(codes ?? const {});
    final lostMahallas =
        boundaries.mahallas.isNotEmpty && next.mahallas.isEmpty;
    if (!firstLoad && (next.polygons.isEmpty || lostMahallas)) return false;
    boundaries = next;
    // Geojson to'liq kelmagan bo'lsa kodlarni "chizilgan" demaymiz.
    assignedCodes = next.mahallas.isEmpty ? null : codes;
    serverInside = zone?.insideAssignedZone;
    return true;
  }
}
