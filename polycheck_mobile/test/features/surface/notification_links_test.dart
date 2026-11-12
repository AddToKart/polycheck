import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/notification.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/surface/data/notification_links.dart';

AppNotification _notification({
  required NotificationType type,
  String? link,
  String id = 'n1',
  String createdAt = '2026-11-10T08:00:00.000Z',
  String? readAt,
}) {
  return AppNotification(
    id: id,
    type: type,
    title: 'Title',
    body: 'Body',
    link: link,
    readAt: readAt,
    createdAt: createdAt,
  );
}

void main() {
  group('notification destinations', () {
    test('rejects external and protocol-relative links', () {
      expect(isInternalNotificationLink('https://evil.example'), isFalse);
      expect(isInternalNotificationLink('//evil.example/path'), isFalse);
      expect(isInternalNotificationLink('/faculty/disputes'), isTrue);
      expect(
        mapNotificationLink('https://evil.example', UserRole.teacher),
        isNull,
      );
    });

    test('student attendance-tab dashboard links land on history', () {
      final notification = _notification(
        type: NotificationType.attendanceAbsent,
        link: '/student/dashboard?tab=attendance',
      );
      expect(
        notificationDestination(notification, UserRole.student),
        '/student/history',
      );
    });

    test('teacher dispute fallback maps to the faculty disputes route', () {
      final notification = _notification(type: NotificationType.disputeFiled);
      expect(
        notificationDestination(notification, UserRole.teacher),
        '/faculty/disputes',
      );
      expect(
        notificationDestination(notification, UserRole.superAdmin),
        isNull,
      );
    });

    test('student report resolution maps to the profile reports tab', () {
      final notification = _notification(
        type: NotificationType.systemReportResolved,
      );
      expect(
        notificationDestination(notification, UserRole.student),
        '/profile?tab=reports',
      );
    });

    test('student account events map to the device tab', () {
      final notification = _notification(type: NotificationType.deviceReleased);
      expect(
        notificationDestination(notification, UserRole.student),
        '/profile?tab=device',
      );
      expect(
        notificationDestination(notification, UserRole.teacher),
        '/profile?tab=security',
      );
    });

    test('faculty links are preserved for teachers but hidden from admins', () {
      final notification = _notification(
        type: NotificationType.excuseRequested,
        link: '/faculty/excuses?sectionId=sec-1',
      );
      expect(
        notificationDestination(notification, UserRole.teacher),
        '/faculty/excuses?sectionId=sec-1',
      );
      expect(
        notificationDestination(notification, UserRole.superAdmin),
        isNull,
      );
    });

    test('student-detail links normalize to the Flutter faculty route', () {
      final singular = _notification(
        type: NotificationType.disputeFiled,
        link: '/faculty/student/student-1?sectionId=sec-1',
      );
      expect(
        mapNotificationLink(singular.link, UserRole.teacher),
        '/faculty/students/student-1?sectionId=sec-1',
      );
      expect(notificationDestination(singular, UserRole.superAdmin), isNull);
    });

    test('type labels and icons cover every notification type', () {
      for (final type in NotificationType.values) {
        expect(notificationTypeLabel(type), isNotEmpty);
        expect(notificationTypeIcon(type), isNotNull);
      }
      expect(
        notificationTypeLabel(NotificationType.systemReportResolved),
        'Reports',
      );
    });
  });

  group('notification timestamps', () {
    final now = DateTime.utc(2026, 11, 10, 12);

    test('formats relative labels', () {
      expect(
        formatNotificationRelativeTime('2026-11-10T11:59:40.000Z', now: now),
        'Just now',
      );
      expect(
        formatNotificationRelativeTime('2026-11-10T11:30:00.000Z', now: now),
        '30m ago',
      );
      expect(
        formatNotificationRelativeTime('2026-11-08T12:00:00.000Z', now: now),
        '2d ago',
      );
    });

    test('formats an absolute timestamp', () {
      expect(
        formatNotificationAbsoluteTime('2026-11-10T08:05:00.000Z'),
        contains('2026'),
      );
    });
  });
}
