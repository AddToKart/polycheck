import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../models/ai.dart';
import '../network/api_config.dart';
import '../network/secure_token_store.dart';
import 'api_base.dart';

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
  Future<AiThreadStream> openThreadStream(String threadId) async {
    final token = await tokenStore.read();
    final socket = socket_io.io(
      ApiConfig.socketUrl,
      socket_io.OptionBuilder()
          .setTransports(<String>['websocket'])
          .setAuth(<String, dynamic>{'token': ?token})
          .enableForceNew()
          .build(),
    );
    final stream = AiThreadStream._(socket, threadId);
    await stream.start();
    return stream;
  }
}

/// One live assistant thread room. Call [close] when leaving the chat.
class AiThreadStream {
  AiThreadStream._(this._socket, this.threadId);

  final socket_io.Socket _socket;
  final String threadId;
  final StreamController<AiStreamEvent> _controller =
      StreamController<AiStreamEvent>.broadcast();
  bool _closed = false;

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
