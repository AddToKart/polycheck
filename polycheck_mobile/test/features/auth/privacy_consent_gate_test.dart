import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/widgets/privacy_consent_gate.dart';

import '../../helpers/auth_harness.dart';

const _notice = PrivacyNotice(
  version: '2026-09-05',
  url: 'https://app.polycheck.live/privacy',
  summary: 'Polycheck stores attendance evidence.',
);

void main() {
  Future<void> pumpGate(WidgetTester tester, FakeSessionApi api) async {
    final database = createTestDatabase();
    addTearDown(database.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionApiProvider.overrideWithValue(api),
          appDatabaseProvider.overrideWithValue(database),
          sessionProvider.overrideWith(
            () => FakeSessionController(testStudent),
          ),
        ],
        child: MaterialApp(
          theme: BrandTheme.light,
          home: const Stack(children: [PrivacyConsentGate()]),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> consent(WidgetTester tester) async {
    final button = find.text('I understand and consent');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
  }

  testWidgets('consent closes the gate using the profile the call returned, '
      'without a second profile request', (tester) async {
    String? sentVersion;
    var profileReloads = 0;
    final api = FakeSessionApi(
      onPrivacyNotice: () async => _notice,
      onAcceptPrivacy: (version) async {
        sentVersion = version;
        return testStudent.copyWith(
          privacyConsentVersion: version,
          privacyConsentedAt: '2026-11-26T03:00:00.000Z',
        );
      },
      // A flaky second request must not matter: it is never made.
      onMe: () async {
        profileReloads += 1;
        throw const ApiRequestError(message: 'offline', status: 0);
      },
    );
    await pumpGate(tester, api);
    expect(find.text('Attendance uses location evidence'), findsOneWidget);

    await consent(tester);

    expect(sentVersion, '2026-09-05');
    expect(profileReloads, 0);
    expect(find.text('Attendance uses location evidence'), findsNothing);
    expect(find.textContaining('Unable to record'), findsNothing);
  });

  testWidgets('a refused consent shows the server status and reason', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onPrivacyNotice: () async => _notice,
      onAcceptPrivacy: (version) async => throw const ApiRequestError(
        message: 'The current privacy notice must be accepted',
        status: 403,
      ),
    );
    await pumpGate(tester, api);

    await consent(tester);

    expect(
      find.textContaining(
        'error 403: The current privacy notice must be accepted',
      ),
      findsOneWidget,
    );
    expect(find.text('Attendance uses location evidence'), findsOneWidget);
  });

  test('describes network and unexpected failures plainly', () {
    expect(
      describeConsentError(const ApiRequestError(message: 'x', status: 0)),
      contains('Cannot reach the Polycheck server'),
    );
    expect(
      describeConsentError(const ApiRequestError(message: '', status: 502)),
      contains('error 502)'),
    );
    expect(describeConsentError(StateError('boom')), contains('StateError'));
  });
}
