import 'package:flutter/material.dart';

import '../../../core/theme/pup_theme.dart';
import '../../../core/theme/pup_tokens.dart';
import '../../../core/widgets/campus_loading.dart';

/// Cold-start restore gate (FLR-02).
///
/// The guard parks every requested location here while the session is
/// `unknown`/`restoring`/`authenticating`, then re-evaluates the same location
/// once the state is authoritative — so a protected screen (and any QR it
/// renders) is never mounted against a session that has not been verified yet.
/// The target rides along in `?redirect=` for diagnostics only; the router
/// keeps the original location and resolves it itself.
class BootScreen extends StatelessWidget {
  const BootScreen({super.key, this.redirect});

  /// The location the user asked for, surfaced for debug builds only.
  final String? redirect;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: tokens.maroon,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'POLYCHECK',
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: tokens.gold,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2.4,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Polytechnic University of the Philippines',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: PupColors.white.withValues(alpha: 0.82),
                ),
              ),
              const SizedBox(height: 28),
              CampusLoading(label: 'Restoring your session.', compact: true),
            ],
          ),
        ),
      ),
    );
  }
}
