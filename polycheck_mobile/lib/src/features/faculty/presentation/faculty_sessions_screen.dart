import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import 'widgets/faculty_shell.dart';

/// Sessions directory. Optionally scoped by subject (route param) or section
/// (query param). The cockpit is the only activation surface.
class FacultySessionsScreen extends ConsumerStatefulWidget {
  const FacultySessionsScreen({super.key, this.subjectId, this.sectionId});

  final String? subjectId;
  final String? sectionId;

  @override
  ConsumerState<FacultySessionsScreen> createState() =>
      _FacultySessionsScreenState();
}

enum _SessionStatusFilter { all, active, completed }

class _FacultySessionsScreenState extends ConsumerState<FacultySessionsScreen> {
  bool _loading = true;
  String? _error;
  List<Session> _sessions = const <Session>[];
  List<Section> _sections = const <Section>[];
  Subject? _subject;
  _SessionStatusFilter _filter = _SessionStatusFilter.all;
  String _sectionFilter = '';

  @override
  void initState() {
    super.initState();
    _sectionFilter = widget.sectionId ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _sessions.isEmpty;
      _error = null;
    });
    try {
      final subjectsApi = ref.read(subjectsApiProvider);
      final sectionsApi = ref.read(sectionsApiProvider);
      final sessionsApi = ref.read(sessionsApiProvider);
      final subject = widget.subjectId == null
          ? null
          : await subjectsApi.getSubject(widget.subjectId!);
      final sections = await sectionsApi.getSections(
        subjectId: widget.subjectId,
      );
      final sessions = await sessionsApi.getSessions();
      if (!mounted) return;
      final sectionIds = sections.map((section) => section.id).toSet();
      final filtered = widget.subjectId == null
          ? sessions
          : sessions
                .where((session) => sectionIds.contains(session.sectionId))
                .toList(growable: false);
      filtered.sort((a, b) {
        final date = b.date.compareTo(a.date);
        if (date != 0) return date;
        return b.startTime.compareTo(a.startTime);
      });
      setState(() {
        _sessions = filtered;
        _sections = sections;
        _subject = subject;
        _loading = false;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load sessions: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final sectionById = <String, Section>{
      for (final section in _sections) section.id: section,
    };
    final scoped = _sessions
        .where((session) {
          if (_sectionFilter.isNotEmpty &&
              session.sectionId != _sectionFilter) {
            return false;
          }
          return switch (_filter) {
            _SessionStatusFilter.all => true,
            _SessionStatusFilter.active => session.isActive,
            _SessionStatusFilter.completed => !session.isActive,
          };
        })
        .toList(growable: false);
    final activeCount = _sessions.where((session) => session.isActive).length;
    final selectedSection = sectionById[_sectionFilter];

    return FacultyScaffold(
      title: _subject == null ? 'Sessions' : _subject!.name,
      subtitle: _subject == null
          ? '${_sessions.length} session(s) · $activeCount live'
          : '${_subject!.code} · ${_sessions.length} session(s)',
      floatingActionButton: FloatingActionButton(
        tooltip: 'Create session',
        backgroundColor: tokens.maroon,
        foregroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        onPressed: () {
          final query = _sectionFilter.isEmpty
              ? ''
              : '?sectionId=${Uri.encodeComponent(_sectionFilter)}';
          context.push('/faculty/sessions/create$query');
        },
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const FacultyLoading(label: 'Loading sessions.')
          : _error != null && _sessions.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (selectedSection != null) ...[
                    CampusCard(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Showing '
                              '${formatSectionHeading(section: selectedSection.section, course: selectedSection.course)}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          TextButton(
                            onPressed: () =>
                                setState(() => _sectionFilter = ''),
                            child: const Text('Clear'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  FacultyTabs(
                    labels: const ['All', 'Live', 'Completed'],
                    selectedIndex: _filter.index,
                    onSelected: (index) => setState(
                      () => _filter = _SessionStatusFilter.values[index],
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (scoped.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.qr_code_2,
                      title: 'No sessions here yet',
                      message:
                          'Create a session to open the live cockpit and arm '
                          'the attendance QR.',
                      actionLabel: 'Create session',
                      onAction: () => context.push('/faculty/sessions/create'),
                    )
                  else
                    for (final session in scoped)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: CampusCard(
                          onTap: () =>
                              context.push('/faculty/sessions/${session.id}'),
                          child: Row(
                            children: [
                              Container(
                                width: 4,
                                height: 46,
                                color: session.isActive
                                    ? tokens.gold
                                    : session.endedAt != null
                                    ? tokens.muted
                                    : tokens.maroon,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      sectionById[session.sectionId] == null
                                          ? session.subjectName
                                          : '${session.subjectName} · '
                                                '${formatSectionHeading(section: sectionById[session.sectionId]!.section, course: sectionById[session.sectionId]!.course)}',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${session.date} · '
                                      '${formatTime(session.startTime)} – '
                                      '${formatTime(session.endTime)}'
                                      '${(session.room ?? '').trim().isEmpty ? '' : ' · ${session.room}'}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: tokens.muted),
                                    ),
                                  ],
                                ),
                              ),
                              if (session.mode == SessionMode.online)
                                const Padding(
                                  padding: EdgeInsets.only(right: 6),
                                  child: FacultyPill(
                                    label: 'ONLINE',
                                    icon: Icons.videocam_outlined,
                                  ),
                                ),
                              if (session.isActive)
                                FacultyPill(
                                  label: 'LIVE',
                                  background: tokens.gold,
                                  foreground: tokens.deepMaroon,
                                  border: tokens.gold,
                                )
                              else
                                Icon(Icons.chevron_right, color: tokens.muted),
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
