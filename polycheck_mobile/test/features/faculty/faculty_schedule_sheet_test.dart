import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/api.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/faculty_schedule_screen.dart';

const List<CalendarEvent> _events = <CalendarEvent>[
  CalendarEvent(
    id: 'sess-9',
    date: '2026-11-10',
    sectionId: 'sec-1',
    type: CalendarEventType.session,
    subjectName: 'Software Engineering',
    startTime: '09:00',
    endTime: '10:00',
    room: 'CEA 301',
  ),
  CalendarEvent(
    id: 'sess-10',
    date: '2026-11-10',
    sectionId: 'sec-2',
    type: CalendarEventType.session,
    subjectName: 'Capstone Project',
    startTime: '13:00',
    endTime: '14:30',
  ),
];

/// DD-F5 reproduction harness.
///
/// A `ShellRoute` page lives on the shell's **nested** navigator while the
/// modal sheet is hosted by the **root** navigator — exactly the arrangement
/// the old code mis-popped, which removed the page and left the awaited sheet
/// future unresolved (the sign-out crash class).
Future<void> _pumpShell(
  WidgetTester tester, {
  required void Function(CalendarEvent? event) onDayPicked,
  required void Function(bool? open) onEventPicked,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: PupTheme.light,
      home: Navigator(
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          builder: (pageContext) => Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Builder(
                    builder: (callerContext) => TextButton(
                      onPressed: () async {
                        onDayPicked(
                          await showModalBottomSheet<CalendarEvent>(
                            context: callerContext,
                            useRootNavigator: true,
                            builder: (_) =>
                                const FacultyDaySheet(events: _events),
                          ),
                        );
                      },
                      child: const Text('Open day'),
                    ),
                  ),
                  Builder(
                    builder: (callerContext) => TextButton(
                      onPressed: () async {
                        onEventPicked(
                          await showModalBottomSheet<bool>(
                            context: callerContext,
                            useRootNavigator: true,
                            builder: (_) =>
                                FacultyEventSheet(event: _events.first),
                          ),
                        );
                      },
                      child: const Text('Open event'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('a day-sheet tap inside the shell returns the tapped event', (
    tester,
  ) async {
    CalendarEvent? picked;
    await _pumpShell(
      tester,
      onDayPicked: (event) => picked = event,
      onEventPicked: (_) {},
    );

    await tester.tap(find.text('Open day'));
    await tester.pumpAndSettle();
    expect(find.byType(FacultyDaySheet), findsOneWidget);

    await tester.tap(find.text('Software Engineering'));
    await tester.pumpAndSettle();

    expect(
      picked?.id,
      'sess-9',
      reason: 'the tap delivers the event to the caller',
    );
    expect(
      find.byType(FacultyDaySheet),
      findsNothing,
      reason: 'the sheet itself is the route that popped',
    );
    expect(
      find.text('Open day'),
      findsOneWidget,
      reason: 'the page under the sheet must survive the pop',
    );
  });

  testWidgets('the event sheet pops true and leaves the page intact', (
    tester,
  ) async {
    bool? opened;
    await _pumpShell(
      tester,
      onDayPicked: (_) {},
      onEventPicked: (open) => opened = open,
    );

    await tester.tap(find.text('Open event'));
    await tester.pumpAndSettle();
    expect(find.byType(FacultyEventSheet), findsOneWidget);
    expect(find.text('CEA 301'), findsOneWidget);

    await tester.tap(find.text('Open session cockpit'));
    await tester.pumpAndSettle();

    expect(opened, isTrue);
    expect(find.byType(FacultyEventSheet), findsNothing);
    expect(find.text('Open event'), findsOneWidget);
  });
}
