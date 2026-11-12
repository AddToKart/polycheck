import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/api.dart';
import 'package:polycheck_mobile/src/core/utils/session_slots.dart';

BulkSlotRow row(
  String day, [
  String startTime = '08:00',
  String endTime = '10:00',
  bool selected = true,
]) {
  return BulkSlotRow(
    day: day,
    startTime: startTime,
    endTime: endTime,
    selected: selected,
  );
}

void main() {
  group('campus date parsing', () {
    test('parses a civil date without timezone drift', () {
      final parsed = parseCampusDate('2026-11-10');
      expect(parsed, isNotNull);
      expect(parsed!.year, 2026);
      expect(parsed.month, 11);
      expect(parsed.day, 10);
      expect(parsed.hour, 12);
    });

    test('rejects malformed and overflowing dates', () {
      expect(parseCampusDate('2026-02-31'), isNull);
      expect(parseCampusDate('not-a-date'), isNull);
      expect(parseCampusDate(''), isNull);
    });

    test('derives the short weekday code', () {
      expect(dayOfWeek('2026-11-10'), 'Tue');
      expect(dayOfWeek('2026-11-15'), 'Sun');
      expect(dayOfWeek('2026-11-16'), 'Mon');
      expect(dayOfWeek(''), isNull);
    });
  });

  group('nextOccurrenceDate', () {
    test('keeps the same day when the weekday already matches', () {
      expect(nextOccurrenceDate('Tue', '2026-11-10'), '2026-11-10');
    });

    test('moves to the next instance within the week', () {
      expect(nextOccurrenceDate('Wed', '2026-11-10'), '2026-11-11');
      expect(nextOccurrenceDate('Mon', '2026-11-10'), '2026-11-16');
    });

    test('wraps across a month and year boundary', () {
      expect(nextOccurrenceDate('Fri', '2026-12-31'), '2027-01-01');
      expect(nextOccurrenceDate('Thu', '2026-12-31'), '2026-12-31');
    });

    test('falls back to the supplied date for bad input', () {
      expect(nextOccurrenceDate('Funday', '2026-11-10'), '2026-11-10');
      expect(nextOccurrenceDate('Mon', 'bad-date'), 'bad-date');
    });

    test('defaults to the Asia/Manila campus date', () {
      // 09:00 on Tuesday 10 Nov 2026 in Manila.
      final now = DateTime.parse('2026-11-10T01:00:00.000Z');
      expect(nextOccurrenceDate('Tue', null, now), '2026-11-10');
      expect(nextOccurrenceDate('Mon', null, now), '2026-11-16');
    });
  });

  group('slotLabel', () {
    test('formats the day, time range and room', () {
      expect(
        slotLabel(
          const SessionSlot(
            day: 'Mon',
            startTime: '08:00',
            endTime: '10:30',
            room: 'CCIS Lab 3',
          ),
        ),
        'Mon 08:00-10:30 (CCIS Lab 3)',
      );
    });

    test('omits empty rooms', () {
      expect(
        slotLabel(
          const SessionSlot(day: 'Wed', startTime: '09:00', endTime: '12:30'),
        ),
        'Wed 09:00-12:30',
      );
      expect(
        slotLabel(
          const SessionSlot(
            day: 'Wed',
            startTime: '09:00',
            endTime: '12:30',
            room: '   ',
          ),
        ),
        'Wed 09:00-12:30',
      );
    });
  });

  group('slot selection defaults', () {
    const schedule = [
      SessionSlot(day: 'Mon', startTime: '08:00', endTime: '10:30'),
      SessionSlot(day: 'Wed', startTime: '09:00', endTime: '12:30'),
    ];

    test('defaults to the slot matching the current date weekday', () {
      expect(defaultSlotSelection(schedule, '2026-11-09'), '0');
      expect(defaultSlotSelection(schedule, '2026-11-11'), '1');
    });

    test('defaults to the first slot when no weekday matches', () {
      expect(defaultSlotSelection(schedule, '2026-11-10'), '0');
      expect(defaultSlotSelection(schedule, 'bad-date'), '0');
    });

    test('defaults to the custom option when there is no schedule', () {
      expect(
        defaultSlotSelection(const <SessionSlot>[], '2026-11-10'),
        customSlotValue,
      );
    });

    test('represents unscheduled dates as custom when the date changes', () {
      expect(slotSelectionForDate(schedule, '2026-11-11'), '1');
      expect(slotSelectionForDate(schedule, '2026-11-10'), customSlotValue);
      expect(slotSelectionForDate(schedule, 'bad-date'), customSlotValue);
    });
  });

  group('buildBulkRows', () {
    test('derives one selected row per slot, preserving order and times', () {
      final rows = buildBulkRows(const [
        SessionSlot(
          day: 'Mon',
          startTime: '08:00',
          endTime: '10:30',
          room: 'Room A',
        ),
        SessionSlot(day: 'Wed', startTime: '09:00', endTime: '12:30'),
      ], 'CCIS Lab 3');
      expect(rows, [
        const BulkSlotRow(
          day: 'Mon',
          startTime: '08:00',
          endTime: '10:30',
          room: 'Room A',
        ),
        const BulkSlotRow(
          day: 'Wed',
          startTime: '09:00',
          endTime: '12:30',
          room: 'CCIS Lab 3',
        ),
      ]);
    });

    test('omits the room when the slot and fallback room are blank', () {
      expect(
        buildBulkRows(const [
          SessionSlot(day: 'Fri', startTime: '13:00', endTime: '14:00'),
        ], '  '),
        [const BulkSlotRow(day: 'Fri', startTime: '13:00', endTime: '14:00')],
      );
    });
  });

  group('countSlotOccurrences', () {
    test('sums each selected slot over the date range', () {
      expect(
        countSlotOccurrences(
          [row('Mon'), row('Wed')],
          '2026-11-01',
          '2026-11-30',
        ),
        9,
      );
    });

    test('ignores unselected rows', () {
      expect(
        countSlotOccurrences(
          [row('Mon'), row('Wed', '09:00', '12:30', false)],
          '2026-11-01',
          '2026-11-30',
        ),
        5,
      );
    });

    test('counts each occurrence for duplicate weekdays', () {
      expect(
        countSlotOccurrences(
          [row('Mon'), row('Mon', '13:00', '15:00')],
          '2026-11-01',
          '2026-11-07',
        ),
        2,
      );
    });

    test('handles single-day ranges', () {
      expect(countSlotOccurrences([row('Tue')], '2026-11-10', '2026-11-10'), 1);
      expect(countSlotOccurrences([row('Mon')], '2026-11-10', '2026-11-10'), 0);
    });

    test('returns zero for empty, invalid, or reversed ranges', () {
      expect(
        countSlotOccurrences(const <BulkSlotRow>[], '2026-11-01', '2026-11-30'),
        0,
      );
      expect(countSlotOccurrences([row('Mon')], '2026-11-30', '2026-11-01'), 0);
      expect(countSlotOccurrences([row('Mon')], 'bad', '2026-11-30'), 0);
      expect(countSlotOccurrences([row('Mon')], '2026-11-01', ''), 0);
    });

    test('counts a full week once per selected slot', () {
      final rows = [
        for (final day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
          row(day),
      ];
      expect(countSlotOccurrences(rows, '2026-11-01', '2026-11-07'), 7);
    });
  });

  group('firstInvalidSlotRow', () {
    test('flags selected rows whose end is not after the start', () {
      expect(firstInvalidSlotRow([row('Mon', '08:00', '08:00')])?.day, 'Mon');
      expect(firstInvalidSlotRow([row('Mon', '10:00', '09:00')])?.day, 'Mon');
      expect(firstInvalidSlotRow([row('Mon', '', '09:00')])?.day, 'Mon');
    });

    test('ignores unselected rows and returns null when all are valid', () {
      expect(
        firstInvalidSlotRow([row('Mon', '10:00', '09:00', false), row('Wed')]),
        isNull,
      );
      expect(
        firstInvalidSlotRow([row('Mon'), row('Wed', '09:00', '12:30')]),
        isNull,
      );
    });
  });

  group('buildBulkSlots', () {
    test('shapes selected rows into the slots payload', () {
      final rows = <BulkSlotRow>[
        const BulkSlotRow(
          day: 'Mon',
          startTime: '08:00',
          endTime: '10:30',
          room: 'Room A',
        ),
        const BulkSlotRow(
          day: 'Wed',
          startTime: '09:00',
          endTime: '12:30',
          selected: false,
        ),
        const BulkSlotRow(day: 'Fri', startTime: '13:00', endTime: '14:30'),
      ];
      expect(buildBulkSlots(rows), [
        const BulkSessionSlot(day: 'Mon', startTime: '08:00', endTime: '10:30'),
        const BulkSessionSlot(day: 'Fri', startTime: '13:00', endTime: '14:30'),
      ]);
    });

    test('returns an empty array when nothing is selected', () {
      expect(buildBulkSlots([row('Mon', '08:00', '10:00', false)]), isEmpty);
    });
  });
}
