// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AppNotification _$AppNotificationFromJson(Map<String, dynamic> json) =>
    _AppNotification(
      id: json['id'] as String,
      type: const NotificationTypeConverter().fromJson(json['type'] as String),
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      link: json['link'] as String?,
      readAt: json['readAt'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );

Map<String, dynamic> _$AppNotificationToJson(_AppNotification instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': const NotificationTypeConverter().toJson(instance.type),
      'title': instance.title,
      'body': instance.body,
      'link': instance.link,
      'readAt': instance.readAt,
      'createdAt': instance.createdAt,
    };

_NotificationReadInput _$NotificationReadInputFromJson(
  Map<String, dynamic> json,
) => _NotificationReadInput(
  ids: (json['ids'] as List<dynamic>?)?.map((e) => e as String).toList(),
  all: json['all'] as bool?,
);

Map<String, dynamic> _$NotificationReadInputToJson(
  _NotificationReadInput instance,
) => <String, dynamic>{'ids': instance.ids, 'all': instance.all};

_PushTokenInput _$PushTokenInputFromJson(Map<String, dynamic> json) =>
    _PushTokenInput(
      token: json['token'] as String,
      platform: json['platform'] == null
          ? PushPlatform.expo
          : const PushPlatformConverter().fromJson(json['platform'] as String),
    );

Map<String, dynamic> _$PushTokenInputToJson(_PushTokenInput instance) =>
    <String, dynamic>{
      'token': instance.token,
      'platform': const PushPlatformConverter().toJson(instance.platform),
    };
