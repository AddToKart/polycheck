import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/student_month_calendar.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/student_schedule_screen.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/timetable_card.dart';

import 'student_test_harness.dart';

/// Bug 3 regression: the outer schedule ListView used to swap a plain week
/// child for a month child that watched providers inside the sliver; a
/// provider completing mid-diff crashed
/// (`sliver_multi_box_adaptor.dart: child == null || indexOf(child) > index`).
/// The watches now live at screen level and the ListView is keyed by view.
void main() {
  testWidgets('week→month toggle survives a late month-sessions completion', (
    tester,
  ) async {
    final completer = Completer<StudentMonthSessions>();
    await pumpStudentScreen(
      tester,
      const StudentScheduleScreen(),
      overrides: <Override>[
        studentSectionsProvider.overrideWith(
          (ref) => Stream.value(<Section>[testSection()]),
        ),
        studentSubjectsProvider.overrideWith(
          (ref) async => <String, Subject>{'subj-1': testSubject},
        ),
        myAttendanceProvider.overrideWith(
          (ref) => Stream.value(<AttendanceRecord>[]),
        ),
        studentMonthSessionsProvider.overrideWith(
          (ref, arg) => completer.future,
        ),
      ],
    );
    await tester.pump();

    // Week view renders the timetable row for today's slot.
    expect(find.byType(TimetableCard), findsOneWidget);

    // Toggle to Month while the sessions future is still pending.
    await tester.tap(find.byKey(const ValueKey('schedule-view-month')));
    await tester.pump();
    expect(find.byType(StudentMonthCalendar), findsOneWidget);
    expect(find.text('Loading your sessions…'), findsOneWidget);

    // The provider completes after the sliver is on stage (production: the
    // drift upsert lands mid-diff).
    completer.complete(
      StudentMonthSessions(
        sessions: <Session>[testSession(date: todayCampusDate())],
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(StudentMonthCalendar), findsOneWidget);
    expect(find.text('Loading your sessions…'), findsNothing);
    expect(
      find.byKey(ValueKey('month-cell-${todayCampusDate()}')),
      findsOneWidget,
    );

    // Back to Week — teardown + rebuild without exception.
    await tester.tap(find.byKey(const ValueKey('schedule-view-week')));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.byType(TimetableCard), findsOneWidget);
  });

  testWidgets('month view renders session dots once data is available', (
    tester,
  ) async {
    final date = todayCampusDate();
    await pumpStudentScreen(
      tester,
      const StudentScheduleScreen(),
      overrides: <Override>[
        studentSectionsProvider.overrideWith(
          (ref) => Stream.value(<Section>[testSection()]),
        ),
        studentSubjectsProvider.overrideWith(
          (ref) async => <String, Subject>{'subj-1': testSubject},
        ),
        myAttendanceProvider.overrideWith(
          (ref) => Stream.value(<AttendanceRecord>[]),
        ),
        studentMonthSessionsProvider.overrideWith(
          (ref, arg) async => StudentMonthSessions(
            sessions: <Session>[testSession(date: date)],
          ),
        ),
      ],
    );
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('schedule-view-month')));
    await tester.pump();
    await tester.pump();

    expect(tester.takeException(), isNull);
    final cell = find.byKey(ValueKey('month-cell-$date'));
    expect(cell, findsOneWidget);
    expect(
      find.descendant(
        of: cell,
        matching: find.byKey(const ValueKey('campus-month-dot-0')),
      ),
      findsOneWidget,
    );
  });
}
