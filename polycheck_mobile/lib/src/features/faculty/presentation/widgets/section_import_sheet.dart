import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/polycheck_core.dart';
import '../../data/section_import.dart';
import 'faculty_shell.dart';

enum _ImportStep { input, map, review, report }

/// Paste-first enrollment import sheet (Android BM6 parity).
///
/// Steps: paste CSV → confirm column mapping → server validation → execute
/// (checksum-bound) → report. Nothing is committed until the validated
/// checksum is returned to the server.
class SectionImportSheet extends ConsumerStatefulWidget {
  const SectionImportSheet({
    super.key,
    required this.sectionId,
    required this.sectionLabel,
    this.onCompleted,
  });

  final String sectionId;
  final String sectionLabel;
  final VoidCallback? onCompleted;

  @override
  ConsumerState<SectionImportSheet> createState() => _SectionImportSheetState();
}

class _SectionImportSheetState extends ConsumerState<SectionImportSheet> {
  final TextEditingController _text = TextEditingController();
  _ImportStep _step = _ImportStep.input;
  ParsedCsv? _parsed;
  ImportColumnMapping _mapping = const ImportColumnMapping();
  EnrollImportResult? _validation;
  EnrollImportResult? _result;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pasteClipboard() async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text ?? '';
      if (text.trim().isEmpty) {
        setState(() => _error = 'The clipboard has no text to paste.');
        return;
      }
      setState(() {
        _text.text = text;
        _error = null;
      });
    } catch (_) {
      setState(
        () => _error = 'Clipboard unavailable — paste the list manually.',
      );
    }
  }

  void _parseInput() {
    final parsed = parseImportCsv(_text.text);
    if (parsed.isEmpty) {
      setState(
        () => _error = 'Paste the master list first (include the header row).',
      );
      return;
    }
    if (parsed.rows.length > enrollImportMaxRows) {
      setState(
        () => _error =
            'This list has ${parsed.rows.length} rows. The limit is '
            '$enrollImportMaxRows per import.',
      );
      return;
    }
    setState(() {
      _parsed = parsed;
      _mapping = suggestImportMapping(parsed.headers);
      _step = _ImportStep.map;
      _error = null;
    });
  }

  Future<void> _validate() async {
    final parsed = _parsed;
    if (parsed == null) return;
    if (!_mapping.canImport) {
      setState(() => _error = 'Map the student number column first.');
      return;
    }
    final built = buildEnrollImportRows(parsed.rows, _mapping);
    if (built.rows.isEmpty) {
      setState(() {
        _error = 'No importable rows. Fix the blocking issues and paste again.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final validation = await ref
          .read(sectionsApiProvider)
          .previewEnrollImport(widget.sectionId, built.rows);
      if (!mounted) return;
      setState(() {
        _validation = validation;
        _step = _ImportStep.review;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Validation failed: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _execute() async {
    final parsed = _parsed;
    final validation = _validation;
    if (parsed == null || validation == null) return;
    final built = buildEnrollImportRows(parsed.rows, _mapping);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(sectionsApiProvider)
          .importSectionEnrollments(
            widget.sectionId,
            EnrollImportRequest(
              mode: ImportMode.execute,
              rows: built.rows,
              rowChecksum: validation.rowChecksum,
              idempotencyKey: const Uuid().v4(),
            ),
          );
      if (!mounted) return;
      setState(() {
        _result = result;
        _step = _ImportStep.report;
      });
      widget.onCompleted?.call();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Import failed: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return SafeArea(
      top: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Enrollment import',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        widget.sectionLabel,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: tokens.borderSubtle),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    switch (_step) {
                      _ImportStep.input =>
                        'Paste the master list from Sheets or Files as CSV '
                            '(header row included).',
                      _ImportStep.map =>
                        'Confirm how ${_parsed?.headers.length ?? 0} columns map '
                            'to Polycheck fields.',
                      _ImportStep.review =>
                        'Review the server validation summary before committing.',
                      _ImportStep.report => 'Import finished.',
                    },
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                  const SizedBox(height: 12),
                  if (_error != null) ...[
                    CampusCard(
                      borderColor: tokens.gold,
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  switch (_step) {
                    _ImportStep.input => _inputStep(context),
                    _ImportStep.map => _mapStep(context),
                    _ImportStep.review => _reviewStep(context),
                    _ImportStep.report => _reportStep(context),
                  },
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _inputStep(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampusTextField(
          controller: _text,
          label: 'CSV',
          hint:
              'Student No.,Name,Program,Year Level\n'
              '2024-00001-MN-0,Dela Cruz Juan,BSIT,1st Year',
          maxLines: 10,
          minLines: 8,
          onChanged: (_) => setState(() => _error = null),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _pasteClipboard,
                icon: const Icon(Icons.content_paste, size: 16),
                label: const Text('Paste from clipboard'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CampusButton(
                label: 'Continue',
                icon: Icons.arrow_forward,
                onPressed: _text.text.trim().isEmpty ? null : _parseInput,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'CSV only. Up to $enrollImportMaxRows rows. Excel files should be '
          'saved as CSV with the student-number column formatted as text.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }

  Widget _mapStep(BuildContext context) {
    final parsed = _parsed!;
    final tokens = PupTheme.of(context);
    final fields = <({String key, String label, bool required, int? value})>[
      (
        key: 'studentId',
        label: 'Student number',
        required: true,
        value: _mapping.studentId,
      ),
      (
        key: 'fullName',
        label: 'Student name (verification)',
        required: false,
        value: _mapping.fullName,
      ),
      (
        key: 'program',
        label: 'Program (verification)',
        required: false,
        value: _mapping.program,
      ),
      (
        key: 'yearLevel',
        label: 'Year level (verification)',
        required: false,
        value: _mapping.yearLevel,
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final field in fields)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${field.label}${field.required ? ' *' : ''}'.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                DropdownButtonFormField<int?>(
                  initialValue: field.value,
                  isExpanded: true,
                  decoration: const InputDecoration(isDense: true),
                  items: [
                    const DropdownMenuItem<int?>(
                      value: null,
                      child: Text('Not mapped'),
                    ),
                    for (
                      var index = 0;
                      index < parsed.headers.length;
                      index += 1
                    )
                      DropdownMenuItem<int?>(
                        value: index,
                        child: Text(
                          parsed.headers[index].isEmpty
                              ? 'Column ${index + 1}'
                              : parsed.headers[index],
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _mapping = ImportColumnMapping(
                        studentId: field.key == 'studentId'
                            ? value
                            : _mapping.studentId,
                        fullName: field.key == 'fullName'
                            ? value
                            : _mapping.fullName,
                        program: field.key == 'program'
                            ? value
                            : _mapping.program,
                        yearLevel: field.key == 'yearLevel'
                            ? value
                            : _mapping.yearLevel,
                      );
                      _error = null;
                    });
                  },
                ),
              ],
            ),
          ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() {
                  _step = _ImportStep.input;
                  _error = null;
                }),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CampusButton(
                label: 'Validate',
                loading: _busy,
                onPressed: _busy ? null : _validate,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _reviewStep(BuildContext context) {
    final validation = _validation!;
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final entry in <({String label, int value})>[
                (label: 'Rows', value: validation.summary.total),
                (label: 'Enrollable', value: validation.summary.enrollable),
                (label: 'Skipped', value: validation.summary.skip),
                (label: 'Invalid', value: validation.summary.invalid),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.label,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      Text(
                        '${entry.value}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (validation.issues.isNotEmpty) ...[
          const SizedBox(height: 10),
          FacultySectionTitle(title: 'Issues (${validation.issues.length})'),
          for (final issue in validation.issues.take(20))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                'Row ${issue.rowNumber}: ${issue.message.isEmpty ? issue.code.wire : issue.message}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ),
          if (validation.hasMoreIssues)
            Text(
              'More issues were truncated by the server.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
        ],
        const SizedBox(height: 14),
        CampusButton(
          label: 'Import ${validation.summary.enrollable} student(s)',
          icon: Icons.file_upload_outlined,
          loading: _busy,
          onPressed: _busy ? null : _execute,
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy
              ? null
              : () => setState(() {
                  _step = _ImportStep.map;
                  _error = null;
                }),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
          child: const Text('Back to mapping'),
        ),
      ],
    );
  }

  Widget _reportStep(BuildContext context) {
    final result = _result!;
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Import complete',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              for (final entry in <({String label, int value})>[
                (label: 'Enrolled', value: result.summary.enrollable),
                (label: 'Skipped', value: result.summary.skip),
                (label: 'Invalid', value: result.summary.invalid),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.label,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      Text(
                        '${entry.value}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (result.issues.isNotEmpty) ...[
          const SizedBox(height: 10),
          FacultySectionTitle(title: 'Issues (${result.issues.length})'),
          for (final issue in result.issues.take(20))
            Text(
              'Row ${issue.rowNumber}: ${issue.message.isEmpty ? issue.code.wire : issue.message}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => shareCsvText(
              context,
              importIssuesCsv(result.issues),
              'polycheck-enrollment-issues.csv',
            ),
            icon: const Icon(Icons.share_outlined, size: 16),
            label: const Text('Share issues CSV'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
          ),
        ],
        const SizedBox(height: 14),
        CampusButton(
          label: 'Done',
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    );
  }
}

/// Shows the sheet at ~92% height with keyboard insets handled.
Future<bool?> showSectionImportSheet(
  BuildContext context, {
  required String sectionId,
  required String sectionLabel,
  VoidCallback? onCompleted,
}) {
  final tokens = PupTheme.of(context);
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: tokens.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    builder: (sheetContext) {
      return Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * 0.92,
          child: SectionImportSheet(
            sectionId: sectionId,
            sectionLabel: sectionLabel,
            onCompleted: onCompleted,
          ),
        ),
      );
    },
  );
}
