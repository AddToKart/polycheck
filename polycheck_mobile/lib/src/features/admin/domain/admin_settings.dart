import '../../../core/api/api_models.dart';
import '../../../core/models/ai.dart';
import '../../../core/models/privacy.dart';

/// Mirrors `frontend/src/app/faculty/settings/settings-config.ts`.
///
/// Pure definitions, derivations, and validation for the institution settings
/// tabs. Every range echoes the backend `SettingsService` so the client never
/// posts a value the server would reject.

enum SettingsTab {
  institution('institution', 'Institution'),
  sessions('sessions', 'Sessions & attendance'),
  accounts('accounts', 'Accounts & access'),
  ai('ai', 'AI Assistant'),
  system('system', 'System'),
  privacy('privacy', 'Privacy (RA 10173)');

  const SettingsTab(this.id, this.label);

  final String id;
  final String label;

  static SettingsTab? tryParse(String? value) {
    for (final tab in values) {
      if (tab.id == value) return tab;
    }
    return null;
  }
}

const SettingsTab defaultSettingsTab = SettingsTab.institution;

SettingsTab resolveSettingsTab(String? value) =>
    SettingsTab.tryParse(value) ?? defaultSettingsTab;

enum SettingFieldType { text, number, datetimeLocal, textarea }

class SettingFieldDef {
  const SettingFieldDef({
    required this.key,
    required this.tab,
    required this.label,
    required this.type,
    required this.defaultValue,
    required this.caption,
    this.min,
    this.max,
    this.optional = false,
    this.placeholder,
  });

  final String key;
  final SettingsTab tab;
  final String label;
  final SettingFieldType type;
  final String defaultValue;
  final String caption;
  final int? min;
  final int? max;
  final bool optional;
  final String? placeholder;
}

class SettingSwitchDef {
  const SettingSwitchDef({
    required this.key,
    required this.tab,
    required this.label,
    required this.caption,
    required this.defaultValue,
  });

  final String key;
  final SettingsTab tab;
  final String label;
  final String caption;
  final bool defaultValue;
}

const List<SettingFieldDef> settingFields = <SettingFieldDef>[
  SettingFieldDef(
    key: 'institution_name',
    tab: SettingsTab.institution,
    label: 'Institution name',
    type: SettingFieldType.text,
    defaultValue: 'Polytechnic University of the Philippines',
    caption: 'Used as the header on generated master-list exports.',
  ),
  SettingFieldDef(
    key: 'default_geofence_radius_meters',
    tab: SettingsTab.sessions,
    label: 'Default geofence radius (meters)',
    type: SettingFieldType.number,
    defaultValue: '40',
    min: 10,
    max: 500,
    caption:
        'Session prefill — teachers can still adjust the radius before '
        'activating.',
  ),
  SettingFieldDef(
    key: 'default_qr_validity_minutes',
    tab: SettingsTab.sessions,
    label: 'Default QR validity (minutes)',
    type: SettingFieldType.number,
    defaultValue: '5',
    min: 1,
    max: 15,
    caption: 'Session prefill — how long a generated QR code accepts scans.',
  ),
  SettingFieldDef(
    key: 'default_grace_period_minutes',
    tab: SettingsTab.sessions,
    label: 'Default grace period (minutes)',
    type: SettingFieldType.number,
    defaultValue: '15',
    min: 0,
    max: 60,
    caption: 'Session prefill — the late window after the QR code expires.',
  ),
  SettingFieldDef(
    key: 'enrollment_code_expiry_days',
    tab: SettingsTab.sessions,
    label: 'Enrollment code expiry (days)',
    type: SettingFieldType.number,
    defaultValue: '14',
    min: 1,
    max: 90,
    caption:
        'Section enrollment — codes stop accepting students after this many '
        'days.',
  ),
  SettingFieldDef(
    key: 'attendance_min_rate_percent',
    tab: SettingsTab.sessions,
    label: 'Minimum attendance rate (%)',
    type: SettingFieldType.number,
    defaultValue: '75',
    min: 0,
    max: 100,
    caption:
        'Standing threshold — students below this rate are flagged on their '
        'dashboard.',
  ),
  SettingFieldDef(
    key: 'device_cooldown_hours',
    tab: SettingsTab.accounts,
    label: 'Device change cooldown (hours)',
    type: SettingFieldType.number,
    defaultValue: '2',
    min: 1,
    max: 24,
    caption:
        'After a student unregisters their mobile device, mobile logins stay '
        'locked for this many hours. Instructors can release a student sooner.',
  ),
  SettingFieldDef(
    key: 'ai_base_url',
    tab: SettingsTab.ai,
    label: 'AI endpoint base URL (optional)',
    type: SettingFieldType.text,
    defaultValue: '',
    optional: true,
    placeholder: 'https://opencode.ai/inference/go/openai/v1',
    caption:
        'OpenAI-compatible base URL. For OpenCode Go use '
        'https://opencode.ai/inference/go/openai/v1.',
  ),
  SettingFieldDef(
    key: 'ai_model',
    tab: SettingsTab.ai,
    label: 'AI model name (optional)',
    type: SettingFieldType.text,
    defaultValue: '',
    optional: true,
    placeholder: 'deepseek-v4.1-flash',
    caption: 'Model identifier sent to the configured endpoint.',
  ),
  SettingFieldDef(
    key: 'maintenance_message',
    tab: SettingsTab.system,
    label: 'Maintenance announcement (optional)',
    type: SettingFieldType.textarea,
    defaultValue: '',
    optional: true,
    placeholder: 'Polycheck is undergoing scheduled server maintenance…',
    caption:
        'Shown on the branded maintenance screen. Leave blank to use the '
        'built-in copy about offline attendance preservation.',
  ),
  SettingFieldDef(
    key: 'maintenance_until',
    tab: SettingsTab.system,
    label: 'Estimated resumption (optional)',
    type: SettingFieldType.datetimeLocal,
    defaultValue: '',
    optional: true,
    caption:
        'Display-only estimate. Maintenance never turns off automatically at '
        'this time — an exempt administrator must switch it off.',
  ),
  SettingFieldDef(
    key: 'geolocation_retention_days',
    tab: SettingsTab.system,
    label: 'Geolocation retention (days)',
    type: SettingFieldType.number,
    defaultValue: '30',
    min: 7,
    max: 90,
    caption:
        'RA 10173 ephemeral-telemetry window — the nightly shredder strips '
        'stored coordinates older than this. Dispute outcomes and distances '
        'are kept.',
  ),
];

const List<SettingSwitchDef> settingSwitches = <SettingSwitchDef>[
  SettingSwitchDef(
    key: 'allow_teacher_student_provisioning',
    tab: SettingsTab.accounts,
    label: 'Allow teacher student provisioning',
    caption:
        'Let teachers auto-provision inactive student accounts when importing '
        'an enrollment list for a student without an account.',
    defaultValue: false,
  ),
  SettingSwitchDef(
    key: 'allow_teacher_password_reset',
    tab: SettingsTab.accounts,
    label: 'Allow teacher password resets',
    caption:
        'Let teachers issue temporary passwords to students enrolled in their '
        'own sections. Per-teacher overrides can restrict this further.',
    defaultValue: true,
  ),
  SettingSwitchDef(
    key: 'allow_teacher_emergency_device_unbind',
    tab: SettingsTab.accounts,
    label: 'Allow emergency device release',
    caption:
        'Let teachers clear a student device binding and cooldown from the '
        'roster when a phone is lost, damaged, or borrowed.',
    defaultValue: true,
  ),
  SettingSwitchDef(
    key: 'ai_assistant_enabled',
    tab: SettingsTab.ai,
    label: 'AI assistant enabled',
    caption:
        'Master switch — turns the assistant off for the entire system. With '
        'it on, super admins always retain access.',
    defaultValue: true,
  ),
  SettingSwitchDef(
    key: 'ai_assistant_teacher_enabled',
    tab: SettingsTab.ai,
    label: 'Available to teachers',
    caption:
        'Hides the assistant entry point for teachers and department '
        'administrators.',
    defaultValue: true,
  ),
  SettingSwitchDef(
    key: 'ai_assistant_student_enabled',
    tab: SettingsTab.ai,
    label: 'Available to students',
    caption: 'Hides the assistant entry point for students on web and mobile.',
    defaultValue: true,
  ),
  SettingSwitchDef(
    key: 'maintenance_mode_enabled',
    tab: SettingsTab.system,
    label: 'Maintenance mode',
    caption:
        'Closes Polycheck for students and non-designated teachers. Super '
        'admins and IT coordinators stay signed in; health probes remain open.',
    defaultValue: false,
  ),
];

final Map<SettingsTab, List<String>> settingsTabKeys =
    <SettingsTab, List<String>>{
      for (final tab in SettingsTab.values)
        tab: <String>[
          for (final setting in settingSwitches)
            if (setting.tab == tab) setting.key,
          for (final field in settingFields)
            if (field.tab == tab) field.key,
        ],
    };

final Map<String, String> settingDefaults = <String, String>{
  for (final field in settingFields) field.key: field.defaultValue,
  for (final setting in settingSwitches)
    setting.key: setting.defaultValue ? 'true' : 'false',
};

final Map<String, SettingFieldDef> settingFieldsByKey =
    <String, SettingFieldDef>{
      for (final field in settingFields) field.key: field,
    };

final Map<String, SettingSwitchDef> settingSwitchesByKey =
    <String, SettingSwitchDef>{
      for (final setting in settingSwitches) setting.key: setting,
    };

bool isBooleanSetting(String key) => settingSwitchesByKey.containsKey(key);

SettingsTab? settingsTabFor(String key) {
  final field = settingFieldsByKey[key];
  if (field != null) return field.tab;
  return settingSwitchesByKey[key]?.tab;
}

/// Merge API rows over documented defaults so missing rows keep their fallback.
Map<String, String> mergeSettingValues(Iterable<AppSetting> settings) {
  return <String, String>{
    ...settingDefaults,
    for (final setting in settings) setting.key: setting.value,
  };
}

List<String> unsavedKeysInTab(
  SettingsTab tab,
  Map<String, String> values,
  Map<String, String> saved,
) {
  return <String>[
    for (final key in settingsTabKeys[tab] ?? const <String>[])
      if ((values[key] ?? '') != (saved[key] ?? '')) key,
  ];
}

bool isTabDirty(
  SettingsTab tab,
  Map<String, String> values,
  Map<String, String> saved,
) => unsavedKeysInTab(tab, values, saved).isNotEmpty;

bool isTabSaveable(SettingsTab tab, Map<String, String> values) {
  for (final field in settingFields) {
    if (field.tab != tab || field.optional) continue;
    if ((values[field.key] ?? '').trim().isEmpty) return false;
  }
  return true;
}

bool isTabValid(
  SettingsTab tab,
  Map<String, String> values,
  Map<String, String> saved,
) {
  for (final key in unsavedKeysInTab(tab, values, saved)) {
    if (settingFieldsByKey[key] case final SettingFieldDef field) {
      if (validateSettingInput(field, values[key] ?? '') != null) return false;
    }
  }
  return true;
}

/// Returns a human-readable error, or null when the value is acceptable.
String? validateSettingInput(SettingFieldDef field, String raw) {
  final value = raw.trim();
  if (value.isEmpty) {
    return field.optional ? null : '${field.label} is required.';
  }
  switch (field.type) {
    case SettingFieldType.number:
      if (!RegExp(r'^\d+$').hasMatch(value)) {
        return '${field.label} must be a whole number.';
      }
      final numeric = int.tryParse(value);
      if (numeric == null) return '${field.label} must be a whole number.';
      if (field.min != null && numeric < field.min!) {
        return '${field.label} must be at least ${field.min}.';
      }
      if (field.max != null && numeric > field.max!) {
        return '${field.label} must be at most ${field.max}.';
      }
      return null;
    case SettingFieldType.datetimeLocal:
      if (value.length > 64 || DateTime.tryParse(value) == null) {
        return '${field.label} must be a valid ISO-8601 datetime or empty.';
      }
      return null;
    case SettingFieldType.text:
    case SettingFieldType.textarea:
      return _validateTextValue(field.key, value);
  }
}

String? _validateTextValue(String key, String value) {
  switch (key) {
    case 'institution_name':
      if (value.length < 2 || value.length > 150) {
        return 'Institution name must be 2–150 characters.';
      }
      return null;
    case 'ai_base_url':
      if (value.length > 500) {
        return 'Base URL must be 500 characters or fewer.';
      }
      final uri = Uri.tryParse(value);
      if (uri == null ||
          !uri.hasScheme ||
          (uri.scheme != 'https' && uri.scheme != 'http') ||
          uri.host.isEmpty) {
        return 'Enter a valid http(s) URL.';
      }
      return null;
    case 'ai_model':
      if (value.length > 100 || RegExp(r'\s').hasMatch(value)) {
        return 'Model must be 100 characters or fewer without spaces.';
      }
      return null;
    case 'maintenance_message':
      if (value.length > 500) {
        return 'Announcement must be 500 characters or fewer.';
      }
      return null;
    default:
      if (key != 'maintenance_until' && value.length > 500) {
        return 'Value must be 500 characters or fewer.';
      }
      return null;
  }
}

/// The exact value the backend will store (trimmed + normalized).
String normalizedSettingValue(SettingFieldDef field, String raw) {
  final value = raw.trim();
  if (field.type == SettingFieldType.number) {
    final numeric = int.tryParse(value);
    return numeric == null ? value : '$numeric';
  }
  if (field.key == 'ai_base_url') {
    return value.replaceFirst(RegExp(r'/+$'), '');
  }
  return value;
}

String? validateAiApiKey(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return null;
  if (RegExp(r'\s').hasMatch(value)) {
    return 'The AI API key must not contain whitespace.';
  }
  if (value.length < 8 || value.length > 500) {
    return 'The AI API key must be 8–500 characters.';
  }
  return null;
}

// ── Maintenance trio ──

class MaintenanceTrio {
  const MaintenanceTrio({
    required this.enabled,
    required this.message,
    required this.until,
    this.untilError,
  });

  final bool enabled;
  final String message;
  final String? until;
  final String? untilError;

  String get announcementCopy =>
      message.trim().isEmpty ? defaultMaintenanceMessage : message.trim();
}

const String defaultMaintenanceMessage =
    'Polycheck is undergoing scheduled maintenance. Attendance taken during '
    'class still works offline — your records are safely stored on this device '
    'and will sync when servers reopen.';

MaintenanceTrio maintenanceTrioFrom(Map<String, String> values) {
  final message = (values['maintenance_message'] ?? '').trim();
  final rawUntil = (values['maintenance_until'] ?? '').trim();
  String? until;
  String? error;
  if (rawUntil.isNotEmpty) {
    final parsed = DateTime.tryParse(rawUntil);
    if (parsed == null) {
      error = 'Estimated resumption must be a valid datetime.';
    } else {
      until = parsed.toIso8601String();
    }
  }
  return MaintenanceTrio(
    enabled: (values['maintenance_mode_enabled'] ?? 'false') == 'true',
    message: message,
    until: until,
    untilError: error,
  );
}

// ── Assistant status ──

enum AssistantStatusTone { ready, warning, neutral }

class AssistantStatus {
  const AssistantStatus({required this.tone, required this.message});

  final AssistantStatusTone tone;
  final String message;
}

const List<String> aiAvailabilityKeys = <String>[
  'ai_assistant_enabled',
  'ai_assistant_teacher_enabled',
  'ai_assistant_student_enabled',
];

const Map<String, String> _aiMissingLabels = <String, String>{
  'base_url': 'endpoint base URL',
  'model': 'model name',
  'api_key': 'API key',
};

String describeMissingAiConfig(AiMissingConfig missing) {
  final label = _aiMissingLabels[missing.wire];
  if (label != null) return label;
  return missing.wire.replaceAll('_', ' ');
}

AssistantStatus describeAssistantStatus({
  required Map<String, String> values,
  required Map<String, String> saved,
  required AiCapabilities? capabilities,
  bool capabilitiesLoading = false,
}) {
  final availabilityDirty = aiAvailabilityKeys.any(
    (key) => (values[key] ?? '') != (saved[key] ?? ''),
  );
  if (availabilityDirty) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Unsaved availability changes — save to apply.',
    );
  }
  if (saved['ai_assistant_enabled'] == 'false') {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Disabled for everyone.',
    );
  }
  final teachersEnabled = saved['ai_assistant_teacher_enabled'] != 'false';
  final studentsEnabled = saved['ai_assistant_student_enabled'] != 'false';
  if (!teachersEnabled && !studentsEnabled) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Disabled for teachers and students.',
    );
  }
  if (!teachersEnabled) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Disabled for teachers.',
    );
  }
  if (!studentsEnabled) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Disabled for students.',
    );
  }
  if (capabilitiesLoading && capabilities == null) {
    return const AssistantStatus(
      tone: AssistantStatusTone.neutral,
      message: 'Checking assistant status…',
    );
  }
  if (capabilities == null) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Unable to read the assistant configuration.',
    );
  }
  if (capabilities.enabled) {
    final model = capabilities.model?.trim();
    return AssistantStatus(
      tone: AssistantStatusTone.ready,
      message: model == null || model.isEmpty
          ? 'Assistant ready.'
          : 'Assistant ready ($model).',
    );
  }
  if (capabilities.policyBlocked) {
    return const AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'The assistant is disabled by policy.',
    );
  }
  final missing = capabilities.missing;
  if (missing.isNotEmpty) {
    final labels = missing.map(describeMissingAiConfig).join(', ');
    return AssistantStatus(
      tone: AssistantStatusTone.warning,
      message: 'Not configured — missing $labels.',
    );
  }
  return const AssistantStatus(
    tone: AssistantStatusTone.warning,
    message: 'Not configured yet — add an endpoint, model, and API key.',
  );
}

/// Consent coverage for the read-only privacy tab.
int? privacyConsentPercent(PrivacyCenterSnapshot? snapshot) {
  if (snapshot == null) return null;
  return consentCoveragePercent(
    snapshot.consent.covered,
    snapshot.consent.totalActive,
  );
}
