import 'package:flutter/material.dart';

import '../../../../core/models/section_role.dart';
import '../../../../core/theme/brand_theme.dart';
import '../../../../core/widgets/campus_dialog.dart';
import '../../../../core/widgets/campus_text_field.dart';

/// Longest a permission can last, mirroring the server.
const int sessionPermissionMaxHours = 168;

/// Asks how long the president's permission should last; null when cancelled.
Future<int?> askPermissionHours(BuildContext context, String studentName) {
  return showCampusDialog<int>(
    context,
    title: 'Give permission',
    description:
        '$studentName can create one session. The permission ends once used or '
        'when the time runs out. You still start the QR code.',
    actionBuilders: [
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(),
        child: const Text('Cancel'),
      ),
    ],
    child: const _HoursForm(),
  );
}

class _HoursForm extends StatefulWidget {
  const _HoursForm();

  @override
  State<_HoursForm> createState() => _HoursFormState();
}

class _HoursFormState extends State<_HoursForm> {
  final TextEditingController _custom = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  void _useCustom() {
    final hours = int.tryParse(_custom.text.trim());
    if (hours == null || hours < 1 || hours > sessionPermissionMaxHours) {
      setState(
        () => _error =
            'Enter a whole number of hours from 1 to '
            '$sessionPermissionMaxHours.',
      );
      return;
    }
    Navigator.of(context).pop(hours);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final hours in const [8, 24]) ...[
          OutlinedButton(
            key: ValueKey('permission-$hours-hours'),
            onPressed: () => Navigator.of(context).pop(hours),
            child: Text('$hours hours'),
          ),
          const SizedBox(height: 8),
        ],
        CampusTextField(
          label: 'Custom hours',
          hint: 'For example 3',
          controller: _custom,
          keyboardType: TextInputType.number,
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _useCustom,
          child: const Text('Use custom hours'),
        ),
      ],
    );
  }
}

/// The president's permission: what it allows now, and the button to change it.
class PresidentPermissionTile extends StatelessWidget {
  const PresidentPermissionTile({
    super.key,
    required this.studentName,
    required this.permission,
    required this.onGrant,
    required this.onRevoke,
  });

  final String studentName;

  /// The active, unused permission, if there is one.
  final SessionPermission? permission;
  final VoidCallback onGrant;
  final VoidCallback onRevoke;

  String _until(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final campus = parsed.toUtc().add(const Duration(hours: 8));
    String two(int number) => number.toString().padLeft(2, '0');
    return '${campus.year}-${two(campus.month)}-${two(campus.day)} '
        '${two(campus.hour)}:${two(campus.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final active = permission;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              active == null
                  ? '$studentName has no active permission to create a session.'
                  : '$studentName can create 1 session until '
                        '${_until(active.expiresAt)}.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: active == null ? onGrant : onRevoke,
            child: Text(active == null ? 'Give permission' : 'Revoke'),
          ),
        ],
      ),
    );
  }
}
