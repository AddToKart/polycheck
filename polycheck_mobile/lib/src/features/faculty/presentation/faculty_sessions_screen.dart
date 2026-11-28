import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/session_list.dart';
import 'widgets/faculty_shell.dart';
import 'widgets/reschedule_sheet.dart';

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

/// The tabs, in order. Upcoming covers scheduled and rescheduled classes that
/// are still ahead.
enum _Tab { all, upcoming, live, completed, rescheduled }

const int _pageSize = 10;

class _FacultySessionsScreenState extends ConsumerState<FacultySessionsScreen> {
  bool _loading = true;
  String? _error;
  List<Session> _sessions = const <Session>[];
  List<Section> _sections = const <Section>[];
  Subject? _subject;
  _Tab _tab = _Tab.all;
  String _query = '';
  String _subjectFilter = '';
  String _sectionFilter = '';
  String _period = '';
  String _sort = '';
  int _page = 1;

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
      final scoped = widget.subjectId == null
          ? sessions
          : sessions
                .where((session) => sectionIds.contains(session.sectionId))
                .toList(growable: false);
      setState(() {
        _sessions = scoped;
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

  /// New session, already set to the section or subject being looked at.
  String _createPath() {
    final subjectId = widget.subjectId ?? _subjectFilter;
    final query = _sectionFilter.isNotEmpty
        ? '?sectionId=${Uri.encodeComponent(_sectionFilter)}'
        : subjectId.isNotEmpty
        ? '?subjectId=${Uri.encodeComponent(subjectId)}'
        : '';
    return '/faculty/sessions/create$query';
  }

  /// Any change to what is listed starts again from the first page.
  void _change(VoidCallback change) => setState(() {
    change();
    _page = 1;
  });

  void _clearFilters() => _change(() {
    _query = '';
    _subjectFilter = '';
    _sectionFilter = '';
    _period = '';
    _sort = '';
  });

  bool _inTab(Session session, String today) {
    final status = sessionListStatus(session, today);
    return switch (_tab) {
      _Tab.all => true,
      _Tab.upcoming =>
        status == SessionListStatus.scheduled ||
            status == SessionListStatus.rescheduled,
      _Tab.live => status == SessionListStatus.live,
      _Tab.completed => status == SessionListStatus.completed,
      _Tab.rescheduled => wasRescheduled(session),
    };
  }

  List<ListFilter> _filters(Map<String, Section> sectionById) {
    final subjectNames = <String, String>{
      for (final session in _sessions)
        if (sectionById[session.sectionId] != null)
          sectionById[session.sectionId]!.subjectId: session.subjectName,
    };
    final subjects = [
      for (final entry in subjectNames.entries)
        ListOption(entry.key, entry.value),
    ]..sort((a, b) => a.label.compareTo(b.label));
    final sections = [
      for (final section in _sections)
        if (_subjectFilter.isEmpty || section.subjectId == _subjectFilter)
          ListOption(
            section.id,
            [
              formatSectionHeading(
                section: section.section,
                course: section.course,
              ),
              if (_subjectFilter.isEmpty) ?subjectNames[section.subjectId],
            ].join(' · '),
          ),
    ]..sort((a, b) => a.label.compareTo(b.label));
    return [
      if (widget.subjectId == null)
        ListFilter(
          id: 'subject',
          label: 'Subject',
          allLabel: 'All subjects',
          value: _subjectFilter,
          options: subjects,
          onChanged: (value) => _change(() {
            _subjectFilter = value;
            // A section of another subject would hide everything.
            if (value.isNotEmpty &&
                sectionById[_sectionFilter]?.subjectId != value) {
              _sectionFilter = '';
            }
          }),
        ),
      ListFilter(
        id: 'section',
        label: 'Section',
        allLabel: 'All sections',
        value: _sectionFilter,
        options: sections,
        onChanged: (value) => _change(() => _sectionFilter = value),
      ),
      ListFilter(
        id: 'period',
        label: 'When',
        allLabel: 'Any date',
        value: _period,
        options: sessionPeriodOptions,
        onChanged: (value) => _change(() => _period = value),
      ),
    ];
  }

  String _heading(Session session, Section? section) => section == null
      ? session.subjectName
      : '${session.subjectName} · '
            '${formatSectionHeading(section: section.section, course: section.course)}';

  Future<void> _reschedule(Session session, Section? section) async {
    final saved = await showRescheduleSheet(
      context,
      session: session,
      label: _heading(session, section),
    );
    if (saved == null || !mounted) return;
    setState(() {
      _sessions = [
        for (final item in _sessions) item.id == saved.id ? saved : item,
      ];
    });
    CampusToast.showIn(
      context,
      'Class rescheduled.',
      tone: CampusToastTone.success,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final sectionById = <String, Section>{
      for (final section in _sections) section.id: section,
    };
    final today = formatCampusDate();
    final matched = _sessions
        .where((session) {
          final section = sectionById[session.sectionId];
          if (_subjectFilter.isNotEmpty &&
              section?.subjectId != _subjectFilter) {
            return false;
          }
          if (_sectionFilter.isNotEmpty &&
              session.sectionId != _sectionFilter) {
            return false;
          }
          if (!inSessionPeriod(session.date, _period, today)) return false;
          if (!_inTab(session, today)) return false;
          return matchesQuery(_query, [
            session.subjectName,
            if (section != null)
              formatSectionHeading(
                section: section.section,
                course: section.course,
              ),
            session.room,
            session.date,
          ]);
        })
        .toList(growable: false);
    final page = ListPage<Session>(
      sortSessions(matched, _sort, today),
      _page,
      size: _pageSize,
    );
    final activeCount = _sessions.where((session) => session.isActive).length;
    final user = ref.watch(sessionProvider).user;

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
        onPressed: () => context.push(_createPath()),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const FacultyLoading(label: 'Loading sessions.')
          : _error != null && _sessions.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              // Room for the last card above the create button.
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListControls(
                    query: _query,
                    searchHint: 'Subject, section, room or date',
                    onQueryChanged: (value) => _change(() => _query = value),
                    filters: () => _filters(sectionById),
                    sort: _sort,
                    sortOptions: sessionSortOptions,
                    onSortChanged: (value) => _change(() => _sort = value),
                    onClear: _clearFilters,
                  ),
                  const SizedBox(height: 10),
                  FacultyTabs(
                    labels: const [
                      'All',
                      'Upcoming',
                      'Live',
                      'Completed',
                      'Rescheduled',
                    ],
                    selectedIndex: _tab.index,
                    onSelected: (index) =>
                        _change(() => _tab = _Tab.values[index]),
                  ),
                  const SizedBox(height: 10),
                  if (_sessions.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.qr_code_2,
                      title: 'No sessions here yet',
                      message:
                          'Create a session to open the live cockpit and arm '
                          'the attendance QR.',
                      actionLabel: 'Create session',
                      onAction: () => context.push(_createPath()),
                    )
                  else if (matched.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.filter_alt_off_outlined,
                      title: 'No sessions match',
                      message: 'Change the search, filters or tab.',
                      actionLabel: 'Clear filters',
                      onAction: () {
                        _clearFilters();
                        setState(() => _tab = _Tab.all);
                      },
                    )
                  else ...[
                    for (final session in page.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _SessionCard(
                          session: session,
                          heading: _heading(
                            session,
                            sectionById[session.sectionId],
                          ),
                          onOpen: () =>
                              context.push('/faculty/sessions/${session.id}'),
                          onReschedule:
                              canReschedule(session) &&
                                  user?.id == session.teacherId
                              ? () => _reschedule(
                                  session,
                                  sectionById[session.sectionId],
                                )
                              : null,
                        ),
                      ),
                    ListPager(
                      page: page,
                      onChanged: (value) => setState(() => _page = value),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.heading,
    required this.onOpen,
    this.onReschedule,
  });

  final Session session;
  final String heading;
  final VoidCallback onOpen;
  final VoidCallback? onReschedule;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final room = (session.room ?? '').trim();
    final from = session.rescheduledFromDate;
    return CampusCard(
      onTap: onOpen,
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
                  heading,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${session.date} · '
                  '${formatTime(session.startTime)} – '
                  '${formatTime(session.endTime)}'
                  '${room.isEmpty ? '' : ' · $room'}',
                  style: text.bodySmall?.copyWith(color: tokens.muted),
                ),
                if (wasRescheduled(session)) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      FacultyPill(
                        label: 'RESCHEDULED',
                        icon: Icons.event_repeat,
                        background: tokens.deepMaroon,
                        foreground: tokens.gold,
                        border: tokens.gold,
                      ),
                      if (from != null && from.isNotEmpty)
                        Text(
                          'from $from'
                          '${session.originalScheduleTime == null ? '' : ', ${session.originalScheduleTime}'}',
                          style: text.labelSmall?.copyWith(color: tokens.muted),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (session.mode == SessionMode.online)
            const Padding(
              padding: EdgeInsets.only(left: 6),
              child: FacultyPill(
                label: 'ONLINE',
                icon: Icons.videocam_outlined,
              ),
            ),
          const SizedBox(width: 6),
          if (session.isActive)
            FacultyPill(
              label: 'LIVE',
              background: tokens.gold,
              foreground: tokens.deepMaroon,
              border: tokens.gold,
            )
          else if (onReschedule != null)
            IconButton(
              key: ValueKey<String>('reschedule-${session.id}'),
              tooltip: 'Reschedule',
              onPressed: onReschedule,
              icon: Icon(
                Icons.edit_calendar_outlined,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
            )
          else
            Icon(Icons.chevron_right, color: tokens.muted),
        ],
      ),
    );
  }
}
