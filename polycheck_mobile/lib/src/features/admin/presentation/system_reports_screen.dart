import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/system_report.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/calendar_utils.dart';
import '../../../core/widgets/campus_bottom_sheet.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../../../core/widgets/campus_text_field.dart';
import '../../../core/widgets/campus_toast.dart';
import '../domain/admin_access.dart';
import '../domain/server_metrics.dart';
import '../domain/system_reports.dart';
import 'widgets/admin_common.dart';

class SystemReportsScreen extends ConsumerStatefulWidget {
  const SystemReportsScreen({super.key});

  @override
  ConsumerState<SystemReportsScreen> createState() =>
      _SystemReportsScreenState();
}

class _SystemReportsScreenState extends ConsumerState<SystemReportsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  SystemReportStats? _stats;
  SystemReportPage? _page;
  SystemReportFilterState _filters = const SystemReportFilterState();
  int _rangeDays = 30;
  bool _loading = true;
  String? _error;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    final range = getRecentCampusDateRange(_rangeDays);
    final filters = buildSystemReportFilters(
      _filters.copyWith(startDate: range.startDate, endDate: range.endDate),
    );
    try {
      final api = ref.read(reportsApiProvider);
      final stats = await api.getSystemReportStats();
      final page = await api.getSystemReports(filters);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _stats = stats;
        _page = page;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() {
        _filters = _filters.copyWith(search: value, offset: 0);
      });
      _load();
    });
  }

  void _setFilter(SystemReportFilterState next) {
    setState(() => _filters = next.copyWith(offset: 0));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).user;
    final readOnly = systemReportReadOnly(user);
    final metrics = _stats == null ? null : metricsFromStats(_stats!);
    final page = _page;

    return AdminScaffold(
      title: 'System reports',
      subtitle: 'Issue triage and feedback follow-up',
      section: AdminSection.systemReports,
      actions: <Widget>[
        IconButton(
          tooltip: 'Refresh reports',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          if (readOnly) ...<Widget>[
            const AdminInfoBanner(
              icon: Icons.visibility_outlined,
              message:
                  'Read-only: department oversight can review reported issues '
                  'but only IT Operations can change triage status.',
            ),
            const SizedBox(height: 12),
          ],
          if (metrics != null)
            AdminStatGrid(
              children: <Widget>[
                AdminStatTile(
                  label: 'Unresolved',
                  value: '${metrics.unresolved}',
                  caption: 'Open + in review',
                  icon: Icons.pending_actions_outlined,
                ),
                AdminStatTile(
                  label: 'Scanner / GPS',
                  value: '${metrics.scannerAndGps}',
                  caption: 'Field reports',
                  icon: Icons.qr_code_scanner,
                ),
                AdminStatTile(
                  label: 'Resolved this month',
                  value: '${metrics.resolvedThisMonth}',
                  caption: 'Closed outcomes',
                  icon: Icons.task_alt,
                ),
                AdminStatTile(
                  label: 'Critical',
                  value: '${metrics.critical}',
                  caption: 'Highest severity',
                  icon: Icons.priority_high,
                ),
                AdminStatTile(
                  label: 'Total',
                  value: '${metrics.total}',
                  caption: 'All time',
                  icon: Icons.report_outlined,
                ),
              ],
            ),
          const SizedBox(height: 14),
          CampusTextField(
            controller: _search,
            label: 'Search reports',
            hint: 'Title, description, or submitter',
            prefixIcon: Icons.search,
            onChanged: _onSearchChanged,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              AdminFilterChip(
                label: 'All statuses',
                selected: _filters.status == null,
                onSelected: () =>
                    _setFilter(_filters.copyWith(clearStatus: true)),
              ),
              for (final status in ReportStatus.values)
                AdminFilterChip(
                  label: reportStatusLabels[status] ?? status.wire,
                  selected: _filters.status == status,
                  onSelected: () =>
                      _setFilter(_filters.copyWith(status: status)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              DropdownButton<ReportCategory?>(
                value: _filters.category,
                hint: const Text('Category'),
                underline: const SizedBox.shrink(),
                items: <DropdownMenuItem<ReportCategory?>>[
                  const DropdownMenuItem<ReportCategory?>(
                    child: Text('All categories'),
                  ),
                  for (final category in ReportCategory.values)
                    DropdownMenuItem<ReportCategory?>(
                      value: category,
                      child: Text(
                        reportCategoryLabels[category] ?? category.wire,
                      ),
                    ),
                ],
                onChanged: (value) => _setFilter(
                  value == null
                      ? _filters.copyWith(clearCategory: true)
                      : _filters.copyWith(category: value),
                ),
              ),
              DropdownButton<ReportSeverity?>(
                value: _filters.severity,
                hint: const Text('Severity'),
                underline: const SizedBox.shrink(),
                items: <DropdownMenuItem<ReportSeverity?>>[
                  const DropdownMenuItem<ReportSeverity?>(
                    child: Text('All severities'),
                  ),
                  for (final severity in ReportSeverity.values)
                    DropdownMenuItem<ReportSeverity?>(
                      value: severity,
                      child: Text(
                        reportSeverityLabels[severity] ?? severity.wire,
                      ),
                    ),
                ],
                onChanged: (value) => _setFilter(
                  value == null
                      ? _filters.copyWith(clearSeverity: true)
                      : _filters.copyWith(severity: value),
                ),
              ),
              DropdownButton<String?>(
                value: _filters.role,
                hint: const Text('Submitter role'),
                underline: const SizedBox.shrink(),
                items: const <DropdownMenuItem<String?>>[
                  DropdownMenuItem<String?>(child: Text('All roles')),
                  DropdownMenuItem<String?>(
                    value: 'student',
                    child: Text('Students'),
                  ),
                  DropdownMenuItem<String?>(
                    value: 'teacher',
                    child: Text('Teachers'),
                  ),
                ],
                onChanged: (value) => _setFilter(
                  value == null
                      ? _filters.copyWith(clearRole: true)
                      : _filters.copyWith(role: value),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: <Widget>[
              for (final days in const <int>[7, 30, 90])
                AdminFilterChip(
                  label: 'Last $days days',
                  selected: _rangeDays == days,
                  onSelected: () {
                    setState(() {
                      _rangeDays = days;
                      _filters = _filters.copyWith(offset: 0);
                    });
                    _load();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: AdminLoading(label: 'Loading reports…'),
            )
          else if (_error != null)
            AdminErrorState(message: _error!, onRetry: _load)
          else if (page == null || page.data.isEmpty)
            const CampusEmptyState(
              icon: Icons.report_gmailerrorred_outlined,
              title: 'No reports match',
              message: 'Adjust the filters or widen the date range.',
            )
          else ...<Widget>[
            for (final report in page.data)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ReportCard(
                  report: report,
                  onTap: () => showCampusBottomSheet<void>(
                    context,
                    title: 'Report detail',
                    child: ReportDetailSheet(
                      reportId: report.id,
                      readOnly: readOnly,
                      onChanged: _load,
                    ),
                  ),
                ),
              ),
            Row(
              children: <Widget>[
                OutlinedButton(
                  onPressed: page.offset > 0 && !_loading
                      ? () {
                          setState(() {
                            _filters = _filters.copyWith(
                              offset: (page.offset - systemReportPageSize)
                                  .clamp(0, page.total),
                            );
                          });
                          _load();
                        }
                      : null,
                  child: const Text('Previous'),
                ),
                const SizedBox(width: 8),
                Text(
                  '${page.data.length} of ${page.total}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: page.hasMore && !_loading
                      ? () {
                          setState(() {
                            _filters = _filters.copyWith(
                              offset: page.offset + systemReportPageSize,
                            );
                          });
                          _load();
                        }
                      : null,
                  child: const Text('Next'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report, required this.onTap});

  final SystemReport report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final critical = report.severity == ReportSeverity.critical;
    return CampusCard(
      onTap: onTap,
      borderColor: critical ? tokens.maroon : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(
                critical
                    ? Icons.priority_high
                    : Icons.report_gmailerrorred_outlined,
                size: 18,
                color: critical ? tokens.maroon : tokens.muted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  report.title.isEmpty ? 'Untitled report' : report.title,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AdminStatusChip(
                label: reportStatusLabels[report.status] ?? report.status.wire,
                active: report.status == ReportStatus.resolved,
                positive: report.status != ReportStatus.dismissed,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: <Widget>[
              AdminStatusChip(
                label:
                    reportCategoryLabels[report.category] ??
                    report.category.wire,
                active: false,
                positive: false,
              ),
              AdminStatusChip(
                label:
                    reportSeverityLabels[report.severity] ??
                    report.severity.wire,
                active: critical,
                positive: true,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            reportSubmitterLabel(report),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          Text(
            formatDateTimeLabel(report.createdAt),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class ReportDetailSheet extends ConsumerStatefulWidget {
  const ReportDetailSheet({
    super.key,
    required this.reportId,
    required this.readOnly,
    required this.onChanged,
  });

  final String reportId;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  ConsumerState<ReportDetailSheet> createState() => _ReportDetailSheetState();
}

class _ReportDetailSheetState extends ConsumerState<ReportDetailSheet> {
  final _notes = TextEditingController();
  SystemReport? _report;
  Uint8List? _screenshot;
  bool _loading = true;
  bool _saving = false;
  bool _screenshotLoading = false;
  String? _error;
  ReportStatus? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final report = await ref
          .read(reportsApiProvider)
          .getSystemReport(widget.reportId);
      if (!mounted) return;
      setState(() {
        _report = report;
        _status = report.status;
        _notes.text = report.adminNotes ?? '';
        _loading = false;
      });
      await _loadScreenshot(report);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  Future<void> _loadScreenshot(SystemReport report) async {
    final url = report.screenshotUrl;
    if (url == null || url.trim().isEmpty) return;
    setState(() => _screenshotLoading = true);
    try {
      final bytes = await ref
          .read(reportsApiProvider)
          .getReportScreenshot(report.id);
      if (!mounted) return;
      setState(() {
        _screenshot = bytes;
        _screenshotLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _screenshotLoading = false);
    }
  }

  Future<void> _save() async {
    final status = _status;
    final report = _report;
    if (status == null || report == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await ref
          .read(reportsApiProvider)
          .updateSystemReportStatus(
            report.id,
            UpdateSystemReportStatusInput(
              status: status,
              adminNotes: _notes.text.trim().isEmpty
                  ? null
                  : _notes.text.trim(),
            ),
          );
      if (!mounted) return;
      setState(() {
        _report = updated;
        _saving = false;
      });
      widget.onChanged();
      CampusToast.showIn(
        context,
        'Report triage saved.',
        tone: CampusToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    if (_loading) {
      return const AdminLoading(label: 'Loading report…');
    }
    final report = _report;
    if (report == null) {
      return AdminErrorState(
        message: _error ?? 'Report unavailable.',
        onRetry: _load,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          report.title.isEmpty ? 'Untitled report' : report.title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: <Widget>[
            AdminStatusChip(
              label:
                  reportCategoryLabels[report.category] ?? report.category.wire,
              active: false,
              positive: false,
            ),
            AdminStatusChip(
              label:
                  reportSeverityLabels[report.severity] ?? report.severity.wire,
              active: report.severity == ReportSeverity.critical,
              positive: true,
            ),
            AdminStatusChip(
              label: reportStatusLabels[report.status] ?? report.status.wire,
              active: report.status == ReportStatus.resolved,
              positive: report.status != ReportStatus.dismissed,
            ),
          ],
        ),
        const SizedBox(height: 12),
        const AdminSectionLabel('Description'),
        const SizedBox(height: 4),
        Text(
          report.description.isEmpty
              ? 'No description provided.'
              : report.description,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.45),
        ),
        const SizedBox(height: 14),
        const AdminSectionLabel('Diagnostics'),
        const SizedBox(height: 6),
        for (final row in reportTelemetryRows(report))
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SizedBox(
                  width: 104,
                  child: Text(
                    row.label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    row.value,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        if (report.screenshotUrl != null) ...<Widget>[
          const SizedBox(height: 10),
          if (_screenshotLoading)
            const AdminLoading(label: 'Streaming screenshot…', compact: true)
          else if (_screenshot != null)
            ClipRect(
              child: Image.memory(
                _screenshot!,
                fit: BoxFit.contain,
                height: 220,
                errorBuilder: (context, error, stackTrace) => Text(
                  'Screenshot could not be decoded.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            )
          else
            Text(
              'Screenshot unavailable.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
        ],
        const SizedBox(height: 14),
        const AdminSectionLabel('Triage'),
        const SizedBox(height: 6),
        if (_error != null) ...<Widget>[
          AdminInfoBanner(
            message: _error!,
            tone: AdminInfoTone.error,
            icon: Icons.error_outline,
          ),
          const SizedBox(height: 8),
        ],
        DropdownButtonFormField<ReportStatus>(
          initialValue: _status ?? report.status,
          decoration: const InputDecoration(labelText: 'Status'),
          items: <DropdownMenuItem<ReportStatus>>[
            for (final status in ReportStatus.values)
              DropdownMenuItem<ReportStatus>(
                value: status,
                child: Text(reportStatusLabels[status] ?? status.wire),
              ),
          ],
          onChanged: widget.readOnly
              ? null
              : (value) => setState(() => _status = value),
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _notes,
          label: 'Admin notes',
          maxLines: 3,
          enabled: !widget.readOnly && !_saving,
          helperText: _notes.text.trim().isEmpty
              ? 'Visible to the submitter when the report is resolved.'
              : 'Notes appear on the submitter’s “My reports” panel.',
          onChanged: (_) => setState(() {}),
        ),
        if (!widget.readOnly) ...<Widget>[
          const SizedBox(height: 14),
          CampusButton(
            label: _saving ? 'Saving…' : 'Save triage',
            icon: Icons.save_outlined,
            loading: _saving,
            onPressed: _saving ? null : _save,
          ),
        ],
      ],
    );
  }
}
