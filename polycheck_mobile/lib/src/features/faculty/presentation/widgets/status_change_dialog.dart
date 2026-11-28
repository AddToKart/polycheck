import 'package:flutter/material.dart';

import '../../../../core/polycheck_core.dart';
import '../../data/faculty_logic.dart';

/// Asks which status to set and waits for a confirmation. Nothing about a
/// student's attendance changes unless this returns a status.
Future<AttendanceStatus?> showStatusChangeDialog(
  BuildContext context, {
  required String studentName,
  required String subject,
  required AttendanceStatus current,
}) {
  return showDialog<AttendanceStatus>(
    context: context,
    builder: (_) => _StatusChangeDialog(
      studentName: studentName,
      subject: subject,
      current: current,
    ),
  );
}

class _StatusChangeDialog extends StatefulWidget {
  const _StatusChangeDialog({
    required this.studentName,
    required this.subject,
    required this.current,
  });

  final String studentName;
  final String subject;
  final AttendanceStatus current;

  @override
  State<_StatusChangeDialog> createState() => _StatusChangeDialogState();
}

class _StatusChangeDialogState extends State<_StatusChangeDialog> {
  AttendanceStatus? _next;

  String _label(AttendanceStatus status) => attendanceStatusLabels[status]!;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final next = _next;
    return CampusDialog(
      title: 'Change status?',
      description:
          '${widget.studentName}, ${widget.subject}. This replaces the recorded '
          'status and is logged as set by you.',
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(
          key: const ValueKey<String>('confirm-status-change'),
          onPressed: next == null
              ? null
              : () => Navigator.of(context).pop(next),
          child: const Text('Confirm change'),
        ),
      ],
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final choice in manualStatusChoices)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Semantics(
                selected: next == choice,
                child: OutlinedButton(
                  key: ValueKey<String>('status-choice-${choice.name}'),
                  onPressed: choice == widget.current
                      ? null
                      : () => setState(() => _next = choice),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    backgroundColor: next == choice ? tokens.maroon : null,
                    foregroundColor: next == choice ? Colors.white : null,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.zero,
                    ),
                  ),
                  child: Text(
                    choice == widget.current
                        ? '${_label(choice)} (now)'
                        : _label(choice),
                  ),
                ),
              ),
            ),
          Text(
            next == null
                ? 'Choose the new status.'
                : '${_label(widget.current)} will change to ${_label(next)}.',
            style: text.bodySmall?.copyWith(
              color: next == null ? tokens.muted : tokens.onSurface,
              fontWeight: next == null ? null : FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
