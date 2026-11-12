import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/unknown_api_value.dart';
import 'support/wire_enum.dart';

part 'ai.freezed.dart';
part 'ai.g.dart';

/// Mirrors `shared/src/types/ai.ts`.
enum AiChatRole {
  user('user'),
  assistant('assistant');

  const AiChatRole(this.wire);

  final String wire;

  static final Map<String, AiChatRole> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AiChatRole fromWire(String value) =>
      decodeWireEnum('AiChatRole', value, byWire);

  static AiChatRole? tryParse(String value) => byWire[value];
}

class AiChatRoleConverter extends JsonConverter<AiChatRole, String> {
  const AiChatRoleConverter();

  @override
  AiChatRole fromJson(String json) => AiChatRole.fromWire(json);

  @override
  String toJson(AiChatRole object) => object.wire;
}

enum AiAttachmentKind {
  masterList('master_list'),
  sessionAttendance('session_attendance');

  const AiAttachmentKind(this.wire);

  final String wire;

  static final Map<String, AiAttachmentKind> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AiAttachmentKind fromWire(String value) =>
      decodeWireEnum('AiAttachmentKind', value, byWire);

  static AiAttachmentKind? tryParse(String value) => byWire[value];
}

class AiAttachmentKindConverter
    extends JsonConverter<AiAttachmentKind, String> {
  const AiAttachmentKindConverter();

  @override
  AiAttachmentKind fromJson(String json) => AiAttachmentKind.fromWire(json);

  @override
  String toJson(AiAttachmentKind object) => object.wire;
}

enum AiAttachmentFormat {
  pdf('pdf'),
  docx('docx'),
  csv('csv');

  const AiAttachmentFormat(this.wire);

  final String wire;

  static final Map<String, AiAttachmentFormat> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AiAttachmentFormat fromWire(String value) =>
      decodeWireEnum('AiAttachmentFormat', value, byWire);

  static AiAttachmentFormat? tryParse(String value) => byWire[value];
}

class AiAttachmentFormatConverter
    extends JsonConverter<AiAttachmentFormat, String> {
  const AiAttachmentFormatConverter();

  @override
  AiAttachmentFormat fromJson(String json) => AiAttachmentFormat.fromWire(json);

  @override
  String toJson(AiAttachmentFormat object) => object.wire;
}

enum AiToolOutcome {
  succeeded('succeeded'),
  denied('denied'),
  failed('failed');

  const AiToolOutcome(this.wire);

  final String wire;

  static final Map<String, AiToolOutcome> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AiToolOutcome fromWire(String value) =>
      decodeWireEnum('AiToolOutcome', value, byWire);

  static AiToolOutcome? tryParse(String value) => byWire[value];
}

class AiToolOutcomeConverter extends JsonConverter<AiToolOutcome, String> {
  const AiToolOutcomeConverter();

  @override
  AiToolOutcome fromJson(String json) => AiToolOutcome.fromWire(json);

  @override
  String toJson(AiToolOutcome object) => object.wire;
}

enum AiMissingConfig {
  baseUrl('base_url'),
  model('model'),
  apiKey('api_key');

  const AiMissingConfig(this.wire);

  final String wire;

  static final Map<String, AiMissingConfig> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AiMissingConfig fromWire(String value) =>
      decodeWireEnum('AiMissingConfig', value, byWire);

  static AiMissingConfig? tryParse(String value) => byWire[value];
}

class AiMissingConfigConverter extends JsonConverter<AiMissingConfig, String> {
  const AiMissingConfigConverter();

  @override
  AiMissingConfig fromJson(String json) => AiMissingConfig.fromWire(json);

  @override
  String toJson(AiMissingConfig object) => object.wire;
}

@freezed
abstract class AiChatAttachment with _$AiChatAttachment {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AiAttachmentKindConverter(), AiAttachmentFormatConverter()],
  )
  const factory AiChatAttachment({
    required String id,
    required AiAttachmentKind kind,
    required AiAttachmentFormat format,
    @Default('') String label,
    @Default('') String filename,
    @Default('') String downloadPath,
  }) = _AiChatAttachment;

  factory AiChatAttachment.fromJson(Map<String, dynamic> json) =>
      _$AiChatAttachmentFromJson(json);
}

@freezed
abstract class AiToolInvocationSummary with _$AiToolInvocationSummary {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AiToolOutcomeConverter()],
  )
  const factory AiToolInvocationSummary({
    required String tool,
    required AiToolOutcome outcome,
    String? detail,
  }) = _AiToolInvocationSummary;

  factory AiToolInvocationSummary.fromJson(Map<String, dynamic> json) =>
      _$AiToolInvocationSummaryFromJson(json);
}

@freezed
abstract class AiChatMessage with _$AiChatMessage {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AiChatRoleConverter()],
  )
  const factory AiChatMessage({
    required String id,
    required String threadId,
    required AiChatRole role,
    @Default('') String content,
    @Default('') String createdAt,
    @Default(<AiChatAttachment>[]) List<AiChatAttachment> attachments,
    @Default(<AiToolInvocationSummary>[])
    List<AiToolInvocationSummary> toolInvocations,
  }) = _AiChatMessage;

  factory AiChatMessage.fromJson(Map<String, dynamic> json) =>
      _$AiChatMessageFromJson(json);
}

@freezed
abstract class AiChatThread with _$AiChatThread {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AiChatThread({
    required String id,
    @Default(<AiChatMessage>[]) List<AiChatMessage> messages,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _AiChatThread;

  factory AiChatThread.fromJson(Map<String, dynamic> json) =>
      _$AiChatThreadFromJson(json);
}

@freezed
abstract class AiChatSendInput with _$AiChatSendInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AiChatSendInput({
    required String message,
    String? threadId,
    bool? regenerate,
  }) = _AiChatSendInput;

  factory AiChatSendInput.fromJson(Map<String, dynamic> json) =>
      _$AiChatSendInputFromJson(json);
}

@freezed
abstract class AiChatSendResult with _$AiChatSendResult {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AiChatSendResult({
    required String threadId,
    required String messageId,
  }) = _AiChatSendResult;

  factory AiChatSendResult.fromJson(Map<String, dynamic> json) =>
      _$AiChatSendResultFromJson(json);
}

@freezed
abstract class AiThreadSummary with _$AiThreadSummary {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AiThreadSummary({
    required String id,
    @Default('') String title,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _AiThreadSummary;

  factory AiThreadSummary.fromJson(Map<String, dynamic> json) =>
      _$AiThreadSummaryFromJson(json);
}

@freezed
abstract class AiCapabilities with _$AiCapabilities {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AiMissingConfigConverter()],
  )
  const factory AiCapabilities({
    required bool enabled,
    String? model,
    int? maxMessageChars,
    String? reason,
    @Default(<AiMissingConfig>[]) List<AiMissingConfig> missing,
    @Default(false) bool policyBlocked,
  }) = _AiCapabilities;

  factory AiCapabilities.fromJson(Map<String, dynamic> json) =>
      _$AiCapabilitiesFromJson(json);
}

/// One Socket.IO stream tick for an in-flight assistant reply.
///
/// A discriminated union on `type`; an unknown tick type throws
/// [UnknownApiValue] (never a silent no-op).
sealed class AiStreamEvent {
  const AiStreamEvent();

  static AiStreamEvent fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'delta':
        return AiStreamDelta.fromJson(json);
      case 'done':
        return AiStreamDone.fromJson(json);
      case 'error':
        return AiStreamError.fromJson(json);
      default:
        throw UnknownApiValue('AiStreamEvent.type', json['type']);
    }
  }

  Map<String, dynamic> toJson();
}

final class AiStreamDelta extends AiStreamEvent {
  const AiStreamDelta({
    required this.threadId,
    required this.messageId,
    required this.text,
  });

  factory AiStreamDelta.fromJson(Map<String, dynamic> json) {
    return AiStreamDelta(
      threadId: json['threadId'] as String,
      messageId: json['messageId'] as String,
      text: json['text'] as String? ?? '',
    );
  }

  final String threadId;
  final String messageId;
  final String text;

  @override
  Map<String, dynamic> toJson() => {
    'type': 'delta',
    'threadId': threadId,
    'messageId': messageId,
    'text': text,
  };
}

final class AiStreamDone extends AiStreamEvent {
  const AiStreamDone({required this.threadId, required this.message});

  factory AiStreamDone.fromJson(Map<String, dynamic> json) {
    return AiStreamDone(
      threadId: json['threadId'] as String,
      message: AiChatMessage.fromJson(json['message'] as Map<String, dynamic>),
    );
  }

  final String threadId;
  final AiChatMessage message;

  @override
  Map<String, dynamic> toJson() => {
    'type': 'done',
    'threadId': threadId,
    'message': message.toJson(),
  };
}

final class AiStreamError extends AiStreamEvent {
  const AiStreamError({
    required this.threadId,
    required this.message,
    this.messageId,
  });

  factory AiStreamError.fromJson(Map<String, dynamic> json) {
    return AiStreamError(
      threadId: json['threadId'] as String,
      messageId: json['messageId'] as String?,
      message: json['message'] as String? ?? '',
    );
  }

  final String threadId;
  final String? messageId;
  final String message;

  @override
  Map<String, dynamic> toJson() => {
    'type': 'error',
    'threadId': threadId,
    if (messageId != null) 'messageId': messageId,
    'message': message,
  };
}

abstract final class AiThreadEvents {
  static const String join = 'ai:thread:join';
  static const String joined = 'ai:thread:joined';
  static const String leave = 'ai:thread:leave';
  static const String stream = 'ai:thread:stream';
}
