import 'package:flutter/material.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Manual token entry sheet.
///
/// The dialog owns its [TextEditingController] (created in [initState],
/// disposed in [dispose]) — the caller only ever receives the popped token.
/// Creating/disposing the controller in the scanner's State while the dialog's
/// `TextField` was still mounted during the exit transition crashed with
/// `A TextEditingController was used after being disposed` (SW-4); this is the
/// same ownership pattern as `enrollment_code_dialog.dart`.
Future<String?> showManualTokenEntryDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (_) => const ManualTokenEntryDialog(),
  );
}

class ManualTokenEntryDialog extends StatefulWidget {
  const ManualTokenEntryDialog({super.key});

  /// Confirm label (SW-5 single site).
  static const String submitLabel = 'SUBMIT CHECK-IN TOKEN';

  @override
  State<ManualTokenEntryDialog> createState() => _ManualTokenEntryDialogState();
}

class _ManualTokenEntryDialogState extends State<ManualTokenEntryDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (value.isEmpty) return;
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      backgroundColor: tokens.surface,
      surfaceTintColor: Colors.transparent,
      title: const Text('Enter QR token'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Paste the token from your instructor. Live location is still '
            'verified for in-person classes.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const ValueKey('scan-manual-input'),
            controller: _controller,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            decoration: const InputDecoration(hintText: 'Paste token here'),
          ),
        ],
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        CampusButton(
          key: const ValueKey('scan-manual-submit'),
          label: ManualTokenEntryDialog.submitLabel,
          expand: false,
          onPressed: _submit,
        ),
      ],
    );
  }
}

/// Meeting-PIN sheet for checkpoint-protected (online) scans.
///
/// Self-owning controller, same contract as [ManualTokenEntryDialog]: pop the
/// validated PIN string, or null on cancel.
Future<String?> showMeetingPinDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (_) => const MeetingPinDialog(),
  );
}

class MeetingPinDialog extends StatefulWidget {
  const MeetingPinDialog({super.key});

  /// Confirm label (aligned with the manual-entry copy).
  static const String submitLabel = 'SUBMIT PIN-SIGNED CHECK-IN';

  @override
  State<MeetingPinDialog> createState() => _MeetingPinDialogState();
}

class _MeetingPinDialogState extends State<MeetingPinDialog> {
  final TextEditingController _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    final cleaned = value.replaceAll(RegExp(r'\D'), '');
    if (cleaned != value) {
      _controller.value = TextEditingValue(
        text: cleaned,
        selection: TextSelection.collapsed(offset: cleaned.length),
      );
    }
    if (_error != null) setState(() => _error = null);
  }

  void _submit() {
    final pin = _controller.text.trim();
    if (!RegExp(r'^\d{2,4}$').hasMatch(pin)) {
      setState(() => _error = 'Enter the 2–4 digit PIN.');
      return;
    }
    Navigator.of(context).pop(pin);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      backgroundColor: tokens.surface,
      surfaceTintColor: Colors.transparent,
      title: const Text('Enter meeting PIN'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Announced aloud by your instructor in class.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const ValueKey('scan-pin-input'),
            controller: _controller,
            autofocus: true,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            maxLength: 4,
            onChanged: _onChanged,
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              hintText: '••••',
              errorText: _error,
              counterText: '',
            ),
          ),
        ],
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        CampusButton(
          key: const ValueKey('scan-pin-submit'),
          label: MeetingPinDialog.submitLabel,
          expand: false,
          onPressed: _submit,
        ),
      ],
    );
  }
}
