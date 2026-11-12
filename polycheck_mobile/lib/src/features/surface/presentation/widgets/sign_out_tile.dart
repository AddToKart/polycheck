import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/widgets/confirm_sign_out.dart';

/// Profile `/profile` sign-out tile — the RN post-unregister style exit (gap
/// report §4.4: the Flutter profile previously had no sign-out affordance).
/// The destructive confirm dialog comes from the shared helper so students,
/// teachers, and admins all see the same controls.
class ProfileSignOutTile extends ConsumerWidget {
  const ProfileSignOutTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      key: const ValueKey('profile-sign-out'),
      onTap: () => confirmSignOut(context, ref),
      semanticLabel: 'Sign out of Polycheck',
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tokens.maroon.withValues(
                alpha: tokens.isDark ? 0.25 : 0.08,
              ),
              border: Border.all(color: tokens.maroon.withValues(alpha: 0.25)),
            ),
            child: Icon(
              Icons.logout,
              size: 18,
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Sign out',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  confirmSignOutMessage,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 18, color: tokens.muted),
        ],
      ),
    );
  }
}
