import 'dart:math' as math;

/// Mirrors `shared/src/utils/haversine.ts` — the same Earth radius constant
/// and the same half-versine formulation, so distance parity is exact.
const double earthRadiusMeters = 6371000;

double _toRadians(double degrees) => (degrees * math.pi) / 180;

double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
  final dLat = _toRadians(lat2 - lat1);
  final dLon = _toRadians(lon2 - lon1);

  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_toRadians(lat1)) *
          math.cos(_toRadians(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);

  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

bool isWithinGeofence(
  double studentLat,
  double studentLon,
  double centerLat,
  double centerLon,
  double radiusMeters,
) {
  final distance = haversineDistance(
    studentLat,
    studentLon,
    centerLat,
    centerLon,
  );
  return distance <= radiusMeters;
}
