import '../../../core/models/ai.dart';
import '../../../core/models/user.dart';

/// Role copy and policy helpers for the assistant surface.
///
/// Mirrors `frontend/src/components/Assistant/{suggestions,assistant-visibility}.ts`
/// and the Android `AssistantChat` mode copy so every client shows the same
/// prompts, the same "can/can't" lists, and the same capability gate.
enum AssistantRole {
  student,
  teacher,
  superAdmin;

  static AssistantRole? forUserRole(UserRole? role) {
    return switch (role) {
      UserRole.student => AssistantRole.student,
      UserRole.teacher => AssistantRole.teacher,
      UserRole.superAdmin => AssistantRole.superAdmin,
      null => null,
    };
  }
}

class AssistantRoleCopy {
  const AssistantRoleCopy({
    required this.eyebrow,
    required this.subtitle,
    required this.emptyTitle,
    required this.emptyDescription,
    required this.placeholder,
    required this.can,
    required this.cant,
  });

  final String eyebrow;
  final String subtitle;
  final String emptyTitle;
  final String emptyDescription;
  final String placeholder;
  final List<String> can;
  final List<String> cant;
}

const Map<AssistantRole, AssistantRoleCopy> assistantRoleCopy = {
  AssistantRole.superAdmin: AssistantRoleCopy(
    eyebrow: 'Administrative assistant',
    subtitle: 'Oversight, accounts, and institution exports.',
    emptyTitle: 'Ask about the institution',
    emptyDescription:
        'Get an institution overview, find accounts, review recent audit '
        'activity, or prepare section exports. Every lookup stays inside your '
        'administrative scope.',
    placeholder: 'Ask about accounts, sections, audit activity, or exports.',
    can: [
      'Institution overview',
      'Account lookup',
      'Audit activity',
      'Section exports',
    ],
    cant: ['Create or disable accounts', 'Change attendance or settings'],
  ),
  AssistantRole.teacher: AssistantRoleCopy(
    eyebrow: 'Faculty assistant',
    subtitle: 'Find sections, review attendance, and prepare exports.',
    emptyTitle: 'Ask about your classes',
    emptyDescription:
        'Find a section, review session attendance, or generate a master '
        'list. The assistant only reads records you can already access.',
    placeholder: 'Ask about a section, session, or attendance file.',
    can: [
      'Your own sections and rosters',
      'Session attendance',
      'Master lists',
      'Attendance exports',
    ],
    cant: ["Other teachers' classes", 'Institution-wide data'],
  ),
  AssistantRole.student: AssistantRoleCopy(
    eyebrow: 'Student assistant',
    subtitle: 'Ask about your own attendance and classes.',
    emptyTitle: 'Ask about your attendance',
    emptyDescription:
        'Understand an attendance mark, check your standing, or draft a '
        'message to your professor. The assistant only reads your own records.',
    placeholder: 'Ask about your attendance or classes.',
    can: [
      'Explain your attendance marks',
      'Check your standing',
      'Draft a professor message',
    ],
    cant: ['Change records or files', 'Geofencing details'],
  ),
};

const List<String> facultyStarterPrompts = [
  'List my sections',
  "Extract my section's master list (PDF)",
  'Show attendance for my last session',
  'Export my last session attendance (CSV)',
];

const List<String> superAdminStarterPrompts = [
  'Give me an institution overview',
  'Who are the disabled accounts?',
  'Show recent audit activity',
  'Extract a section master list (PDF)',
];

const List<String> studentStarterPrompts = [
  'Why was I marked absent recently?',
  'What is my attendance standing in each subject?',
  'Draft a message to my professor.',
  'How do I enroll in a subject?',
];

List<String> starterPromptsFor(AssistantRole? role) {
  return switch (role) {
    AssistantRole.superAdmin => superAdminStarterPrompts,
    AssistantRole.teacher => facultyStarterPrompts,
    AssistantRole.student => studentStarterPrompts,
    null => const <String>[],
  };
}

/// The exact state the assistant/entry point should present.
enum AssistantAvailability {
  /// Capabilities could not be loaded at all.
  unreachable,

  /// The master switch or the role switch is off.
  policyBlocked,

  /// Switched on but the provider is missing configuration.
  unconfigured,

  /// Ready for chat.
  ready,
}

AssistantAvailability assistantAvailabilityFor(
  UserRole role,
  AiCapabilities? capabilities,
) {
  if (capabilities == null) return AssistantAvailability.unreachable;
  if (capabilities.policyBlocked) return AssistantAvailability.policyBlocked;
  if (!capabilities.enabled) return AssistantAvailability.unconfigured;
  return AssistantAvailability.ready;
}

/// Should an entry point (bubble, tab, More item) advertise the assistant?
///
/// Unknown capabilities hide the surface. Policy-blocked roles hide it too
/// (including super admins when the master switch is off). Unconfigured
/// providers only surface for super admins, who can reach Institution
/// Settings; teachers and students cannot fix missing configuration.
bool shouldShowAssistantEntry(UserRole role, AiCapabilities? capabilities) {
  final availability = assistantAvailabilityFor(role, capabilities);
  return availability == AssistantAvailability.ready ||
      (availability == AssistantAvailability.unconfigured &&
          role == UserRole.superAdmin);
}

/// Super admins keep the Institution Settings affordance while the assistant
/// is switched on but not configured/ready.
bool showsAssistantSetupHint(UserRole role, AiCapabilities? capabilities) {
  if (role != UserRole.superAdmin) return false;
  if (capabilities == null) return false;
  return assistantAvailabilityFor(role, capabilities) !=
      AssistantAvailability.ready;
}

String assistantBlockedMessage(AiCapabilities? capabilities) {
  final reason = capabilities?.reason?.trim();
  if (reason != null && reason.isNotEmpty) return reason;
  if (capabilities?.policyBlocked == true) {
    return 'The assistant has been disabled by your administrator.';
  }
  return 'The assistant is not configured yet.';
}

// ── Stream/thread state transitions ─────────────────────────────────────────

List<AiChatMessage> upsertAiMessage(
  List<AiChatMessage> messages,
  AiChatMessage message,
) {
  final index = messages.indexWhere((existing) => existing.id == message.id);
  if (index == -1) return [...messages, message];
  final next = [...messages];
  next[index] = message;
  return next;
}

List<AiChatMessage> appendAiDelta(
  List<AiChatMessage> messages,
  String threadId,
  String messageId,
  String text,
) {
  if (text.isEmpty) return messages;
  final index = messages.indexWhere((message) => message.id == messageId);
  if (index == -1) return messages;
  final target = messages[index];
  if (target.threadId != threadId || target.role != AiChatRole.assistant) {
    return messages;
  }
  final next = [...messages];
  next[index] = target.copyWith(content: '${target.content}$text');
  return next;
}

class AssistantStreamGuard {
  const AssistantStreamGuard({this.threadId, this.messageId});

  final String? threadId;
  final String? messageId;
}

class AssistantStreamUpdate {
  const AssistantStreamUpdate({
    required this.messages,
    required this.handled,
    required this.done,
    this.error,
  });

  final List<AiChatMessage> messages;
  final bool handled;
  final bool done;
  final String? error;
}

/// Applies one typed socket tick, ignoring events from other threads/messages.
AssistantStreamUpdate applyAssistantStreamEvent(
  List<AiChatMessage> messages,
  AiStreamEvent event,
  AssistantStreamGuard guard,
) {
  final eventThreadId = switch (event) {
    AiStreamDelta(:final threadId) => threadId,
    AiStreamDone(:final threadId) => threadId,
    AiStreamError(:final threadId) => threadId,
  };
  if (guard.threadId == null || eventThreadId != guard.threadId) {
    return AssistantStreamUpdate(
      messages: messages,
      handled: false,
      done: false,
    );
  }

  if (event is AiStreamError) {
    if (guard.messageId != null &&
        event.messageId != null &&
        event.messageId != guard.messageId) {
      return AssistantStreamUpdate(
        messages: messages,
        handled: false,
        done: false,
      );
    }
    return AssistantStreamUpdate(
      messages: messages,
      handled: true,
      done: true,
      error: event.message.isEmpty
          ? 'The assistant reported an error.'
          : event.message,
    );
  }

  if (guard.messageId != null) {
    final eventMessageId = switch (event) {
      AiStreamDelta(:final messageId) => messageId,
      AiStreamDone(:final message) => message.id,
      AiStreamError(:final messageId) => messageId,
    };
    if (eventMessageId != guard.messageId) {
      return AssistantStreamUpdate(
        messages: messages,
        handled: false,
        done: false,
      );
    }
  }

  if (event is AiStreamDelta) {
    return AssistantStreamUpdate(
      messages: appendAiDelta(
        messages,
        event.threadId,
        event.messageId,
        event.text,
      ),
      handled: true,
      done: false,
    );
  }
  if (event is AiStreamDone) {
    return AssistantStreamUpdate(
      messages: upsertAiMessage(messages, event.message),
      handled: true,
      done: true,
    );
  }
  return AssistantStreamUpdate(messages: messages, handled: true, done: true);
}

/// Replaces the trailing assistant draft with a fresh one (regenerate must
/// never append a second user turn).
List<AiChatMessage> replaceLastAssistantDraft(
  List<AiChatMessage> messages,
  AiChatMessage draft,
) {
  final index = messages.lastIndexWhere(
    (message) => message.role == AiChatRole.assistant,
  );
  if (index == -1) return [...messages, draft];
  return [...messages.sublist(0, index), draft];
}

/// Reconciles a stopped reply against the authoritative thread without
/// discarding locally streamed assistant text the server has not persisted.
List<AiChatMessage> reconcileStoppedAssistantThread(
  List<AiChatMessage> local,
  List<AiChatMessage> server,
) {
  final serverIds = server.map((message) => message.id).toSet();
  final merged = <AiChatMessage>[
    for (final message in server) _preferLongerLocal(local, message),
  ];
  for (final message in local) {
    // Only assistant text is carried forward: the optimistic user bubble uses
    // a client id while the server stores the same turn under its own id.
    if (message.role == AiChatRole.assistant &&
        !serverIds.contains(message.id) &&
        message.content.trim().isNotEmpty) {
      merged.add(message);
    }
  }
  return merged;
}

AiChatMessage _preferLongerLocal(
  List<AiChatMessage> local,
  AiChatMessage server,
) {
  if (server.role != AiChatRole.assistant) return server;
  final index = local.indexWhere((message) => message.id == server.id);
  if (index == -1) return server;
  final localMessage = local[index];
  return localMessage.content.length > server.content.length
      ? localMessage
      : server;
}

int lastAssistantIndex(List<AiChatMessage> messages) {
  return messages.lastIndexWhere(
    (message) => message.role == AiChatRole.assistant,
  );
}

String? deriveAssistantThreadTitle(
  List<AiChatMessage> messages, {
  int maxLength = 60,
}) {
  for (final message in messages) {
    if (message.role != AiChatRole.user) continue;
    final compact = message.content.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (compact.isEmpty) continue;
    if (compact.length <= maxLength) return compact;
    return '${compact.substring(0, maxLength - 1).trimRight()}.';
  }
  return null;
}

List<AiThreadSummary> sortAssistantThreads(List<AiThreadSummary> threads) {
  final sorted = [...threads];
  sorted.sort((left, right) {
    final leftAt = DateTime.tryParse(right.updatedAt)?.millisecondsSinceEpoch;
    final rightAt = DateTime.tryParse(left.updatedAt)?.millisecondsSinceEpoch;
    return (leftAt ?? 0).compareTo(rightAt ?? 0);
  });
  return sorted;
}

// ── Transcript rows (grouping + turn dividers) ──────────────────────────────

const Duration assistantTurnDivider = Duration(minutes: 5);

sealed class AssistantTranscriptRow {
  const AssistantTranscriptRow({required this.key});

  final String key;
}

final class AssistantMessageRow extends AssistantTranscriptRow {
  const AssistantMessageRow({
    required super.key,
    required this.message,
    required this.grouped,
    required this.showAvatar,
    required this.isLastAssistant,
  });

  final AiChatMessage message;

  /// Consecutive same-role message inside the same five-minute turn.
  final bool grouped;

  /// Show the assistant avatar chip only at the start of a group.
  final bool showAvatar;
  final bool isLastAssistant;
}

final class AssistantDividerRow extends AssistantTranscriptRow {
  const AssistantDividerRow({required super.key, required this.label});

  final String label;
}

List<AssistantTranscriptRow> buildAssistantTranscriptRows(
  List<AiChatMessage> messages, {
  DateTime? now,
}) {
  final rows = <AssistantTranscriptRow>[];
  final lastAssistant = lastAssistantIndex(messages);
  AiChatMessage? previous;

  for (var index = 0; index < messages.length; index += 1) {
    final message = messages[index];
    final at = DateTime.tryParse(message.createdAt);
    final previousAt = previous == null
        ? null
        : DateTime.tryParse(previous.createdAt);
    final newTurn =
        previous != null &&
        at != null &&
        previousAt != null &&
        at.difference(previousAt).abs() > assistantTurnDivider;

    if (newTurn) {
      rows.add(
        AssistantDividerRow(
          key: 'divider-${message.id}',
          label: formatAssistantTurnDivider(message.createdAt, now: now),
        ),
      );
    }

    rows.add(
      AssistantMessageRow(
        key: message.id,
        message: message,
        grouped: previous != null && previous.role == message.role && !newTurn,
        showAvatar:
            message.role == AiChatRole.assistant &&
            (previous == null || previous.role != message.role || newTurn),
        isLastAssistant: index == lastAssistant,
      ),
    );
    previous = message;
  }

  return rows;
}

String formatAssistantTurnDivider(String iso, {DateTime? now}) {
  final date = DateTime.tryParse(iso)?.toLocal();
  if (date == null) return '';
  final current = (now ?? DateTime.now()).toLocal();
  final time = _formatClock(date);
  if (_sameDay(date, current)) return time;
  return '${_monthName(date.month)} ${date.day} \u00b7 $time';
}

String formatAssistantMessageTime(String iso) {
  final date = DateTime.tryParse(iso)?.toLocal();
  return date == null ? '' : _formatClock(date);
}

String formatAssistantRelativeTime(String iso, {DateTime? now}) {
  final date = DateTime.tryParse(iso)?.toLocal();
  if (date == null) return '';
  final current = (now ?? DateTime.now()).toLocal();
  final diff = current.difference(date);
  if (diff.isNegative || diff.inMinutes < 1) return 'Just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${_monthName(date.month)} ${date.day}';
}

String describeAssistantError(Object error) {
  if (error is Exception) {
    final message = error.toString();
    if (message.isNotEmpty && !message.startsWith('Exception: ')) {
      return message;
    }
    if (message.startsWith('Exception: ')) {
      return message.substring('Exception: '.length);
    }
  }
  return 'Unable to reach the assistant. Try again.';
}

String _formatClock(DateTime date) {
  final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
  final minute = date.minute.toString().padLeft(2, '0');
  final suffix = date.hour < 12 ? 'AM' : 'PM';
  return '$hour:$minute $suffix';
}

bool _sameDay(DateTime left, DateTime right) {
  return left.year == right.year &&
      left.month == right.month &&
      left.day == right.day;
}

String _monthName(int month) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[month - 1];
}
