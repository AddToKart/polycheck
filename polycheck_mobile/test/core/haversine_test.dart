import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/haversine.dart';

void main() {
  group('haversineDistance', () {
    test('returns zero for identical coordinates', () {
      expect(haversineDistance(0, 0, 0, 0), 0);
      expect(haversineDistance(14.5995, 120.9842, 14.5995, 120.9842), 0);
    });

    test('returns ~111.195 km for one degree of latitude at the equator', () {
      final distance = haversineDistance(0, 0, 1, 0);
      expect((distance - 111195).abs(), lessThan(500));
    });

    test('returns ~111.195 km for one degree of longitude at the equator', () {
      final distance = haversineDistance(0, 0, 0, 1);
      expect((distance - 111195).abs(), lessThan(500));
    });

    test('returns ~78.6 km for one degree of longitude at 45 latitude', () {
      final distance = haversineDistance(45, 0, 45, 1);
      expect(distance, greaterThan(78000));
      expect(distance, lessThan(79500));
    });

    test('is symmetric distance(a, b) == distance(b, a)', () {
      const pairs = [
        [0.0, 0.0, 1.0, 1.0],
        [14.5995, 120.9842, 40.7128, -74.006],
        [-33.8688, 151.2093, 35.6762, 139.6503],
        [45.0, -93.0, 45.0, -92.0],
      ];
      for (final pair in pairs) {
        expect(
          haversineDistance(pair[0], pair[1], pair[2], pair[3]),
          haversineDistance(pair[2], pair[3], pair[0], pair[1]),
        );
      }
    });

    test('matches the TS vector for a campus-scale offset', () {
      // 0.00036 deg latitude is ~40.03 m at PUP Santa Maria's latitude.
      final distance = haversineDistance(14.5995, 120.9842, 14.59986, 120.9842);
      expect(distance, closeTo(39.9, 0.6));
      expect(math.max(distance, 0), distance);
    });
  });

  group('isWithinGeofence', () {
    const centerLat = 14.5995;
    const centerLon = 120.9842;

    test('returns true when the student is inside the radius', () {
      expect(
        isWithinGeofence(
          centerLat + 0.00036,
          centerLon,
          centerLat,
          centerLon,
          50,
        ),
        isTrue,
      );
    });

    test('returns true exactly at the radius (inclusive boundary)', () {
      final distance = haversineDistance(
        centerLat,
        centerLon,
        centerLat + 0.001,
        centerLon,
      );
      expect(
        isWithinGeofence(
          centerLat + 0.001,
          centerLon,
          centerLat,
          centerLon,
          distance,
        ),
        isTrue,
      );
    });

    test('returns false just outside the radius', () {
      final distance = haversineDistance(
        centerLat,
        centerLon,
        centerLat + 0.001,
        centerLon,
      );
      expect(
        isWithinGeofence(
          centerLat + 0.001,
          centerLon,
          centerLat,
          centerLon,
          distance - 1,
        ),
        isFalse,
      );
    });

    test('returns false for a clearly distant point', () {
      expect(
        isWithinGeofence(centerLat + 1, centerLon, centerLat, centerLon, 50),
        isFalse,
      );
    });
  });
}
