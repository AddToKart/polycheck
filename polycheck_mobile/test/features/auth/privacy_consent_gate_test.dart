import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/utils/legal_links.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/widgets/privacy_consent_gate.dart';

import '../../helpers/auth_harness.dart';

const _notice = PrivacyNotice(
  version: '2026-11-26',
  url: 'https://polycheck.live/privacy',
  summary: 'PolyCheck stores attendance evidence.',
);

void main() {
  Future<void> pumpGate(
    WidgetTester tester,
    FakeSessionApi api, {
    ExternalLinkOpener? opener,
  }) async {
    final database = createTestDatabase();
    addTearDown(database.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionApiProvider.overrideWithValue(api),
          if (opener != null)
            externalLinkOpenerProvider.overrideWithValue(opener),
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

    expect(sentVersion, '2026-11-26');
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

  Future<void> tapLink(WidgetTester tester, String label) async {
    final link = find.text(label);
    await tester.ensureVisible(link);
    await tester.tap(link);
    await tester.pumpAndSettle();
  }

  testWidgets('both legal links open in the browser', (tester) async {
    final opened = <Uri>[];
    await pumpGate(
      tester,
      FakeSessionApi(onPrivacyNotice: () async => _notice),
      opener: (uri) async {
        opened.add(uri);
        return true;
      },
    );

    await tapLink(tester, 'Read the complete privacy notice');
    await tapLink(tester, 'Read the Terms & Conditions');

    expect(opened.map((uri) => '$uri'), [_notice.url, LegalLinks.terms]);
    expect(find.text('Copy link'), findsNothing);
  });

  testWidgets('if no browser can open it, the address can still be copied', (
    tester,
  ) async {
    await pumpGate(
      tester,
      FakeSessionApi(onPrivacyNotice: () async => _notice),
      opener: (uri) async => throw StateError('no browser'),
    );

    await tapLink(tester, 'Read the complete privacy notice');

    expect(find.text('Copy link'), findsOneWidget);
    expect(find.text(_notice.url), findsOneWidget);
  });

  test('the public legal links point at the landing site', () {
    expect(LegalLinks.privacy, 'https://polycheck.live/privacy');
    expect(LegalLinks.terms, 'https://polycheck.live/terms');
  });

  test('describes network and unexpected failures plainly', () {
    expect(
      describeConsentError(const ApiRequestError(message: 'x', status: 0)),
      contains('Cannot reach the PolyCheck server'),
    );
    expect(
      describeConsentError(const ApiRequestError(message: '', status: 502)),
      contains('error 502)'),
    );
    expect(describeConsentError(StateError('boom')), contains('StateError'));
  });
}
