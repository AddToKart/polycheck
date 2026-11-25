import 'package:flutter/foundation.dart';

import '../models/notification.dart';
import 'api_base.dart';

/// Notifications inbox (`backend/src/notifications/notifications.controller.ts`).
class NotificationsApi extends ApiBase {
  NotificationsApi(super.dio);

  Future<List<AppNotification>> getNotifications({
    bool unreadOnly = false,
    int? limit,
  }) async {
    final data = await getJson(
      '/notifications',
      query: <String, dynamic>{
        'unreadOnly': unreadOnly ? 'true' : null,
        'limit': limit,
      },
    );
    return parseNotificationInbox(data);
  }

  Future<int> getUnreadNotificationCount() async {
    final data = await getJson('/notifications/unread-count');
    return data is num ? data.toInt() : 0;
  }

  /// Marks notifications read and returns the new unread count.
  Future<int> markNotificationsRead([
    NotificationReadInput input = const NotificationReadInput(all: true),
  ]) async {
    final data = await postJson('/notifications/read', body: input.toJson());
    return data is num ? data.toInt() : 0;
  }

  Future<bool> registerPushToken(PushTokenInput input) async {
    final data = await postJson(
      '/notifications/push-token',
      body: input.toJson(),
    );
    return data == true;
  }
}

/// Decodes the inbox list row-by-row.
///
/// **Documented degraded mode (FLR-05):** a row that cannot be decoded (a
/// missing/ill-typed field, a removed shape) is skipped and logged instead of
/// failing the whole request. The list used to be decoded with `map`, so one
/// malformed row - or one notification type this build does not know - blanked
/// the entire inbox. Unknown *types* already degrade to
/// [NotificationType.unknown]; this guard covers structural drift.
List<AppNotification> parseNotificationInbox(Object? data) {
  final notifications = <AppNotification>[];
  for (final item in asList(data)) {
    if (item is! Map) continue;
    try {
      notifications.add(AppNotification.fromJson(asMap(item)));
    } catch (error) {
      debugPrint('NotificationsApi: skipping undecodable row: $error');
    }
  }
  return List<AppNotification>.unmodifiable(notifications);
}
