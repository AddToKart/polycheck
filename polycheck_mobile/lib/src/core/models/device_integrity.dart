import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'device_integrity.freezed.dart';
part 'device_integrity.g.dart';

/// Mirrors `shared/src/types/device-integrity.ts`.
enum ActiveDeviceKind {
  mobile('mobile'),
  web('web');

  const ActiveDeviceKind(this.wire);

  final String wire;

  static final Map<String, ActiveDeviceKind> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ActiveDeviceKind fromWire(String value) =>
      decodeWireEnum('ActiveDeviceKind', value, byWire);

  static ActiveDeviceKind? tryParse(String value) => byWire[value];
}

class ActiveDeviceKindConverter
    extends JsonConverter<ActiveDeviceKind, String> {
  const ActiveDeviceKindConverter();

  @override
  ActiveDeviceKind fromJson(String json) => ActiveDeviceKind.fromWire(json);

  @override
  String toJson(ActiveDeviceKind object) => object.wire;
}

enum DeviceIntegrityErrorCode {
  deviceCooldownActive('device_cooldown_active'),
  activeSessionElsewhere('active_session_elsewhere');

  const DeviceIntegrityErrorCode(this.wire);

  final String wire;

  static final Map<String, DeviceIntegrityErrorCode> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static DeviceIntegrityErrorCode fromWire(String value) =>
      decodeWireEnum('DeviceIntegrityErrorCode', value, byWire);

  static DeviceIntegrityErrorCode? tryParse(String value) => byWire[value];
}

class DeviceIntegrityErrorCodeConverter
    extends JsonConverter<DeviceIntegrityErrorCode, String> {
  const DeviceIntegrityErrorCodeConverter();

  @override
  DeviceIntegrityErrorCode fromJson(String json) =>
      DeviceIntegrityErrorCode.fromWire(json);

  @override
  String toJson(DeviceIntegrityErrorCode object) => object.wire;
}

@freezed
abstract class DeviceIntegrityErrorPayload with _$DeviceIntegrityErrorPayload {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      DeviceIntegrityErrorCodeConverter(),
      ActiveDeviceKindConverter(),
    ],
  )
  const factory DeviceIntegrityErrorPayload({
    required DeviceIntegrityErrorCode code,
    String? message,
    int? remainingMinutes,
    int? remainingSeconds,
    ActiveDeviceKind? activeDeviceKind,
    String? activeSessionLastActiveAt,
  }) = _DeviceIntegrityErrorPayload;

  factory DeviceIntegrityErrorPayload.fromJson(Map<String, dynamic> json) =>
      _$DeviceIntegrityErrorPayloadFromJson(json);
}
