import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

/// Mirrors `shared/src/types/notification.ts`.
enum NotificationType {
  disputeFiled('dispute_filed'),
  disputeResolved('dispute_resolved'),
  excuseRequested('excuse_requested'),
  excuseDecided('excuse_decided'),
  attendanceAbsent('attendance_absent'),
  standingBelowThreshold('standing_below_threshold'),
  accountStatusChanged('account_status_changed'),
  passwordReset('password_reset'),
  roleChanged('role_changed'),
  keyProvisioned('key_provisioned'),
  deviceReleased('device_released'),
  systemReportResolved('system_report_resolved'),
  atRiskReferral('at_risk_referral');

  const NotificationType(this.wire);

  final String wire;

  static final Map<String, NotificationType> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static NotificationType fromWire(String value) =>
      decodeWireEnum('NotificationType', value, byWire);

  static NotificationType? tryParse(String value) => byWire[value];
}

class NotificationTypeConverter
    extends JsonConverter<NotificationType, String> {
  const NotificationTypeConverter();

  @override
  NotificationType fromJson(String json) => NotificationType.fromWire(json);

  @override
  String toJson(NotificationType object) => object.wire;
}

@freezed
abstract class AppNotification with _$AppNotification {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [NotificationTypeConverter()],
  )
  const factory AppNotification({
    required String id,
    required NotificationType type,
    @Default('') String title,
    @Default('') String body,
    String? link,
    String? readAt,
    @Default('') String createdAt,
  }) = _AppNotification;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationFromJson(json);
}

@freezed
abstract class NotificationReadInput with _$NotificationReadInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory NotificationReadInput({List<String>? ids, bool? all}) =
      _NotificationReadInput;

  factory NotificationReadInput.fromJson(Map<String, dynamic> json) =>
      _$NotificationReadInputFromJson(json);
}

enum PushPlatform {
  expo('expo');

  const PushPlatform(this.wire);

  final String wire;

  static final Map<String, PushPlatform> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static PushPlatform fromWire(String value) =>
      decodeWireEnum('PushPlatform', value, byWire);
}

class PushPlatformConverter extends JsonConverter<PushPlatform, String> {
  const PushPlatformConverter();

  @override
  PushPlatform fromJson(String json) => PushPlatform.fromWire(json);

  @override
  String toJson(PushPlatform object) => object.wire;
}

@freezed
abstract class PushTokenInput with _$PushTokenInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [PushPlatformConverter()],
  )
  const factory PushTokenInput({
    required String token,
    @Default(PushPlatform.expo) PushPlatform platform,
  }) = _PushTokenInput;

  factory PushTokenInput.fromJson(Map<String, dynamic> json) =>
      _$PushTokenInputFromJson(json);
}
