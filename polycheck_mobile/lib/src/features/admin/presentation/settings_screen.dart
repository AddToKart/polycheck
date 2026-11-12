import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/ai.dart';
import '../../../core/models/maintenance.dart';
import '../../../core/models/privacy.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_text_field.dart';
import '../../../core/widgets/campus_toast.dart';
import '../domain/admin_access.dart';
import '../domain/admin_settings.dart';
import 'widgets/admin_common.dart';

class AdminSettingsScreen extends ConsumerStatefulWidget {
  const AdminSettingsScreen({super.key, this.initialTab});

  final SettingsTab? initialTab;

  @override
  ConsumerState<AdminSettingsScreen> createState() =>
      _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends ConsumerState<AdminSettingsScreen> {
  final Map<String, TextEditingController> _controllers =
      <String, TextEditingController>{};
  final Map<String, String?> _fieldErrors = <String, String?>{};
  final _aiKey = TextEditingController();

  Map<String, String> _values = <String, String>{};
  Map<String, String> _saved = <String, String>{};
  SettingsTab? _selectedTab;
  AiCapabilities? _capabilities;
  PrivacyCenterSnapshot? _privacy;
  bool _privacyLoading = false;
  bool _loading = true;
  bool _saving = false;
  bool _aiKeySaving = false;
  String? _error;
  String? _aiKeyError;

  @override
  void initState() {
    super.initState();
    _selectedTab = widget.initialTab ?? defaultSettingsTab;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _aiKey.dispose();
    super.dispose();
  }

  TextEditingController _controllerFor(String key) {
    return _controllers.putIfAbsent(
      key,
      () => TextEditingController(text: _values[key] ?? ''),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final settings = await ref.read(settingsApiProvider).getSettings();
      if (!mounted) return;
      final merged = mergeSettingValues(settings);
      setState(() {
        _values = merged;
        _saved = Map<String, String>.from(merged);
        _loading = false;
      });
      for (final entry in merged.entries) {
        _controllerFor(entry.key).text = entry.value;
      }
      unawaited(_loadCapabilities());
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  Future<void> _loadCapabilities() async {
    try {
      final capabilities = await ref.read(aiApiProvider).getCapabilities();
      if (!mounted) return;
      setState(() => _capabilities = capabilities);
    } catch (_) {
      if (!mounted) return;
      setState(() => _capabilities = null);
    }
  }

  Future<void> _loadPrivacy() async {
    if (_privacyLoading) return;
    setState(() => _privacyLoading = true);
    try {
      final snapshot = await ref.read(settingsApiProvider).getPrivacyCenter();
      if (!mounted) return;
      setState(() {
        _privacy = snapshot;
        _privacyLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _privacyLoading = false);
      CampusToast.showIn(
        context,
        error is ApiRequestError
            ? error.message
            : 'Could not load the privacy snapshot.',
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _selectTab(SettingsTab tab) async {
    if (tab == _selectedTab) return;
    setState(() => _selectedTab = tab);
    if (tab == SettingsTab.privacy && _privacy == null) {
      await _loadPrivacy();
    }
  }

  void _updateField(String key, String value) {
    setState(() {
      _values = <String, String>{..._values, key: value};
      _fieldErrors.remove(key);
    });
  }

  void _updateSwitch(String key, bool value) {
    setState(() {
      _values = <String, String>{..._values, key: value ? 'true' : 'false'};
    });
  }

  Future<void> _saveTab(SettingsTab tab) async {
    final access = adminAccessFor(ref.read(sessionProvider).user);
    final keys = settingsTabKeys[tab] ?? const <String>[];
    bool canWriteKey(String key) =>
        access.canEditInstitutionSettings || isMaintenanceSettingKey(key);
    final errors = <String, String?>{};
    for (final key in keys.where(canWriteKey)) {
      final field = settingFieldsByKey[key];
      if (field == null) continue;
      final value = _controllers[key]?.text ?? _values[key] ?? '';
      final error = validateSettingInput(field, value);
      if (error != null) errors[key] = error;
    }
    if (errors.isNotEmpty) {
      setState(() => _fieldErrors.addAll(errors));
      return;
    }
    final dirty = unsavedKeysInTab(
      tab,
      _values,
      _saved,
    ).where(canWriteKey).toList(growable: false);
    if (dirty.isEmpty) {
      CampusToast.showIn(context, 'No changes to save on this tab.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final api = ref.read(settingsApiProvider);
    final nextSaved = Map<String, String>.from(_saved);
    try {
      for (final key in dirty) {
        final field = settingFieldsByKey[key];
        final raw = _controllers[key]?.text ?? _values[key] ?? '';
        final value = field == null
            ? raw.trim()
            : normalizedSettingValue(field, raw);
        await api.setSetting(key, value);
        nextSaved[key] = value;
        _values[key] = value;
        _controllers[key]?.text = value;
      }
      if (!mounted) return;
      setState(() {
        _saved = nextSaved;
        _saving = false;
      });
      CampusToast.showIn(
        context,
        '${tab.label} settings saved.',
        tone: CampusToastTone.success,
      );
      if (tab == SettingsTab.ai) unawaited(_loadCapabilities());
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Could not save settings: $error';
      });
    }
  }

  Future<void> _saveAiKey() async {
    final error = validateAiApiKey(_aiKey.text);
    if (error != null) {
      setState(() => _aiKeyError = error);
      return;
    }
    if (_aiKey.text.trim().isEmpty) {
      setState(() => _aiKeyError = 'Enter a key or use Clear stored key.');
      return;
    }
    setState(() {
      _aiKeySaving = true;
      _aiKeyError = null;
    });
    try {
      await ref
          .read(settingsApiProvider)
          .setSetting('ai_api_key', _aiKey.text.trim());
      if (!mounted) return;
      _aiKey.clear();
      setState(() => _aiKeySaving = false);
      await _loadCapabilities();
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'AI API key sealed on the server.',
        tone: CampusToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _aiKeySaving = false;
        _aiKeyError = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  Future<void> _clearAiKey() async {
    setState(() {
      _aiKeySaving = true;
      _aiKeyError = null;
    });
    try {
      await ref.read(settingsApiProvider).setSetting('ai_api_key', '');
      if (!mounted) return;
      setState(() => _aiKeySaving = false);
      await _loadCapabilities();
      if (!mounted) return;
      CampusToast.showIn(context, 'Stored AI API key cleared.');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _aiKeySaving = false;
        _aiKeyError = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).user;
    final access = adminAccessFor(user);
    final tabs = adminSettingsTabsFor(user);
    final activeTab = tabs.contains(_selectedTab)
        ? _selectedTab!
        : (tabs.isEmpty ? defaultSettingsTab : tabs.first);

    return AdminScaffold(
      title: 'Institution settings',
      subtitle: 'Campus configuration and AI availability',
      section: AdminSection.settings,
      actions: <Widget>[
        IconButton(
          tooltip: 'Reload settings',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: _loading
          ? const AdminLoading(label: 'Loading institution settings…')
          : _error != null && _saved.isEmpty
          ? AdminErrorState(message: _error!, onRetry: _load)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                if (access.settingsReadOnly) ...<Widget>[
                  const AdminInfoBanner(
                    icon: Icons.visibility_outlined,
                    message:
                        'Read-only: your account can view institution settings '
                        'but cannot change them. Only institution-scope super '
                        'admins (and IT coordinators for maintenance controls) '
                        'may write.',
                  ),
                  const SizedBox(height: 12),
                ],
                if (!access.canEditInstitutionSettings &&
                    access.canWriteMaintenance) ...<Widget>[
                  const AdminInfoBanner(
                    icon: Icons.build_outlined,
                    message:
                        'IT Operations may change only the maintenance trio in '
                        'the System tab. Academic, account, and AI settings '
                        'stay with institution administrators.',
                  ),
                  const SizedBox(height: 12),
                ],
                if (access.canOpen(AdminSection.serverStatus) ||
                    access.canOpen(AdminSection.systemReports)) ...<Widget>[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      if (access.canOpen(AdminSection.serverStatus))
                        OutlinedButton.icon(
                          onPressed: () =>
                              context.go(AdminSection.serverStatus.route),
                          icon: const Icon(
                            Icons.monitor_heart_outlined,
                            size: 16,
                          ),
                          label: const Text('Server status'),
                        ),
                      if (access.canOpen(AdminSection.systemReports))
                        OutlinedButton.icon(
                          onPressed: () =>
                              context.go(AdminSection.systemReports.route),
                          icon: const Icon(
                            Icons.report_gmailerrorred_outlined,
                            size: 16,
                          ),
                          label: const Text('System reports'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                if (_error != null) ...<Widget>[
                  AdminInfoBanner(
                    icon: Icons.error_outline,
                    message: _error!,
                    tone: AdminInfoTone.error,
                  ),
                  const SizedBox(height: 12),
                ],
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    for (final tab in tabs)
                      AdminFilterChip(
                        label:
                            '${tab.label}'
                            '${isTabDirty(tab, _values, _saved) ? ' •' : ''}',
                        selected: activeTab == tab,
                        onSelected: () => _selectTab(tab),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                _buildTab(context, activeTab, access),
              ],
            ),
    );
  }

  Widget _buildTab(BuildContext context, SettingsTab tab, AdminAccess access) {
    if (tab == SettingsTab.privacy) return _buildPrivacy(context);
    final switches = settingSwitches
        .where((setting) => setting.tab == tab)
        .toList(growable: false);
    final fields = settingFields
        .where((field) => field.tab == tab)
        .toList(growable: false);
    final canWrite = access.canWriteSettingsTab(tab);
    final dirty = isTabDirty(tab, _values, _saved);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final setting in switches)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: CampusCard(
              padding: EdgeInsets.zero,
              child: SwitchListTile.adaptive(
                value: (_values[setting.key] ?? 'false') == 'true',
                title: Text(setting.label),
                subtitle: Text(setting.caption),
                onChanged: canWrite
                    ? (value) => _updateSwitch(setting.key, value)
                    : null,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 4,
                ),
              ),
            ),
          ),
        if (switches.isNotEmpty && fields.isNotEmpty) const SizedBox(height: 4),
        for (final field in fields) ...<Widget>[
          Builder(
            builder: (context) {
              final writable =
                  canWrite &&
                  (access.canEditInstitutionSettings ||
                      isMaintenanceSettingKey(field.key));
              return CampusTextField(
                controller: _controllerFor(field.key),
                label: field.label,
                hint: field.placeholder,
                helperText: writable
                    ? field.caption
                    : '${field.caption} Only institution administrators can '
                          'change this field.',
                errorText: _fieldErrors[field.key],
                enabled: writable && !_saving,
                keyboardType: field.type == SettingFieldType.number
                    ? TextInputType.number
                    : TextInputType.text,
                maxLines: field.type == SettingFieldType.textarea ? 3 : 1,
                onChanged: (value) {
                  if (writable) _updateField(field.key, value);
                },
              );
            },
          ),
          const SizedBox(height: 14),
        ],
        if (tab == SettingsTab.ai) _buildAiKeyBlock(context),
        if (tab == SettingsTab.system) _buildMaintenancePreview(context),
        if (canWrite) ...<Widget>[
          const SizedBox(height: 4),
          if (dirty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'You have unsaved changes on this tab.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: PupTheme.of(context).maroon,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          CampusButton(
            label: _saving ? 'Saving…' : 'Save ${tab.label}',
            icon: Icons.save_outlined,
            loading: _saving,
            onPressed: _saving || !dirty ? null : () => _saveTab(tab),
          ),
        ],
      ],
    );
  }

  Widget _buildAiKeyBlock(BuildContext context) {
    final tokens = PupTheme.of(context);
    final capabilities = _capabilities;
    final status = describeAssistantStatus(
      values: _values,
      saved: _saved,
      capabilities: capabilities,
      capabilitiesLoading: capabilities == null,
    );
    final canWrite = adminAccessFor(
      ref.watch(sessionProvider).user,
    ).canEditInstitutionSettings;

    return CampusCard(
      color: tokens.campus,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const AdminSectionLabel('Provider API key'),
          const SizedBox(height: 6),
          Text(
            'The key is sealed on the server and never rendered again. Saving '
            'a new key replaces the stored value; Clear removes it.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Icon(
                status.tone == AssistantStatusTone.ready
                    ? Icons.check_circle_outline
                    : status.tone == AssistantStatusTone.warning
                    ? Icons.warning_amber_outlined
                    : Icons.hourglass_empty,
                size: 16,
                color: status.tone == AssistantStatusTone.ready
                    ? tokens.maroon
                    : tokens.muted,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  status.message,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (capabilities != null && capabilities.model != null) ...<Widget>[
            const SizedBox(height: 4),
            Text(
              'Model: ${capabilities.model}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
          const SizedBox(height: 10),
          CampusTextField(
            controller: _aiKey,
            label: 'New API key',
            hint: 'Never displayed after saving',
            obscure: true,
            errorText: _aiKeyError,
            enabled: canWrite && !_aiKeySaving,
            onChanged: (_) {
              if (_aiKeyError != null) setState(() => _aiKeyError = null);
            },
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Expanded(
                child: CampusButton(
                  label: _aiKeySaving ? 'Saving…' : 'Save key',
                  icon: Icons.lock_outline,
                  loading: _aiKeySaving,
                  onPressed: canWrite && !_aiKeySaving ? _saveAiKey : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CampusButton(
                  label: 'Clear key',
                  icon: Icons.delete_outline,
                  variant: CampusButtonVariant.outline,
                  onPressed: canWrite && !_aiKeySaving ? _clearAiKey : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMaintenancePreview(BuildContext context) {
    final trio = maintenanceTrioFrom(_values);
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 12),
      child: CampusCard(
        color: trio.enabled
            ? tokens.gold.withValues(alpha: 0.16)
            : tokens.campus,
        borderColor: trio.enabled ? tokens.gold : tokens.borderSubtle,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const AdminSectionLabel('Maintenance preview'),
            const SizedBox(height: 6),
            AdminStatusChip(
              label: trio.enabled ? 'Maintenance is ON' : 'Maintenance is off',
              active: trio.enabled,
            ),
            const SizedBox(height: 8),
            Text(
              trio.announcementCopy,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(height: 1.4),
            ),
            if (trio.until != null) ...<Widget>[
              const SizedBox(height: 4),
              Text(
                'Estimated resumption: ${trio.until} (display only).',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
            if (trio.untilError != null) ...<Widget>[
              const SizedBox(height: 4),
              Text(
                trio.untilError!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.maroon,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPrivacy(BuildContext context) {
    final tokens = PupTheme.of(context);
    if (_privacyLoading) {
      return const AdminLoading(label: 'Loading privacy snapshot…');
    }
    final snapshot = _privacy;
    if (snapshot == null) {
      return Column(
        children: <Widget>[
          const AdminInfoBanner(
            message:
                'Read-only RA 10173 transparency report. Reload to fetch the '
                'current consent and shredding snapshot.',
          ),
          const SizedBox(height: 10),
          CampusButton(
            label: 'Load privacy snapshot',
            icon: Icons.refresh,
            onPressed: _loadPrivacy,
          ),
        ],
      );
    }
    final consent = snapshot.consent;
    final coverage = privacyConsentPercent(snapshot);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const AdminSectionLabel('Telemetry retention'),
              const SizedBox(height: 6),
              Text(
                '${snapshot.retentionDays} days',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                'Coordinates, accuracy, and risk signals older than this are '
                'shredded nightly. Decisional metadata stays with the '
                'attendance record.',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        AdminStatGrid(
          children: <Widget>[
            AdminStatTile(
              label: 'Consent coverage',
              value: coverage == null ? '—' : '$coverage%',
              caption: '${consent.covered} of ${consent.totalActive} active',
            ),
            AdminStatTile(
              label: 'Last shred',
              value: snapshot.ephemeral.lastRunAt == null
                  ? 'No run yet'
                  : snapshot.ephemeral.lastRunAt!,
              caption:
                  '${snapshot.ephemeral.recordsShredded ?? 0} records · '
                  '${snapshot.ephemeral.attemptsShredded ?? 0} attempts',
            ),
          ],
        ),
        const SizedBox(height: 14),
        const AdminSectionLabel('Data inventory'),
        const SizedBox(height: 6),
        for (final row
            in snapshot.dataInventory.isEmpty
                ? privacyDataInventory
                : snapshot.dataInventory)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: CampusCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    row.data,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    row.purpose,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${row.lawfulBasis} · ${row.lifetime}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.muted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ),
        Text(
          'Breaches on record: ${snapshot.breaches.length}',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }
}
