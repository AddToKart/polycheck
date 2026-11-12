import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_excuses.dart';
import '../../data/student_images.dart';

/// Absence/lateness excuse request with an optional compressed evidence photo.
class StudentExcuseDialog extends StatefulWidget {
  const StudentExcuseDialog({super.key, required this.onSubmit});

  final Future<String?> Function(
    ExcuseReason reason,
    String description,
    String? evidenceData,
  )
  onSubmit;

  @override
  State<StudentExcuseDialog> createState() => _StudentExcuseDialogState();
}

class _StudentExcuseDialogState extends State<StudentExcuseDialog> {
  final TextEditingController _descriptionController = TextEditingController();
  ExcuseReason? _reason;
  StudentImageEvidence? _evidence;
  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickEvidence() async {
    try {
      final evidence = await pickStudentImage(source: ImageSource.gallery);
      if (!mounted || evidence == null) return;
      setState(() {
        _evidence = evidence;
        _error = null;
      });
    } on StudentImageException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } on Object {
      if (!mounted) return;
      setState(() => _error = 'The photo could not be prepared.');
    }
  }

  Future<void> _submit() async {
    final reason = _reason;
    final validation = validateExcuseForm(
      reason: reason,
      description: _descriptionController.text,
    );
    if (validation != null || reason == null) {
      setState(() => _error = validation ?? 'Select a reason.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final error = await widget.onSubmit(
      reason,
      _descriptionController.text.trim(),
      _evidence?.dataUrl,
    );
    if (!mounted) return;
    setState(() {
      _submitting = false;
      _error = error;
      _sent = error == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return AlertDialog(
      key: const ValueKey('student-excuse-dialog'),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      backgroundColor: tokens.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      title: Text(_sent ? 'Excuse requested' : 'Request an excuse'),
      scrollable: true,
      content: _sent
          ? Text(
              'Your instructor will review the request and notify you.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'Reason',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                for (final option in excuseReasonOptions)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: InkWell(
                      key: ValueKey('excuse-reason-${option.reason.wire}'),
                      onTap: _submitting
                          ? null
                          : () => setState(() => _reason = option.reason),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: _reason == option.reason
                              ? tokens.maroon.withValues(
                                  alpha: tokens.isDark ? 0.2 : 0.06,
                                )
                              : tokens.surface,
                          border: Border.all(
                            color: _reason == option.reason
                                ? (tokens.isDark ? tokens.gold : tokens.maroon)
                                : tokens.borderSubtle,
                          ),
                        ),
                        child: Row(
                          children: <Widget>[
                            Icon(
                              _reason == option.reason
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              size: 16,
                              color: _reason == option.reason
                                  ? (tokens.isDark
                                        ? tokens.gold
                                        : tokens.maroon)
                                  : tokens.muted,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                option.label,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: tokens.onSurface,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                Text(
                  'Description',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const ValueKey('excuse-description'),
                  controller: _descriptionController,
                  enabled: !_submitting,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 1000,
                  onChanged: (_) => setState(() => _error = null),
                  decoration: InputDecoration(
                    hintText: 'Explain what happened.',
                    errorText: _error,
                    errorMaxLines: 3,
                  ),
                ),
                if (_evidence != null) ...<Widget>[
                  const SizedBox(height: 6),
                  Row(
                    children: <Widget>[
                      ClipRect(
                        child: Image.memory(
                          _evidence!.bytes,
                          width: 56,
                          height: 56,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Evidence attached',
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                        ),
                      ),
                      TextButton(
                        onPressed: _submitting
                            ? null
                            : () => setState(() => _evidence = null),
                        child: const Text('Remove'),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 4),
                OutlinedButton.icon(
                  onPressed: _submitting ? null : _pickEvidence,
                  icon: const Icon(
                    Icons.add_photo_alternate_outlined,
                    size: 18,
                  ),
                  label: Text(
                    _evidence == null
                        ? 'Attach evidence photo'
                        : 'Replace evidence photo',
                  ),
                ),
              ],
            ),
      actions: <Widget>[
        if (_sent)
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Done'),
          )
        else ...<Widget>[
          TextButton(
            onPressed: _submitting ? null : () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          CampusButton(
            key: const ValueKey('excuse-submit'),
            label: _submitting ? 'Sending…' : 'Submit request',
            loading: _submitting,
            expand: false,
            onPressed: _reason == null || _submitting ? null : _submit,
          ),
        ],
      ],
    );
  }
}
