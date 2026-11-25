import 'dart:async';

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
import 'package:polycheck_mobile/src/features/surface/presentation/assistant_screen.dart';

import '../../helpers/auth_harness.dart';

/// Scripted subscription: records whether it was opened and lets the test
/// push stream events.
class _ScriptedSubscription implements AiThreadSubscription {
  _ScriptedSubscription(this.threadId);

  final String threadId;
  final StreamController<AiStreamEvent> _controller =
      StreamController<AiStreamEvent>.broadcast();
  bool closed = false;

  @override
  Stream<AiStreamEvent> get events => _controller.stream;

  void emit(AiStreamEvent event) {
    if (!_controller.isClosed) _controller.add(event);
  }

  @override
  Future<void> close() async {
    closed = true;
    if (!_controller.isClosed) await _controller.close();
  }
}

/// Records the exact `AiChatSendInput` bodies so the tests can assert
/// regenerate content/draft preservation (FLF-01) and the stop race (FLF-04).
class _ScriptedAiApi extends AiApi {
  _ScriptedAiApi() : super(Dio(), tokenStore: MemoryTokenStore());

  final List<AiChatSendInput> sends = <AiChatSendInput>[];
  final List<_ScriptedSubscription> subscriptions = <_ScriptedSubscription>[];

  /// Completes the NEXT `sendMessage` call; set by a test that wants to hold
  /// the POST open (the Stop-during-HTTP window).
  Completer<AiChatSendResult>? holdNextSend;

  @override
  Future<AiCapabilities> getCapabilities() async =>
      const AiCapabilities(enabled: true);

  @override
  Future<List<AiThreadSummary>> listThreads() async =>
      const <AiThreadSummary>[];

  @override
  Future<AiChatThread> getThread(String threadId) async =>
      AiChatThread(id: threadId);

  @override
  Future<AiChatSendResult> sendMessage(AiChatSendInput input) async {
    sends.add(input);
    final held = holdNextSend;
    if (held != null) {
      holdNextSend = null;
      return held.future;
    }
    return const AiChatSendResult(
      threadId: 'thread-1',
      messageId: 'assistant-2',
    );
  }

  @override
  Future<AiThreadSubscription> openThreadStream(String threadId) async {
    final subscription = _ScriptedSubscription(threadId);
    subscriptions.add(subscription);
    return subscription;
  }
}

/// `_lastThreadByUser` is process-lifetime, so every test gets its own account
/// id and therefore a clean (unrestored) assistant.
User _student(String suffix) => User(
  id: 'stop-regenerate-$suffix',
  fullName: 'Maria Santos',
  role: UserRole.student,
  studentId: '2024-00123-MN-0',
);

Future<_ScriptedAiApi> _pumpAssistant(WidgetTester tester, User user) async {
  final api = _ScriptedAiApi();
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
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

Finder _composer() => find.byType(TextField);
Finder _regenerateButton() => find.byTooltip('Regenerate reply');

void main() {
  testWidgets(
    'FLF-01: regenerate re-sends the last user turn and keeps the draft',
    (tester) async {
      final api = await _pumpAssistant(tester, _student('regen'));
      expect(api.sends, isEmpty);

      // Turn 1: a normal send. Nothing is held, so the POST resolves.
      await tester.enterText(_composer(), 'How many absences do I have?');
      await tester.pump();
      await tester.tap(find.byTooltip('Send message'));
      await tester.pump();
      await tester.pump();
      expect(api.sends, hasLength(1));
      expect(api.subscriptions, hasLength(1));

      // Complete the turn through the scripted stream.
      api.subscriptions.single.emit(
        const AiStreamDone(
          threadId: 'thread-1',
          message: AiChatMessage(
            id: 'assistant-2',
            threadId: 'thread-1',
            role: AiChatRole.assistant,
            content: 'You have three absences.',
            createdAt: '2026-11-10T08:00:05.000Z',
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('You have three absences.'), findsOneWidget);

      // The teacher starts typing a next message but has not sent it.
      await tester.enterText(_composer(), 'and my standing?');
      await tester.pump();

      await tester.tap(_regenerateButton());
      await tester.pump();
      await tester.pump();

      expect(api.sends, hasLength(2));
      final body = api.sends.last;
      expect(body.regenerate, isTrue);
      expect(
        body.message,
        'How many absences do I have?',
        reason: 'web parity: regenerate re-sends the last user message',
      );
      expect(body.threadId, 'thread-1');

      // The unsent draft survived — regenerate never reads or clears it.
      final field = tester.widget<TextField>(_composer());
      expect(field.controller!.text, 'and my standing?');
    },
  );

  testWidgets(
    'FLF-04: Stop during the in-flight POST never adopts the stream',
    (tester) async {
      final api = await _pumpAssistant(tester, _student('stop'));

      final hold = Completer<AiChatSendResult>();
      api.holdNextSend = hold;

      await tester.enterText(_composer(), 'Summarize this term');
      await tester.pump();
      await tester.tap(find.byTooltip('Send message'));
      await tester.pump();

      // The POST is in flight. Stop must be reachable and must win.
      expect(api.sends, hasLength(1));
      expect(find.byTooltip('Stop generating'), findsOneWidget);

      await tester.tap(find.byTooltip('Stop generating'));
      await tester.pump();

      // The server side completed after the stop: a thread was claimed.
      hold.complete(
        const AiChatSendResult(threadId: 'thread-1', messageId: 'assistant-2'),
      );
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(
        api.subscriptions,
        isEmpty,
        reason: 'a stopped turn must never subscribe or arm reply timers',
      );
      expect(find.text('Sending.'), findsNothing);
      // The idle composer is back so the teacher can send again.
      expect(find.byTooltip('Send message'), findsOneWidget);

      // Nothing is left streaming: the reply watchdog is not armed.
      expect(find.byTooltip('Stop generating'), findsNothing);
    },
  );

  testWidgets('FLF-04: a normal send (no stop) does adopt the stream', (
    tester,
  ) async {
    final api = await _pumpAssistant(tester, _student('normal'));

    await tester.enterText(_composer(), 'Summarize this term');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pump();
    await tester.pump();

    expect(api.sends, hasLength(1));
    expect(api.subscriptions, hasLength(1));
    expect(api.subscriptions.single.threadId, 'thread-1');
    expect(find.byTooltip('Stop generating'), findsOneWidget);
  });
}
