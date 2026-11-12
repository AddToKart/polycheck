import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/maintenance_time.dart';

void main() {
  final now = DateTime.utc(2026, 11, 1, 9);
  final nowMs = now.millisecondsSinceEpoch;

  test('no estimate renders no countdown', () {
    expect(
      formatMaintenanceRemaining(null, nowMs).tone,
      MaintenanceCountdownTone.none,
    );
    expect(
      formatMaintenanceRemaining('', nowMs).tone,
      MaintenanceCountdownTone.none,
    );
    expect(
      formatMaintenanceRemaining('not-a-date', nowMs).tone,
      MaintenanceCountdownTone.none,
    );
  });

  test('minutes and hours match the web copy', () {
    expect(
      formatMaintenanceRemaining('2026-11-01T09:10:00.000Z', nowMs).label,
      'Estimated resumption in 10 min',
    );
    expect(
      formatMaintenanceRemaining('2026-11-01T10:35:00.000Z', nowMs).label,
      'Estimated resumption in 1 h 35 min',
    );
    expect(
      formatMaintenanceRemaining('2026-11-01T11:00:00.000Z', nowMs).label,
      'Estimated resumption in 2 h',
    );
  });

  test('past the estimate the mode is overdue but still on', () {
    final result = formatMaintenanceRemaining(
      '2026-11-01T08:00:00.000Z',
      nowMs,
    );
    expect(result.tone, MaintenanceCountdownTone.overdue);
    expect(result.label, 'Resumption is overdue - contact the IT desk');
  });
}
