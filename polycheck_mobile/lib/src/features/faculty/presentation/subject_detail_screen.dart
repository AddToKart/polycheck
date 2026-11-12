import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/session_wizard.dart';
import 'widgets/faculty_shell.dart';

/// Parent subject detail: its sections grid + "Add section" + sessions link.
class SubjectDetailScreen extends ConsumerStatefulWidget {
  const SubjectDetailScreen({super.key, required this.subjectId});

  final String subjectId;

  @override
  ConsumerState<SubjectDetailScreen> createState() =>
      _SubjectDetailScreenState();
}

class _SubjectDetailScreenState extends ConsumerState<SubjectDetailScreen> {
  bool _loading = true;
  String? _error;
  Subject? _subject;
  List<Section> _sections = const <Section>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _subject == null;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        ref.read(subjectsApiProvider).getSubject(widget.subjectId),
        ref.read(sectionsApiProvider).getSections(subjectId: widget.subjectId),
      ]);
      if (!mounted) return;
      setState(() {
        _subject = results[0] as Subject;
        _sections = results[1] as List<Section>;
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
        _error = 'Unable to load the subject: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final subject = _subject;
    return FacultyScaffold(
      title: subject == null ? 'Subject' : subject.name,
      subtitle: subject?.code,
      showDefaultActions: false,
      body: _loading
          ? const FacultyLoading(label: 'Loading subject.')
          : _error != null && subject == null
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          subject!.name,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subject.code,
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                        if ((subject.description ?? '').trim().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            subject.description!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => context.push(
                                  '/faculty/sections/create'
                                  '?subjectId=${Uri.encodeComponent(subject.id)}',
                                ),
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Add section'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => context.push(
                                  '/faculty/subjects/${subject.id}/sessions',
                                ),
                                icon: const Icon(Icons.qr_code_2, size: 16),
                                label: const Text('Sessions'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  FacultySectionTitle(title: 'Sections (${_sections.length})'),
                  if (_sections.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.groups_outlined,
                      title: 'No sections yet',
                      message:
                          'Add a section to assign a schedule, room and '
                          'semester, then enroll students.',
                      actionLabel: 'Add section',
                      onAction: () => context.push(
                        '/faculty/sections/create'
                        '?subjectId=${Uri.encodeComponent(subject.id)}',
                      ),
                    )
                  else
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final columns = constraints.maxWidth >= 700 ? 2 : 1;
                        const spacing = 8.0;
                        final width =
                            (constraints.maxWidth - spacing * (columns - 1)) /
                            columns;
                        return Wrap(
                          spacing: spacing,
                          runSpacing: spacing,
                          children: [
                            for (final section in _sections)
                              SizedBox(
                                width: width,
                                child: _SectionCard(
                                  section: section,
                                  subjectName: subject.name,
                                  onTap: () => context.push(
                                    '/faculty/sections/${section.id}',
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                ],
              ),
            ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.section,
    required this.subjectName,
    required this.onTap,
  });

  final Section section;
  final String subjectName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final slots = scheduleSlotsForSection(section);
    return CampusCard(
      onTap: onTap,
      semanticLabel:
          '${formatSectionHeading(section: section.section, course: section.course)}, ${section.studentCount} students',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeadingLabel(
            section: section.section,
            course: section.course,
            maxLines: 2,
          ),
          const SizedBox(height: 4),
          Text(
            subjectName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              FacultyPill(
                label: '${section.studentCount} students',
                icon: Icons.people_outline,
              ),
              if (section.semester.isNotEmpty)
                FacultyPill(label: section.semester),
              if (section.room.trim().isNotEmpty)
                FacultyPill(
                  label: section.room,
                  icon: Icons.meeting_room_outlined,
                ),
            ],
          ),
          if (slots.isNotEmpty) ...[
            const SizedBox(height: 8),
            for (final slot in slots)
              Text(
                slotLabel(slot),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
          ],
        ],
      ),
    );
  }
}
