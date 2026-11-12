import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/models/bulk_import.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_bottom_sheet.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_card.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../domain/bulk_import.dart';

Future<void> showBulkImportSheet(
  BuildContext context, {
  required VoidCallback onImported,
}) {
  return showCampusBottomSheet<void>(
    context,
    title: 'Import students',
    child: BulkImportSheet(onImported: onImported),
  );
}

class _ImportPlan {
  _ImportPlan({required this.rows});

  final List<StudentImportRow> rows;
  String? checksum;
  bool committed = false;
}

class BulkImportSheet extends ConsumerStatefulWidget {
  const BulkImportSheet({super.key, required this.onImported});

  final VoidCallback onImported;

  @override
  ConsumerState<BulkImportSheet> createState() => _BulkImportSheetState();
}

class _BulkImportSheetState extends ConsumerState<BulkImportSheet> {
  final _paste = TextEditingController();
  BulkImportState _state = const BulkImportState();
  List<_ImportPlan> _plans = const <_ImportPlan>[];
  StudentImportSummary? _summary;
  bool _busy = false;
  bool _stopRequested = false;
  String? _error;

  @override
  void dispose() {
    _paste.dispose();
    super.dispose();
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text ?? '';
    if (text.trim().isEmpty) {
      setState(() => _error = 'The clipboard does not contain any text.');
      return;
    }
    _paste.text = text;
    setState(() {
      _state = _state.withPaste(text);
      _error = _state.error;
    });
  }

  void _continueFromInput() {
    setState(() {
      _state = _state.withPaste(_paste.text);
      _error = _state.error;
    });
  }

  void _setMapping(ImportField field, int? index) {
    setState(() => _state = _state.withMapping(field, index));
  }

  Future<void> _validate() async {
    if (!isMappingComplete(_state.mapping)) {
      setState(() => _error = 'Map the student number and full name columns.');
      return;
    }
    final built = buildStudentRows(_state.sourceRows, _state.mapping);
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
      final plans = <_ImportPlan>[
        for (final chunk in chunkRows(built.rows, importChunkSize))
          _ImportPlan(rows: chunk),
      ];
      final issues = <ImportIssue>[];
      var hasMore = false;
      var total = 0;
      var valid = 0;
      var skip = 0;
      var invalid = 0;
      var newCount = 0;
      var update = 0;
      final api = ref.read(usersApiProvider);
      for (final plan in plans) {
        final result = await api.importStudents(
          StudentImportRequest(
            mode: ImportMode.validate,
            conflictMode: _state.conflictMode,
            rows: plan.rows,
          ),
        );
        plan.checksum = result.rowChecksum;
        issues.addAll(result.issues);
        hasMore = hasMore || result.hasMoreIssues;
        total += result.summary.total;
        valid += result.summary.valid;
        skip += result.summary.skip;
        invalid += result.summary.invalid;
        newCount += result.summary.newCount;
        update += result.summary.update;
      }
      if (!mounted) return;
      setState(() {
        _busy = false;
        _plans = plans;
        _summary = StudentImportSummary(
          total: total,
          valid: valid,
          skip: skip,
          invalid: invalid,
          newCount: newCount,
          update: update,
        );
        _state = _state.afterValidation(
          local: built.issues,
          server: issues,
          more: hasMore,
          validRows: valid,
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$error';
      });
    }
  }

  Future<void> _commit() async {
    setState(() {
      _busy = true;
      _stopRequested = false;
      _error = null;
      _state = _state.copyWith(
        chunksDone: 0,
        chunksTotal: _plans.length,
        clearError: true,
      );
    });
    final api = ref.read(usersApiProvider);
    var counts = const ImportCommitCounts();
    final credentials = <ImportCredential>[];
    var done = 0;
    try {
      for (final plan in _plans) {
        if (plan.committed || plan.checksum == null) {
          done += 1;
          continue;
        }
        if (_stopRequested) break;
        final result = await api.importStudents(
          StudentImportRequest(
            mode: ImportMode.execute,
            conflictMode: _state.conflictMode,
            rows: plan.rows,
            rowChecksum: plan.checksum,
            idempotencyKey: const Uuid().v4(),
          ),
        );
        plan.committed = true;
        counts = counts.plus(
          created: result.summary.newCount,
          updated: result.summary.update,
          skipped: result.summary.skip,
          failed: result.summary.invalid,
        );
        if (result.credentials != null) credentials.addAll(result.credentials!);
        done += 1;
        if (!mounted) return;
        setState(() {
          _state = _state.copyWith(chunksDone: done);
        });
      }
      if (!mounted) return;
      setState(() {
        _busy = false;
        _state = _state.afterCommit(
          committed: counts,
          issuedCredentials: credentials,
          done: done,
          total: _plans.length,
        );
      });
      widget.onImported();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error =
            '$error Committed chunks are safe to retry — already-imported '
            'rows are skipped.';
      });
    }
  }

  Future<void> _shareCsv(
    String contents,
    String filename,
    String subject,
  ) async {
    try {
      final bytes = Uint8List.fromList(utf8.encode(contents));
      await SharePlus.instance.share(
        ShareParams(
          files: <XFile>[
            XFile.fromData(bytes, name: filename, mimeType: 'text/csv'),
          ],
          subject: subject,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to share: $error',
        tone: CampusToastTone.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        _StepRail(step: _state.step),
        const SizedBox(height: 12),
        if (_error != null || _state.error != null) ...<Widget>[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tokens.maroon,
              border: Border.all(color: tokens.maroon),
            ),
            child: Text(
              _error ?? _state.error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        switch (_state.step) {
          BulkImportStep.input => _buildInput(context),
          BulkImportStep.map => _buildMapping(context),
          BulkImportStep.review => _buildReview(context),
          BulkImportStep.report => _buildReport(context),
        },
        if (_state.step != BulkImportStep.report) ...<Widget>[
          const SizedBox(height: 10),
          TextButton.icon(
            onPressed: _busy
                ? null
                : () => setState(() => _state = _state.back()),
            icon: const Icon(Icons.arrow_back, size: 16),
            label: Text(
              _state.step == BulkImportStep.input ? 'Cancel' : 'Back',
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildInput(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Paste the master list from Sheets or Files as CSV (header row '
          'included). Preview the mapping before anything is written.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _paste,
          minLines: 6,
          maxLines: 10,
          enabled: !_busy,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(fontFamily: 'monospace'),
          decoration: const InputDecoration(
            hintText: 'Student No,Name,Email,Program,Year Level,Department',
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
              child: CampusButton(
                label: 'Paste from clipboard',
                icon: Icons.content_paste,
                variant: CampusButtonVariant.outline,
                onPressed: _busy ? null : _pasteFromClipboard,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CampusButton(
                label: 'Continue',
                icon: Icons.arrow_forward,
                onPressed: _busy ? null : _continueFromInput,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'CSV only. Up to 5,000 rows. Excel files should be saved as CSV '
          'with the student-number column formatted as text.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }

  Widget _buildMapping(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Confirm how ${_state.headers.length} columns map to Polycheck '
          'fields. Student number and full name are required.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 12),
        for (final field in studentImportFields) ...<Widget>[
          DropdownButtonFormField<int>(
            key: ValueKey<String>('map-${field.name}'),
            initialValue: _state.mapping[field] ?? -1,
            isExpanded: true,
            decoration: InputDecoration(
              labelText:
                  '${field.label}'
                  '${field == ImportField.studentId || field == ImportField.fullName ? ' *' : ''}',
            ),
            items: <DropdownMenuItem<int>>[
              const DropdownMenuItem<int>(value: -1, child: Text('Not mapped')),
              for (var index = 0; index < _state.headers.length; index++)
                DropdownMenuItem<int>(
                  value: index,
                  child: Text(
                    _state.headers[index].isEmpty
                        ? 'Column ${index + 1}'
                        : _state.headers[index],
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: _busy
                ? null
                : (value) => _setMapping(
                    field,
                    value == null || value < 0 ? null : value,
                  ),
          ),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 4),
        Text(
          'Existing accounts',
          style: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        SegmentedButton<ImportConflictMode>(
          segments: const <ButtonSegment<ImportConflictMode>>[
            ButtonSegment<ImportConflictMode>(
              value: ImportConflictMode.skipExisting,
              label: Text('Skip'),
            ),
            ButtonSegment<ImportConflictMode>(
              value: ImportConflictMode.updateExisting,
              label: Text('Update'),
            ),
          ],
          selected: <ImportConflictMode>{_state.conflictMode},
          onSelectionChanged: _busy
              ? null
              : (selection) => setState(() {
                  _state = _state.withConflictMode(selection.first);
                }),
          style: ButtonStyle(
            shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            ),
            side: WidgetStatePropertyAll(
              BorderSide(color: tokens.borderSubtle),
            ),
          ),
        ),
        const SizedBox(height: 14),
        CampusButton(
          label: _busy ? 'Validating…' : 'Validate rows',
          icon: Icons.rule,
          loading: _busy,
          onPressed: _busy ? null : _validate,
        ),
      ],
    );
  }

  Widget _buildReview(BuildContext context) {
    final summary = _summary;
    final issues = _state.allIssues;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Review the validation summary before committing. Only importable '
          'rows are written.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _CountChip(label: 'Rows', value: summary?.total ?? 0),
            _CountChip(label: 'Valid', value: summary?.valid ?? 0),
            _CountChip(label: 'Skip', value: summary?.skip ?? 0),
            _CountChip(label: 'Invalid', value: summary?.invalid ?? 0),
            _CountChip(label: 'Issues', value: issues.length),
          ],
        ),
        if (issues.isNotEmpty) ...<Widget>[
          const SizedBox(height: 12),
          CampusCard(
            color: PupTheme.of(context).gold.withValues(alpha: 0.14),
            borderColor: PupTheme.of(context).gold,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'First issues',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 6),
                for (final issue in issues.take(8))
                  Text(
                    'Row ${issue.rowNumber} · ${issue.code.wire} · '
                    '${issue.message}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                if (_state.hasMoreIssues) ...<Widget>[
                  const SizedBox(height: 4),
                  Text(
                    'The server capped the issue list; fix these first and '
                    're-validate.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ],
        if (_busy) ...<Widget>[
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: _state.chunksTotal == 0
                ? null
                : _state.chunksDone / _state.chunksTotal,
            color: PupTheme.of(context).maroon,
          ),
          const SizedBox(height: 6),
          Text(
            'Committing ${_state.chunksDone} of ${_state.chunksTotal} chunks…',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 14),
        if (!_busy)
          CampusButton(
            label: 'Confirm & import',
            icon: Icons.upload_file,
            onPressed: _commit,
          )
        else
          CampusButton(
            label: 'Stop after this chunk',
            icon: Icons.stop_circle_outlined,
            variant: CampusButtonVariant.outline,
            onPressed: () => setState(() => _stopRequested = true),
          ),
      ],
    );
  }

  Widget _buildReport(BuildContext context) {
    final tokens = PupTheme.of(context);
    final counts = _state.counts;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Import finished. Hand out temporary credentials in person — they '
          'are shown once.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _CountChip(label: 'Created', value: counts.created),
            _CountChip(label: 'Updated', value: counts.updated),
            _CountChip(label: 'Skipped', value: counts.skipped),
            _CountChip(
              label: 'Failed',
              value: counts.failed + blockingIssueCount(_state.localIssues),
            ),
          ],
        ),
        if (_state.credentials.isNotEmpty) ...<Widget>[
          const SizedBox(height: 14),
          Text(
            'Temporary credentials — display once',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.maroon,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          for (final credential in _state.credentials.take(20))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      credential.studentId,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(fontFamily: 'monospace'),
                    ),
                  ),
                  Text(
                    credential.tempPassword,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontFamily: 'monospace',
                      color: tokens.maroon,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          if (_state.credentials.length > 20)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Showing the first 20 of ${_state.credentials.length} '
                'credentials — share the CSV for the full set.',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ),
          const SizedBox(height: 8),
          CampusButton(
            label: 'Share credentials CSV',
            icon: Icons.share_outlined,
            variant: CampusButtonVariant.gold,
            onPressed: () => _shareCsv(
              credentialsCsv(_state.credentials),
              'polycheck-temporary-credentials.csv',
              'Share temporary credentials',
            ),
          ),
        ],
        if (_state.allIssues.isNotEmpty) ...<Widget>[
          const SizedBox(height: 8),
          CampusButton(
            label: 'Share issue list',
            icon: Icons.share_outlined,
            variant: CampusButtonVariant.outline,
            onPressed: () => _shareCsv(
              issuesCsv(_state.allIssues),
              'polycheck-import-issues.csv',
              'Share import issues',
            ),
          ),
        ],
        const SizedBox(height: 14),
        CampusButton(
          label: 'Done',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _StepRail extends StatelessWidget {
  const _StepRail({required this.step});

  final BulkImportStep step;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    const labels = <BulkImportStep, String>{
      BulkImportStep.input: 'Paste',
      BulkImportStep.map: 'Map',
      BulkImportStep.review: 'Review',
      BulkImportStep.report: 'Report',
    };
    final currentIndex = BulkImportStep.values.indexOf(step);
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: <Widget>[
        for (var index = 0; index < BulkImportStep.values.length; index++)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: index <= currentIndex ? tokens.gold : tokens.campus,
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Text(
              '${index + 1}. ${labels[BulkImportStep.values[index]]}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: index <= currentIndex ? tokens.deepMaroon : tokens.muted,
              ),
            ),
          ),
      ],
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.campus,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            '$value',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: tokens.muted),
          ),
        ],
      ),
    );
  }
}
