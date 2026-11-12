import 'package:flutter/material.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_dispute_options.dart';

/// Dispute form with the exact student reason set and the backend's 10–1000
/// character rule. Returns `null` from [onSubmit] on success, or a typed error
/// message that is rendered inline.
class StudentDisputeDialog extends StatefulWidget {
  const StudentDisputeDialog({super.key, required this.onSubmit});

  final Future<String?> Function(DisputeReason reason, String description)
  onSubmit;

  @override
  State<StudentDisputeDialog> createState() => _StudentDisputeDialogState();
}

class _StudentDisputeDialogState extends State<StudentDisputeDialog> {
  final TextEditingController _descriptionController = TextEditingController();
  DisputeReason? _reason;
  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      !_submitting &&
      !_sent &&
      _reason != null &&
      isDisputeDescriptionValid(_descriptionController.text);

  Future<void> _submit() async {
    final reason = _reason;
    if (reason == null) {
      setState(() => _error = 'Select what went wrong.');
      return;
    }
    final description = _descriptionController.text.trim();
    final validation = validateDisputeDescription(description);
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final error = await widget.onSubmit(reason, description);
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
    final length = _descriptionController.text.length;
    return AlertDialog(
      key: const ValueKey('student-dispute-dialog'),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      backgroundColor: tokens.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      title: Text(_sent ? 'Report sent' : 'Report an issue'),
      scrollable: true,
      content: _sent
          ? Text(
              'Your instructor can now review this attendance record.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'What went wrong?',
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<DisputeReason>(
                      key: const ValueKey('dispute-reason'),
                      value: _reason,
                      isExpanded: true,
                      hint: const Text('Select a reason'),
                      items: <DropdownMenuItem<DisputeReason>>[
                        for (final option in studentDisputeOptions)
                          DropdownMenuItem<DisputeReason>(
                            value: option.reason,
                            child: Text(option.label),
                          ),
                      ],
                      onChanged: _submitting
                          ? null
                          : (value) => setState(() {
                              _reason = value;
                              _error = null;
                            }),
                    ),
                  ),
                ),
                if (_reason != null) ...<Widget>[
                  const SizedBox(height: 4),
                  Text(
                    studentDisputeOptions
                        .firstWhere((option) => option.reason == _reason)
                        .description,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
                const SizedBox(height: 14),
                Text(
                  'Additional details',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const ValueKey('dispute-description'),
                  controller: _descriptionController,
                  enabled: !_submitting,
                  minLines: 3,
                  maxLines: 6,
                  onChanged: (_) => setState(() => _error = null),
                  decoration: InputDecoration(
                    hintText:
                        'Describe what happened so your instructor can review it.',
                    errorText: _error,
                    errorMaxLines: 3,
                  ),
                ),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        'At least $disputeDescriptionMinLength characters',
                        style: Theme.of(
                          context,
                        ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                    Text(
                      '$length/$disputeDescriptionMaxLength',
                      style: Theme.of(
                        context,
                      ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                    ),
                  ],
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
            key: const ValueKey('dispute-submit'),
            label: _submitting ? 'Sending…' : 'Send report',
            loading: _submitting,
            expand: false,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ],
    );
  }
}
