import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_settings.dart';

void main() {
  group('settings derivation', () {
    test('merge keeps documented defaults for missing rows', () {
      final merged = mergeSettingValues(<AppSetting>[
        const AppSetting(
          key: 'default_qr_validity_minutes',
          value: '9',
          updatedAt: '',
        ),
      ]);
      expect(merged['default_qr_validity_minutes'], '9');
      expect(merged['default_grace_period_minutes'], '15');
      expect(merged['attendance_min_rate_percent'], '75');
      expect(merged['maintenance_mode_enabled'], 'false');
    });

    test('dirty and saveable track per-tab changes', () {
      final saved = Map<String, String>.from(settingDefaults);
      final values = Map<String, String>.from(saved)
        ..['attendance_min_rate_percent'] = '80';
      expect(isTabDirty(SettingsTab.sessions, values, saved), isTrue);
      expect(isTabDirty(SettingsTab.institution, values, saved), isFalse);
      expect(isTabDirty(SettingsTab.privacy, values, saved), isFalse);
      expect(isTabSaveable(SettingsTab.sessions, values), isTrue);
      values['institution_name'] = '';
      expect(isTabSaveable(SettingsTab.institution, values), isFalse);
    });

    test('setting keys map back to their tab', () {
      expect(settingsTabFor('device_cooldown_hours'), SettingsTab.accounts);
      expect(settingsTabFor('ai_assistant_enabled'), SettingsTab.ai);
      expect(settingsTabFor('geolocation_retention_days'), SettingsTab.system);
      expect(settingsTabFor('not_a_setting'), isNull);
      expect(isBooleanSetting('maintenance_mode_enabled'), isTrue);
    });
  });

  group('per-field validation mirrors backend ranges', () {
    SettingFieldDef field(String key) => settingFieldsByKey[key]!;

    test('QR validity is 1–15 and grace is 0–60', () {
      final qr = field('default_qr_validity_minutes');
      expect(validateSettingInput(qr, '0'), contains('at least 1'));
      expect(validateSettingInput(qr, '16'), contains('at most 15'));
      expect(validateSettingInput(qr, '15'), isNull);
      final grace = field('default_grace_period_minutes');
      expect(validateSettingInput(grace, '0'), isNull);
      expect(validateSettingInput(grace, '61'), contains('at most 60'));
    });

    test('geofence, retention, cooldown, and rate ranges', () {
      expect(
        validateSettingInput(field('default_geofence_radius_meters'), '9'),
        contains('at least 10'),
      );
      expect(
        validateSettingInput(field('default_geofence_radius_meters'), '501'),
        contains('at most 500'),
      );
      expect(
        validateSettingInput(field('geolocation_retention_days'), '6'),
        contains('at least 7'),
      );
      expect(
        validateSettingInput(field('geolocation_retention_days'), '91'),
        contains('at most 90'),
      );
      expect(
        validateSettingInput(field('device_cooldown_hours'), '0'),
        contains('at least 1'),
      );
      expect(
        validateSettingInput(field('device_cooldown_hours'), '25'),
        contains('at most 24'),
      );
      expect(
        validateSettingInput(field('attendance_min_rate_percent'), '101'),
        contains('at most 100'),
      );
      expect(
        validateSettingInput(field('default_qr_validity_minutes'), 'abc'),
        contains('whole number'),
      );
    });

    test('AI endpoint, model, and announcement validation', () {
      expect(
        validateSettingInput(field('ai_base_url'), 'ftp://example.com'),
        contains('http(s)'),
      );
      expect(
        validateSettingInput(
          field('ai_base_url'),
          'https://api.example.com/v1/',
        ),
        isNull,
      );
      expect(
        validateSettingInput(field('ai_model'), 'bad model'),
        contains('without spaces'),
      );
      expect(
        validateSettingInput(field('maintenance_message'), 'x' * 501),
        contains('500'),
      );
      expect(
        normalizedSettingValue(
          field('ai_base_url'),
          ' https://api.example.com/v1/ ',
        ),
        'https://api.example.com/v1',
      );
    });

    test('AI key allows clearing but enforces 8–500 without whitespace', () {
      expect(validateAiApiKey(''), isNull);
      expect(validateAiApiKey('short'), isNotNull);
      expect(validateAiApiKey('key with space'), isNotNull);
      expect(validateAiApiKey('sk-example-123456'), isNull);
    });
  });

  group('maintenance trio', () {
    test('maps enabled, message, and display-only resumption', () {
      final trio = maintenanceTrioFrom(<String, String>{
        'maintenance_mode_enabled': 'true',
        'maintenance_message': '  Server upgrades  ',
        'maintenance_until': '2026-11-18T08:00:00Z',
      });
      expect(trio.enabled, isTrue);
      expect(trio.announcementCopy, 'Server upgrades');
      expect(trio.until, isNotNull);
      expect(trio.untilError, isNull);
    });

    test('blank copy falls back to the offline-preservation notice', () {
      final trio = maintenanceTrioFrom(<String, String>{
        'maintenance_mode_enabled': 'false',
        'maintenance_message': '',
      });
      expect(trio.enabled, isFalse);
      expect(trio.announcementCopy, defaultMaintenanceMessage);
      expect(trio.until, isNull);
    });

    test('invalid resumption offers an inline error and no estimate', () {
      final trio = maintenanceTrioFrom(<String, String>{
        'maintenance_until': 'not-a-date',
      });
      expect(trio.until, isNull);
      expect(trio.untilError, contains('valid datetime'));
    });
  });

  group('assistant status narration', () {
    final saved = Map<String, String>.from(settingDefaults);

    test('unsaved availability outranks provider state', () {
      final values = Map<String, String>.from(saved)
        ..['ai_assistant_teacher_enabled'] = 'false';
      final status = describeAssistantStatus(
        values: values,
        saved: saved,
        capabilities: const AiCapabilities(enabled: true),
      );
      expect(status.tone, AssistantStatusTone.warning);
      expect(status.message, contains('Unsaved'));
    });

    test('master off and role toggles are described', () {
      final masterOff = Map<String, String>.from(saved)
        ..['ai_assistant_enabled'] = 'false';
      expect(
        describeAssistantStatus(
          values: masterOff,
          saved: masterOff,
          capabilities: null,
        ).message,
        'Disabled for everyone.',
      );
      final teacherOff = Map<String, String>.from(saved)
        ..['ai_assistant_teacher_enabled'] = 'false';
      expect(
        describeAssistantStatus(
          values: teacherOff,
          saved: teacherOff,
          capabilities: null,
        ).message,
        'Disabled for teachers.',
      );
    });

    test('ready, policy-blocked, and missing-config states', () {
      expect(
        describeAssistantStatus(
          values: saved,
          saved: saved,
          capabilities: const AiCapabilities(
            enabled: true,
            model: 'deepseek-v4.1-flash',
          ),
        ).message,
        'Assistant ready (deepseek-v4.1-flash).',
      );
      expect(
        describeAssistantStatus(
          values: saved,
          saved: saved,
          capabilities: const AiCapabilities(
            enabled: false,
            policyBlocked: true,
          ),
        ).message,
        contains('disabled by policy'),
      );
      final missing = describeAssistantStatus(
        values: saved,
        saved: saved,
        capabilities: const AiCapabilities(
          enabled: false,
          missing: <AiMissingConfig>[AiMissingConfig.apiKey],
        ),
      );
      expect(missing.message, contains('API key'));
    });
  });
}
