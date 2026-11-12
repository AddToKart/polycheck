import '../models/maintenance.dart';
import '../models/privacy.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Institution settings, RA 10173 privacy center, and maintenance status.
class SettingsApi extends ApiBase {
  SettingsApi(super.dio);

  Future<List<AppSetting>> getSettings() async {
    final data = await getJson('/settings');
    return asList(data)
        .whereType<Map>()
        .map((item) => AppSetting.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AppSetting> setSetting(String key, String value) async {
    final data = await putJson(
      '/settings/${Uri.encodeComponent(key)}',
      body: <String, dynamic>{'value': value},
    );
    return AppSetting.fromJson(asMap(data));
  }

  Future<PrivacyCenterSnapshot> getPrivacyCenter() async {
    final data = await getJson('/settings/privacy-center');
    return PrivacyCenterSnapshot.fromJson(asMap(data));
  }

  /// Public `GET /maintenance/status` (safe before login).
  Future<MaintenanceStatus> getMaintenanceStatus() async {
    final data = await getJson(maintenanceStatusPath);
    return MaintenanceStatus.fromJson(asMap(data));
  }
}
