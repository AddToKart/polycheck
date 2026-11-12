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
    return asList(data)
        .whereType<Map>()
        .map((item) => AppNotification.fromJson(asMap(item)))
        .toList(growable: false);
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
