import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/ai_api.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/utils/ai_terms.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/assistant_screen.dart';

import '../../helpers/auth_harness.dart';

AiCapabilities _ready({bool accepted = true, int remaining = 10}) =>
    AiCapabilities.fromJson(<String, dynamic>{
      'enabled': true,
      'provider': 'api.provider.example',
      'terms': <String, dynamic>{
        'version': aiTermsVersion,
        'accepted': accepted,
      },
      'usage': <String, dynamic>{
        'limit': 10,
        'used': 10 - remaining,
        'remaining': remaining,
        'resetsAt': DateTime.now()
            .add(const Duration(hours: 1))
            .toUtc()
            .toIso8601String(),
      },
    });

class _FakeAiApi extends AiApi {
  _FakeAiApi(this.capabilities) : super(Dio(), tokenStore: MemoryTokenStore());

  AiCapabilities capabilities;
  final List<String> accepted = <String>[];
  final List<AiChatSendInput> sends = <AiChatSendInput>[];

  @override
  Future<AiCapabilities> getCapabilities() async => capabilities;

  @override
  Future<AiCapabilities> acceptTerms(String version) async {
    accepted.add(version);
    return capabilities = _ready();
  }

  @override
  Future<List<AiThreadSummary>> listThreads() async =>
      const <AiThreadSummary>[];

  @override
  Future<AiChatSendResult> sendMessage(AiChatSendInput input) async {
    sends.add(input);
    return const AiChatSendResult(threadId: 't', messageId: 'm');
  }
}

Future<_FakeAiApi> _pump(
  WidgetTester tester,
  AiCapabilities capabilities,
  String userId,
) async {
  final api = _FakeAiApi(capabilities);
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(
        () => FakeSessionController(
          User(id: userId, fullName: 'Test Student', role: UserRole.student),
        ),
      ),
      aiApiProvider.overrideWithValue(api),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: BrandTheme.light,
        home: const AssistantScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('shows the terms first, with no way to send a message', (
    tester,
  ) async {
    final api = await _pump(tester, _ready(accepted: false), 'terms-gate');

    expect(find.text(aiTermsTitle), findsOneWidget);
    expect(
      find.text('AI provider in use: api.provider.example'),
      findsOneWidget,
    );
    expect(find.byType(TextField), findsNothing);
    expect(find.byTooltip('New chat'), findsNothing);
    // Every section can be read by scrolling.
    for (final section in aiTermsSections) {
      await tester.scrollUntilVisible(
        find.text(section.heading.toUpperCase()),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text(section.heading.toUpperCase()), findsOneWidget);
    }
    expect(api.accepted, isEmpty);
  });

  testWidgets('agreeing records the version and opens the chat', (
    tester,
  ) async {
    final api = await _pump(tester, _ready(accepted: false), 'terms-accept');

    expect(find.text(aiTermsAcceptLabel), findsOneWidget);
    await tester.tap(
      find.byKey(const ValueKey<String>('assistant-terms-accept')),
    );
    await tester.pumpAndSettle();

    expect(api.accepted, <String>[aiTermsVersion]);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('10 of 10 messages left today'), findsOneWidget);
  });

  testWidgets('cannot send once the messages for today are used up', (
    tester,
  ) async {
    final api = await _pump(tester, _ready(remaining: 0), 'terms-used-up');

    await tester.enterText(find.byType(TextField), 'Hello');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'), warnIfMissed: false);
    await tester.pump();

    expect(api.sends, isEmpty);
    expect(
      find.text('0 of 10 messages left today · resets at midnight'),
      findsOneWidget,
    );
  });

  testWidgets('an older server without terms goes straight to the chat', (
    tester,
  ) async {
    await _pump(tester, const AiCapabilities(enabled: true), 'terms-old');

    expect(find.byType(TextField), findsOneWidget);
    expect(find.text(aiTermsTitle), findsNothing);
    expect(find.byKey(const ValueKey<String>('assistant-usage')), findsNothing);
  });
}
