import 'dart:async';

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';

/// Xodimga biriktirilgan bitta mahalla.
class AssignedMahalla extends Equatable {
  const AssignedMahalla({required this.code, required this.name});

  final String code;
  final String name;

  @override
  List<Object?> get props => [code, name];
}

/// Xodimning ish hududi. Bo'sh ro'yxat — butun tuman.
class Territory extends Equatable {
  const Territory(this.mahallas);

  /// `GET /locations/me` yoki `territory:changed` yuki. Hudud maydonlari
  /// umuman bo'lmasa `null` (noma'lum — "butun tuman" EMAS).
  static Territory? tryParse(Object? json) {
    if (json is! Map) return null;
    final named = json['assignedMahallas'];
    if (named is List) {
      return Territory([
        for (final m in named.whereType<Map<dynamic, dynamic>>())
          if (m['code'] != null)
            AssignedMahalla(
              code: '${m['code']}',
              name: '${m['name'] ?? m['code']}',
            ),
      ]);
    }
    // Eski server faqat kodlarni beradi.
    final codes = json['assignedMahallaCodes'];
    if (codes is! List) return null;
    return Territory([
      for (final c in codes)
        if (c != null) AssignedMahalla(code: '$c', name: '$c'),
    ]);
  }

  final List<AssignedMahalla> mahallas;

  bool get wholeDistrict => mahallas.isEmpty;

  Set<String> get codes => {for (final m in mahallas) m.code};

  @override
  List<Object?> get props => [mahallas];
}

/// Ish hududining yagona manbai: bosh sahifa, profil va xarita shuni
/// kuzatadi. Admin o'zgartirsa (`territory:changed` soketi yoki push) darhol
/// yangilanadi va [changed] signal beradi.
class TerritoryService {
  TerritoryService({
    required Future<Territory?> Function() load,
    Stream<Map<String, dynamic>>? events,
  }) : _load = load {
    _events = events?.listen((payload) {
      final next = Territory.tryParse(payload);
      if (next != null) _apply(next);
      // Server bahosi va nomlar uchun qayta o'qiymiz.
      unawaited(refresh());
    });
  }

  /// Haqiqiy backend (`GET /locations/me`).
  static Future<Territory?> Function() apiLoader(Dio dio) => () async {
    final res = await dio.get<Map<String, dynamic>>('/locations/me');
    return Territory.tryParse(res.data);
  };

  final Future<Territory?> Function() _load;
  StreamSubscription<Map<String, dynamic>>? _events;

  /// `null` — hali ma'lum emas.
  final ValueNotifier<Territory?> territory = ValueNotifier(null);

  final _changed = StreamController<Territory>.broadcast();

  /// Ma'lum hudud BOSHQASIGA almashganda (birinchi yuklash signal bermaydi).
  Stream<Territory> get changed => _changed.stream;

  /// Har [clear]da oshadi — oldingi xodimning kechikkan javobi tashlanadi.
  int _generation = 0;

  /// So'rov tartib raqami — faqat ENG OXIRGI so'rovning javobi qo'llanadi.
  /// Aks holda socket hodisasidan oldin boshlangan sekin so'rov yangi hududni
  /// eskisi bilan ustidan yozardi.
  int _request = 0;

  /// Xatoda avvalgi qiymat qoladi. Hech qachon throw qilmaydi.
  Future<void> refresh() async {
    final generation = _generation;
    final request = ++_request;
    try {
      final next = await _load();
      if (next == null) return;
      if (generation == _generation && request == _request) _apply(next);
    } on Object catch (error) {
      debugPrint('[territory] refresh: $error');
    }
  }

  void _apply(Territory next) {
    final previous = territory.value;
    territory.value = next;
    if (previous != null && !setEquals(previous.codes, next.codes)) {
      _changed.add(next);
    }
  }

  void clear() {
    _generation++;
    territory.value = null;
  }

  Future<void> dispose() async {
    await _events?.cancel();
    await _changed.close();
    territory.dispose();
  }
}
