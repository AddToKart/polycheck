import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/database/app_database.dart';
import '../../../core/models/notification.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/providers/session_provider.dart';
import 'notification_realtime.dart';

@immutable
class NotificationInboxState {
  const NotificationInboxState({
    this.items = const <AppNotification>[],
    this.unreadCount = 0,
    this.loading = false,
    this.refreshing = false,
    this.connected = false,
    this.error,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final bool loading;
  final bool refreshing;

  /// Realtime socket state (false also means "not attempted").
  final bool connected;
  final String? error;

  NotificationInboxState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    bool? loading,
    bool? refreshing,
    bool? connected,
    String? error,
    bool clearError = false,
  }) {
    return NotificationInboxState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      loading: loading ?? this.loading,
      refreshing: refreshing ?? this.refreshing,
      connected: connected ?? this.connected,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Drift-backed notification inbox with realtime inserts and server refresh.
///
/// The DB stream is the source the UI watches, so a `notifications:new` socket
/// event appears immediately and survives screen rebuilds.
///
/// Push registration is intentionally deferred in this wave: the backend
/// `POST /notifications/push-token` contract exists, but no Expo/FCM
/// dependency or native plugin is available yet (the Android port ships
/// Expo push in a dev-client rebuild).
class NotificationInboxController extends Notifier<NotificationInboxState> {
  StreamSubscription<List<AppNotification>>? _dbSubscription;
  NotificationRealtime? _realtime;
  int _generation = 0;

  @override
  NotificationInboxState build() {
    final userId = ref.watch(sessionProvider.select((state) => state.user?.id));
    _generation += 1;
    final generation = _generation;
    ref.onDispose(() {
      _dbSubscription?.cancel();
      _dbSubscription = null;
      _realtime?.dispose();
      _realtime = null;
    });

    if (userId == null) return const NotificationInboxState();

    final database = ref.read(appDatabaseProvider);
    _dbSubscription = database.watchNotifications(userId).listen((items) {
      if (!ref.mounted || generation != _generation) return;
      state = state.copyWith(
        items: items,
        unreadCount: items.where((item) => item.readAt == null).length,
        loading: false,
        clearError: true,
      );
    });

    _realtime = NotificationRealtime(
      tokenStore: ref.read(tokenStoreProvider),
      onNotification: (notification) {
        String? localReadAt;
        for (final item in state.items) {
          if (item.id == notification.id) {
            localReadAt = item.readAt;
            break;
          }
        }
        final merged = notification.readAt == null && localReadAt != null
            ? notification.copyWith(readAt: localReadAt)
            : notification;
        unawaited(database.upsertNotifications(userId, [merged]));
      },
      onConnection: (connected) {
        if (!ref.mounted || generation != _generation) return;
        state = state.copyWith(connected: connected);
      },
    );
    unawaited(_realtime!.start());
    unawaited(refresh(userId: userId, generation: generation));

    return const NotificationInboxState(loading: true);
  }

  /// Fetches the authoritative list + unread count and seeds the local cache.
  Future<void> refresh({String? userId, int? generation}) async {
    final targetUser =
        userId ?? ref.read(sessionProvider.select((state) => state.user?.id));
    if (targetUser == null) return;
    final expected = generation ?? _generation;
    if (ref.mounted && expected == _generation) {
      state = state.copyWith(refreshing: true, clearError: true);
    }
    try {
      final api = ref.read(notificationsApiProvider);
      final (list, count) = await (
        api.getNotifications(limit: 100),
        api.getUnreadNotificationCount(),
      ).wait;
      if (!ref.mounted || expected != _generation) return;
      // The drift watcher decodes the payload JSON, so carry locally-known
      // read stamps into refreshed payloads (an optimistic read must not
      // flicker back to unread while the server response catches up).
      final localReadAt = {
        for (final item in state.items)
          if (item.readAt != null) item.id: item.readAt,
      };
      final merged = [
        for (final notification in list)
          notification.readAt == null && localReadAt[notification.id] != null
              ? notification.copyWith(readAt: localReadAt[notification.id])
              : notification,
      ];
      await ref
          .read(appDatabaseProvider)
          .upsertNotifications(targetUser, merged);
      if (!ref.mounted || expected != _generation) return;
      state = state.copyWith(
        loading: false,
        refreshing: false,
        unreadCount: count.clamp(0, 9999).toInt(),
        clearError: true,
      );
    } on ApiRequestError catch (error) {
      if (!ref.mounted || expected != _generation) return;
      state = state.copyWith(
        loading: false,
        refreshing: false,
        error: error.isUnauthorized
            ? null
            : 'Notifications could not load. Try again.',
      );
    } catch (_) {
      if (!ref.mounted || expected != _generation) return;
      state = state.copyWith(
        loading: false,
        refreshing: false,
        error: 'Notifications could not load. Try again.',
      );
    }
  }

  Future<void> markAllRead() async {
    final userId = ref.read(sessionProvider.select((state) => state.user?.id));
    if (userId == null || state.unreadCount == 0) return;
    final database = ref.read(appDatabaseProvider);
    final now = DateTime.now().toUtc();
    await database.markAllNotificationsRead(userId, readAt: now);
    // Keep payloads in sync with the column: the watcher decodes payloads.
    await database.upsertNotifications(userId, [
      for (final item in state.items)
        item.readAt == null
            ? item.copyWith(readAt: now.toIso8601String())
            : item,
    ]);
    try {
      final count = await ref
          .read(notificationsApiProvider)
          .markNotificationsRead(const NotificationReadInput(all: true));
      if (!ref.mounted) return;
      state = state.copyWith(unreadCount: count.clamp(0, 9999).toInt());
    } catch (_) {
      await refresh();
    }
  }

  Future<void> markRead(AppNotification notification) async {
    if (notification.readAt != null) return;
    final userId = ref.read(sessionProvider.select((state) => state.user?.id));
    if (userId == null) return;
    final database = ref.read(appDatabaseProvider);
    final readAt = DateTime.now().toUtc();
    await database.markNotificationRead(
      userId,
      notification.id,
      readAt: readAt,
    );
    await database.upsertNotifications(userId, [
      notification.copyWith(readAt: readAt.toIso8601String()),
    ]);
    try {
      final count = await ref
          .read(notificationsApiProvider)
          .markNotificationsRead(NotificationReadInput(ids: [notification.id]));
      if (!ref.mounted) return;
      state = state.copyWith(unreadCount: count.clamp(0, 9999).toInt());
    } catch (_) {
      // Local read state stays; a refresh reconciles with the server.
      unawaited(refresh());
    }
  }
}

final notificationInboxProvider =
    NotifierProvider<NotificationInboxController, NotificationInboxState>(
      NotificationInboxController.new,
    );
