import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
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
      ]);
      if (!mounted) return;
      setState(() {
        _subjects = results[0] as List<Subject>;
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
        _error = 'Unable to load subjects: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final sectionCount = <String, int>{};
    for (final section in _sections) {
      sectionCount.update(
        section.subjectId,
        (value) => value + 1,
        ifAbsent: () => 1,
      );
    }

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
              child: _subjects.isEmpty
                  ? FacultyEmptyState(
                      icon: Icons.menu_book_outlined,
                      title: 'No subjects yet',
                      message:
                          'Create your first parent subject, then add sections '
                          'for each class you handle.',
                      actionLabel: 'Create subject',
                      onAction: () => context.push('/faculty/subjects/create'),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final subject in _subjects)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: CampusCard(
                              semanticLabel:
                                  '${subject.name} subject, ${sectionCount[subject.id] ?? 0} sections',
                              onTap: () => context.push(
                                '/faculty/subjects/${subject.id}',
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          subject.name,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleSmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w700,
                                              ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${subject.code} · '
                                          '${sectionCount[subject.id] ?? 0} '
                                          'section(s)',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(color: tokens.muted),
                                        ),
                                        if ((subject.description ?? '')
                                            .trim()
                                            .isNotEmpty) ...[
                                          const SizedBox(height: 6),
                                          Text(
                                            subject.description!,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(color: tokens.muted),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  Icon(
                                    Icons.chevron_right,
                                    color: tokens.muted,
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
