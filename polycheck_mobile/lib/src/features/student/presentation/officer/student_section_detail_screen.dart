import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_models.dart';
import '../../data/student_providers.dart';
import '../../student_paths.dart';

class StudentSectionDetailScreen extends ConsumerStatefulWidget {
  const StudentSectionDetailScreen({super.key, required this.sectionId});

  final String sectionId;

  @override
  ConsumerState<StudentSectionDetailScreen> createState() =>
      _StudentSectionDetailScreenState();
}

class _StudentSectionDetailScreenState
    extends ConsumerState<StudentSectionDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Re-check on every mount (RN parity, Bug 6): the permission check is
    // time-sensitive, so a fresh mount never trusts a cached answer.
    // `invalidate` is Riverpod's fire-and-forget re-check (same re-fetch as
    // refresh for a watched provider, without the unused-result lint).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.invalidate(studentSectionDetailProvider(widget.sectionId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final detailAsync = ref.watch(
      studentSectionDetailProvider(widget.sectionId),
    );
    final attendance =
        ref.watch(myAttendanceProvider).value ?? const <AttendanceRecord>[];

    return Scaffold(
      appBar: CampusHeader(
        title: detailAsync.value?.detail.subjectName ?? 'Class details',
        subtitle: detailAsync.value?.sectionLabel,
        automaticallyImplyLeading: true,
      ),
      body: RefreshIndicator(
        color: tokens.maroon,
        onRefresh: () async {
          ref.invalidate(studentSectionDetailProvider(widget.sectionId));
        },
        child: detailAsync.when(
          skipLoadingOnReload: true,
          loading: () => const CampusLoading(label: 'Loading class details…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              CampusCard(
                borderColor: tokens.gold,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Unable to load this class',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      error is ApiRequestError
                          ? error.message
                          : 'Check your connection and try again.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                    const SizedBox(height: 10),
                    CampusButton(
                      label: 'Try again',
                      variant: CampusButtonVariant.outline,
                      expand: false,
                      onPressed: () => ref.invalidate(
                        studentSectionDetailProvider(widget.sectionId),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          data: (view) => _SectionBody(
            detail: view.detail,
            permission: view.permission,
            permissionExpiresAt: view.permissionExpiresAt,
            attendance: attendance
                .where((record) => record.sectionId == view.detail.section.id)
                .toList(growable: false),
          ),
        ),
      ),
    );
  }
}

class _SectionBody extends ConsumerWidget {
  const _SectionBody({
    required this.detail,
    required this.permission,
    required this.permissionExpiresAt,
    required this.attendance,
  });

  final StudentSectionDetail detail;
  final OfficerPermissionCheck permission;
  final DateTime? permissionExpiresAt;
  final List<AttendanceRecord> attendance;

  bool get hasActivePermission =>
      permission == OfficerPermissionCheck.authorized;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = PupTheme.of(context);
    final section = detail.section;
    final sessions = <Session>[...detail.sessions]
      ..sort((a, b) => b.date.compareTo(a.date));
    final present = attendance
        .where((record) => record.status == AttendanceStatus.present)
        .length;
    final late = attendance
        .where((record) => record.status == AttendanceStatus.late)
        .length;
    final absent = attendance
        .where((record) => record.status == AttendanceStatus.absent)
        .length;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: <Widget>[
        if (detail.roles.isNotEmpty) ...<Widget>[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              if (detail.isPresident)
                _OfficerBadge(
                  icon: Icons.star,
                  label: 'Section president',
                  background: tokens.maroon,
                  foreground: Colors.white,
                ),
              if (detail.isQac)
                _OfficerBadge(
                  icon: Icons.camera_alt_outlined,
                  label: 'QAC officer',
                  background: tokens.deepMaroon,
                  foreground: tokens.gold,
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (detail.isPresident)
          CampusCard(
            borderColor:
                hasActivePermission ||
                    permission == OfficerPermissionCheck.errored
                ? tokens.gold
                : null,
            color: hasActivePermission
                ? tokens.gold.withValues(alpha: tokens.isDark ? 0.08 : 0.12)
                : null,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(
                      permission == OfficerPermissionCheck.errored
                          ? Icons.cloud_off_outlined
                          : Icons.admin_panel_settings_outlined,
                      size: 22,
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Session permission',
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: tokens.onSurface,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            switch (permission) {
                              OfficerPermissionCheck.authorized =>
                                'Your instructor authorized you to create a session for this class.',
                              OfficerPermissionCheck.denied =>
                                'No active permission. Ask your instructor to grant access.',
                              OfficerPermissionCheck.errored =>
                                "Couldn't verify permission — tap to retry.",
                            },
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (hasActivePermission) ...<Widget>[
                  if (permissionExpiresAt != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Row(
                        children: <Widget>[
                          Icon(
                            Icons.schedule_outlined,
                            size: 14,
                            color: tokens.muted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Active until '
                            '${_formatPermissionExpiry(permissionExpiresAt!)}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),
                  CampusButton(
                    key: const ValueKey('officer-create-session'),
                    label: 'Create class session',
                    icon: Icons.add,
                    onPressed: () =>
                        context.push(StudentPaths.createSession(section.id)),
                  ),
                ],
                if (!hasActivePermission) ...<Widget>[
                  const SizedBox(height: 12),
                  CampusButton(
                    key: const ValueKey('officer-permission-recheck'),
                    label: 'Check again',
                    variant: CampusButtonVariant.outline,
                    expand: false,
                    onPressed: () => ref.invalidate(
                      studentSectionDetailProvider(section.id),
                    ),
                  ),
                ],
              ],
            ),
          ),
        if (detail.isPresident) const SizedBox(height: 12),
        if (detail.isQac)
          CampusCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  Icons.add_a_photo_outlined,
                  size: 22,
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'As QAC officer you can upload proof-of-class photos from any session on this page.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ),
              ],
            ),
          ),
        if (detail.isQac) const SizedBox(height: 12),
        _InfoCard(detail: detail),
        const SizedBox(height: 12),
        CampusCard(
          child: Row(
            children: <Widget>[
              Expanded(
                child: _MiniStat(
                  label: 'Present',
                  value: '$present',
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                ),
              ),
              Expanded(
                child: _MiniStat(
                  label: 'Late',
                  value: '$late',
                  color: tokens.onSurface,
                ),
              ),
              Expanded(
                child: _MiniStat(
                  label: 'Absent',
                  value: '$absent',
                  color: tokens.onSurface,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                'Class sessions',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              '${sessions.length} total',
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: tokens.muted),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (sessions.isEmpty)
          CampusCard(
            child: CampusEmptyState(
              icon: Icons.event_busy_outlined,
              title: 'No sessions yet',
              message:
                  'Attendance sessions created for this class will appear here.',
            ),
          )
        else
          for (final session in sessions) ...<Widget>[
            _SessionCard(
              session: session,
              isQac: detail.isQac,
              onTap: () => context.push(
                StudentPaths.subjectSession(section.id, session.id),
              ),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

class _OfficerBadge extends StatelessWidget {
  const _OfficerBadge({
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      color: background,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.detail});

  final StudentSectionDetail detail;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final section = detail.section;
    return CampusCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _InfoRow(
            icon: Icons.person_outline,
            label: 'Instructor',
            value: section.teacherName.trim().isEmpty
                ? 'To be announced'
                : section.teacherName,
          ),
          _InfoRow(
            icon: Icons.meeting_room_outlined,
            label: 'Room',
            value: section.room.trim().isEmpty
                ? 'To be announced'
                : section.room,
          ),
          _InfoRow(
            icon: Icons.school_outlined,
            label: 'Semester',
            value: section.semester.trim().isEmpty
                ? 'Not set'
                : section.semester,
          ),
          const SizedBox(height: 10),
          Text(
            'WEEKLY SCHEDULE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          if (section.schedule.isEmpty)
            Text(
              'No schedule configured.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                for (final day in section.schedule)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    color: tokens.maroon.withValues(
                      alpha: tokens.isDark ? 0.2 : 0.05,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          day.day.wire.toUpperCase(),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: tokens.isDark
                                    ? tokens.gold
                                    : tokens.maroon,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        Text(
                          '${formatTime(day.startTime)}–${formatTime(day.endTime)}'
                          '${day.room?.trim().isNotEmpty == true ? ' · ${day.room}' : ''}',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: tokens.muted, fontSize: 9),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: <Widget>[
          Icon(icon, size: 18, color: tokens.muted),
          const SizedBox(width: 8),
          SizedBox(
            width: 78,
            child: Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w700,
                fontSize: 9,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
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

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      children: <Widget>[
        Text(
          value,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: tokens.muted,
            fontWeight: FontWeight.w700,
            fontSize: 9,
            letterSpacing: 0.6,
          ),
        ),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.isQac,
    required this.onTap,
  });

  final Session session;
  final bool isQac;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final active = session.isActive && (session.endedAt?.isNotEmpty != true);
    final completed = session.endedAt?.isNotEmpty == true;
    final label = completed
        ? 'COMPLETED'
        : active
        ? 'ACTIVE'
        : 'SCHEDULED';
    return CampusCard(
      onTap: onTap,
      semanticLabel: 'Open session on ${session.date}',
      child: Row(
        children: <Widget>[
          Container(
            width: 46,
            height: 46,
            color: active
                ? tokens.gold
                : tokens.maroon.withValues(alpha: tokens.isDark ? 0.22 : 0.05),
            child: Icon(
              active ? Icons.radio_button_checked : Icons.event_outlined,
              size: 21,
              color: active
                  ? tokens.deepMaroon
                  : tokens.isDark
                  ? tokens.gold
                  : tokens.maroon,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  _formatSessionDate(session.date),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${formatTime(session.startTime)}–${formatTime(session.endTime)}'
                  '${session.room?.trim().isNotEmpty == true ? ' · ${session.room}' : ''}',
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          if (isQac)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Icon(
                Icons.camera_alt_outlined,
                size: 17,
                color: tokens.muted,
              ),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              border: Border.all(
                color: active ? tokens.gold : tokens.borderSubtle,
              ),
              color: active ? tokens.gold : Colors.transparent,
            ),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: active
                    ? tokens.deepMaroon
                    : tokens.isDark
                    ? tokens.gold
                    : tokens.maroon,
                fontWeight: FontWeight.w700,
                fontSize: 8,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatSessionDate(String date) {
  final parsed = DateTime.tryParse(date);
  if (parsed == null) return date;
  final month = getMonthName(parsed.month - 1);
  final shortMonth = month.length >= 3 ? month.substring(0, 3) : month;
  return '${getDayName(parsed.weekday % 7)} · $shortMonth ${parsed.day}, ${parsed.year}';
}

String _formatPermissionExpiry(DateTime expiresAtUtc) {
  final local = expiresAtUtc.toLocal();
  final month = getMonthName(local.month - 1);
  final shortMonth = month.length >= 3 ? month.substring(0, 3) : month;
  var hour = local.hour % 12;
  if (hour == 0) hour = 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final marker = local.hour >= 12 ? 'PM' : 'AM';
  final weekday = getDayName(local.weekday % 7);
  return '$weekday · $shortMonth ${local.day}, ${local.year} $hour:$minute $marker';
}
