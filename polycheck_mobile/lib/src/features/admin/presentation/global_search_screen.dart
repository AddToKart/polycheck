import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/api/api_models.dart';
import '../../../core/models/subject.dart';
import '../../../core/models/user.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/section_label.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../../../core/widgets/campus_text_field.dart';
import '../domain/admin_access.dart';
import 'widgets/admin_common.dart';

class GlobalSearchScreen extends ConsumerStatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  ConsumerState<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends ConsumerState<GlobalSearchScreen> {
  final _query = TextEditingController();
  Timer? _debounce;
  SearchResults? _results;
  final List<String> _recent = <String>[];
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.length < 2) {
      setState(() {
        _results = null;
        _loading = false;
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) _search(trimmed);
    });
  }

  Future<void> _search(String query) async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ref.read(searchApiProvider).search(query);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _results = results;
        _loading = false;
        _recent.remove(query);
        _recent.insert(0, query);
        if (_recent.length > 6) _recent.removeRange(6, _recent.length);
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final results = _results;
    final hasQuery = _query.text.trim().length >= 2;
    return AdminScaffold(
      title: 'Global search',
      subtitle: 'Read-only lookup across accounts and sections',
      section: AdminSection.search,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          const AdminInfoBanner(
            icon: Icons.visibility_outlined,
            message:
                'Read-only accountability lookup. Results open the owning '
                'faculty screen in view mode; administrative actions stay in '
                'their dedicated consoles.',
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _query,
            label: 'Search students and sections',
            hint: 'Name, student number, section, or course',
            prefixIcon: Icons.search,
            onChanged: _onChanged,
            onSubmitted: (value) {
              final trimmed = value.trim();
              if (trimmed.length >= 2) _search(trimmed);
            },
          ),
          if (!hasQuery && _recent.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            const AdminSectionLabel('Recent searches'),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                for (final term in _recent)
                  AdminFilterChip(
                    label: term,
                    selected: false,
                    onSelected: () {
                      _query.text = term;
                      _search(term);
                    },
                  ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: AdminLoading(label: 'Searching…'),
            )
          else if (_error != null)
            AdminErrorState(
              message: _error!,
              onRetry: () {
                final trimmed = _query.text.trim();
                if (trimmed.length >= 2) _search(trimmed);
              },
            )
          else if (!hasQuery)
            const CampusEmptyState(
              icon: Icons.search,
              title: 'Start typing',
              message: 'Enter at least two characters to search.',
            )
          else if (results == null)
            const SizedBox.shrink()
          else if (results.students.isEmpty && results.sections.isEmpty)
            const CampusEmptyState(
              icon: Icons.search_off,
              title: 'No matches',
              message: 'Try a different name, student number, or section.',
            )
          else ...<Widget>[
            if (results.students.isNotEmpty) ...<Widget>[
              AdminSectionLabel('Students (${results.students.length})'),
              const SizedBox(height: 6),
              for (final student in results.students)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _StudentResult(
                    student: student,
                    onTap: () =>
                        context.push('/faculty/students/${student.id}'),
                  ),
                ),
              const SizedBox(height: 10),
            ],
            if (results.sections.isNotEmpty) ...<Widget>[
              AdminSectionLabel('Sections (${results.sections.length})'),
              const SizedBox(height: 6),
              for (final section in results.sections)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _SectionResult(
                    section: section,
                    onTap: () =>
                        context.push('/faculty/sections/${section.id}'),
                  ),
                ),
            ],
            const SizedBox(height: 8),
            Text(
              'Destination screens are owned by the faculty workspace and open '
              'in read-only mode.',
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

class _StudentResult extends StatelessWidget {
  const _StudentResult({required this.student, required this.onTap});

  final User student;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          CircleAvatar(
            radius: 18,
            backgroundColor: tokens.campus,
            child: Icon(Icons.person_outline, size: 18, color: tokens.muted),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  student.fullName,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  <String?>[
                        student.studentId,
                        student.program,
                        student.department,
                      ]
                      .whereType<String>()
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18),
        ],
      ),
    );
  }
}

class _SectionResult extends StatelessWidget {
  const _SectionResult({required this.section, required this.onTap});

  final Section section;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          CircleAvatar(
            radius: 18,
            backgroundColor: tokens.campus,
            child: Icon(Icons.class_outlined, size: 18, color: tokens.muted),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  formatSectionHeading(
                    section: section.section,
                    course: section.course,
                  ),
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  <String?>[section.room, section.semester, section.teacherName]
                      .whereType<String>()
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18),
        ],
      ),
    );
  }
}
