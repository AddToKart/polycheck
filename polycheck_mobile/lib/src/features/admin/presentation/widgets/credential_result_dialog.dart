import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_dialog.dart';

/// One-time credential shown after account creation or a password reset.
///
/// The value is never persisted; closing the dialog loses it. Copying writes
/// to the system clipboard only.
class CredentialResultDialog extends StatefulWidget {
  const CredentialResultDialog({
    super.key,
    required this.accountName,
    required this.identifier,
    required this.temporaryPassword,
    this.title = 'Temporary password',
    this.note,
  });

  final String accountName;
  final String identifier;
  final String temporaryPassword;
  final String title;
  final String? note;

  @override
  State<CredentialResultDialog> createState() => _CredentialResultDialogState();
}

class _CredentialResultDialogState extends State<CredentialResultDialog> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.temporaryPassword));
    if (!mounted) return;
    setState(() => _copied = true);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusDialog(
      title: widget.title,
      description:
          widget.note ??
          'Share this password with ${widget.accountName} in person. It will '
              'not be shown again; they must change it at next sign-in.',
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
        CampusButton(
          label: _copied ? 'Copied' : 'Copy password',
          icon: _copied ? Icons.check : Icons.copy,
          expand: false,
          height: 44,
          onPressed: _copy,
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            widget.accountName,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
          ),
          if (widget.identifier.isNotEmpty)
            Text(
              widget.identifier,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: tokens.campus,
              border: Border.all(color: tokens.gold),
            ),
            child: SelectableText(
              widget.temporaryPassword,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w700,
                color: tokens.maroon,
                letterSpacing: 0.6,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Existing sessions were revoked where applicable. This credential '
            'is displayed once.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
        ],
      ),
    );
  }
}

Future<void> showCredentialResultDialog(
  BuildContext context, {
  required String accountName,
  required String identifier,
  required String temporaryPassword,
  String title = 'Temporary password',
  String? note,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => CredentialResultDialog(
      accountName: accountName,
      identifier: identifier,
      temporaryPassword: temporaryPassword,
      title: title,
      note: note,
    ),
  );
}
