import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/id_hologram.dart';

int utc(int year, int monthIndex, int day, int hour, int minute, int second) =>
    DateTime.utc(
      year,
      monthIndex + 1,
      day,
      hour,
      minute,
      second,
    ).millisecondsSinceEpoch;

void main() {
  group('formatLiveUtcStamp', () {
    test('formats an epoch in UTC with zero padding', () {
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14)),
        '2026-11-02 08:01:14',
      );
    });

    test('pads single-digit components, including seconds', () {
      expect(
        formatLiveUtcStamp(utc(2026, 0, 5, 3, 7, 2)),
        '2026-01-05 03:07:02',
      );
    });

    test('applies a positive clock offset (device fast -> server)', () {
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14), 60000),
        '2026-11-02 08:02:14',
      );
    });

    test('applies a negative clock offset', () {
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14), -60000),
        '2026-11-02 08:00:14',
      );
    });

    test('rolls forward across the day boundary with an offset', () {
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 23, 59, 59), 1000),
        '2026-11-03 00:00:00',
      );
    });

    test('rolls back across the year boundary with an offset', () {
      expect(
        formatLiveUtcStamp(utc(2027, 0, 1, 0, 0, 0), -1000),
        '2026-12-31 23:59:59',
      );
    });

    test('defaults the offset to zero', () {
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14), 0),
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14)),
      );
    });

    test('falls back to the epoch stamp for non-finite input', () {
      expect(formatLiveUtcStamp(double.nan), '1970-01-01 00:00:00');
      expect(
        formatLiveUtcStamp(utc(2026, 10, 2, 8, 1, 14), double.infinity),
        '1970-01-01 00:00:00',
      );
    });
  });

  group('maskDeviceChip', () {
    test('reports WEB-SESSION when no device id exists', () {
      expect(maskDeviceChip(null), hologramWebSessionChip);
      expect(maskDeviceChip(''), hologramWebSessionChip);
      expect(maskDeviceChip('   '), hologramWebSessionChip);
    });

    test('reveals only the last 4 alphanumeric characters', () {
      expect(
        maskDeviceChip('mobile-a1b2c3d4e5'),
        '${hologramDeviceChipPrefix}d4e5',
      );
    });

    test('ignores separators when extracting the tail', () {
      expect(
        maskDeviceChip('AB-CD-EF-1234'),
        '${hologramDeviceChipPrefix}1234',
      );
      expect(
        maskDeviceChip('device:PuP_9f2a'),
        '${hologramDeviceChipPrefix}9f2a',
      );
    });

    test('uses the full mask under 4 alphanumeric characters', () {
      expect(maskDeviceChip('ab'), hologramDeviceChipFullMask);
      expect(maskDeviceChip('xyz'), hologramDeviceChipFullMask);
      expect(maskDeviceChip('--_.&'), hologramDeviceChipFullMask);
    });

    test('never leaks the full device id', () {
      final chip = maskDeviceChip('mobile-a1b2c3d4e5');
      expect(chip.contains('mobile-a1b2c3d4e5'), isFalse);
      expect(chip.endsWith('d4e5'), isTrue);
    });
  });

  group('buildWatermarkLine', () {
    test('assembles the verified prefix, stamp, and chip', () {
      expect(
        buildWatermarkLine(
          '2026-11-02 08:01:14',
          'DEVICE-BOUND \u2022\u00B7\u2022\u00B74F2A',
        ),
        'PUP-ID-VERIFIED \u2022 LIVE UTC: 2026-11-02 08:01:14 \u2022 '
        'DEVICE-BOUND \u2022\u00B7\u2022\u00B74F2A',
      );
    });

    test('starts with the shared watermark text and ends with the chip', () {
      final line = buildWatermarkLine(
        '1970-01-01 00:00:00',
        hologramWebSessionChip,
      );
      expect(
        line.startsWith('$hologramWatermarkText \u2022 LIVE UTC: '),
        isTrue,
      );
      expect(line.endsWith(hologramWebSessionChip), isTrue);
    });

    test('keeps the web-session chip inline for unbound cards', () {
      expect(
        buildWatermarkLine('2026-11-02 08:01:14', hologramWebSessionChip),
        'PUP-ID-VERIFIED \u2022 LIVE UTC: 2026-11-02 08:01:14 \u2022 WEB-SESSION',
      );
    });
  });

  group('hologram constants', () {
    test('keeps the watermark lead text stable across platforms', () {
      expect(hologramWatermarkText, 'PUP-ID-VERIFIED');
      expect(hologramDeviceChipPrefix, 'DEVICE-BOUND \u2022\u00B7\u2022\u00B7');
      expect(
        hologramDeviceChipFullMask,
        'DEVICE-BOUND \u2022\u00B7\u2022\u00B7\u2022\u00B7',
      );
    });
  });
}
