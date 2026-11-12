import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../student_paths.dart';

/// One timetable row: a schedule slot of an enrolled section with the subject
/// resolved. Shared by the week carousel and the month day sheet.
class TimetableEntry {
  const TimetableEntry({
    required this.section,
    required this.slot,
    this.subject,
  });

  final Section section;
  final ScheduleDay slot;
  final Subject? subject;

  String get subjectName {
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }
}

/// Week-row class card (RN `StudentCalendarEventList` parity). The optional
/// [record] renders the student's attendance status pill for the month
/// drilldown sheet; the plain week carousel passes null.
class TimetableCard extends StatelessWidget {
  const TimetableCard({super.key, required this.entry, this.record});

  final TimetableEntry entry;
  final AttendanceRecord? record;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final section = entry.section;
    return CampusCard(
      onTap: () => context.push(StudentPaths.subject(section.id)),
      semanticLabel: 'Open ${entry.subjectName} details',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 58,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: tokens.maroon.withValues(
                alpha: tokens.isDark ? 0.24 : 0.06,
              ),
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Column(
              children: <Widget>[
                Text(
                  formatTime(entry.slot.startTime),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                    fontWeight: FontWeight.w700,
                    fontSize: 9,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formatTime(entry.slot.endTime),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontSize: 8,
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
                Text(
                  entry.subjectName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  formatSectionHeading(
                    section: section.section,
                    course: section.course,
                  ),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 3),
                Text(
                  '${entry.slot.room?.trim().isNotEmpty == true
                      ? entry.slot.room
                      : section.room.isNotEmpty
                      ? section.room
                      : 'Room TBA'}'
                  ' · ${section.teacherName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
                if (record != null) ...<Widget>[
                  const SizedBox(height: 6),
                  CampusStatusBadge(status: record!.status, dense: true),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 20, color: tokens.muted),
        ],
      ),
    );
  }
}
