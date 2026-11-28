import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import 'widgets/archived_subject_dialog.dart';
import 'widgets/faculty_shell.dart';

/// Parent-subject list (`/faculty/subjects`).
class FacultySubjectsScreen extends ConsumerStatefulWidget {
  const FacultySubjectsScreen({super.key});

  @override
  ConsumerState<FacultySubjectsScreen> createState() =>
      _FacultySubjectsScreenState();
}

class _FacultySubjectsScreenState extends ConsumerState<FacultySubjectsScreen> {
  bool _loading = true;
  String? _error;
  List<Subject> _subjects = const <Subject>[];
  List<Section> _sections = const <Section>[];
  List<Subject> _archived = const <Subject>[];
  bool _showArchived = false;
  String _query = '';
  String _course = '';
  String _sort = '';
  int _page = 1;

  void _change(VoidCallback change) => setState(() {
    change();
    _page = 1;
  });

  Future<List<Subject>> _loadArchived() async {
    try {
      return await ref.read(subjectsApiProvider).getArchivedSubjects();
    } catch (_) {
      // A failure here (or an older server) must not hide current subjects.
      return const <Subject>[];
    }
  }

  Future<void> _openArchived(Subject subject) async {
    final outcome = await showArchivedSubjectDialog(context, subject: subject);
    if (!mounted || outcome == ArchiveOutcome.closed) return;
    CampusToast.showIn(
      context,
      outcome == ArchiveOutcome.restored
          ? '${subject.code} restored.'
          : '${subject.code} deleted.',
      tone: CampusToastTone.success,
    );
    if (outcome == ArchiveOutcome.restored) {
      _change(() => _showArchived = false);
    }
    await _load();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _subjects.isEmpty;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        ref.read(subjectsApiProvider).getSubjects(),
        ref.read(sectionsApiProvider).getSections(),
        _loadArchived(),
      ]);
      if (!mounted) return;
      setState(() {
        _subjects = results[0] as List<Subject>;
        _sections = results[1] as List<Section>;
        _archived = results[2] as List<Subject>;
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
        _error = 'Unable to load subjects: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final sectionCount = <String, int>{};
    for (final section in _sections) {
      sectionCount.update(
        section.subjectId,
        (value) => value + 1,
        ifAbsent: () => 1,
      );
    }

    final courses = <String, Set<String>>{};
    for (final section in _sections) {
      final course = section.course?.trim() ?? '';
      if (course.isNotEmpty) {
        courses.putIfAbsent(section.subjectId, () => <String>{}).add(course);
      }
    }
    final courseOptions = {for (final set in courses.values) ...set}.toList()
      ..sort();
    final listed = _showArchived ? _archived : _subjects;
    final matched = listed
        .where(
          (subject) =>
              matchesQuery(_query, [
                subject.name,
                subject.code,
                subject.description,
              ]) &&
              (_showArchived ||
                  _course.isEmpty ||
                  (courses[subject.id]?.contains(_course) ?? false)),
        )
        .toList();
    if (_sort == 'name') {
      matched.sort((a, b) => a.name.compareTo(b.name));
    } else if (_sort == 'newest') {
      matched.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
    final page = ListPage<Subject>(matched, _page);

    return FacultyScaffold(
      title: 'Subjects',
      subtitle: '${_subjects.length} subject(s)',
      floatingActionButton: FloatingActionButton(
        tooltip: 'Create subject',
        backgroundColor: tokens.maroon,
        foregroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        onPressed: () => context.push('/faculty/subjects/create'),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const FacultyLoading(label: 'Loading subjects.')
          : _error != null && _subjects.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListControls(
                    query: _query,
                    searchHint: 'Subject name or code',
                    onQueryChanged: (value) => _change(() => _query = value),
                    filters: () => [
                      if (!_showArchived && courseOptions.isNotEmpty)
                        ListFilter(
                          id: 'course',
                          label: 'Course',
                          allLabel: 'All courses',
                          value: _course,
                          options: [
                            for (final course in courseOptions)
                              ListOption(course, course),
                          ],
                          onChanged: (value) => _change(() => _course = value),
                        ),
                    ],
                    sort: _sort,
                    sortOptions: [
                      ListOption(
                        '',
                        _showArchived ? 'Recently archived' : 'Subject code',
                      ),
                      const ListOption('name', 'Name (A to Z)'),
                      const ListOption('newest', 'Newest first'),
                    ],
                    onSortChanged: (value) => _change(() => _sort = value),
                    onClear: () => _change(() {
                      _query = '';
                      _course = '';
                      _sort = '';
                    }),
                  ),
                  const SizedBox(height: 10),
                  FacultyTabs(
                    labels: [
                      'Current (${_subjects.length})',
                      'Archived (${_archived.length})',
                    ],
                    selectedIndex: _showArchived ? 1 : 0,
                    onSelected: (index) =>
                        _change(() => _showArchived = index == 1),
                  ),
                  const SizedBox(height: 10),
                  if (!_showArchived && _subjects.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.menu_book_outlined,
                      title: 'No subjects yet',
                      message:
                          'Create your first parent subject, then add sections '
                          'for each class you handle.',
                      actionLabel: 'Create subject',
                      onAction: () => context.push('/faculty/subjects/create'),
                    )
                  else if (matched.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Text(
                        _showArchived && _archived.isEmpty
                            ? 'Nothing is archived. Open a subject to archive '
                                  'it at the end of a semester.'
                            : 'No subject matches these filters.',
                        textAlign: TextAlign.center,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    )
                  else ...[
                    for (final subject in page.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _SubjectCard(
                          subject: subject,
                          sectionCount: sectionCount[subject.id] ?? 0,
                          onTap: () => subject.archivedAt != null
                              ? _openArchived(subject)
                              : context
                                    .push('/faculty/subjects/${subject.id}')
                                    // It may have been archived while open.
                                    .then((_) => mounted ? _load() : null),
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

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({
    required this.subject,
    required this.sectionCount,
    required this.onTap,
  });

  final Subject subject;
  final int sectionCount;
  final VoidCallback onTap;

  String? _erasure() {
    final archivedAt = DateTime.tryParse(subject.archivedAt ?? '');
    if (archivedAt == null) return null;
    if (subject.evidencePurgedAt != null) {
      return 'Evidence erased, results kept';
    }
    final due = archivedAt.add(
      const Duration(days: archiveEvidenceRetentionDays),
    );
    final left = due.difference(DateTime.now().toUtc());
    final days = left.isNegative ? 0 : (left.inSeconds / 86400).ceil();
    return 'Evidence erased in $days days';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final erasure = _erasure();
    final detail = erasure == null
        ? '${subject.code} · $sectionCount section(s)'
        : '${subject.code} · Archived';
    return CampusCard(
      semanticLabel: erasure == null
          ? '${subject.name} subject, $sectionCount sections'
          : '${subject.name} subject, archived',
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject.name,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: text.bodySmall?.copyWith(color: tokens.muted),
                ),
                if (erasure != null) ...[
                  const SizedBox(height: 6),
                  FacultyPill(
                    label: erasure,
                    icon: Icons.timer_outlined,
                    background: tokens.deepMaroon,
                    foreground: tokens.gold,
                    border: tokens.gold,
                  ),
                ] else if ((subject.description ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    subject.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: tokens.muted),
        ],
      ),
    );
  }
}
