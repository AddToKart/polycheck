import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/device_now.dart';
import 'package:polycheck_mobile/src/core/providers/maintenance_provider.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/providers/trusted_clock.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/maintenance_screen.dart';

import '../../helpers/auth_harness.dart';

void main() {
  testWidgets('maintenance screen shows message, preservation notice, and '
      'trusted-clock countdown', (tester) async {
    var now = DateTime.utc(2026, 11, 10, 8);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(() => FakeSessionController(null)),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(
              const MaintenanceState(
                enabled: true,
                message: 'Scheduled database upgrade.',
                estimatedEnd: '2026-11-10T08:10:00.000Z',
              ),
            ),
          ),
          trustedClockProvider.overrideWith(
            () => FakeTrustedClock(const TrustedClock()),
          ),
          deviceNowProvider.overrideWithValue(() => now),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const MaintenanceScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(
      find.text('Polycheck is under scheduled maintenance'),
      findsOneWidget,
    );
    expect(find.text('Scheduled database upgrade.'), findsOneWidget);
    expect(find.text('YOUR RECORDS ARE SAFE'), findsOneWidget);
    expect(find.text('Estimated resumption in 10 min'), findsOneWidget);

    now = now.add(const Duration(minutes: 11));
    await tester.pump(const Duration(seconds: 1));

    expect(
      find.text('Resumption is overdue - contact the IT desk'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('exempt users see the exemption notice variant', (tester) async {
    const itCoordinator = User(
      id: 'teacher-it',
      fullName: 'IT Coordinator',
      role: UserRole.teacher,
      isItCoordinator: true,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(
            () => FakeSessionController(itCoordinator),
          ),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(
              const MaintenanceState(
                enabled: true,
                message: 'Scheduled database upgrade.',
              ),
            ),
          ),
          trustedClockProvider.overrideWith(
            () => FakeTrustedClock(const TrustedClock()),
          ),
          deviceNowProvider.overrideWithValue(DateTime.now),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const MaintenanceScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('MAINTENANCE EXEMPTION ACTIVE'), findsOneWidget);
    expect(find.text('Continue with exemption'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}
