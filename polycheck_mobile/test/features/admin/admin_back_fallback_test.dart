import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_access.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/admin_common.dart';

import '../../helpers/auth_harness.dart';

/// Gap report B-13: the admin console suppressed every back affordance
/// (`automaticallyImplyLeading: false`). Now deep-linked console screens
/// (notifications → `router.go`) keep a fallback BackButton that returns to
/// the account's console landing, and pushed screens get the system back.
Future<void> _pumpHeader(WidgetTester tester, User user) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(user)),
      ],
      child: MaterialApp(
        home: AdminScaffold(
          title: 'User management',
          section: AdminSection.users,
          body: const Text('console body'),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('console screens keep a back affordance when deep-linked', (
    tester,
  ) async {
    await _pumpHeader(tester, testAdmin);

    expect(find.text('User management'), findsOneWidget);
    expect(find.byKey(const ValueKey('admin-back-fallback')), findsOneWidget);
    // The section popup stays for tab-style switching.
    expect(find.byTooltip('Administrator sections'), findsOneWidget);
  });

  testWidgets('canBack: false still suppresses the header back affordance', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(() => FakeSessionController(testAdmin)),
        ],
        child: MaterialApp(
          home: AdminScaffold(
            title: 'User management',
            section: AdminSection.users,
            canBack: false,
            body: const Text('console body'),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const ValueKey('admin-back-fallback')), findsNothing);
  });

  testWidgets(
    'denied teachers see the designation explainer with a home exit',
    (tester) async {
      await _pumpHeader(tester, testFaculty);

      expect(find.text('Administrator access required'), findsOneWidget);
      expect(find.text('Back to my home'), findsOneWidget);
    },
  );
}
