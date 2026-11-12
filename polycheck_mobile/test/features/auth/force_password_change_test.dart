import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_button.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/force_password_change_screen.dart';

import '../../helpers/auth_harness.dart';

void main() {
  const pendingStudent = User(
    id: 'student-1',
    fullName: 'Maria Santos',
    role: UserRole.student,
    mustChangePassword: true,
  );

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(
            () => FakeSessionController(pendingStudent),
          ),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const ForcePasswordChangeScreen(),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('live-validates the backend password policy and confirmation', (
    tester,
  ) async {
    await pumpScreen(tester);

    final fields = find.byType(TextField);
    expect(fields, findsNWidgets(3));

    CampusButton button() => tester.widget<CampusButton>(
      find.widgetWithText(CampusButton, 'Change password'),
    );

    expect(button().onPressed, isNull);

    await tester.enterText(fields.at(1), 'StrongPassw0rd!');
    await tester.pump();
    await tester.enterText(fields.at(2), 'DifferentPassw0rd!');
    await tester.pump();

    expect(
      find.text('The password confirmation does not match.'),
      findsOneWidget,
    );
    expect(button().onPressed, isNull);

    await tester.enterText(fields.at(2), 'StrongPassw0rd!');
    await tester.pump();

    expect(
      find.text('The password confirmation does not match.'),
      findsNothing,
    );
    expect(button().onPressed, isNotNull);
  });

  testWidgets('a short password keeps submit disabled', (tester) async {
    await pumpScreen(tester);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(1), 'Short1!');
    await tester.pump();
    await tester.enterText(fields.at(2), 'Short1!');
    await tester.pump();

    final button = tester.widget<CampusButton>(
      find.widgetWithText(CampusButton, 'Change password'),
    );
    expect(button.onPressed, isNull);
    expect(find.text('Use at least 12 characters.'), findsOneWidget);
  });
}
