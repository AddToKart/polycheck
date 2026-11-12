import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/ai_api.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/ai.dart';
import '../../../core/models/user.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/theme/pup_tokens.dart';
import '../../../core/widgets/campus_bottom_sheet.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_dialog.dart';
import '../../../core/widgets/campus_header.dart';
import '../../../core/widgets/campus_loading.dart';
import '../../../core/widgets/campus_toast.dart';
import '../data/assistant_copy.dart';
import '../data/surface_downloads.dart';
import '../data/surface_navigation.dart';
import '../data/surface_paths.dart';
import 'widgets/assistant_markdown.dart';
import 'widgets/assistant_widgets.dart';

/// Process-lifetime last thread per account (the Android client keeps the
/// same value in memory for the app session).
final Map<String, String> _lastThreadByUser = <String, String>{};

class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key});

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  static const int _replyTimeoutMs = 75000;
  static const int _reconcileDelayMs = 1500;
  static const int _hardMessageLimit = 2000;
  static const double _stickThreshold = 72;

  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  AiCapabilities? _capabilities;
  String? _capabilityError;
  bool _initializing = true;
  bool _sending = false;
  bool _streaming = false;
  bool _connected = false;
  bool _conversationBusy = false;
  bool _receivedStreamEvent = false;
  bool _nearBottom = true;
  bool _threadLoading = false;

  String? _threadId;
  List<AiChatMessage> _messages = const <AiChatMessage>[];
  String? _pendingMessageId;
  String? _stoppedMessageId;
  String? _error;
  String? _retryText;
  bool _retryRegenerate = false;

  List<AiThreadSummary> _threads = const <AiThreadSummary>[];
  bool _threadsLoading = false;
  String? _threadsError;
  Map<String, AttachmentDownloadState> _downloadStates =
      const <String, AttachmentDownloadState>{};

  AiThreadStream? _threadStream;
  StreamSubscription<AiStreamEvent>? _threadEvents;
  Timer? _replyTimer;
  Timer? _reconcileTimer;
  int _conversationSeq = 0;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    _input.addListener(_onInputChanged);
    _scroll.addListener(_onScroll);
    unawaited(_initialize());
  }

  @override
  void dispose() {
    _disposed = true;
    _conversationSeq += 1;
    _input.removeListener(_onInputChanged);
    _scroll.removeListener(_onScroll);
    _input.dispose();
    _scroll.dispose();
    unawaited(_closeStream());
    _cancelTimers();
    super.dispose();
  }

  AssistantRole? get _role =>
      AssistantRole.forUserRole(ref.read(sessionProvider).user?.role);

  bool get _ready =>
      assistantAvailabilityFor(
        ref.read(sessionProvider).user?.role ?? UserRole.student,
        _capabilities,
      ) ==
      AssistantAvailability.ready;

  User? get _user => ref.read(sessionProvider).user;

  int get _maxMessageLength {
    final configured = _capabilities?.maxMessageChars;
    if (configured == null || configured <= 0) return _hardMessageLimit;
    return configured < _hardMessageLimit ? configured : _hardMessageLimit;
  }

  void _onInputChanged() {
    if (mounted) setState(() {});
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final position = _scroll.position;
    final nearBottom =
        position.maxScrollExtent - position.pixels <= _stickThreshold;
    if (nearBottom != _nearBottom) {
      setState(() => _nearBottom = nearBottom);
    }
  }

  Future<void> _initialize() async {
    final user = _user;
    if (user == null) {
      if (mounted) setState(() => _initializing = false);
      return;
    }
    setState(() {
      _initializing = true;
      _capabilityError = null;
    });
    AiCapabilities? capabilities;
    String? capabilityError;
    try {
      capabilities = await ref.read(aiApiProvider).getCapabilities();
    } catch (error) {
      capabilityError = describeAssistantError(error);
    }
    if (!mounted || _disposed) return;
    setState(() {
      _capabilities = capabilities;
      _capabilityError = capabilityError;
      _initializing = false;
    });

    if (capabilities?.enabled != true) return;
    final stored = _lastThreadByUser[user.id];
    if (stored != null && stored.isNotEmpty) {
      await _openThread(stored, initial: true);
    } else {
      unawaited(_loadThreads());
    }
  }

  Future<void> _loadThreads() async {
    if (!mounted) return;
    setState(() {
      _threadsLoading = true;
      _threadsError = null;
    });
    try {
      final threads = await ref.read(aiApiProvider).listThreads();
      if (!mounted) return;
      setState(() {
        _threads = sortAssistantThreads(threads);
        _threadsLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _threadsLoading = false;
        _threadsError = describeAssistantError(error);
      });
    }
  }

  Future<void> _adoptThread(String threadId) async {
    _threadId = threadId;
    final userId = _user?.id;
    if (userId != null) _lastThreadByUser[userId] = threadId;
  }

  Future<void> _applyThread(AiChatThread thread, {bool initial = false}) async {
    final seq = _conversationSeq;
    if (!mounted) return;
    setState(() {
      _messages = thread.messages;
      _stoppedMessageId = null;
      _error = null;
      _retryText = null;
      _threadLoading = false;
    });
    await _adoptThread(thread.id);
    if (!mounted || seq != _conversationSeq) return;
    await _subscribe(thread.id);
    if (!mounted || seq != _conversationSeq) return;

    final trailing = thread.messages.isEmpty ? null : thread.messages.last;
    if (trailing != null &&
        trailing.role == AiChatRole.assistant &&
        trailing.content.trim().isEmpty) {
      _pendingMessageId = trailing.id;
      _conversationBusy = true;
      setState(() => _streaming = true);
      _startReplyTimer();
      _scheduleReconcile();
    } else {
      _pendingMessageId = null;
      _conversationBusy = false;
      setState(() => _streaming = false);
    }
    _scrollToBottomSoon();
    if (initial) unawaited(_loadThreads());
  }

  Future<void> _openThread(String threadId, {bool initial = false}) async {
    if (!initial && threadId == _threadId) return;
    final seq = _conversationSeq + 1;
    _conversationSeq = seq;
    await _closeStream();
    _cancelTimers();
    _conversationBusy = false;
    _receivedStreamEvent = false;
    _pendingMessageId = null;
    if (mounted) {
      setState(() {
        _streaming = false;
        _sending = false;
        _error = null;
        _retryText = null;
        _threadLoading = !initial;
      });
    }
    try {
      final thread = await ref.read(aiApiProvider).getThread(threadId);
      if (!mounted || seq != _conversationSeq) return;
      // A restored thread must never clobber a chat the user started while
      // the request was in flight.
      if (initial && (_conversationBusy || _messages.isNotEmpty)) return;
      await _applyThread(thread, initial: initial);
    } catch (error) {
      if (!mounted || seq != _conversationSeq) return;
      if (initial) {
        final userId = _user?.id;
        if (userId != null) _lastThreadByUser.remove(userId);
        if (mounted) setState(() => _threadLoading = false);
      } else {
        setState(() {
          _threadLoading = false;
          _error = describeAssistantError(error);
        });
      }
    }
  }

  Future<void> _subscribe(String threadId) async {
    final seq = _conversationSeq;
    await _closeStream();
    if (!mounted || seq != _conversationSeq) return;
    try {
      final stream = await ref.read(aiApiProvider).openThreadStream(threadId);
      if (!mounted || seq != _conversationSeq) {
        unawaited(stream.close());
        return;
      }
      _threadStream = stream;
      _threadEvents = stream.events.listen(
        (event) => _onStreamEvent(event, seq),
        onError: (Object _) {
          if (mounted && seq == _conversationSeq) {
            setState(() => _connected = false);
          }
        },
      );
      if (mounted) setState(() => _connected = true);
    } catch (error) {
      if (!mounted || seq != _conversationSeq) return;
      setState(() => _connected = false);
      _failReply(
        describeAssistantError(error),
        keepConversationBusy: false,
        seq: seq,
      );
    }
  }

  Future<void> _closeStream() async {
    final events = _threadEvents;
    _threadEvents = null;
    await events?.cancel();
    final stream = _threadStream;
    _threadStream = null;
    if (stream != null) await stream.close();
    if (mounted) setState(() => _connected = false);
  }

  void _onStreamEvent(AiStreamEvent event, int seq) {
    if (!mounted || _disposed || seq != _conversationSeq) return;
    final update = applyAssistantStreamEvent(
      _messages,
      event,
      AssistantStreamGuard(threadId: _threadId, messageId: _pendingMessageId),
    );
    if (!update.handled) return;

    _receivedStreamEvent = true;
    var next = update.messages;
    if (update.error != null) {
      final pendingId = _pendingMessageId;
      _pendingMessageId = null;
      if (pendingId != null) {
        next = [
          for (final message in next)
            if (message.id != pendingId || message.content.trim().isNotEmpty)
              message,
        ];
      }
      _error = update.error;
      _retryText = null;
      _retryRegenerate = true;
    }
    if (update.done) {
      _conversationBusy = false;
      _cancelTimers();
      _streaming = false;
      if (update.error == null) {
        _pendingMessageId = null;
        _stoppedMessageId = null;
        _error = null;
        _retryText = null;
      }
      unawaited(_loadThreads());
    }
    setState(() => _messages = next);
    _scrollToBottomSoon();
  }

  void _startReplyTimer() {
    _replyTimer?.cancel();
    final seq = _conversationSeq;
    _replyTimer = Timer(const Duration(milliseconds: _replyTimeoutMs), () {
      if (!mounted || seq != _conversationSeq || !_conversationBusy) return;
      _failReply(
        'The assistant did not reply in time. Try again.',
        keepConversationBusy: false,
        seq: seq,
      );
    });
  }

  void _scheduleReconcile() {
    _reconcileTimer?.cancel();
    final seq = _conversationSeq;
    _reconcileTimer = Timer(
      const Duration(milliseconds: _reconcileDelayMs),
      () => unawaited(_reconcileOnce(seq)),
    );
  }

  Future<void> _reconcileOnce(int seq) async {
    final activeThreadId = _threadId;
    if (!mounted ||
        seq != _conversationSeq ||
        !_conversationBusy ||
        _receivedStreamEvent ||
        activeThreadId == null) {
      return;
    }
    try {
      final thread = await ref.read(aiApiProvider).getThread(activeThreadId);
      if (!mounted ||
          seq != _conversationSeq ||
          !_conversationBusy ||
          _receivedStreamEvent) {
        return;
      }
      final pendingId = _pendingMessageId;
      AiChatMessage? completed;
      for (final message in thread.messages) {
        if (message.id == pendingId && message.content.trim().isNotEmpty) {
          completed = message;
          break;
        }
      }
      if (completed == null) return;
      _pendingMessageId = null;
      _conversationBusy = false;
      _cancelTimers();
      if (!mounted) return;
      setState(() {
        _messages = upsertAiMessage(_messages, completed!);
        _streaming = false;
        _error = null;
        _retryText = null;
      });
      _scrollToBottomSoon();
      unawaited(_loadThreads());
    } catch (_) {
      // The reply watchdog remains the final fallback.
    }
  }

  void _failReply(
    String message, {
    required bool keepConversationBusy,
    required int seq,
  }) {
    if (!mounted || seq != _conversationSeq) return;
    final pendingId = _pendingMessageId;
    _pendingMessageId = null;
    if (!keepConversationBusy) _conversationBusy = false;
    _cancelTimers();
    final filtered = pendingId == null
        ? _messages
        : [
            for (final item in _messages)
              if (item.id != pendingId || item.content.trim().isNotEmpty) item,
          ];
    setState(() {
      _messages = filtered;
      _streaming = false;
      _error = message;
      _retryText = null;
      _retryRegenerate = true;
    });
  }

  Future<void> _send({String? rawText, bool regenerate = false}) async {
    final text = (rawText ?? _input.text).trim();
    final user = _user;
    if (text.isEmpty ||
        user == null ||
        !_ready ||
        _sending ||
        _streaming ||
        _conversationBusy) {
      return;
    }
    if (text.length > _maxMessageLength) {
      setState(
        () => _error = 'Messages are limited to $_maxMessageLength characters.',
      );
      return;
    }

    final seq = _conversationSeq;
    _conversationBusy = true;
    _receivedStreamEvent = false;
    _cancelTimers();
    _input.clear();
    setState(() {
      _sending = true;
      _error = null;
      _retryText = null;
      _retryRegenerate = false;
      _stoppedMessageId = null;
    });

    String? optimisticId;
    if (!regenerate) {
      optimisticId =
          'local-user-${DateTime.now().microsecondsSinceEpoch}-${text.hashCode}';
      final optimistic = AiChatMessage(
        id: optimisticId,
        threadId: _threadId ?? '',
        role: AiChatRole.user,
        content: text,
        createdAt: DateTime.now().toUtc().toIso8601String(),
      );
      setState(() => _messages = [..._messages, optimistic]);
      _nearBottom = true;
      _scrollToBottomSoon();
    }

    try {
      final result = await ref
          .read(aiApiProvider)
          .sendMessage(
            AiChatSendInput(
              message: text,
              threadId: _threadId,
              regenerate: regenerate ? true : null,
            ),
          );
      if (!mounted || seq != _conversationSeq) return;
      await _adoptThread(result.threadId);
      _pendingMessageId = result.messageId;
      final draft = AiChatMessage(
        id: result.messageId,
        threadId: result.threadId,
        role: AiChatRole.assistant,
        content: '',
        createdAt: DateTime.now().toUtc().toIso8601String(),
      );
      setState(() {
        if (regenerate) {
          _messages = replaceLastAssistantDraft(_messages, draft);
        } else {
          _messages = [
            for (final message in _messages)
              if (optimisticId != null && message.id == optimisticId)
                message.copyWith(threadId: result.threadId)
              else
                message,
            draft,
          ];
        }
        _streaming = true;
      });
      _startReplyTimer();
      _scheduleReconcile();
      _scrollToBottomSoon();
      await _subscribe(result.threadId);
    } catch (error) {
      if (!mounted || seq != _conversationSeq) return;
      _conversationBusy = false;
      _cancelTimers();
      final message = describeAssistantError(error);
      setState(() {
        if (optimisticId != null) {
          _messages = [
            for (final item in _messages)
              if (item.id != optimisticId) item,
          ];
        }
        _input.text = text;
        _input.selection = TextSelection.collapsed(offset: text.length);
        _retryText = regenerate ? null : text;
        _retryRegenerate = regenerate;
        _error = message;
      });
      CampusToast.showIn(context, message, tone: CampusToastTone.error);
    } finally {
      if (mounted && seq == _conversationSeq) {
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _stop() async {
    if (!_conversationBusy) return;
    final activeThreadId = _threadId;
    final pendingId = _pendingMessageId;

    await _closeStream();
    _cancelTimers();
    _conversationBusy = false;
    _receivedStreamEvent = false;
    _pendingMessageId = null;
    if (!mounted) return;
    setState(() {
      _streaming = false;
      _error = null;
      _retryText = null;
      if (pendingId != null) _stoppedMessageId = pendingId;
    });
    if (activeThreadId == null) return;

    try {
      final thread = await ref.read(aiApiProvider).getThread(activeThreadId);
      if (!mounted || _threadId != activeThreadId || _conversationBusy) {
        return;
      }
      AiChatMessage? authoritative;
      if (pendingId != null) {
        for (final message in thread.messages) {
          if (message.id == pendingId) {
            authoritative = message;
            break;
          }
        }
      }
      setState(() {
        _messages = reconcileStoppedAssistantThread(_messages, thread.messages);
        if (authoritative != null && authoritative.content.trim().isNotEmpty) {
          _stoppedMessageId = null;
        }
      });
      unawaited(_loadThreads());
    } catch (_) {
      // Keep the local partial reply marked stopped.
    }
  }

  Future<void> _newChat() async {
    _conversationSeq += 1;
    await _closeStream();
    _cancelTimers();
    final userId = _user?.id;
    if (userId != null) _lastThreadByUser.remove(userId);
    if (!mounted) return;
    setState(() {
      _threadId = null;
      _messages = const <AiChatMessage>[];
      _input.clear();
      _error = null;
      _retryText = null;
      _stoppedMessageId = null;
      _pendingMessageId = null;
      _streaming = false;
      _sending = false;
      _conversationBusy = false;
      _downloadStates = const <String, AttachmentDownloadState>{};
    });
    unawaited(_loadThreads());
  }

  Future<void> _deleteThread(String threadId, VoidCallback? onChanged) async {
    try {
      await ref.read(aiApiProvider).deleteThread(threadId);
      if (!mounted) return;
      setState(() {
        _threads = [
          for (final thread in _threads)
            if (thread.id != threadId) thread,
        ];
      });
      onChanged?.call();
      if (_threadId == threadId) await _newChat();
      if (mounted) {
        CampusToast.showIn(context, 'Conversation deleted');
      }
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        describeAssistantError(error),
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _openThreadsSheet() async {
    await _loadThreads();
    if (!mounted) return;
    await showCampusBottomSheet<void>(
      context,
      title: 'Conversations',
      child: StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CampusButton(
                label: 'New chat',
                icon: Icons.add_comment_outlined,
                variant: CampusButtonVariant.outline,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  unawaited(_newChat());
                },
              ),
              const SizedBox(height: 12),
              if (_threadsError != null)
                AssistantErrorBanner(
                  message: _threadsError!,
                  onRetry: () => unawaited(_loadThreads()),
                ),
              if (_threadsLoading && _threads.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: CampusLoading(compact: true, label: 'Loading chats.'),
                )
              else if (_threads.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No past conversations yet. Chats you start appear here '
                    'for seven days.',
                    style: Theme.of(sheetContext).textTheme.bodySmall?.copyWith(
                      color: PupTheme.of(sheetContext).muted,
                    ),
                  ),
                )
              else
                for (final thread in _threads)
                  _ThreadTile(
                    summary: thread,
                    active: thread.id == _threadId,
                    onOpen: () {
                      Navigator.of(sheetContext).pop();
                      unawaited(_openThread(thread.id));
                    },
                    onDelete: () => unawaited(
                      _deleteThread(thread.id, () => setSheetState(() {})),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _downloadAttachment(AiChatAttachment attachment) async {
    final current = _downloadStates[attachment.id];
    if (current == AttachmentDownloadState.loading) return;
    setState(() {
      _downloadStates = {
        ..._downloadStates,
        attachment.id: AttachmentDownloadState.loading,
      };
    });
    try {
      final bytes = await SurfaceDownloads.download(
        ref.read(dioProvider),
        attachment.downloadPath,
      );
      final filename = attachment.filename.trim().isEmpty
          ? '${attachment.kind.wire}.${attachment.format.wire}'
          : attachment.filename;
      await SurfaceDownloads.shareBytes(
        bytes: bytes,
        filename: filename,
        mimeType: _attachmentMime(attachment.format),
        title: attachment.label.isEmpty ? filename : attachment.label,
      );
      if (!mounted) return;
      setState(() {
        _downloadStates = {
          ..._downloadStates,
          attachment.id: AttachmentDownloadState.done,
        };
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _downloadStates = {
          for (final entry in _downloadStates.entries)
            if (entry.key != attachment.id) entry.key: entry.value,
        };
      });
      CampusToast.showIn(
        context,
        describeAssistantError(error),
        tone: CampusToastTone.error,
      );
    }
  }

  String _attachmentMime(AiAttachmentFormat format) {
    return switch (format) {
      AiAttachmentFormat.pdf => 'application/pdf',
      AiAttachmentFormat.docx =>
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      AiAttachmentFormat.csv => 'text/csv',
    };
  }

  void _cancelTimers() {
    _replyTimer?.cancel();
    _replyTimer = null;
    _reconcileTimer?.cancel();
    _reconcileTimer = null;
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_nearBottom || !_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  void _retry() {
    final text = _retryText;
    if (!_retryRegenerate && text != null && text.trim().isNotEmpty) {
      unawaited(_send(rawText: text));
      return;
    }
    if (_threadId != null) {
      unawaited(_send(regenerate: true));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider.select((state) => state.user));
    final role = _role;
    final copy = role == null ? null : assistantRoleCopy[role];
    final tokens = PupTheme.of(context);
    final readiness = assistantAvailabilityFor(
      ref.read(sessionProvider).user?.role ?? UserRole.student,
      _capabilities,
    );
    // A pushed assistant (profile action, notification, deep link) keeps the
    // implied arrow; a stackless landing (router.go) needs an explicit exit,
    // exactly like the profile header (FIX3/SW-3).
    final canPop = Navigator.maybeOf(context)?.canPop() ?? false;

    return Scaffold(
      appBar: CampusHeader(
        title: 'Assistant',
        subtitle: copy?.subtitle,
        automaticallyImplyLeading: canPop,
        leading: canPop
            ? null
            : BackButton(
                key: const ValueKey<String>('assistant-back-fallback'),
                onPressed: () => context.go(
                  adminLandingPath(user) ??
                      roleHome(
                        resolveAppRole(
                          user,
                          officerPresident: false,
                          officerQac: false,
                        ),
                      ),
                ),
              ),
        actions: [
          if (_ready) ...[
            IconButton(
              tooltip: 'Conversations',
              onPressed: () => unawaited(_openThreadsSheet()),
              icon: const Icon(Icons.forum_outlined, size: 20),
            ),
            IconButton(
              tooltip: 'New chat',
              onPressed: () => unawaited(_newChat()),
              icon: const Icon(Icons.add_comment_outlined, size: 20),
            ),
          ],
        ],
      ),
      body: SafeArea(
        top: false,
        child: _initializing
            ? const CampusLoading(label: 'Loading assistant.')
            : readiness == AssistantAvailability.unreachable
            ? AssistantUnavailablePanel(
                title: 'Assistant unavailable',
                message:
                    _capabilityError ??
                    'The assistant could not be reached right now.',
                onRetry: _initialize,
              )
            : readiness != AssistantAvailability.ready
            ? AssistantUnavailablePanel(
                title: 'Assistant unavailable',
                message: assistantBlockedMessage(_capabilities),
                onOpenSettings:
                    showsAssistantSetupHint(
                      ref.read(sessionProvider).user?.role ?? UserRole.student,
                      _capabilities,
                    )
                    ? () => SurfaceNavigation.open(
                        context,
                        SurfacePaths.adminSettings,
                        unavailableMessage:
                            'Institution Settings is not available in this build.',
                      )
                    : null,
              )
            : _threadLoading
            ? const CampusLoading(label: 'Loading conversation.')
            : _buildReadyBody(role, tokens),
      ),
    );
  }

  Widget _buildReadyBody(AssistantRole? role, PupTokens tokens) {
    final rows = buildAssistantTranscriptRows(_messages);
    final busy = _sending || _streaming;
    final canSend = _input.text.trim().isNotEmpty && !busy && _ready;
    final showJump = !_nearBottom && _messages.isNotEmpty;

    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                itemCount: rows.isEmpty ? 1 : rows.length,
                itemBuilder: (context, index) {
                  if (rows.isEmpty) {
                    return role == null
                        ? const SizedBox.shrink()
                        : AssistantEmptyState(
                            role: role,
                            prompts: starterPromptsFor(role),
                            onSelectPrompt: (prompt) {
                              _input.text = prompt;
                              _input.selection = TextSelection.collapsed(
                                offset: prompt.length,
                              );
                            },
                          );
                  }
                  final row = rows[index];
                  if (row is AssistantDividerRow) {
                    return _TurnDivider(
                      key: ValueKey(row.key),
                      label: row.label,
                    );
                  }
                  if (row is! AssistantMessageRow) {
                    return const SizedBox.shrink();
                  }
                  return _MessageBubble(
                    key: ValueKey(row.key),
                    row: row,
                    streaming: _streaming,
                    stopped: _stoppedMessageId == row.message.id,
                    busy: busy,
                    downloadStates: _downloadStates,
                    onDownload: _downloadAttachment,
                    onRegenerate: row.isLastAssistant && !busy && _ready
                        ? () => unawaited(_send(regenerate: true))
                        : null,
                    onRetry: _stoppedMessageId == row.message.id
                        ? () => unawaited(_send(regenerate: true))
                        : null,
                  );
                },
              ),
              if (showJump)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 8,
                  child: Center(
                    child: Material(
                      color: tokens.isDark ? tokens.surface : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.zero,
                        side: BorderSide(
                          color: tokens.isDark ? tokens.gold : tokens.maroon,
                        ),
                      ),
                      child: InkWell(
                        onTap: () {
                          setState(() => _nearBottom = true);
                          if (_scroll.hasClients) {
                            _scroll.animateTo(
                              _scroll.position.maxScrollExtent,
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOut,
                            );
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Jump to latest',
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: tokens.isDark
                                          ? tokens.gold
                                          : tokens.maroon,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.arrow_downward,
                                size: 13,
                                color: tokens.isDark
                                    ? tokens.gold
                                    : tokens.maroon,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: AssistantErrorBanner(
              message: _error!,
              onRetry: _retryText != null || _threadId != null ? _retry : null,
              busy: busy,
            ),
          ),
        Container(
          decoration: BoxDecoration(
            color: tokens.surface,
            border: Border(top: BorderSide(color: tokens.borderSubtle)),
          ),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: tokens.surface,
                  border: Border.all(color: tokens.borderSubtle),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        minLines: 1,
                        maxLines: 5,
                        keyboardType: TextInputType.multiline,
                        enabled: !_sending && !_streaming,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: tokens.onSurface,
                        ),
                        decoration: InputDecoration(
                          hintText: role == null
                              ? 'Message the assistant'
                              : assistantRoleCopy[role]!.placeholder,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(4),
                      child: _streaming
                          ? IconButton(
                              tooltip: 'Stop generating',
                              onPressed: () => unawaited(_stop()),
                              style: IconButton.styleFrom(
                                backgroundColor: tokens.maroon,
                                foregroundColor: Colors.white,
                                shape: const RoundedRectangleBorder(
                                  borderRadius: BorderRadius.zero,
                                ),
                              ),
                              icon: const Icon(Icons.stop, size: 18),
                            )
                          : IconButton(
                              tooltip: 'Send message',
                              onPressed: canSend
                                  ? () => unawaited(_send())
                                  : null,
                              style: IconButton.styleFrom(
                                backgroundColor: canSend
                                    ? tokens.maroon
                                    : tokens.muted.withValues(alpha: 0.25),
                                foregroundColor: canSend
                                    ? Colors.white
                                    : tokens.muted,
                                shape: const RoundedRectangleBorder(
                                  borderRadius: BorderRadius.zero,
                                ),
                              ),
                              icon: _sending
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                              Colors.white,
                                            ),
                                      ),
                                    )
                                  : const Icon(Icons.arrow_upward, size: 18),
                            ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _streaming
                          ? (_connected ? 'Replying.' : 'Reconnecting.')
                          : _stoppedMessageId != null
                          ? 'Reply stopped \u00b7 retry or send a new message'
                          : 'Read-only \u00b7 never changes attendance',
                      style: Theme.of(
                        context,
                      ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                    ),
                  ),
                  Text(
                    '${_input.text.length}/$_maxMessageLength',
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TurnDivider extends StatelessWidget {
  const _TurnDivider({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Divider(color: tokens.borderSubtle)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
          Expanded(child: Divider(color: tokens.borderSubtle)),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    super.key,
    required this.row,
    required this.streaming,
    required this.stopped,
    required this.busy,
    required this.downloadStates,
    required this.onDownload,
    required this.onRegenerate,
    required this.onRetry,
  });

  final AssistantMessageRow row;
  final bool streaming;
  final bool stopped;
  final bool busy;
  final Map<String, AttachmentDownloadState> downloadStates;
  final void Function(AiChatAttachment attachment) onDownload;
  final VoidCallback? onRegenerate;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final message = row.message;
    final isUser = message.role == AiChatRole.user;
    final isEmpty = message.content.trim().isEmpty;

    return Semantics(
      label: isUser ? 'Your message' : 'Assistant message',
      child: Padding(
        padding: EdgeInsets.only(top: row.grouped ? 4 : 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: isUser
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          children: [
            Flexible(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.92,
                ),
                child: Column(
                  crossAxisAlignment: isUser
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!isUser && row.showAvatar) ...[
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              border: Border.all(color: tokens.gold),
                              color: tokens.isDark
                                  ? tokens.gold.withValues(alpha: 0.12)
                                  : tokens.gold.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.zero,
                            ),
                            child: Icon(
                              Icons.auto_awesome,
                              size: 12,
                              color: tokens.isDark
                                  ? tokens.gold
                                  : tokens.maroon,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        if (!isUser)
                          Text(
                            'Assistant',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: tokens.muted,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                      ],
                    ),
                    if (!isUser && row.showAvatar) const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: isUser
                            ? (tokens.isDark ? tokens.surface : tokens.maroon)
                            : tokens.surface,
                        border: Border.all(
                          color: isUser
                              ? (tokens.isDark
                                    ? tokens.gold.withValues(alpha: 0.5)
                                    : tokens.maroon)
                              : tokens.borderSubtle,
                        ),
                        borderRadius: BorderRadius.zero,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (isUser)
                            SelectableText(
                              message.content,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: Colors.white, height: 1.45),
                            )
                          else if (!isEmpty)
                            AssistantMarkdown(content: message.content)
                          else if (stopped)
                            Text(
                              'Stopped before a reply arrived.',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: tokens.muted,
                                    fontStyle: FontStyle.italic,
                                  ),
                            )
                          else if (streaming && row.isLastAssistant)
                            const AssistantTypingDots(),
                          if (!isUser && stopped && !isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                'STOPPED \u00b7 RETRY?',
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: tokens.muted,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.8,
                                    ),
                              ),
                            ),
                          if (!isUser && message.toolInvocations.isNotEmpty)
                            AssistantToolActivity(
                              invocations: message.toolInvocations,
                            ),
                          if (!isUser && message.attachments.isNotEmpty)
                            AssistantAttachmentCards(
                              attachments: message.attachments,
                              states: downloadStates,
                              onDownload: onDownload,
                            ),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          formatAssistantMessageTime(message.createdAt),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: tokens.muted.withValues(alpha: 0.9),
                                fontSize: 10,
                              ),
                        ),
                        if (!isEmpty || stopped)
                          AssistantMessageActions(
                            content: message.content,
                            onRegenerate: !isUser ? onRegenerate : null,
                            onRetry: !isUser ? onRetry : null,
                            regenerateDisabled: busy,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({
    required this.summary,
    required this.active,
    required this.onOpen,
    required this.onDelete,
  });

  final AiThreadSummary summary;
  final bool active;
  final VoidCallback onOpen;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final title = summary.title.trim().isEmpty
        ? 'Untitled chat'
        : summary.title.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: active
            ? (tokens.isDark
                  ? tokens.gold.withValues(alpha: 0.10)
                  : tokens.gold.withValues(alpha: 0.18))
            : tokens.surface,
        border: Border(
          left: BorderSide(
            color: active
                ? tokens.gold
                : tokens.borderSubtle.withValues(alpha: 0.7),
            width: 2,
          ),
          top: BorderSide(color: tokens.borderSubtle),
          right: BorderSide(color: tokens.borderSubtle),
          bottom: BorderSide(color: tokens.borderSubtle),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: onOpen,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 9,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      formatAssistantRelativeTime(summary.updatedAt),
                      style: Theme.of(
                        context,
                      ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Delete conversation',
            onPressed: () => _confirmDelete(context),
            icon: Icon(Icons.delete_outline, size: 17, color: tokens.muted),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'Delete this conversation?',
      description:
          'The chat will be removed from your history. This cannot be undone.',
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Delete'),
        ),
      ],
    );
    if (confirmed == true) onDelete();
  }
}
