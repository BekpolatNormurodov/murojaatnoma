import 'dart:math';
import 'package:worker_app/core/constants/app_constants.dart';

class GeofenceService {
  /// Calculates distance in meters between two points using Haversine formula.
  ///
  /// Parameters [lat1], [lng1], [lat2], [lng2] are in decimal degrees.
  /// Returns distance in meters.
  double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
    const earthRadiusMeters = 6371000.0;

    // Convert degrees to radians
    final lat1Rad = lat1 * pi / 180.0;
    final lat2Rad = lat2 * pi / 180.0;
    final deltaLatRad = (lat2 - lat1) * pi / 180.0;
    final deltaLngRad = (lng2 - lng1) * pi / 180.0;

    // Haversine formula
    final a = sin(deltaLatRad / 2) * sin(deltaLatRad / 2) +
        cos(lat1Rad) *
            cos(lat2Rad) *
            sin(deltaLngRad / 2) *
            sin(deltaLngRad / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    final distance = earthRadiusMeters * c;

    return distance;
  }

  /// Checks if a point (lat, lng) is inside the geofence.
  ///
  /// The point is inside if distance <= radius (inclusive).
  bool isInside(
    double lat,
    double lng, {
    double centerLat = kWorkplaceLat,
    double centerLng = kWorkplaceLng,
    double radius = kGeofenceRadius,
  }) {
    final distance = distanceMeters(centerLat, centerLng, lat, lng);
    return distance <= radius;
  }
}
