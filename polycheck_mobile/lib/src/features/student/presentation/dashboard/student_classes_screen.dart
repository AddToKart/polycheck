import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_classes_data.dart';
import '../../data/student_providers.dart';
import '../../student_paths.dart';
import '../enrollment/enrollment_code_dialog.dart';
import 'my_class_card.dart';

/// Full enrolled-class list (`/student/subjects`), reached from the dashboard
/// "View all N classes" link. The section detail page stays the home of the
/// officer permission window and the create-session action.
class StudentClassesScreen extends ConsumerWidget {
  const StudentClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = PupTheme.of(context);
    final cards = ref.watch(studentClassCardsProvider);
    final sections = ref.watch(studentSectionsProvider);
    final loading = sections.isLoading && cards.isEmpty;

    return Scaffold(
      appBar: CampusHeader(
        title: 'My classes',
        subtitle: cards.isEmpty ? null : '${cards.length} enrolled',
      ),
      body: RefreshIndicator(
        color: tokens.maroon,
        onRefresh: () => _refresh(ref),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: <Widget>[
            if (loading) ...<Widget>[
              LinearProgressIndicator(
                minHeight: 2,
                color: tokens.maroon,
                backgroundColor: tokens.borderSubtle,
              ),
              const SizedBox(height: 12),
            ],
            if (cards.isEmpty && !loading)
              CampusCard(
                key: const ValueKey('student-classes-list-empty'),
                child: CampusEmptyState(
                  icon: Icons.auto_stories_outlined,
                  title: 'No classes yet',
                  message: 'Enroll with a code from your instructor.',
                  actionLabel: 'Enroll',
                  onAction: () => showEnrollmentCodeDialog(context),
                ),
              )
            else
              for (final card in cards) ...<Widget>[
                MyClassCard(
                  key: ValueKey('student-class-card-${card.sectionId}'),
                  card: card,
                  onTap: () =>
                      context.push(StudentPaths.subject(card.sectionId)),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(studentSectionsProvider);
    ref.invalidate(studentSubjectsProvider);
    ref.invalidate(myAttendanceProvider);
    ref.invalidate(studentClassRolesProvider);
    try {
      await ref.read(studentSectionsProvider.future);
    } catch (_) {
      // The list keeps the last rendered snapshot.
    }
  }
}
