import 'package:flutter/material.dart';

import '../../../../core/polycheck_core.dart';
import '../../data/teacher_signing_key.dart';
import 'faculty_shell.dart';

class InPersonQrSettings {
  const InPersonQrSettings({
    required this.validityMinutes,
    required this.gracePeriodMinutes,
  });

  final int validityMinutes;
  final int gracePeriodMinutes;
}

Future<InPersonQrSettings?> showInPersonQrDialog(
  BuildContext context, {
  required int initialValidity,
  required int initialGrace,
  required bool regenerating,
}) {
  return showDialog<InPersonQrSettings>(
    context: context,
    builder: (dialogContext) => _InPersonQrDialog(
      initialValidity: initialValidity,
      initialGrace: initialGrace,
      regenerating: regenerating,
    ),
  );
}

class _InPersonQrDialog extends StatefulWidget {
  const _InPersonQrDialog({
    required this.initialValidity,
    required this.initialGrace,
    required this.regenerating,
  });

  final int initialValidity;
  final int initialGrace;
  final bool regenerating;

  @override
  State<_InPersonQrDialog> createState() => _InPersonQrDialogState();
}

class _InPersonQrDialogState extends State<_InPersonQrDialog> {
  late final TextEditingController _validity = TextEditingController(
    text: '${widget.initialValidity}',
  );
  late final TextEditingController _grace = TextEditingController(
    text: '${widget.initialGrace}',
  );
  String? _error;

  @override
  void dispose() {
    _validity.dispose();
    _grace.dispose();
    super.dispose();
  }

  void _submit() {
    final validity = int.tryParse(_validity.text.trim());
    final grace = int.tryParse(_grace.text.trim());
    if (validity == null || validity < 1 || validity > 15) {
      setState(() => _error = 'QR validity must be between 1 and 15 minutes.');
      return;
    }
    if (grace == null || grace < 0 || grace > 60) {
      setState(() => _error = 'Grace must be between 0 and 60 minutes.');
      return;
    }
    Navigator.of(context).pop(
      InPersonQrSettings(validityMinutes: validity, gracePeriodMinutes: grace),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CampusDialog(
      title: widget.regenerating ? 'Regenerate QR' : 'Generate QR',
      description:
          'The QR opens a signed attendance window. Scans inside the window '
          'are Present; scans inside the grace window are Late.',
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(onPressed: _submit, child: const Text('Generate')),
      ],
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampusTextField(
            controller: _validity,
            label: 'QR validity (1–15 minutes)',
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _grace,
            label: 'Grace period (0–60 minutes)',
            keyboardType: TextInputType.number,
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class CheckpointQrSettings {
  const CheckpointQrSettings({
    required this.validitySeconds,
    required this.graceMinutes,
    required this.pinRequired,
    this.pin,
  });

  final int validitySeconds;
  final int graceMinutes;
  final bool pinRequired;
  final String? pin;
}

Future<CheckpointQrSettings?> showCheckpointQrDialog(
  BuildContext context, {
  required bool isStart,
  required bool regenerating,
  required int initialValiditySeconds,
  required int initialGraceMinutes,
  String? rememberedPin,
}) {
  return showDialog<CheckpointQrSettings>(
    context: context,
    builder: (dialogContext) => _CheckpointQrDialog(
      isStart: isStart,
      regenerating: regenerating,
      initialValiditySeconds: initialValiditySeconds,
      initialGraceMinutes: initialGraceMinutes,
      rememberedPin: rememberedPin,
    ),
  );
}

class _CheckpointQrDialog extends StatefulWidget {
  const _CheckpointQrDialog({
    required this.isStart,
    required this.regenerating,
    required this.initialValiditySeconds,
    required this.initialGraceMinutes,
    this.rememberedPin,
  });

  final bool isStart;
  final bool regenerating;
  final int initialValiditySeconds;
  final int initialGraceMinutes;
  final String? rememberedPin;

  @override
  State<_CheckpointQrDialog> createState() => _CheckpointQrDialogState();
}

class _CheckpointQrDialogState extends State<_CheckpointQrDialog> {
  late final TextEditingController _validity = TextEditingController(
    text: '${widget.initialValiditySeconds}',
  );
  late final TextEditingController _grace = TextEditingController(
    text: '${widget.initialGraceMinutes}',
  );
  late final TextEditingController _pin = TextEditingController(
    text: (widget.regenerating ? widget.rememberedPin : null) ?? '',
  );
  bool _pinRequired = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _pinRequired =
        widget.regenerating && (widget.rememberedPin ?? '').isNotEmpty;
  }

  @override
  void dispose() {
    _validity.dispose();
    _grace.dispose();
    _pin.dispose();
    super.dispose();
  }

  void _submit() {
    final validity = int.tryParse(_validity.text.trim());
    if (validity == null || validity < 60 || validity > 300) {
      setState(() => _error = 'Checkpoint validity must be 60–300 seconds.');
      return;
    }
    final grace = int.tryParse(_grace.text.trim());
    if (widget.isStart && (grace == null || grace < 0 || grace > 60)) {
      setState(() => _error = 'Grace must be between 0 and 60 minutes.');
      return;
    }
    final pin = _pin.text.trim();
    if (_pinRequired && !isValidPinFormat(pin)) {
      setState(() => _error = 'The meeting PIN must be 2–4 digits.');
      return;
    }
    Navigator.of(context).pop(
      CheckpointQrSettings(
        validitySeconds: validity,
        graceMinutes: widget.isStart ? (grace ?? 10) : 0,
        pinRequired: _pinRequired,
        pin: _pinRequired ? pin : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusDialog(
      title:
          '${widget.regenerating ? 'Regenerate' : 'Generate'} '
          '${widget.isStart ? 'start' : 'end'} QR',
      description: widget.isStart
          ? 'Checkpoint 1 opens the check-in window. A meeting PIN blocks '
                'forwarded screenshots.'
          : 'Checkpoint 2 closes attendance. End-of-class QR codes have no '
                'grace period.',
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(onPressed: _submit, child: const Text('Generate')),
      ],
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampusTextField(
            controller: _validity,
            label: 'Validity (60–300 seconds)',
            keyboardType: TextInputType.number,
          ),
          if (widget.isStart) ...[
            const SizedBox(height: 12),
            CampusTextField(
              controller: _grace,
              label: 'Check-in grace (0–60 minutes)',
              keyboardType: TextInputType.number,
            ),
          ],
          const SizedBox(height: 8),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            value: _pinRequired,
            onChanged: (value) => setState(() {
              _pinRequired = value ?? false;
              if (!_pinRequired) _pin.clear();
            }),
            title: const Text('Require a meeting PIN'),
          ),
          if (_pinRequired) ...[
            Row(
              children: [
                Expanded(
                  child: CampusTextField(
                    controller: _pin,
                    label: 'PIN (2–4 digits)',
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => setState(() {
                    _pin.text = generateMeetingPin(3);
                  }),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 46),
                  ),
                  child: const Text('Random'),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Announce the PIN aloud in the meeting. Screenshots cannot carry '
              'audio, so forwarded QR images stay unusable.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// End-session confirmation with the authoritative roster summary.
Future<bool> confirmEndSession(
  BuildContext context, {
  required bool online,
  required int present,
  required int late,
  required int absent,
  required int pendingCount,
}) async {
  return showFacultyConfirm(
    context,
    title: 'End this session?',
    message: online
        ? 'Attendance resolves now: check-in-only students keep their credit, '
              'both-leg scans use the checkpoint matrix, and students with '
              'neither scan become Absent. ($present present · $late late · '
              '$absent absent · $pendingCount pending)'
        : 'Attendance closes now. Pending scans become Absent and no further '
              'QR is valid. ($present present · $late late · $absent absent · '
              '$pendingCount pending)',
    confirmLabel: 'End session',
    destructive: true,
  );
}
