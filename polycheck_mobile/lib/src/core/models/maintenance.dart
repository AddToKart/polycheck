import 'package:freezed_annotation/freezed_annotation.dart';

part 'maintenance.freezed.dart';
part 'maintenance.g.dart';

/// Mirrors `shared/src/types/maintenance.ts`.
const String defaultMaintenanceMessage =
    'Polycheck is undergoing scheduled maintenance. Attendance taken during '
    'class still works offline - your records are safely stored on this device '
    'and will sync when servers reopen.';

const List<String> maintenanceSettingKeys = [
  'maintenance_mode_enabled',
  'maintenance_message',
  'maintenance_until',
];

bool isMaintenanceSettingKey(String key) =>
    maintenanceSettingKeys.contains(key);

/// Public metadata endpoint path (exempt from the maintenance guard).
const String maintenanceStatusPath = '/maintenance/status';

/// In-process event emitted when a maintenance setting is written.
const String maintenanceSettingsChangedEvent = 'settings.maintenance-changed';

/// Canonical 503 body published while maintenance mode is active.
@freezed
abstract class MaintenanceBlockBody with _$MaintenanceBlockBody {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory MaintenanceBlockBody({
    @Default('system_maintenance') String code,
    @Default('') String message,
    String? estimatedEnd,
  }) = _MaintenanceBlockBody;

  factory MaintenanceBlockBody.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceBlockBodyFromJson(json);
}

/// Public, unauthenticated snapshot served by GET /maintenance/status.
@freezed
abstract class MaintenanceStatus with _$MaintenanceStatus {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory MaintenanceStatus({
    required bool enabled,
    String? message,
    String? estimatedEnd,
  }) = _MaintenanceStatus;

  factory MaintenanceStatus.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceStatusFromJson(json);
}
