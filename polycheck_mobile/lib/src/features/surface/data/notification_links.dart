import 'package:flutter/material.dart';

import '../../../core/models/notification.dart';
import '../../../core/models/user.dart';
import 'surface_paths.dart';

/// Pure notification presentation + deep-link mapping.
///
/// Mirrors `frontend/src/lib/notification-center.ts` and
/// `android/lib/notifications.ts`, then adapts the destinations to the
/// Flutter router's shared paths.
const String notificationsNewEvent = 'notifications:new';

const Map<NotificationType, String> notificationTypeLabels = {
  NotificationType.disputeFiled: 'Dispute',
  NotificationType.disputeResolved: 'Dispute',
  NotificationType.excuseRequested: 'Excuse',
  NotificationType.excuseDecided: 'Excuse',
  NotificationType.attendanceAbsent: 'Attendance',
  NotificationType.standingBelowThreshold: 'Standing',
  NotificationType.accountStatusChanged: 'Account',
  NotificationType.passwordReset: 'Account',
  NotificationType.roleChanged: 'Account',
  NotificationType.keyProvisioned: 'Security',
  NotificationType.deviceReleased: 'Security',
  NotificationType.systemReportResolved: 'Reports',
  NotificationType.atRiskReferral: 'At-risk',
};

const Map<NotificationType, IconData> notificationTypeIcons = {
  NotificationType.disputeFiled: Icons.gavel,
  NotificationType.disputeResolved: Icons.verified_outlined,
  NotificationType.excuseRequested: Icons.assignment_turned_in_outlined,
  NotificationType.excuseDecided: Icons.fact_check_outlined,
  NotificationType.attendanceAbsent: Icons.event_busy_outlined,
  NotificationType.standingBelowThreshold: Icons.trending_down,
  NotificationType.accountStatusChanged: Icons.manage_accounts_outlined,
  NotificationType.passwordReset: Icons.lock_reset,
  NotificationType.roleChanged: Icons.swap_horiz,
  NotificationType.deviceReleased: Icons.smartphone_outlined,
  NotificationType.keyProvisioned: Icons.vpn_key_outlined,
  NotificationType.systemReportResolved: Icons.task_alt,
  NotificationType.atRiskReferral: Icons.assignment_late_outlined,
};

bool isInternalNotificationLink(String? link) {
  final trimmed = link?.trim() ?? '';
  return trimmed.startsWith('/') && !trimmed.startsWith('//');
}

/// Maps a server-supplied web link onto the Flutter route tree.
String? mapNotificationLink(String? link, UserRole role) {
  if (!isInternalNotificationLink(link)) return null;
  final uri = Uri.tryParse(link!.trim());
  if (uri == null) return null;
  var path = uri.path;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.substring(0, path.length - 1);
  }

  if (path == '/profile') {
    final tab = uri.queryParameters['tab'];
    return tab == null || tab.isEmpty ? SurfacePaths.profile : link.trim();
  }
  if (path.startsWith('/profile/')) return SurfacePaths.profile;

  if (role == UserRole.student) {
    if (path == '/student/dashboard') {
      // Outcome notifications land on the attendance history, not the
      // dashboard summary (web parity).
      if ((uri.queryParameters['tab'] ?? '') == 'attendance') {
        return '/student/history';
      }
      return '/student/dashboard';
    }
    if (path == '/student/history') return '/student/history';
    if (path.startsWith('/student/')) return '/student/dashboard';
    return null;
  }

  // Super admins never get proactive classroom navigation (Option A); their
  // notification actions stay inside the admin console.
  if (role == UserRole.superAdmin && path.startsWith('/faculty')) return null;
  if (path == '/faculty/students' || path == '/faculty/student') {
    return '/faculty/subjects';
  }
  final studentDetail = RegExp(
    r'^/faculty/students?/([^/]+)$',
  ).firstMatch(path);
  if (studentDetail != null) {
    final query = uri.hasQuery ? '?${uri.query}' : '';
    return '/faculty/students/${studentDetail.group(1)}$query';
  }
  if (path.startsWith('/faculty/')) {
    return link.trim();
  }
  return null;
}

/// Type-based fallback when the server link is absent or unmappable.
String? notificationFallbackDestination(NotificationType type, UserRole role) {
  final isStudent = role == UserRole.student;
  final isAdmin = role == UserRole.superAdmin;

  switch (type) {
    case NotificationType.disputeFiled:
      return isAdmin ? null : '/faculty/disputes';
    case NotificationType.disputeResolved:
      if (isAdmin) return null;
      return isStudent ? '/student/history' : '/faculty/disputes';
    case NotificationType.excuseRequested:
      return isAdmin ? null : '/faculty/excuses';
    case NotificationType.excuseDecided:
      if (isAdmin) return null;
      return isStudent ? '/student/history' : '/faculty/excuses';
    case NotificationType.attendanceAbsent:
      return isAdmin ? null : '/student/history';
    case NotificationType.standingBelowThreshold:
      return isAdmin ? null : '/student/dashboard';
    case NotificationType.accountStatusChanged:
    case NotificationType.passwordReset:
    case NotificationType.roleChanged:
    case NotificationType.deviceReleased:
      return isStudent ? SurfacePaths.device : SurfacePaths.security;
    case NotificationType.keyProvisioned:
      return isAdmin ? null : '/faculty/sessions';
    case NotificationType.systemReportResolved:
      return isAdmin ? '/admin/system-reports' : SurfacePaths.reports;
    case NotificationType.atRiskReferral:
      return isAdmin ? null : '/faculty/at-risk';
  }
}

/// Full destination resolution: safe link first, then type fallback.
String? notificationDestination(AppNotification notification, UserRole role) {
  return mapNotificationLink(notification.link, role) ??
      notificationFallbackDestination(notification.type, role);
}

String notificationTypeLabel(NotificationType type) =>
    notificationTypeLabels[type] ?? 'Update';

IconData notificationTypeIcon(NotificationType type) =>
    notificationTypeIcons[type] ?? Icons.notifications_none;

/// Compact relative timestamp used by the notification list.
String formatNotificationRelativeTime(String createdAt, {DateTime? now}) {
  final parsed = DateTime.tryParse(createdAt)?.toLocal();
  if (parsed == null) return '';
  final current = (now ?? DateTime.now()).toLocal();
  final diff = current.difference(parsed);
  if (diff.isNegative || diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final label = '${months[parsed.month - 1]} ${parsed.day}';
  return parsed.year == current.year ? label : '$label, ${parsed.year}';
}

/// Absolute timestamp shown next to the relative label.
String formatNotificationAbsoluteTime(String createdAt) {
  final parsed = DateTime.tryParse(createdAt)?.toLocal();
  if (parsed == null) return '';
  final hour = parsed.hour % 12 == 0 ? 12 : parsed.hour % 12;
  final minute = parsed.minute.toString().padLeft(2, '0');
  final suffix = parsed.hour < 12 ? 'AM' : 'PM';
  return '${_month(parsed.month)} ${parsed.day}, ${parsed.year} \u00b7 '
      '$hour:$minute $suffix';
}

String _month(int month) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[month - 1];
}
