import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/ai_api.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/users_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/features/surface/data/notification_inbox_controller.dart';
import 'package:polycheck_mobile/src/features/surface/data/surface_paths.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/profile_screen.dart';

import '../../helpers/auth_harness.dart';

/// Saved contact details must still be there after leaving the profile and
/// coming back. The email is what "forgot password" sends to, so a profile that
/// looks empty again reads as "it did not bind".
class _FakeUsersApi extends UsersApi {
  _FakeUsersApi() : super(Dio());

  @override
  Future<User> updateContacts(UpdateContactsInput input) async {
    // Like the server, the reply carries the contacts but not the privacy
    // consent or scope fields.
    return User(
      id: testStudent.id,
      fullName: testStudent.fullName,
      role: UserRole.student,
      studentId: testStudent.studentId,
      program: testStudent.program,
      yearLevel: testStudent.yearLevel,
      contactEmail: input.contactEmail!.isEmpty ? null : input.contactEmail,
      contactPhone: input.contactPhone!.isEmpty ? null : input.contactPhone,
    );
  }
}

class _FakeAiApi extends AiApi {
  _FakeAiApi() : super(Dio(), tokenStore: MemoryTokenStore());

  @override
  Future<AiCapabilities> getCapabilities() async =>
      const AiCapabilities(enabled: false, policyBlocked: false);
}

class _FakeInbox extends NotificationInboxController {
  @override
  NotificationInboxState build() => const NotificationInboxState();
}

final User _consented = testStudent.copyWith(
  privacyConsentVersion: '2026-11-26',
  privacyConsentedAt: '2026-11-26T00:00:00.000Z',
);

void main() {
  Future<ProviderContainer> setUpContainer(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final database = createTestDatabase();
    addTearDown(database.close);
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(() => FakeSessionController(_consented)),
        sessionApiProvider.overrideWithValue(
          FakeSessionApi(onMe: () async => throw StateError('offline')),
        ),
        usersApiProvider.overrideWithValue(_FakeUsersApi()),
        aiApiProvider.overrideWithValue(_FakeAiApi()),
        appDatabaseProvider.overrideWithValue(database),
        notificationInboxProvider.overrideWith(_FakeInbox.new),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Future<void> openProfile(
    WidgetTester tester,
    ProviderContainer container,
  ) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: BrandTheme.light,
          // A fresh key is a fresh screen, as after navigating away and back.
          home: ProfileScreen(key: UniqueKey(), tab: ProfileTab.contacts),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Finder field(String hint) => find.byWidgetPredicate(
    (widget) => widget is TextField && widget.decoration?.hintText == hint,
  );

  String textOf(WidgetTester tester, String hint) =>
      tester.widget<TextField>(field(hint)).controller!.text;

  const emailHint = 'you@example.com';
  const phoneHint = '+63 917 123 4567';

  Future<void> save(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Save contacts'));
    await tester.pump();
    await tester.tap(find.text('Save contacts'));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(seconds: 5));
  }

  testWidgets('saved contacts are still there after reopening the profile', (
    tester,
  ) async {
    final container = await setUpContainer(tester);
    await openProfile(tester, container);

    await tester.enterText(field(emailHint), 'maria@example.com');
    await tester.enterText(field(phoneHint), '+63 917 123 4567');
    await tester.pump();
    await save(tester);

    await openProfile(tester, container);

    expect(textOf(tester, emailHint), 'maria@example.com');
    expect(textOf(tester, phoneHint), '+63 917 123 4567');
    final stored = container.read(sessionProvider).user!;
    expect(stored.contactEmail, 'maria@example.com');
    // The partial reply must not wipe what it does not carry, or the privacy
    // consent popup would return.
    expect(stored.privacyConsentVersion, '2026-11-26');
    expect(stored.privacyConsentedAt, isNotNull);
    expect(stored.program, testStudent.program);
  });

  testWidgets('clearing a contact stays cleared', (tester) async {
    final container = await setUpContainer(tester);
    await openProfile(tester, container);
    await tester.enterText(field(emailHint), 'maria@example.com');
    await tester.pump();
    await save(tester);

    await openProfile(tester, container);
    await tester.enterText(field(emailHint), '');
    await tester.pump();
    await save(tester);
    await openProfile(tester, container);

    expect(textOf(tester, emailHint), '');
    expect(container.read(sessionProvider).user!.contactEmail, isNull);
  });
}
