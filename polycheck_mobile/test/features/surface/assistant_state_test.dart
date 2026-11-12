import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/features/surface/data/assistant_copy.dart';

AiChatMessage _message({
  required String id,
  required AiChatRole role,
  String content = '',
  String threadId = 'thread-1',
  String createdAt = '2026-11-10T08:00:00.000Z',
}) {
  return AiChatMessage(
    id: id,
    threadId: threadId,
    role: role,
    content: content,
    createdAt: createdAt,
  );
}

void main() {
  group('assistant stream state', () {
    test('upsert appends new messages and replaces matching ids', () {
      final first = _message(id: 'm1', role: AiChatRole.user, content: 'Hi');
      final updated = _message(
        id: 'm1',
        role: AiChatRole.user,
        content: 'Hi there',
      );
      final next = upsertAiMessage([first], updated);
      expect(next, hasLength(1));
      expect(next.single.content, 'Hi there');

      final appended = upsertAiMessage(
        next,
        _message(id: 'm2', role: AiChatRole.assistant, content: 'Hello'),
      );
      expect(appended.map((message) => message.id), ['m1', 'm2']);
    });

    test('deltas only append to the matching assistant draft', () {
      final messages = [
        _message(id: 'draft', role: AiChatRole.assistant, content: 'Hel'),
      ];
      final appended = appendAiDelta(messages, 'thread-1', 'draft', 'lo');
      expect(appended.single.content, 'Hello');

      final wrongThread = appendAiDelta(messages, 'thread-2', 'draft', '!');
      expect(wrongThread.single.content, 'Hel');

      final wrongRole = appendAiDelta(messages, 'thread-1', 'user-1', '!');
      expect(wrongRole.single.content, 'Hel');
    });

    test('events from another thread are ignored', () {
      final update = applyAssistantStreamEvent(
        const <AiChatMessage>[],
        const AiStreamDelta(
          threadId: 'thread-2',
          messageId: 'm1',
          text: 'ignored',
        ),
        const AssistantStreamGuard(threadId: 'thread-1', messageId: 'm1'),
      );
      expect(update.handled, isFalse);
      expect(update.messages, isEmpty);
    });

    test('delta applies and done upserts the authoritative reply', () {
      final draft = _message(id: 'draft', role: AiChatRole.assistant);
      final delta = applyAssistantStreamEvent(
        [draft],
        const AiStreamDelta(
          threadId: 'thread-1',
          messageId: 'draft',
          text: 'Partial',
        ),
        const AssistantStreamGuard(threadId: 'thread-1', messageId: 'draft'),
      );
      expect(delta.handled, isTrue);
      expect(delta.messages.single.content, 'Partial');
      expect(delta.done, isFalse);

      final authoritative = _message(
        id: 'draft',
        role: AiChatRole.assistant,
        content: 'Complete answer',
      );
      final done = applyAssistantStreamEvent(
        delta.messages,
        AiStreamDone(threadId: 'thread-1', message: authoritative),
        const AssistantStreamGuard(threadId: 'thread-1', messageId: 'draft'),
      );
      expect(done.handled, isTrue);
      expect(done.done, isTrue);
      expect(done.messages.single.content, 'Complete answer');
    });

    test('error events finish the turn with their message', () {
      final update = applyAssistantStreamEvent(
        const <AiChatMessage>[],
        const AiStreamError(
          threadId: 'thread-1',
          messageId: 'draft',
          message: 'Provider unavailable',
        ),
        const AssistantStreamGuard(threadId: 'thread-1', messageId: 'draft'),
      );
      expect(update.handled, isTrue);
      expect(update.done, isTrue);
      expect(update.error, 'Provider unavailable');
    });

    test('regenerate replaces the trailing assistant draft only', () {
      final messages = [
        _message(id: 'u1', role: AiChatRole.user, content: 'Question'),
        _message(id: 'a1', role: AiChatRole.assistant, content: 'First'),
      ];
      final next = replaceLastAssistantDraft(
        messages,
        _message(id: 'a2', role: AiChatRole.assistant),
      );
      expect(next.map((message) => message.id), ['u1', 'a2']);
      expect(
        next.where((message) => message.role == AiChatRole.user),
        hasLength(1),
      );

      final empty = replaceLastAssistantDraft(
        const <AiChatMessage>[],
        _message(id: 'a3', role: AiChatRole.assistant),
      );
      expect(empty.single.id, 'a3');
    });

    test('stop reconciliation preserves longer local assistant text', () {
      final local = [
        _message(id: 'u1', role: AiChatRole.user, content: 'Question'),
        _message(
          id: 'a1',
          role: AiChatRole.assistant,
          content: 'Partial answer from the stream',
        ),
        _message(
          id: 'a-local',
          role: AiChatRole.assistant,
          content: 'Unpersisted tail',
        ),
      ];
      final server = [
        _message(id: 'u-server', role: AiChatRole.user, content: 'Question'),
        _message(id: 'a1', role: AiChatRole.assistant, content: 'Partial'),
      ];
      final merged = reconcileStoppedAssistantThread(local, server);
      expect(merged.map((message) => message.id), [
        'u-server',
        'a1',
        'a-local',
      ]);
      expect(merged[1].content, 'Partial answer from the stream');
      expect(
        merged.where((message) => message.role == AiChatRole.user),
        hasLength(1),
      );
    });

    test('thread titles derive from the first non-empty user message', () {
      final messages = [
        _message(id: 'u0', role: AiChatRole.user),
        _message(
          id: 'u1',
          role: AiChatRole.user,
          content: '  Please   summarize my attendance   ',
        ),
      ];
      expect(
        deriveAssistantThreadTitle(messages),
        'Please summarize my attendance',
      );
      final long = deriveAssistantThreadTitle([
        _message(id: 'u2', role: AiChatRole.user, content: 'x' * 80),
      ], maxLength: 20);
      expect(long, hasLength(20));
      expect(long!.endsWith('.'), isTrue);
    });

    test('transcript rows group consecutive messages and insert dividers', () {
      final messages = [
        _message(
          id: 'u1',
          role: AiChatRole.user,
          content: 'First',
          createdAt: '2026-11-10T08:00:00.000Z',
        ),
        _message(
          id: 'a1',
          role: AiChatRole.assistant,
          content: 'Reply',
          createdAt: '2026-11-10T08:00:10.000Z',
        ),
        _message(
          id: 'u2',
          role: AiChatRole.user,
          content: 'Later',
          createdAt: '2026-11-10T08:10:00.000Z',
        ),
      ];
      final rows = buildAssistantTranscriptRows(messages);
      final dividers = rows.whereType<AssistantDividerRow>().toList();
      final messageRows = rows.whereType<AssistantMessageRow>().toList();
      expect(dividers, hasLength(1));
      expect(messageRows, hasLength(3));
      expect(messageRows[1].showAvatar, isTrue);
      expect(messageRows[2].grouped, isFalse);
      expect(messageRows[1].isLastAssistant, isTrue);
    });

    test('threads sort newest-first', () {
      final sorted = sortAssistantThreads(const [
        AiThreadSummary(
          id: 'older',
          title: 'Older',
          updatedAt: '2026-11-01T08:00:00.000Z',
        ),
        AiThreadSummary(
          id: 'newer',
          title: 'Newer',
          updatedAt: '2026-11-09T08:00:00.000Z',
        ),
        AiThreadSummary(id: 'unknown', title: 'Unknown'),
      ]);
      expect(sorted.map((thread) => thread.id), ['newer', 'older', 'unknown']);
    });
  });
}
