import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/faculty_shell.dart';

/// Teacher dashboard: stat cards, today's schedule, subjects, at-risk preview.
class FacultyDashboardScreen extends ConsumerStatefulWidget {
  const FacultyDashboardScreen({super.key});

  @override
  ConsumerState<FacultyDashboardScreen> createState() =>
      _FacultyDashboardScreenState();
}

class _FacultyDashboardScreenState
    extends ConsumerState<FacultyDashboardScreen> {
  bool _loading = true;
  String? _error;
  DashboardOverview? _overview;
  List<Subject> _subjects = const <Subject>[];
  List<Section> _sections = const <Section>[];
  List<CalendarEvent> _todayEvents = const <CalendarEvent>[];
  List<StudentAtRisk> _atRisk = const <StudentAtRisk>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    if (mounted) setState(() => _error = null);
    final today = formatCampusDate();
    final subjectsApi = ref.read(subjectsApiProvider);
    final sectionsApi = ref.read(sectionsApiProvider);
    final dashboardApi = ref.read(dashboardApiProvider);
    final attendanceApi = ref.read(attendanceApiProvider);

    Future<T?> guarded<T>(Future<T> Function() request) async {
      try {
        return await request();
      } catch (_) {
        return null;
      }
    }

    final results = await Future.wait<Object?>(<Future<Object?>>[
      guarded(subjectsApi.getSubjects),
      guarded(sectionsApi.getSections),
      guarded(dashboardApi.getDashboardOverview),
      guarded(() => dashboardApi.getCalendarEvents(user.id, today, today)),
      guarded(() => attendanceApi.getAtRiskStudents(limit: 8)),
    ]);
    if (!mounted) return;
    final subjects = results[0] as List<Subject>?;
    final sections = results[1] as List<Section>?;
    final overview = results[2] as DashboardOverview?;
    final events = results[3] as List<CalendarEvent>?;
    final atRisk = results[4] as List<StudentAtRisk>?;
    setState(() {
      _subjects = subjects ?? const <Subject>[];
      _sections = (sections ?? const <Section>[])
          .where((section) => section.teacherId == user.id)
          .toList(growable: false);
      _overview = overview;
      _todayEvents = (events ?? const <CalendarEvent>[]).toList(growable: false)
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
      _atRisk = sortAtRiskRows(atRisk ?? const <StudentAtRisk>[]);
      _loading = false;
      if (overview == null && subjects == null && sections == null) {
        _error =
            'Cannot reach the Polycheck server. Check your connection and try '
            'again.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final tokens = PupTheme.of(context);

    if (_loading) {
      return const FacultyScaffold(
        title: 'Faculty dashboard',
        showDefaultActions: true,
        body: FacultyLoading(label: 'Loading your classroom.'),
      );
    }

    final counts = _overview?.counts;
    final sectionCountBySubject = <String, int>{};
    for (final section in _sections) {
      sectionCountBySubject.update(
        section.subjectId,
        (value) => value + 1,
        ifAbsent: () => 1,
      );
    }
    final atRiskPreview = _atRisk
        .where(
          (row) =>
              row.status == AttendanceStandingStatus.belowThreshold ||
              row.status == AttendanceStandingStatus.atRisk ||
              (row.status == AttendanceStandingStatus.onTrack &&
                  (row.absencesBeforeBelowThreshold ?? 99) <= 2),
        )
        .take(3)
        .toList(growable: false);

    return FacultyScaffold(
      title: 'Faculty dashboard',
      subtitle: user == null ? null : 'Welcome back, ${user.fullName}',
      body: FacultyPageBody(
        refresh: _load,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              CampusCard(
                borderColor: tokens.gold,
                color: tokens.isDark ? tokens.surface : null,
                child: Row(
                  children: [
                    Icon(
                      Icons.cloud_off_outlined,
                      color: tokens.gold,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            FacultyStatGrid(
              wideColumns: 3,
              children: [
                FacultyStatCard(
                  label: 'Subjects',
                  value: '${counts?.subjects ?? _subjects.length}',
                  icon: Icons.menu_book_outlined,
                  onTap: () => context.go('/faculty/subjects'),
                ),
                FacultyStatCard(
                  label: 'Sections',
                  value: '${counts?.sections ?? _sections.length}',
                  icon: Icons.groups_outlined,
                ),
                FacultyStatCard(
                  label: 'Students',
                  value: '${counts?.students ?? 0}',
                  icon: Icons.people_outline,
                ),
                FacultyStatCard(
                  label: 'Sessions today',
                  value: '${counts?.sessionsToday ?? 0}',
                  icon: Icons.event_available_outlined,
                  onTap: () => context.go('/faculty/sessions'),
                ),
                FacultyStatCard(
                  label: 'Pending disputes',
                  value: '${counts?.pendingDisputes ?? 0}',
                  icon: Icons.gavel_outlined,
                  onTap: () => context.go('/faculty/disputes'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            FacultySectionTitle(
              title: "Today's schedule",
              trailing: TextButton(
                onPressed: () => context.go('/faculty/schedule'),
                child: const Text('Calendar'),
              ),
            ),
            if (_todayEvents.isEmpty)
              CampusCard(
                child: Row(
                  children: [
                    Icon(
                      Icons.event_busy_outlined,
                      color: tokens.muted,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'No classes scheduled for today.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._todayEvents.map(
                (event) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _TodayEventCard(
                    event: event,
                    onTap: () {
                      if (event.type == CalendarEventType.session) {
                        context.push('/faculty/sessions/${event.id}');
                      } else {
                        context.push('/faculty/sections/${event.sectionId}');
                      }
                    },
                  ),
                ),
              ),
            const SizedBox(height: 20),
            FacultySectionTitle(
              title: 'Students to check on',
              trailing: TextButton(
                onPressed: () => context.go('/faculty/at-risk'),
                child: const Text('View all'),
              ),
            ),
            if (atRiskPreview.isEmpty)
              CampusCard(
                child: Row(
                  children: [
                    Icon(Icons.verified_outlined, color: tokens.gold, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Everyone is on track this week.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                  ],
                ),
              )
            else
              ...atRiskPreview.map(
                (row) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _AtRiskPreviewCard(
                    row: row,
                    onTap: () => context.push(
                      '/faculty/students/${row.studentId}'
                      '?sectionId=${Uri.encodeComponent(row.sectionId)}',
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 20),
            FacultySectionTitle(
              title: 'My subjects',
              trailing: TextButton(
                onPressed: () => context.push('/faculty/subjects/create'),
                child: const Text('New subject'),
              ),
            ),
            if (_subjects.isEmpty)
              CampusCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No subjects yet',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Create a subject, then add a section to start tracking '
                      'attendance.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                    const SizedBox(height: 10),
                    CampusButton(
                      label: 'Create subject',
                      expand: false,
                      icon: Icons.add,
                      onPressed: () => context.push('/faculty/subjects/create'),
                    ),
                  ],
                ),
              )
            else
              ..._subjects.map(
                (subject) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: CampusCard(
                    onTap: () =>
                        context.push('/faculty/subjects/${subject.id}'),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                subject.name,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${subject.code} · '
                                '${sectionCountBySubject[subject.id] ?? 0} '
                                'section(s)',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: tokens.muted),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 20),
            FacultySectionTitle(title: 'Shortcuts'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ShortcutChip(
                  label: 'Attendance',
                  icon: Icons.fact_check_outlined,
                  onTap: () => context.go('/faculty/attendance'),
                ),
                _ShortcutChip(
                  label: 'Reports',
                  icon: Icons.insights_outlined,
                  onTap: () => context.go('/faculty/reports'),
                ),
                _ShortcutChip(
                  label: 'Excuses',
                  icon: Icons.event_note_outlined,
                  onTap: () => context.go('/faculty/excuses'),
                ),
                _ShortcutChip(
                  label: 'Sessions',
                  icon: Icons.qr_code_2,
                  onTap: () => context.go('/faculty/sessions'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TodayEventCard extends StatelessWidget {
  const _TodayEventCard({required this.event, required this.onTap});

  final CalendarEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final active = event.status == CalendarEventStatus.active;
    return CampusCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 4,
            height: 44,
            color: active ? tokens.gold : tokens.maroon,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.subjectName.isEmpty ? event.title : event.subjectName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${formatTime(event.startTime)} – ${formatTime(event.endTime)}'
                  '${event.room == null || event.room!.isEmpty ? '' : ' · ${event.room}'}'
                  '${event.sectionName.isEmpty ? '' : ' · Sec ${event.sectionName}'}',
                  maxLines: 2,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          if (active)
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
    );
  }
}

class _AtRiskPreviewCard extends StatelessWidget {
  const _AtRiskPreviewCard({required this.row, required this.onTap});

  final StudentAtRisk row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final below = row.status == AttendanceStandingStatus.belowThreshold;
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Icon(
            below ? Icons.error_outline : Icons.warning_amber_outlined,
            size: 18,
            color: below ? tokens.maroon : tokens.gold,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.studentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${row.subjectName} · Sec ${row.sectionName} · '
                  '${formatRatePercent(row.attendanceRate)} attendance',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          FacultyPill(
            label: atRiskStatusLabels[row.status] ?? row.status.wire,
            background: below ? tokens.maroon : tokens.campus,
            foreground: below ? Colors.white : tokens.onSurface,
            border: below ? tokens.maroon : tokens.borderSubtle,
          ),
        ],
      ),
    );
  }
}

class _ShortcutChip extends StatelessWidget {
  const _ShortcutChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: tokens.isDark ? tokens.gold : tokens.maroon,
        minimumSize: const Size(0, 44),
      ),
    );
  }
}
