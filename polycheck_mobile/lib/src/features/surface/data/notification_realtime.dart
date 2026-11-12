import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../../../core/models/notification.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/secure_token_store.dart';
import 'notification_links.dart';

/// Realtime `notifications:new` subscription for the current user's
/// `auth:user:<id>` room (the gateway joins it automatically on connect).
class NotificationRealtime {
  NotificationRealtime({
    required this.tokenStore,
    required this.onNotification,
    required this.onConnection,
  });

  final TokenStore tokenStore;
  final void Function(AppNotification notification) onNotification;
  final void Function(bool connected) onConnection;

  socket_io.Socket? _socket;
  bool _disposed = false;

  Future<void> start() async {
    try {
      final token = await tokenStore.read();
      if (_disposed) return;
      if (token == null || token.isEmpty) {
        onConnection(false);
        return;
      }
      final socket = socket_io.io(
        ApiConfig.socketUrl,
        socket_io.OptionBuilder()
            .setTransports(<String>['websocket'])
            // Resolve the bearer per engine open rather than at construction: a
            // token rotated mid-session would otherwise be replayed stale on
            // every reconnect (DD-F18). A missing token sends no CONNECT packet.
            .setAuthFn((void Function(Map auth) callback) {
              unawaited(() async {
                try {
                  final current = await tokenStore.read();
                  if (current == null || current.isEmpty) return;
                  callback(<String, dynamic>{'token': current});
                } on Object catch (error) {
                  // DD-F15 guard: this runs on every engine (re)open, outside
                  // start()'s try. A failed re-read skips the CONNECT auth
                  // packet; the engine then reports the disconnect through
                  // `onConnectError`, which flips the inbox state.
                  debugPrint(
                    'NotificationRealtime token re-read failed: $error',
                  );
                }
              }());
            })
            .enableForceNew()
            .build(),
      );
      _socket = socket;
      socket.onConnect((_) {
        if (!_disposed) onConnection(true);
      });
      socket.onDisconnect((_) {
        if (!_disposed) onConnection(false);
      });
      socket.onConnectError((dynamic _) {
        if (!_disposed) onConnection(false);
      });
      socket.on(notificationsNewEvent, (dynamic payload) {
        if (_disposed || payload is! Map) return;
        try {
          onNotification(
            AppNotification.fromJson(payload.cast<String, dynamic>()),
          );
        } catch (_) {
          // A malformed notification must never crash the inbox socket.
        }
      });
      socket.connect();
    } on Object catch (error, stackTrace) {
      // Token-store reads (secure storage platform channel) and socket
      // bootstrap can throw. The inbox is created fire-and-forget, so an
      // escaping future would surface as unhandled zone noise: drop the
      // half-built socket, report the disconnected state through the same
      // callback the socket uses, and keep the screen usable.
      if (_disposed) return;
      final socket = _socket;
      _socket = null;
      socket?.dispose();
      debugPrint('NotificationRealtime.start failed: $error\n$stackTrace');
      onConnection(false);
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    final socket = _socket;
    _socket = null;
    socket?.dispose();
    onConnection(false);
  }
}
