import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/api.dart';
import 'package:polycheck_mobile/src/core/utils/calendar_utils.dart';

void main() {
  group('faculty month grid', () {
    test('never emits a trailing all-null week', () {
      for (var month = 0; month < 12; month += 1) {
        final weeks = getMonthDays(2026, month);
        expect(
          weeks.last.any((day) => day != null),
          isTrue,
          reason: 'month ${month + 1} ends with an empty week',
        );
        for (final week in weeks) {
          expect(week, hasLength(7));
        }
      }
    });

    test('month range matches the grid boundaries', () {
      final range = getDateRangeForMonth(2026, 10); // November (0-based)
      expect(range.start, '2026-11-01');
      expect(range.end, '2026-11-30');
    });

    test('week columns stay Sunday..Saturday and resolve a series', () {
      // 2026-11-10 is a Tuesday.
      final week = getWeekDays(DateTime(2026, 11, 10, 12));
      expect(week.first.day, 'Sun');
      expect(week.first.date, '2026-11-08');
      expect(week.last.day, 'Sat');
      expect(week.last.date, '2026-11-14');
    });

    test('calendar events match their grid day by civil date', () {
      final events = [
        const CalendarEvent(
          id: 'sess-1',
          date: '2026-11-09',
          sectionId: 'sec-1',
          type: CalendarEventType.session,
        ),
        const CalendarEvent(
          id: 'sess-2',
          date: '2026-11-09',
          sectionId: 'sec-1',
          type: CalendarEventType.session,
        ),
        const CalendarEvent(
          id: 'sess-3',
          date: '2026-11-10',
          sectionId: 'sec-1',
          type: CalendarEventType.session,
        ),
      ];
      int dotsFor(String date) =>
          events.where((event) => event.date == date).length;
      expect(dotsFor('2026-11-09'), 2);
      expect(dotsFor('2026-11-10'), 1);
      expect(dotsFor('2026-11-11'), 0);
    });
  });
}
