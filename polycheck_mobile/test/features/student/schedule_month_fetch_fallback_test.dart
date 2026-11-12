import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/student_month_calendar.dart';
import 'package:polycheck_mobile/src/features/student/presentation/schedule/student_schedule_screen.dart';

import 'student_test_harness.dart';

/// A non-`ApiRequestError` failure: the old month fetch only caught
/// `ApiRequestError`, so this class of failure escaped and the grid rendered
/// silently empty with no retry.
class _ExplodingSessionsApi extends SessionsApi {
  _ExplodingSessionsApi() : super(Dio());

  @override
  Future<List<Session>> getSessions({String? sectionId}) async {
    throw StateError('session decoder exploded');
  }
}

/// DD-F14: any month-fetch failure degrades to the cached month and stays
/// visible as a retryable state.
void main() {
  test('a non-ApiRequestError falls back to the cached month', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    await database.upsertSessions(studentUser.id, <Session>[
      testSession(id: 'cached-sess'),
    ]);

    final result = await fetchStudentMonthSessions(
      database,
      _ExplodingSessionsApi(),
      studentUser,
    );

    expect(result.fromCache, isTrue);
    expect(result.hasError, isTrue);
    expect(result.error, isNotNull);
    expect(result.sessions.map((session) => session.id), <String>[
      'cached-sess',
    ]);
  });

  test('an ApiRequestError keeps the same fallback shape', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);

    final result = await fetchStudentMonthSessions(
      database,
      _ThrowingSessionsApi(
        const ApiRequestError(message: 'offline', status: 0),
      ),
      studentUser,
    );

    expect(result.fromCache, isTrue);
    expect(result.error, 'offline');
    expect(result.sessions, isEmpty);
  });

  testWidgets('the month view renders the cached fallback plus a retry', (
    tester,
  ) async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final date = todayCampusDate();
    await database.upsertSessions(studentUser.id, <Session>[
      testSession(id: 'cached-sess', date: date),
    ]);

    var fetches = 0;
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
        appDatabaseProvider.overrideWithValue(database),
        studentMonthSessionsProvider.overrideWith((ref, arg) {
          fetches += 1;
          return fetchStudentMonthSessions(
            database,
            _ExplodingSessionsApi(),
            studentUser,
          );
        }),
      ],
    );

    await tester.tap(find.byKey(const ValueKey('schedule-view-month')));
    await tester.pump();
    await tester.pump();

    expect(fetches, 1);
    expect(find.byKey(const ValueKey('month-sessions-error')), findsOneWidget);
    expect(find.text('Showing saved sessions'), findsOneWidget);
    expect(find.byKey(const ValueKey('month-sessions-retry')), findsOneWidget);

    // The cached session still plots: the month is not silently empty.
    final cell = find.byKey(ValueKey('month-cell-$date'));
    expect(cell, findsOneWidget);
    expect(
      find.descendant(
        of: cell,
        matching: find.byKey(const ValueKey('campus-month-dot-0')),
      ),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('month-sessions-retry')));
    await tester.pump();
    await tester.pump();

    expect(fetches, 2);
    expect(tester.takeException(), isNull);
  });
}

class _ThrowingSessionsApi extends SessionsApi {
  _ThrowingSessionsApi(this.error) : super(Dio());

  final Object error;

  @override
  Future<List<Session>> getSessions({String? sectionId}) async {
    throw error;
  }
}
