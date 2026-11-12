import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/cockpit_dialogs.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/faculty_shell.dart';

import '../../helpers/auth_harness.dart';
import '../../router/nested_shell_harness.dart';

/// FX1: `showFacultyConfirm`/`confirmEndSession` must resolve on the dialog's
/// own navigator. In the real app every faculty page lives inside the
/// `FacultyShell` `ShellRoute` navigator while the dialog rides the root
/// navigator - the pre-fix caller-context `pop` removed the page and the
/// awaited future never completed.
class _ConfirmProbe extends StatefulWidget {
  const _ConfirmProbe({required this.mode});

  final _ProbeMode mode;

  @override
  State<_ConfirmProbe> createState() => _ConfirmProbeState();
}

enum _ProbeMode { facultyConfirm, endSession }

class _ConfirmProbeState extends State<_ConfirmProbe> {
  String _result = 'pending';

  Future<void> _run() async {
    final bool confirmed;
    switch (widget.mode) {
      case _ProbeMode.facultyConfirm:
        confirmed = await showFacultyConfirm(
          context,
          title: 'End this session?',
          message: 'Attendance closes now.',
          confirmLabel: 'End session',
          destructive: true,
        );
      case _ProbeMode.endSession:
        confirmed = await confirmEndSession(
          context,
          online: false,
          present: 3,
          late: 1,
          absent: 0,
          pendingCount: 2,
        );
    }
    if (!mounted) return;
    setState(() => _result = confirmed ? 'confirmed' : 'cancelled');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey<String>('confirm-probe-page'),
      appBar: AppBar(title: const Text('Probe')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Text('PROBE PAGE'),
            Text('result:$_result'),
            ElevatedButton(
              key: const ValueKey<String>('run-confirm'),
              onPressed: _run,
              child: const Text('run'),
            ),
          ],
        ),
      ),
    );
  }
}

Future<GoRouter> _pumpProbe(
  WidgetTester tester, {
  required _ProbeMode mode,
}) async {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(testFaculty)),
    ],
  );
  addTearDown(container.dispose);
  return pumpNestedShellApp(
    tester,
    container: container,
    initialLocation: '/faculty/probe',
    nestedRoutes: <RouteBase>[
      GoRoute(
        path: '/faculty/probe',
        builder: (context, state) => _ConfirmProbe(mode: mode),
      ),
      GoRoute(
        path: '/faculty/sessions',
        builder: (context, state) => const Scaffold(body: Text('sessions')),
      ),
    ],
  );
}

void main() {
  testWidgets('showFacultyConfirm resolves true inside the nested shell', (
    tester,
  ) async {
    await _pumpProbe(tester, mode: _ProbeMode.facultyConfirm);

    await tester.tap(find.byKey(const ValueKey<String>('run-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('End this session?'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'End session'));
    await tester.pumpAndSettle();

    expect(find.text('result:confirmed'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('confirm-probe-page')),
      findsOneWidget,
      reason: 'the dialog pop must not remove the page beneath',
    );
    expect(find.text('End this session?'), findsNothing);
  });

  testWidgets('showFacultyConfirm cancel keeps the page and resolves false', (
    tester,
  ) async {
    await _pumpProbe(tester, mode: _ProbeMode.facultyConfirm);

    await tester.tap(find.byKey(const ValueKey<String>('run-confirm')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    expect(find.text('result:cancelled'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('confirm-probe-page')),
      findsOneWidget,
    );
  });

  testWidgets('end-session confirmation resolves inside the nested shell', (
    tester,
  ) async {
    await _pumpProbe(tester, mode: _ProbeMode.endSession);

    await tester.tap(find.byKey(const ValueKey<String>('run-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('End this session?'), findsOneWidget);
    expect(find.textContaining('Attendance closes now'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'End session'));
    await tester.pumpAndSettle();

    expect(find.text('result:confirmed'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('confirm-probe-page')),
      findsOneWidget,
    );
  });

  testWidgets('barrier dismiss resolves false and leaves the page mounted', (
    tester,
  ) async {
    await _pumpProbe(tester, mode: _ProbeMode.facultyConfirm);

    await tester.tap(find.byKey(const ValueKey<String>('run-confirm')));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(8, 8));
    await tester.pumpAndSettle();

    expect(find.text('result:cancelled'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('confirm-probe-page')),
      findsOneWidget,
    );
  });
}
