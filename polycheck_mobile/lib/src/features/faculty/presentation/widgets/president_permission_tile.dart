import 'package:flutter/material.dart';

import '../../../../core/models/section_role.dart';
import '../../../../core/theme/brand_theme.dart';
import '../../../../core/widgets/campus_dialog.dart';
import '../../../../core/widgets/campus_text_field.dart';
import '../../../../core/widgets/form_feedback.dart';

/// Longest a permission can last and most sessions it can allow, mirroring the
/// server.
const int sessionPermissionMaxHours = 168;
const int sessionPermissionMaxSessions = 20;

/// What the professor chose: how long, and how many sessions.
typedef PermissionChoice = ({int hours, int sessions});

/// Asks what the president's permission should allow; null when cancelled.
Future<PermissionChoice?> askPermission(
  BuildContext context,
  String studentName,
) {
  return showCampusDialog<PermissionChoice>(
    context,
    title: 'Give permission',
    description:
        '$studentName can create this many sessions, and start and end only '
        'those, until the time runs out.',
    actionBuilders: [
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(),
        child: const Text('Cancel'),
      ),
    ],
    child: const _PermissionForm(),
  );
}

class _PermissionForm extends StatefulWidget {
  const _PermissionForm();

  @override
  State<_PermissionForm> createState() => _PermissionFormState();
}

class _PermissionFormState extends State<_PermissionForm> {
  final TextEditingController _sessions = TextEditingController(text: '1');
  final TextEditingController _custom = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _sessions.dispose();
    _custom.dispose();
    super.dispose();
  }

  void _choose(int? hours) {
    final sessions = int.tryParse(_sessions.text.trim());
    if (sessions == null ||
        sessions < 1 ||
        sessions > sessionPermissionMaxSessions) {
      setState(
        () => _error =
            'Enter a number of sessions from 1 to '
            '$sessionPermissionMaxSessions.',
      );
      return;
    }
    if (hours == null || hours < 1 || hours > sessionPermissionMaxHours) {
      setState(
        () => _error =
            'Enter a whole number of hours from 1 to '
            '$sessionPermissionMaxHours.',
      );
      return;
    }
    Navigator.of(context).pop((hours: hours, sessions: sessions));
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampusTextField(
            key: const ValueKey('permission-sessions'),
            label: 'Number of sessions',
            controller: _sessions,
            keyboardType: TextInputType.number,
            inputFormatters: wholeNumberFormatters(2),
          ),
          const SizedBox(height: 12),
          const Text('Choose how long it lasts'),
          const SizedBox(height: 8),
          for (final hours in const [8, 24]) ...[
            OutlinedButton(
              key: ValueKey('permission-$hours-hours'),
              onPressed: () => _choose(hours),
              child: Text('$hours hours'),
            ),
            const SizedBox(height: 8),
          ],
          CampusTextField(
            key: const ValueKey('permission-custom-hours'),
            label: 'Custom hours',
            hint: 'For example 3',
            controller: _custom,
            keyboardType: TextInputType.number,
            inputFormatters: wholeNumberFormatters(3),
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
            onPressed: () => _choose(int.tryParse(_custom.text.trim())),
            child: const Text('Use custom hours'),
          ),
        ],
      ),
    );
  }
}

/// The president's permission: what it allows now, and the buttons to change it.
class PresidentPermissionTile extends StatelessWidget {
  const PresidentPermissionTile({
    super.key,
    required this.studentName,
    required this.permission,
    required this.onGrant,
    required this.onRevoke,
  });

  final String studentName;

  /// The permission whose time limit is still running, if there is one.
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
    // A new one can be given when none is running or all its sessions are used.
    final canGrant =
        active == null || active.sessionsUsed >= active.sessionLimit;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            active == null
                ? '$studentName has no active permission to create a session.'
                : '$studentName used ${active.sessionsUsed} of '
                      '${active.sessionLimit} session'
                      '${active.sessionLimit == 1 ? '' : 's'}, until '
                      '${_until(active.expiresAt)}.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          Wrap(
            alignment: WrapAlignment.end,
            children: [
              if (active != null)
                TextButton(onPressed: onRevoke, child: const Text('Revoke')),
              if (canGrant)
                TextButton(
                  onPressed: onGrant,
                  child: const Text('Give permission'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
