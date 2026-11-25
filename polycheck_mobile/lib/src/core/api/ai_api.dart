import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../models/ai.dart';
import '../network/api_config.dart';
import '../network/secure_token_store.dart';
import 'api_base.dart';

/// Reads the CURRENT bearer token, invoked on every socket engine open (the
/// initial connect *and* each reconnect) so a mid-session rotation never
/// re-authenticates with a stale bearer (FLR-06, DD-F18).
typedef AiTokenReader = Future<String?> Function();

/// Builds the per-thread Socket.IO options.
///
/// Extracted so the `setAuthFn` contract is unit-testable without a live
/// gateway, mirroring `cockpit_realtime.dart`/`notification_realtime.dart`.
Map<String, dynamic> buildAiThreadSocketOptions(AiTokenReader readToken) {
  return socket_io.OptionBuilder()
      .setTransports(<String>['websocket'])
      // Resolve the bearer per engine open rather than at construction.
      .setAuthFn((void Function(Map auth) callback) {
        unawaited(() async {
          try {
            final token = await readToken();
            if (token == null || token.isEmpty) return;
            callback(<String, dynamic>{'token': token});
          } on Object catch (error) {
            // This runs outside `openThreadStream`'s try; a failed re-read
            // skips the CONNECT auth packet and the engine reports the failure
            // through `onConnectError` (the assistant surfaces it as an error
            // stream event).
            debugPrint('AiThreadStream token re-read failed: $error');
          }
        }());
      })
      .enableForceNew()
      .build();
}

/// The live subscription seam the assistant screen consumes. `AiThreadStream`
/// is the production implementation; tests supply a scripted one.
abstract interface class AiThreadSubscription {
  Stream<AiStreamEvent> get events;
  Future<void> close();
}

/// AI assistant REST surface plus the typed Socket.IO reply stream.
class AiApi extends ApiBase {
  AiApi(super.dio, {required this.tokenStore});

  final TokenStore tokenStore;

  Future<AiCapabilities> getCapabilities() async {
    final data = await getJson('/ai/capabilities');
    return AiCapabilities.fromJson(asMap(data));
  }

  Future<AiChatSendResult> sendMessage(AiChatSendInput input) async {
    final data = await postJson('/ai/chat', body: input.toJson());
    return AiChatSendResult.fromJson(asMap(data));
  }

  Future<AiChatThread> getThread(String threadId) async {
    final data = await getJson('/ai/threads/${Uri.encodeComponent(threadId)}');
    return AiChatThread.fromJson(asMap(data));
  }

  Future<List<AiThreadSummary>> listThreads() async {
    final data = await getJson('/ai/threads');
    return asList(data)
        .whereType<Map>()
        .map((item) => AiThreadSummary.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<bool> deleteThread(String threadId) async {
    await deleteJson('/ai/threads/${Uri.encodeComponent(threadId)}');
    return true;
  }

  /// Opens the per-thread Socket.IO room and exposes `ai:thread:stream`
  /// ticks as [AiStreamEvent]s (`delta` / `done` / `error`).
  ///
  /// The bearer is resolved per engine open (FLR-06), so a token rotated
  /// mid-session is picked up on the next reconnect.
  ///
  /// Returns the [AiThreadSubscription] seam (not the concrete socket class)
  /// so tests can script a stream without a live gateway.
  Future<AiThreadSubscription> openThreadStream(String threadId) async {
    final socket = socket_io.io(
      ApiConfig.socketUrl,
      buildAiThreadSocketOptions(() => tokenStore.read()),
    );
    final stream = AiThreadStream._(socket, threadId);
    await stream.start();
    return stream;
  }
}

/// One live assistant thread room. Call [close] when leaving the chat.
class AiThreadStream implements AiThreadSubscription {
  AiThreadStream._(this._socket, this.threadId);

  final socket_io.Socket _socket;
  final String threadId;
  final StreamController<AiStreamEvent> _controller =
      StreamController<AiStreamEvent>.broadcast();
  bool _closed = false;

  @override
  Stream<AiStreamEvent> get events => _controller.stream;

  Future<void> start() async {
    _socket.onConnect((_) {
      _socket.emit(AiThreadEvents.join, <String, dynamic>{
        'threadId': threadId,
      });
    });
    _socket.on(AiThreadEvents.stream, _handlePayload);
    _socket.onConnectError((dynamic error) {
      if (_controller.isClosed) return;
      _controller.add(
        AiStreamError(
          threadId: threadId,
          message: 'Assistant connection failed: $error',
        ),
      );
    });
    _socket.connect();
  }

  void _handlePayload(dynamic payload) {
    if (_controller.isClosed) return;
    if (payload is! Map) return;
    try {
      _controller.add(AiStreamEvent.fromJson(payload.cast<String, dynamic>()));
    } catch (error, stackTrace) {
      _controller.addError(error, stackTrace);
    }
  }

  @override
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    if (_socket.connected) {
      _socket.emit(AiThreadEvents.leave, <String, dynamic>{
        'threadId': threadId,
      });
    }
    _socket.dispose();
    await _controller.close();
  }
}
