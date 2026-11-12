import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_standing.dart';
import '../../student_paths.dart';

/// Supportive, dismissible attendance-standing notice.
class StudentStandingBanner extends ConsumerWidget {
  const StudentStandingBanner({
    super.key,
    required this.userId,
    required this.standing,
  });

  final String userId;
  final AttendanceStanding standing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dismissals = ref.watch(standingDismissalsProvider);
    if (dismissals.contains(standingDismissKey(userId, standing.sectionId))) {
      return const SizedBox.shrink();
    }

    final tokens = PupTheme.of(context);
    final rate = standing.attendanceRate;
    final professor = standing.professorName.trim().isEmpty
        ? 'your professor'
        : standing.professorName.trim();
    final copy = standing.status == AttendanceStandingStatus.atRisk
        ? 'One more recorded absence drops you below the minimum.'
        : 'You are below the minimum. Consider talking to $professor.';

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: CampusCard(
        key: const ValueKey('student-standing-banner'),
        color: tokens.gold.withValues(alpha: tokens.isDark ? 0.08 : 0.13),
        borderColor: tokens.gold,
        padding: const EdgeInsets.fromLTRB(14, 14, 6, 14),
        onTap: () => context.push(StudentPaths.subject(standing.sectionId)),
        semanticLabel: 'View attendance standing for ${standing.subjectName}',
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              Icons.error_outline,
              size: 20,
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'ATTENDANCE CHECK',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${standing.subjectName} · Section ${standing.sectionName}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${formatStandingRate(rate)}% (minimum ${standing.thresholdPercent}%)',
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    copy,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.onSurface.withValues(alpha: 0.8),
                    ),
                  ),
                  if (standing.caveat != null &&
                      standing.caveat!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 3),
                    Text(
                      standing.caveat!,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    'VIEW CLASS',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              key: const ValueKey('standing-dismiss'),
              tooltip: 'Dismiss attendance notice',
              onPressed: () => ref
                  .read(standingDismissalsProvider.notifier)
                  .dismiss(userId, standing.sectionId),
              icon: Icon(Icons.close, size: 18, color: tokens.muted),
            ),
          ],
        ),
      ),
    );
  }
}
