import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/widgets/confirm_sign_out.dart';

/// Student dashboard sign-out affordance (RN parity — every role needs a
/// confirmed exit; gap report B-15: students previously had none).
class SignOutFooterTile extends ConsumerWidget {
  const SignOutFooterTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      key: const ValueKey('student-sign-out'),
      onTap: () => confirmSignOut(context, ref),
      semanticLabel: 'Sign out of Polycheck',
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: <Widget>[
          Icon(Icons.logout, size: 18, color: tokens.maroon),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Sign out',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Icon(Icons.chevron_right, size: 18, color: tokens.muted),
        ],
      ),
    );
  }
}
