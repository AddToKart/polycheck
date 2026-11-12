import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/student_month_calendar.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/timetable_card.dart';

import 'student_test_harness.dart';

/// Fixed fixture date (Tuesday). The harness schedule weekday is pinned to
/// this date so the month-events tests never depend on the real "today" —
/// before this seam, the suite failed on every day except Tuesday.
final DateTime _pinnedToday = DateTime.parse('2026-11-10T12:00:00');

StudentMonthEvent _event({
  required String date,
  AttendanceStatus? status,
  String startTime = '09:00',
}) {
  return StudentMonthEvent(
    date: date,
    section: testSection(now: _pinnedToday),
    slot: ScheduleDay(
      day: DayOfWeek.fromWire(todayDayWire(now: _pinnedToday)),
      startTime: startTime,
      endTime: '10:30',
    ),
    record: status == null ? null : testRecord(status: status),
  );
}

void main() {
  final today = _pinnedToday;

  test(
    'month events expand the weekly schedule over every matching weekday',
    () {
      final events = buildStudentMonthEvents(
        year: 2026,
        month: 10, // November (0-based).
        sections: <Section>[testSection(now: today)],
        sessions: const <Session>[],
        records: const <AttendanceRecord>[],
      );

      // Nov 2026 starts on Sunday; the harness schedule repeats the pinned
      // Tuesday (2026-11-10).
      expect(events.keys, isNotEmpty);
      final times = <String>{};
      for (final value in events.values) {
        final dateWire = value.single;
        expect(dateWire.date, allOf(isNotEmpty, hasLength(10)));
        times.add(dateWire.slot.startTime);
      }
      expect(times, <String>{'09:00'});
    },
  );

  test(
    'same-date session merges into the schedule event and carries status',
    () {
      final date = formatDate(today);
      final events = buildStudentMonthEvents(
        year: today.year,
        month: today.month - 1,
        sections: <Section>[testSection(now: today)],
        sessions: <Session>[testSession(date: date)],
        records: <AttendanceRecord>[
          testRecord(status: AttendanceStatus.disputed),
        ],
      );

      final list = events[date]!;
      expect(list.single.record?.status, AttendanceStatus.disputed);
      expect(list.single.session, isNotNull);
    },
  );

  test('off-schedule session (make-up class) still plots without crashing', () {
    // Wednesday, not the pinned Tuesday schedule. Production previously
    // null-checked the missing schedule bucket and crashed.
    const date = '2026-11-11';
    final events = buildStudentMonthEvents(
      year: 2026,
      month: 10,
      sections: <Section>[testSection(now: today)],
      sessions: <Session>[testSession(date: date)],
      records: const <AttendanceRecord>[],
    );

    final list = events[date]!;
    expect(list.single.session, isNotNull);
    expect(list.single.slot.startTime, '09:00');
  });

  test(
    'dot colors follow the PUP status palette (incl. disputed gold border)',
    () {
      expect(
        studentMonthDotStyle(AttendanceStatus.present, isDark: false),
        const StudentMonthDotStyle(
          fill: PupColors.pupGold,
          border: PupColors.pupGold,
        ),
      );
      expect(
        studentMonthDotStyle(AttendanceStatus.late, isDark: false),
        const StudentMonthDotStyle(
          fill: PupColors.pupMaroon,
          border: PupColors.pupMaroon,
        ),
      );
      expect(
        studentMonthDotStyle(AttendanceStatus.absent, isDark: false).fill,
        PupColors.pupDeepMaroon,
      );
      final disputed = studentMonthDotStyle(
        AttendanceStatus.disputed,
        isDark: false,
      );
      expect(disputed.fill, PupColors.pupDeepMaroon);
      expect(disputed.border, PupColors.pupGold);

      // Plain scheduled meetings draw the muted event dot (RN zinc parity).
      final scheduled = studentMonthDotStyle(null, isDark: false);
      expect(scheduled.fill, PupColors.muted);
      expect(scheduled.border, PupColors.muted);
    },
  );

  testWidgets('grid draws dots and taps a day cell back through onSelectDay', (
    tester,
  ) async {
    final pressed = <String>[];
    final date = formatDate(today);
    final events = <String, List<StudentMonthEvent>>{
      date: <StudentMonthEvent>[_event(date: date)],
    };
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudentMonthCalendar(
            year: today.year,
            month: today.month - 1,
            events: events,
            today: today,
            selectedDate: '',
            onSelectDay: pressed.add,
          ),
        ),
      ),
    );
    await tester.pump();

    // Bug 4: cells render through the shared CampusMonthCell; the day's dot
    // lives inside the date-keyed cell.
    final cell = find.byKey(ValueKey('month-cell-$date'));
    expect(cell, findsOneWidget);
    expect(
      find.descendant(
        of: cell,
        matching: find.byKey(const ValueKey('campus-month-dot-0')),
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('10'));
    await tester.pump();

    expect(pressed, <String>[date]);
  });

  testWidgets('day drilldown sheet lists that day through the week-row card', (
    tester,
  ) async {
    final date = '2026-11-10';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudentMonthDaySheet(
            events: <StudentMonthEvent>[
              _event(date: date, status: AttendanceStatus.present),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(TimetableCard), findsOneWidget);
    expect(find.text('Present'), findsOneWidget);
  });

  testWidgets('day drilldown sheet uses the RN empty-day copy', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: StudentMonthDaySheet(events: [])),
      ),
    );
    await tester.pump();

    expect(find.text('No classes this day'), findsOneWidget);
  });
}
