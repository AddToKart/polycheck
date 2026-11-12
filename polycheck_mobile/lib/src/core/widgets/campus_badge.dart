import 'package:flutter/material.dart';

import '../models/attendance.dart';
import '../theme/pup_theme.dart';
import 'status_colors.dart';

/// Square, 1px-bordered label chip.
class CampusBadge extends StatelessWidget {
  const CampusBadge({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
    this.icon,
    this.dense = false,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;
  final IconData? icon;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.labelSmall?.copyWith(
      color: foreground,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.2,
    );
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 6 : 8,
        vertical: dense ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.zero,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: dense ? 11 : 12, color: foreground),
            const SizedBox(width: 4),
          ],
          Text(label, style: textStyle),
        ],
      ),
    );
  }
}

/// Status badge resolved through the centralized status color/label map.
///
/// Pass [status] (e.g. present/late/absent/pending/disputed) and optionally
/// [label]/[overrideLabel] to add a detail such as "Present · manual".
class CampusStatusBadge extends StatelessWidget {
  const CampusStatusBadge({
    super.key,
    required this.status,
    this.label,
    this.showIcon = true,
    this.dense = false,
  });

  final AttendanceStatus status;
  final String? label;
  final bool showIcon;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final isDark = PupTheme.of(context).isDark;
    final style = attendanceStatusStyle(status, isDark: isDark);
    return CampusBadge(
      label: label ?? style.label,
      background: style.background,
      foreground: style.foreground,
      border: style.border,
      icon: showIcon ? style.icon : null,
      dense: dense,
    );
  }
}
