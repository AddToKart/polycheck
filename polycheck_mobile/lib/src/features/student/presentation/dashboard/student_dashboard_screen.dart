import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_classes_data.dart';
import '../../data/student_dashboard_data.dart';
import '../../data/student_models.dart';
import '../../data/student_providers.dart';
import '../../data/student_standing.dart';
import '../../student_paths.dart';
import '../common/student_app_bar_actions.dart';
import '../enrollment/enrollment_code_dialog.dart';
import '../id_card/student_id_card_screen.dart';
import 'my_class_card.dart';
import 'offline_readiness_chip.dart';
import 'offline_sync_panel.dart';
import 'sign_out_footer.dart';
import 'student_standing_banner.dart';

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    if (user == null) {
      return Scaffold(
        body: const CampusLoading(label: 'Loading your account…'),
      );
    }

    final sectionsAsync = ref.watch(studentSectionsProvider);
    final subjectsAsync = ref.watch(studentSubjectsProvider);
    final attendanceAsync = ref.watch(myAttendanceProvider);
    final sessionsAsync = ref.watch(todaySessionsProvider);
    final standingsAsync = ref.watch(studentStandingProvider);
    final officers = ref.watch(studentOfficerProvider).value;
    final classCards = ref.watch(studentClassCardsProvider);

    final sections = sectionsAsync.value ?? const <Section>[];
    final subjects = subjectsAsync.value ?? const <String, Subject>{};
    final records = attendanceAsync.value ?? const <AttendanceRecord>[];
    final sessions = sessionsAsync.value ?? const <Session>[];
    final standings = standingsAsync.value ?? const <AttendanceStanding>[];

    final now = DateTime.now();
    final today = formatCampusDate(now);
    final todayClasses = buildTodayClasses(
      sections: sections,
      sessions: sessions,
      subjects: subjects,
      records: records,
      todayDate: today,
    );
    final totals = attendanceTotals(records);
    final standing = pickStandingAlert(standings);
    final computedRate = attendanceRatePercent(records);
    final rate = standing?.attendanceRate ?? computedRate.toDouble();
    final threshold = standing?.thresholdPercent ?? 75;

    final isLoading =
        sectionsAsync.isLoading ||
        subjectsAsync.isLoading ||
        attendanceAsync.isLoading ||
        sessionsAsync.isLoading;
    final hasHardError =
        sectionsAsync.hasError &&
        sectionsAsync.value == null &&
        attendanceAsync.value == null;

    return Scaffold(
      appBar: CampusHeader(
        title: '${dashboardGreeting(now)}, ${firstNameOf(user.fullName)}',
        subtitle:
            '${user.program?.trim().isNotEmpty == true ? user.program : 'PUP Student'}'
            ' · Year ${user.yearLevel ?? 1}',
        actions: StudentAppBarActions.build(context),
      ),
      body: RefreshIndicator(
        color: PupTheme.of(context).maroon,
        onRefresh: () => _refresh(ref),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: <Widget>[
            if (isLoading) ...<Widget>[
              LinearProgressIndicator(
                minHeight: 2,
                color: PupTheme.of(context).maroon,
                backgroundColor: PupTheme.of(context).borderSubtle,
              ),
              const SizedBox(height: 10),
            ],
            if (hasHardError) ...<Widget>[
              _ErrorCard(onRetry: () => _refresh(ref)),
              const SizedBox(height: 14),
            ],
            if (standing != null)
              StudentStandingBanner(userId: user.id, standing: standing),
            const SizedBox(height: 12),
            const OfflineReadinessChip(),
            const SizedBox(height: 12),
            const StudentOfflineSyncPanel(),
            const SizedBox(height: 12),
            const SignOutFooterTile(),
            _CredentialCard(
              studentNumber: user.studentId?.trim().isNotEmpty == true
                  ? user.studentId!
                  : user.id,
              onViewId: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const StudentIdCardScreen(),
                ),
              ),
            ),
            const SizedBox(height: 14),
            _AttendanceSnapshot(
              totals: totals,
              rate: rate,
              threshold: threshold,
            ),
            const SizedBox(height: 14),
            if (officers?.isOfficer == true) ...<Widget>[
              _OfficerHint(
                isPresident: officers?.isPresident ?? false,
                isQac: officers?.isQac ?? false,
              ),
              const SizedBox(height: 14),
            ],
            _QuickActions(
              onScan: () => context.push(StudentPaths.scan),
              onEnroll: () => showEnrollmentCodeDialog(context),
              onHistory: () => context.go(StudentPaths.history),
            ),
            const SizedBox(height: 22),
            _MyClassesSection(
              cards: classCards,
              onOpenAll: () => context.push(StudentPaths.classList),
              onEnroll: () => showEnrollmentCodeDialog(context),
              onOpenSection: (sectionId) =>
                  context.push(StudentPaths.subject(sectionId)),
            ),
            const SizedBox(height: 22),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'TODAY',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: PupTheme.of(context).muted,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.6,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Your class schedule',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: PupTheme.of(context).onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => context.go(StudentPaths.schedule),
                  child: const Text('Full schedule'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (todayClasses.isEmpty)
              CampusCard(
                child: CampusEmptyState(
                  icon: Icons.event_available_outlined,
                  title: 'Your day is clear',
                  message: 'There are no enrolled classes scheduled for today.',
                ),
              )
            else
              for (final item in todayClasses) ...<Widget>[
                _TodayClassCard(
                  item: item,
                  onTap: () =>
                      context.push(StudentPaths.subject(item.section.id)),
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
    ref.invalidate(todaySessionsProvider);
    ref.invalidate(studentStandingProvider);
    ref.invalidate(studentClassRolesProvider);
    try {
      await ref.read(todaySessionsProvider.future);
    } catch (_) {
      // The screen keeps the last rendered snapshot.
    }
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      borderColor: tokens.gold,
      color: tokens.gold.withValues(alpha: 0.08),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Unable to load your dashboard',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your classes and attendance could not be fetched. Nothing is lost — try again.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 10),
          CampusButton(
            label: 'Try again',
            variant: CampusButtonVariant.outline,
            expand: false,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

class _CredentialCard extends StatelessWidget {
  const _CredentialCard({required this.studentNumber, required this.onViewId});

  final String studentNumber;
  final VoidCallback onViewId;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onViewId,
      semanticLabel: 'Open digital student ID card',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'STUDENT CREDENTIAL',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: tokens.muted,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.6,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      studentNumber,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Verified PUP account',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                  ],
                ),
              ),
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: tokens.maroon.withValues(alpha: 0.06),
                  border: Border.all(
                    color: tokens.maroon.withValues(alpha: 0.18),
                  ),
                ),
                child: Icon(
                  Icons.verified_user_outlined,
                  size: 22,
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          CampusButton(
            label: 'View digital ID card',
            icon: Icons.badge_outlined,
            variant: CampusButtonVariant.outline,
            onPressed: onViewId,
          ),
        ],
      ),
    );
  }
}

class _AttendanceSnapshot extends StatelessWidget {
  const _AttendanceSnapshot({
    required this.totals,
    required this.rate,
    required this.threshold,
  });

  final Map<AttendanceStatus, int> totals;
  final double rate;
  final int threshold;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final items = <(AttendanceStatus, int)>[
      (AttendanceStatus.present, totals[AttendanceStatus.present] ?? 0),
      (AttendanceStatus.late, totals[AttendanceStatus.late] ?? 0),
      (AttendanceStatus.absent, totals[AttendanceStatus.absent] ?? 0),
      (AttendanceStatus.disputed, totals[AttendanceStatus.disputed] ?? 0),
    ];
    return CampusCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'ATTENDANCE SNAPSHOT',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.6,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              for (final (status, value) in items)
                Expanded(
                  child: Column(
                    children: <Widget>[
                      Text(
                        '$value',
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              color: tokens.onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        attendanceStatusLabels[status]!.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tokens.muted,
                          fontWeight: FontWeight.w700,
                          fontSize: 9,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(color: tokens.borderSubtle, height: 1),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  'Standing rate',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ),
              Text(
                '${formatStandingRate(rate)}%',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '(min $threshold%)',
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OfficerHint extends StatelessWidget {
  const _OfficerHint({required this.isPresident, required this.isQac});

  final bool isPresident;
  final bool isQac;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final labels = <String>[
      if (isPresident) 'Section president',
      if (isQac) 'QAC officer',
    ];
    return CampusCard(
      color: tokens.maroon.withValues(alpha: tokens.isDark ? 0.12 : 0.05),
      borderColor: tokens.maroon.withValues(alpha: 0.25),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: <Widget>[
          Icon(Icons.stars_outlined, size: 18, color: tokens.gold),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${labels.join(' · ')} — officer tools are on your class pages.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MyClassesSection extends StatelessWidget {
  const _MyClassesSection({
    required this.cards,
    required this.onOpenAll,
    required this.onEnroll,
    required this.onOpenSection,
  });

  static const int previewLimit = 4;

  final List<StudentClassCard> cards;
  final VoidCallback onOpenAll;
  final VoidCallback onEnroll;
  final ValueChanged<String> onOpenSection;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final preview = cards.take(previewLimit).toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Expanded(
              child: Text(
                'My classes',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (cards.isNotEmpty)
              TextButton(
                key: const ValueKey('student-classes-view-all'),
                onPressed: onOpenAll,
                child: Text('View all ${cards.length} classes'),
              ),
          ],
        ),
        if (preview.isEmpty)
          CampusCard(
            key: const ValueKey('student-classes-empty'),
            child: CampusEmptyState(
              icon: Icons.auto_stories_outlined,
              title: 'No classes yet',
              message: 'Enroll with a code from your instructor.',
              actionLabel: 'Enroll',
              onAction: onEnroll,
            ),
          )
        else
          for (final card in preview) ...<Widget>[
            MyClassCard(
              key: ValueKey('student-class-card-${card.sectionId}'),
              card: card,
              onTap: () => onOpenSection(card.sectionId),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.onScan,
    required this.onEnroll,
    required this.onHistory,
  });

  final VoidCallback onScan;
  final VoidCallback onEnroll;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: _QuickAction(
            key: const ValueKey('student-scan-action'),
            icon: Icons.qr_code_scanner,
            label: 'Scan QR',
            onTap: onScan,
            emphasize: true,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickAction(
            key: const ValueKey('student-enroll-action'),
            icon: Icons.playlist_add,
            label: 'Enroll',
            onTap: onEnroll,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickAction(
            key: const ValueKey('student-history-action'),
            icon: Icons.history,
            label: 'History',
            onTap: onHistory,
          ),
        ),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.emphasize = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      semanticLabel: label,
      color: emphasize ? tokens.maroon : tokens.surface,
      borderColor: emphasize ? tokens.maroon : tokens.borderSubtle,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      child: Column(
        children: <Widget>[
          Icon(icon, size: 22, color: emphasize ? tokens.gold : tokens.maroon),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: emphasize ? Colors.white : tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _TodayClassCard extends StatelessWidget {
  const _TodayClassCard({required this.item, required this.onTap});

  final TodayClass item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      semanticLabel: 'Open ${item.subjectName} details',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 54,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: item.status == TodayClassStatus.active
                  ? tokens.gold
                  : tokens.maroon.withValues(
                      alpha: tokens.isDark ? 0.25 : 0.06,
                    ),
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Column(
              children: <Widget>[
                Text(
                  formatTime(item.slot.startTime),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: item.status == TodayClassStatus.active
                        ? tokens.deepMaroon
                        : tokens.isDark
                        ? tokens.gold
                        : tokens.maroon,
                    fontWeight: FontWeight.w700,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        item.subjectName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: tokens.onSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _SessionStatusBadge(status: item.status),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.sectionLabel} · ${item.roomLabel}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 6),
                Row(
                  children: <Widget>[
                    Text(
                      item.timeLabel,
                      style: Theme.of(
                        context,
                      ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                    ),
                    if (item.record != null) ...<Widget>[
                      const SizedBox(width: 8),
                      if (item.record!.isSynced)
                        CampusStatusBadge(
                          status: item.record!.status,
                          dense: true,
                        )
                      else
                        Text(
                          'Saved on device',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: tokens.isDark
                                    ? tokens.gold
                                    : tokens.maroon,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionStatusBadge extends StatelessWidget {
  const _SessionStatusBadge({required this.status});

  final TodayClassStatus status;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final (background, foreground, border) = switch (status) {
      TodayClassStatus.active => (tokens.gold, tokens.deepMaroon, tokens.gold),
      TodayClassStatus.completed => (
        tokens.deepMaroon,
        Colors.white,
        tokens.deepMaroon,
      ),
      TodayClassStatus.scheduled => (
        tokens.surface,
        tokens.isDark ? tokens.gold : tokens.maroon,
        tokens.borderSubtle,
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
      ),
      child: Text(
        status.label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w700,
          fontSize: 9,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}
