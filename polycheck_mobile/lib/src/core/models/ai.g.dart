// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AiChatAttachment _$AiChatAttachmentFromJson(Map<String, dynamic> json) =>
    _AiChatAttachment(
      id: json['id'] as String,
      kind: const AiAttachmentKindConverter().fromJson(json['kind'] as String),
      format: const AiAttachmentFormatConverter().fromJson(
        json['format'] as String,
      ),
      label: json['label'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      downloadPath: json['downloadPath'] as String? ?? '',
    );

Map<String, dynamic> _$AiChatAttachmentToJson(_AiChatAttachment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': const AiAttachmentKindConverter().toJson(instance.kind),
      'format': const AiAttachmentFormatConverter().toJson(instance.format),
      'label': instance.label,
      'filename': instance.filename,
      'downloadPath': instance.downloadPath,
    };

_AiToolInvocationSummary _$AiToolInvocationSummaryFromJson(
  Map<String, dynamic> json,
) => _AiToolInvocationSummary(
  tool: json['tool'] as String,
  outcome: const AiToolOutcomeConverter().fromJson(json['outcome'] as String),
  detail: json['detail'] as String?,
);

Map<String, dynamic> _$AiToolInvocationSummaryToJson(
  _AiToolInvocationSummary instance,
) => <String, dynamic>{
  'tool': instance.tool,
  'outcome': const AiToolOutcomeConverter().toJson(instance.outcome),
  'detail': instance.detail,
};

_AiChatMessage _$AiChatMessageFromJson(Map<String, dynamic> json) =>
    _AiChatMessage(
      id: json['id'] as String,
      threadId: json['threadId'] as String,
      role: const AiChatRoleConverter().fromJson(json['role'] as String),
      content: json['content'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      attachments:
          (json['attachments'] as List<dynamic>?)
              ?.map((e) => AiChatAttachment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AiChatAttachment>[],
      toolInvocations:
          (json['toolInvocations'] as List<dynamic>?)
              ?.map(
                (e) =>
                    AiToolInvocationSummary.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          const <AiToolInvocationSummary>[],
    );

Map<String, dynamic> _$AiChatMessageToJson(
  _AiChatMessage instance,
) => <String, dynamic>{
  'id': instance.id,
  'threadId': instance.threadId,
  'role': const AiChatRoleConverter().toJson(instance.role),
  'content': instance.content,
  'createdAt': instance.createdAt,
  'attachments': instance.attachments.map((e) => e.toJson()).toList(),
  'toolInvocations': instance.toolInvocations.map((e) => e.toJson()).toList(),
};

_AiChatThread _$AiChatThreadFromJson(Map<String, dynamic> json) =>
    _AiChatThread(
      id: json['id'] as String,
      messages:
          (json['messages'] as List<dynamic>?)
              ?.map((e) => AiChatMessage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AiChatMessage>[],
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );

Map<String, dynamic> _$AiChatThreadToJson(_AiChatThread instance) =>
    <String, dynamic>{
      'id': instance.id,
      'messages': instance.messages.map((e) => e.toJson()).toList(),
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
    };

_AiChatSendInput _$AiChatSendInputFromJson(Map<String, dynamic> json) =>
    _AiChatSendInput(
      message: json['message'] as String,
      threadId: json['threadId'] as String?,
      regenerate: json['regenerate'] as bool?,
    );

Map<String, dynamic> _$AiChatSendInputToJson(_AiChatSendInput instance) =>
    <String, dynamic>{
      'message': instance.message,
      'threadId': instance.threadId,
      'regenerate': instance.regenerate,
    };

_AiChatSendResult _$AiChatSendResultFromJson(Map<String, dynamic> json) =>
    _AiChatSendResult(
      threadId: json['threadId'] as String,
      messageId: json['messageId'] as String,
    );

Map<String, dynamic> _$AiChatSendResultToJson(_AiChatSendResult instance) =>
    <String, dynamic>{
      'threadId': instance.threadId,
      'messageId': instance.messageId,
    };

_AiThreadSummary _$AiThreadSummaryFromJson(Map<String, dynamic> json) =>
    _AiThreadSummary(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );

Map<String, dynamic> _$AiThreadSummaryToJson(_AiThreadSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
    };

_AiCapabilities _$AiCapabilitiesFromJson(Map<String, dynamic> json) =>
    _AiCapabilities(
      enabled: json['enabled'] as bool,
      model: json['model'] as String?,
      maxMessageChars: (json['maxMessageChars'] as num?)?.toInt(),
      reason: json['reason'] as String?,
      missing:
          (json['missing'] as List<dynamic>?)
              ?.map(
                (e) => const AiMissingConfigConverter().fromJson(e as String),
              )
              .toList() ??
          const <AiMissingConfig>[],
      policyBlocked: json['policyBlocked'] as bool? ?? false,
    );

Map<String, dynamic> _$AiCapabilitiesToJson(_AiCapabilities instance) =>
    <String, dynamic>{
      'enabled': instance.enabled,
      'model': instance.model,
      'maxMessageChars': instance.maxMessageChars,
      'reason': instance.reason,
      'missing': instance.missing
          .map(const AiMissingConfigConverter().toJson)
          .toList(),
      'policyBlocked': instance.policyBlocked,
    };
