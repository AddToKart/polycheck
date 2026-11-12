import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/widgets/privacy_consent_gate.dart';
import '../providers/maintenance_provider.dart';
import '../providers/session_provider.dart';
import '../theme/pup_theme.dart';
import '../utils/designations.dart';
import '../widgets/campus_toast.dart';
import 'routes/app_routes.dart';

/// Root authenticated/public shell.
///
/// * binds [CampusToast] to the navigator overlay,
/// * shows the persistent maintenance-exemption notice for exempt staff,
/// * hosts the app-wide privacy-consent overlay.
class AppRootShell extends ConsumerWidget {
  const AppRootShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenance = ref.watch(maintenanceProvider);
    final user = ref.watch(sessionProvider.select((state) => state.user));
    final exempt =
        maintenance.enabled && user != null && isMaintenanceExempt(user);
    final topInset = MediaQuery.paddingOf(context).top;

    final content = Stack(
      fit: StackFit.expand,
      children: [child, const PrivacyConsentGate()],
    );

    return CampusToastBinder(
      child: exempt
          ? Column(
              children: [
                _ExemptBanner(message: maintenance.message, topInset: topInset),
                Expanded(
                  child: MediaQuery.removePadding(
                    context: context,
                    removeTop: true,
                    child: content,
                  ),
                ),
              ],
            )
          : content,
    );
  }
}

class _ExemptBanner extends StatelessWidget {
  const _ExemptBanner({required this.message, required this.topInset});

  final String message;
  final double topInset;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Material(
      color: tokens.gold,
      child: Padding(
        padding: EdgeInsets.fromLTRB(14, topInset + 6, 8, 6),
        child: Row(
          children: [
            Icon(Icons.build_outlined, size: 16, color: tokens.deepMaroon),
            const SizedBox(width: 8),
            Expanded(
              child: Tooltip(
                message: message,
                child: Text(
                  'Maintenance mode - exemption active',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.deepMaroon,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ),
            TextButton(
              onPressed: () => context.go(AppRoutes.maintenance),
              style: TextButton.styleFrom(
                foregroundColor: tokens.deepMaroon,
                minimumSize: const Size(48, 36),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: const Text('View status'),
            ),
          ],
        ),
      ),
    );
  }
}
