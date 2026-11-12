import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_providers.dart';

Future<bool?> showEnrollmentCodeDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    builder: (_) => const EnrollmentCodeDialog(),
  );
}

class EnrollmentCodeDialog extends ConsumerStatefulWidget {
  const EnrollmentCodeDialog({super.key});

  @override
  ConsumerState<EnrollmentCodeDialog> createState() =>
      _EnrollmentCodeDialogState();
}

class _EnrollmentCodeDialogState extends ConsumerState<EnrollmentCodeDialog> {
  final TextEditingController _controller = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _successMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _validate(String raw) {
    final code = raw.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{6,8}$').hasMatch(code)) {
      return 'Enrollment codes are 6–8 letters or numbers.';
    }
    return null;
  }

  Future<void> _submit() async {
    final validation = _validate(_controller.text);
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final enrollment = await ref
          .read(sectionsApiProvider)
          .enrollByCode(_controller.text.trim().toUpperCase());
      ref.invalidate(studentSectionsProvider);
      if (!mounted) return;
      setState(() {
        _successMessage =
            'Enrolled in section successfully (${enrollment.sectionId}).';
        _submitting = false;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message.trim().isEmpty
            ? 'The enrollment code could not be redeemed.'
            : error.message.trim();
        _submitting = false;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _error = 'The enrollment code could not be redeemed. Try again.';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final done = _successMessage != null;
    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      backgroundColor: tokens.surface,
      title: Text(done ? 'Enrollment complete' : 'Enroll in a class'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (done)
            Text(
              _successMessage!,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
            )
          else ...<Widget>[
            Text(
              'Enter the code from your instructor. Codes are 6–8 characters.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
            const SizedBox(height: 14),
            CampusTextField(
              key: const ValueKey('enrollment-code-input'),
              controller: _controller,
              label: 'Enrollment code',
              hint: 'ABC123',
              helperText: 'Letters and numbers only',
              errorText: _error,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
              onSubmitted: (_) {
                if (!_submitting) _submit();
              },
            ),
          ],
        ],
      ),
      actions: <Widget>[
        if (!done)
          TextButton(
            onPressed: _submitting ? null : () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        if (done)
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Done'),
          )
        else
          CampusButton(
            label: _submitting ? 'Redeeming…' : 'Redeem code',
            loading: _submitting,
            expand: false,
            onPressed: _submitting ? null : _submit,
          ),
      ],
    );
  }
}
