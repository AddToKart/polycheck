import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/main.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/providers/maintenance_provider.dart';

import '../../helpers/auth_harness.dart';

void main() {
  testWidgets('portal renders the PUP landing and role cards', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(const MaintenanceState()),
          ),
        ],
        child: const PolycheckApp(bootstrap: false),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Polycheck'), findsOneWidget);
    expect(find.text('Student'), findsOneWidget);
    expect(find.text('Faculty & Staff'), findsOneWidget);
    expect(find.text('Version 1.0.0'), findsOneWidget);
  });

  testWidgets('student card navigates to the student login form', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(const MaintenanceState()),
          ),
        ],
        child: const PolycheckApp(bootstrap: false),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Student'));
    await tester.pumpAndSettle();

    expect(find.text('Student sign in'), findsOneWidget);
    expect(find.text('Student number'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
  });

  testWidgets('faculty card navigates to the faculty login form', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(const MaintenanceState()),
          ),
        ],
        child: const PolycheckApp(bootstrap: false),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Faculty & Staff'));
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsWidgets);
    expect(find.text('Institutional email'), findsOneWidget);
  });

  testWidgets('public maintenance status replaces the portal', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(
              const MaintenanceState(
                enabled: true,
                message: 'Scheduled database upgrade.',
                estimatedEnd: '2026-11-10T12:00:00.000Z',
              ),
            ),
          ),
        ],
        child: const PolycheckApp(bootstrap: false),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(
      find.text('Polycheck is under scheduled maintenance'),
      findsOneWidget,
    );
    expect(find.text('YOUR RECORDS ARE SAFE'), findsOneWidget);
    expect(find.text('Administrator login'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}
