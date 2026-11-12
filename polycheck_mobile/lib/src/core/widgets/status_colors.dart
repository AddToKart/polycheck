import 'package:flutter/material.dart';

import '../models/attendance.dart';
import '../theme/pup_tokens.dart';

/// The single home for attendance-status labels, icons, and colors.
///
/// Present = gold bg + deep-maroon text; Late = maroon bg + white;
/// Absent = deep maroon + gold border; Pending = white/maroon;
/// Disputed = deep maroon + gold icon; Excused/Incomplete get distinct calm
/// variants so the roster never shows two statuses with identical styling.
@immutable
class AttendanceStatusStyle {
  const AttendanceStatusStyle({
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
    required this.icon,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;
  final IconData icon;
}

const Map<AttendanceStatus, String> attendanceStatusLabels = {
  AttendanceStatus.present: 'Present',
  AttendanceStatus.late: 'Late',
  AttendanceStatus.absent: 'Absent',
  AttendanceStatus.pending: 'Pending',
  AttendanceStatus.disputed: 'Disputed',
  AttendanceStatus.excused: 'Excused',
  AttendanceStatus.incomplete: 'Incomplete',
};

const Map<AttendanceStatus, IconData> attendanceStatusIcons = {
  AttendanceStatus.present: Icons.check_circle_outline,
  AttendanceStatus.late: Icons.schedule,
  AttendanceStatus.absent: Icons.cancel_outlined,
  AttendanceStatus.pending: Icons.hourglass_empty,
  AttendanceStatus.disputed: Icons.gavel,
  AttendanceStatus.excused: Icons.event_available_outlined,
  AttendanceStatus.incomplete: Icons.timelapse,
};

AttendanceStatusStyle attendanceStatusStyle(
  AttendanceStatus status, {
  required bool isDark,
}) {
  final surface = isDark ? PupColors.surfaceDark : PupColors.surfaceLight;
  final campus = isDark ? PupColors.campusDark : PupColors.campusLight;
  final border = isDark
      ? PupColors.borderSubtleDark
      : PupColors.borderSubtleLight;
  final accent = isDark ? PupColors.pupGold : PupColors.pupMaroon;

  switch (status) {
    case AttendanceStatus.present:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: PupColors.pupGold,
        foreground: PupColors.pupDeepMaroon,
        border: PupColors.pupGold,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.late:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: PupColors.pupMaroon,
        foreground: PupColors.white,
        border: PupColors.pupMaroon,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.absent:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: PupColors.pupDeepMaroon,
        foreground: PupColors.white,
        border: PupColors.pupGold,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.pending:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: surface,
        foreground: accent,
        border: border,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.disputed:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: PupColors.pupDeepMaroon,
        foreground: PupColors.pupGold,
        border: PupColors.pupGold,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.excused:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: campus,
        foreground: isDark ? PupColors.white : PupColors.pupDeepMaroon,
        border: isDark ? PupColors.pupGold : PupColors.pupMaroon,
        icon: attendanceStatusIcons[status]!,
      );
    case AttendanceStatus.incomplete:
      return AttendanceStatusStyle(
        label: attendanceStatusLabels[status]!,
        background: campus,
        foreground: isDark ? PupColors.pupGold : PupColors.pupDeepMaroon,
        border: PupColors.pupGold,
        icon: attendanceStatusIcons[status]!,
      );
  }
}
