import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/calendar_utils.dart';

void main() {
  group('formatDate', () {
    test('formats dates as YYYY-MM-DD with zero padding', () {
      expect(formatDate(DateTime(2026, 8, 2)), '2026-08-02');
      expect(formatDate(DateTime(2026, 1, 5)), '2026-01-05');
      expect(formatDate(DateTime(2026, 12, 31)), '2026-12-31');
    });
  });

  group('formatCampusDate', () {
    test('shifts a UTC instant into the PUP (UTC+08:00) civil date', () {
      expect(
        formatCampusDate(DateTime.parse('2026-08-01T20:00:00Z')),
        '2026-08-02',
      );
      expect(
        formatCampusDate(DateTime.parse('2026-08-02T00:30:00Z')),
        '2026-08-02',
      );
      expect(
        formatCampusDate(DateTime.parse('2026-08-02T15:59:59Z')),
        '2026-08-02',
      );
      expect(
        formatCampusDate(DateTime.parse('2026-08-02T16:00:00Z')),
        '2026-08-03',
      );
    });
  });

  group('getRecentCampusDateRange', () {
    test('returns a 7-day range ending on the campus date', () {
      expect(
        getRecentCampusDateRange(7, DateTime.parse('2026-08-02T12:00:00Z')),
        const CampusDateRange(startDate: '2026-07-27', endDate: '2026-08-02'),
      );
    });

    test('clamps days below 1 to a single-day range', () {
      expect(
        getRecentCampusDateRange(0, DateTime.parse('2026-08-02T12:00:00Z')),
        const CampusDateRange(startDate: '2026-08-02', endDate: '2026-08-02'),
      );
    });
  });

  group('formatTime', () {
    test('formats 12-hour clock times', () {
      expect(formatTime('08:30'), '08:30 AM');
      expect(formatTime('13:05'), '01:05 PM');
      expect(formatTime('00:00'), '12:00 AM');
      expect(formatTime('12:00'), '12:00 PM');
    });

    test('ignores seconds beyond the first two parts', () {
      expect(formatTime('09:00:00'), '09:00 AM');
      expect(formatTime('17:45:30'), '05:45 PM');
    });

    test('returns the input unchanged for non-time strings', () {
      expect(formatTime('abc'), 'abc');
      expect(formatTime('9:xx'), '9:xx');
    });

    test('returns an empty string for missing input', () {
      expect(formatTime(null), '');
      expect(formatTime(''), '');
    });
  });

  group('day and month name helpers', () {
    test('maps day indices to short and full names', () {
      expect(getDayName(0), 'Sun');
      expect(getDayName(3), 'Wed');
      expect(getDayName(6), 'Sat');
      expect(getDayName(7), '');
      expect(getDayNameFull(0), 'Sunday');
      expect(getDayNameFull(6), 'Saturday');
      expect(getDayNameFull(7), '');
    });

    test('maps month indices to names', () {
      expect(getMonthName(0), 'January');
      expect(getMonthName(7), 'August');
      expect(getMonthName(11), 'December');
      expect(getMonthName(12), '');
    });
  });

  group('getWeekDays', () {
    test('returns the full week (Sunday to Saturday) containing the date', () {
      final week = getWeekDays(
        DateTime(2026, 8, 5),
        today: DateTime(2026, 8, 5, 9),
      );
      expect(week, hasLength(7));
      expect(week.map((day) => day.day), [
        'Sun',
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat',
      ]);
      expect(week.map((day) => day.date), [
        '2026-08-02',
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
      ]);
      expect(week.every((day) => day.isCurrentMonth), isTrue);
      expect(week[3].isToday, isTrue);
      expect(week[0].isToday, isFalse);
    });

    test('marks days from the adjacent month as not in the current month', () {
      final week = getWeekDays(
        DateTime(2026, 8, 1),
        today: DateTime(2026, 8, 10),
      );
      expect(week.first.day, 'Sun');
      expect(week.first.date, '2026-07-26');
      expect(week.first.isCurrentMonth, isFalse);
      expect(week.last.day, 'Sat');
      expect(week.last.date, '2026-08-01');
      expect(week.last.isCurrentMonth, isTrue);
    });
  });

  group('getMonthDays / getWeeksInMonth', () {
    test('builds a 6-row grid for August 2026 (starts Saturday, 31 days)', () {
      final grid = getMonthDays(2026, 7);
      expect(grid, hasLength(6));
      expect(grid.every((row) => row.length == 7), isTrue);

      final nonNull = [
        for (final row in grid)
          for (final day in row) ?day,
      ];
      expect(nonNull, hasLength(31));
      expect(
        nonNull.every((day) => day.month == 8 && day.year == 2026),
        isTrue,
      );

      expect(grid.first.take(6), everyElement(isNull));
      expect(grid.first[6], isNotNull);
      expect(grid.first[6]!.day, 1);
    });

    test('builds a 5-row grid for February 2025 (28 days, Saturday start)', () {
      final grid = getMonthDays(2025, 1);
      expect(grid, hasLength(5));
      final nonNull = [
        for (final row in grid)
          for (final day in row) ?day,
      ];
      expect(nonNull, hasLength(28));
      expect(grid.first[6], isNotNull);
      expect(grid.first[6]!.day, 1);
    });

    test('reports the row count as weeks in the month', () {
      expect(getWeeksInMonth(2026, 7), 6);
      expect(getWeeksInMonth(2025, 1), 5);
    });

    test('does not emit an all-null trailing week', () {
      expect(getMonthDays(2026, 0), hasLength(5));
      expect(getMonthDays(2026, 1), hasLength(4));
      expect(getWeeksInMonth(2026, 0), 5);
      expect(getWeeksInMonth(2026, 1), 4);
      expect(
        getMonthDays(
          2026,
          1,
        ).expand((row) => row).where((day) => day != null).length,
        28,
      );
    });
  });

  group('getDateRangeForMonth / getDateRangeForWeek', () {
    test('returns the first and last day of the month', () {
      expect(
        getDateRangeForMonth(2026, 7),
        const DateRange(start: '2026-08-01', end: '2026-08-31'),
      );
      expect(
        getDateRangeForMonth(2026, 1),
        const DateRange(start: '2026-02-01', end: '2026-02-28'),
      );
    });

    test('returns the Sunday-to-Saturday range of the week', () {
      expect(
        getDateRangeForWeek(DateTime(2026, 8, 5)),
        const DateRange(start: '2026-08-02', end: '2026-08-08'),
      );
    });
  });

  group('isSameDay', () {
    test('is true for the same calendar day at different times', () {
      expect(
        isSameDay(DateTime(2026, 8, 2, 1), DateTime(2026, 8, 2, 23, 59)),
        isTrue,
      );
    });

    test('is false across days, months, and years', () {
      expect(isSameDay(DateTime(2026, 8, 2), DateTime(2026, 8, 3)), isFalse);
      expect(isSameDay(DateTime(2026, 7, 2), DateTime(2026, 8, 2)), isFalse);
      expect(isSameDay(DateTime(2025, 8, 2), DateTime(2026, 8, 2)), isFalse);
    });
  });
}
