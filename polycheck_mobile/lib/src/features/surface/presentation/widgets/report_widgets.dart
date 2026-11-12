import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/models/system_report.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/theme/pup_tokens.dart';
import '../../../../core/utils/image_compression.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_loading.dart';
import '../../../../core/widgets/campus_text_field.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../data/profile_validation.dart';

const int _maxScreenshotBytes = 5000000;

/// Reusable report entry point for any screen (`Report an issue`).
class ReportIssueButton extends ConsumerWidget {
  const ReportIssueButton({
    super.key,
    this.label = 'Report an issue',
    this.variant = CampusButtonVariant.outline,
    this.onSubmitted,
    this.expand = false,
  });

  final String label;
  final CampusButtonVariant variant;
  final VoidCallback? onSubmitted;
  final bool expand;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CampusButton(
      label: label,
      icon: Icons.flag_outlined,
      variant: variant,
      expand: expand,
      onPressed: () => openReportIssueDialog(
        context,
        route: _currentRoute(context),
        onSubmitted: onSubmitted,
      ),
    );
  }

  static String _currentRoute(BuildContext context) {
    try {
      return GoRouterState.of(context).uri.toString();
    } catch (_) {
      return '/profile';
    }
  }
}

Future<void> openReportIssueDialog(
  BuildContext context, {
  String? route,
  VoidCallback? onSubmitted,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) =>
        ReportIssueDialog(route: route ?? '/profile', onSubmitted: onSubmitted),
  );
}

/// Accessible issue intake (category/severity/title/description + optional
/// screenshot + automatically attached diagnostics).
class ReportIssueDialog extends ConsumerStatefulWidget {
  const ReportIssueDialog({super.key, required this.route, this.onSubmitted});

  final String route;
  final VoidCallback? onSubmitted;

  @override
  ConsumerState<ReportIssueDialog> createState() => _ReportIssueDialogState();
}

class _ReportIssueDialogState extends ConsumerState<ReportIssueDialog> {
  final TextEditingController _title = TextEditingController();
  final TextEditingController _description = TextEditingController();
  ReportCategory _category = ReportCategory.scannerCamera;
  ReportSeverity _severity = ReportSeverity.medium;
  Uint8List? _screenshot;
  String? _screenshotLabel;
  bool _submitting = false;
  bool _attaching = false;
  String? _error;

  bool get _valid =>
      validateReportTitle(_title.text) == null &&
      validateReportDescription(_description.text) == null;

  @override
  void initState() {
    super.initState();
    _title.addListener(_rebuild);
    _description.addListener(_rebuild);
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _title.removeListener(_rebuild);
    _description.removeListener(_rebuild);
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _attachImage() async {
    if (_attaching) return;
    setState(() {
      _attaching = true;
      _error = null;
    });
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 82,
      );
      if (picked == null) {
        if (mounted) setState(() => _attaching = false);
        return;
      }
      var bytes = await picked.readAsBytes();
      if (bytes.length > _maxScreenshotBytes) {
        bytes = await compressImageBytes(bytes, quality: 55, minWidth: 1080);
      }
      if (bytes.length > _maxScreenshotBytes) {
        if (!mounted) return;
        setState(() {
          _attaching = false;
          _error = 'Screenshots must be 5 MB or smaller.';
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _screenshot = bytes;
        _screenshotLabel = picked.name;
        _attaching = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _attaching = false;
        _error = 'The selected image could not be read.';
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final titleError = validateReportTitle(_title.text);
    final descriptionError = validateReportDescription(_description.text);
    if (titleError != null || descriptionError != null) {
      setState(() => _error = titleError ?? descriptionError);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final screenshot = _screenshot;
      await ref
          .read(reportsApiProvider)
          .createSystemReport(
            CreateSystemReportInput(
              category: _category,
              severity: _severity,
              title: _title.text.trim(),
              description: _description.text.trim(),
              screenshotData: screenshot == null
                  ? null
                  : 'data:image/jpeg;base64,${base64Encode(screenshot)}',
              deviceInfo: buildSurfaceDeviceLabel(),
              appVersion: buildSurfaceAppVersion(),
              route: widget.route,
              networkType: surfaceNetworkType,
            ),
          );
      if (!mounted) return;
      widget.onSubmitted?.call();
      Navigator.of(context).pop();
      CampusToast.showIn(
        context,
        'Report submitted. Track the status under Profile \u00b7 My reports.',
        tone: CampusToastTone.success,
        duration: const Duration(seconds: 4),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Unable to submit the report. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final titleError = _title.text.isEmpty
        ? null
        : validateReportTitle(_title.text);
    final descriptionError = _description.text.isEmpty
        ? null
        : validateReportDescription(_description.text);

    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      backgroundColor: tokens.surface,
      title: Text(
        'Report an issue',
        style: Theme.of(
          context,
        ).textTheme.titleLarge?.copyWith(color: tokens.onSurface),
      ),
      content: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 520,
          maxHeight: MediaQuery.sizeOf(context).height * 0.68,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Tell us what went wrong or share feedback. Diagnostics '
                '(device, app version, screen, and connection) are attached '
                'automatically.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.muted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              _SectionLabel('CATEGORY'),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final category in reportCategories)
                    _ChoicePill(
                      label: reportCategoryLabels[category] ?? category.wire,
                      selected: _category == category,
                      onTap: () => setState(() => _category = category),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                reportCategoryHints[_category] ?? '',
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: tokens.muted),
              ),
              const SizedBox(height: 14),
              _SectionLabel('SEVERITY'),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final severity in reportSeverities)
                    _ChoicePill(
                      label: reportSeverityLabels[severity] ?? severity.wire,
                      selected: _severity == severity,
                      onTap: () => setState(() => _severity = severity),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              CampusTextField(
                controller: _title,
                label: 'Title',
                hint: '5-120 characters summarizing the issue',
                errorText: titleError,
              ),
              const SizedBox(height: 10),
              CampusTextField(
                controller: _description,
                label: 'Description',
                hint: 'What happened? Steps to reproduce help a lot.',
                maxLines: 5,
                minLines: 3,
                errorText: descriptionError,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: CampusButton(
                      label: _screenshot == null
                          ? 'Attach screenshot'
                          : 'Replace screenshot',
                      icon: Icons.image_outlined,
                      variant: CampusButtonVariant.outline,
                      loading: _attaching,
                      onPressed: _attaching
                          ? null
                          : () => unawaited(_attachImage()),
                    ),
                  ),
                  if (_screenshot != null) ...[
                    const SizedBox(width: 8),
                    ClipRect(
                      child: Image.memory(
                        _screenshot!,
                        width: 46,
                        height: 46,
                        fit: BoxFit.cover,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Remove screenshot',
                      onPressed: () => setState(() {
                        _screenshot = null;
                        _screenshotLabel = null;
                      }),
                      icon: Icon(Icons.close, size: 16, color: tokens.muted),
                    ),
                  ],
                ],
              ),
              if (_screenshotLabel != null)
                Text(
                  _screenshotLabel!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
              const SizedBox(height: 8),
              Text(
                'Diagnostics: ${buildSurfaceDeviceLabel()} \u00b7 '
                '${buildSurfaceAppVersion()} \u00b7 ${widget.route}',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  height: 1.35,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Semantics(
                  liveRegion: true,
                  child: Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: tokens.campus,
                      border: Border.all(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                      ),
                    ),
                    child: Text(
                      _error!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        CampusButton(
          label: 'Submit report',
          icon: Icons.send_outlined,
          expand: false,
          height: 42,
          loading: _submitting,
          onPressed: _valid && !_submitting ? () => unawaited(_submit()) : null,
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: tokens.muted,
        fontWeight: FontWeight.w700,
        letterSpacing: 1,
      ),
    );
  }
}

class _ChoicePill extends StatelessWidget {
  const _ChoicePill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? tokens.maroon : tokens.surface,
            border: Border.all(
              color: selected ? tokens.maroon : tokens.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: selected ? Colors.white : tokens.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

/// Submitter's own report stream.
class MyReportsPanel extends ConsumerStatefulWidget {
  const MyReportsPanel({super.key, this.reloadToken = 0});

  final int reloadToken;

  @override
  ConsumerState<MyReportsPanel> createState() => _MyReportsPanelState();
}

class _MyReportsPanelState extends ConsumerState<MyReportsPanel> {
  List<SystemReport> _reports = const <SystemReport>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(MyReportsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadToken != widget.reloadToken) {
      unawaited(_load());
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final reports = await ref.read(reportsApiProvider).getMySystemReports();
      if (!mounted) return;
      setState(() {
        _reports = reports;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Unable to load your reports.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: CampusLoading(label: 'Loading your reports.'),
      );
    }
    if (_error != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _error!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
          ),
          const SizedBox(height: 8),
          CampusButton(
            label: 'Try again',
            variant: CampusButtonVariant.outline,
            expand: false,
            icon: Icons.refresh,
            onPressed: () => unawaited(_load()),
          ),
        ],
      );
    }
    if (_reports.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Column(
          children: [
            Icon(
              Icons.flag_outlined,
              size: 32,
              color: tokens.muted.withValues(alpha: 0.6),
            ),
            const SizedBox(height: 8),
            Text(
              'No reports yet. Use "Report an issue" to file the first one.',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final report in _reports)
          _MyReportCard(report: report, tokens: tokens),
      ],
    );
  }
}

class _MyReportCard extends StatelessWidget {
  const _MyReportCard({required this.report, required this.tokens});

  final SystemReport report;
  final PupTokens tokens;

  @override
  Widget build(BuildContext context) {
    final tone = reportStatusTone(report.status, isDark: tokens.isDark);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: tone.background,
                  border: Border.all(color: tone.border),
                ),
                child: Text(
                  (reportStatusLabels[report.status] ?? report.status.wire)
                      .toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tone.foreground,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Text(
                (reportCategoryLabels[report.category] ?? report.category.wire)
                    .toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                formatReportDate(report.createdAt),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontSize: 9,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            report.title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (report.description.trim().isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              report.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.muted,
                height: 1.35,
              ),
            ),
          ],
          if (report.adminNotes != null &&
              report.adminNotes!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: tokens.campus,
                border: Border.all(color: tokens.borderSubtle),
              ),
              child: Text(
                'Admin note: ${report.adminNotes}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.onSurface,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String formatReportDate(String createdAt) {
  final date = DateTime.tryParse(createdAt)?.toLocal();
  if (date == null) return '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}';
}
