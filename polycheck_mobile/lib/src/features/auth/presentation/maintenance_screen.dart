import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/device_now.dart';
import '../../../core/providers/maintenance_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/providers/trusted_clock.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/router/routes/app_routes.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/designations.dart';
import '../../../core/utils/maintenance_time.dart';
import '../../../core/widgets/campus_card.dart';

/// Branded maintenance surface (route, portal replacement, and login embed).
///
/// While mounted it runs the 30-second public-status recovery poll and leaves
/// automatically once the server reports maintenance off.
class MaintenanceScreen extends ConsumerStatefulWidget {
  const MaintenanceScreen({
    super.key,
    this.message,
    this.estimatedEnd,
    this.embedded = false,
    this.showAdminLogin = true,
    this.studentNotice = true,
  });

  final String? message;
  final String? estimatedEnd;
  final bool embedded;
  final bool showAdminLogin;
  final bool studentNotice;

  @override
  ConsumerState<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends ConsumerState<MaintenanceScreen> {
  Timer? _ticker;
  MaintenanceController? _maintenance;

  @override
  void initState() {
    super.initState();
    _maintenance = ref.read(maintenanceProvider.notifier);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _maintenance?.startPolling();
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _maintenance?.stopPolling();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(maintenanceProvider);
    final session = ref.watch(sessionProvider);

    ref.listen<MaintenanceState>(maintenanceProvider, (previous, next) {
      if (previous?.enabled == true && !next.enabled) {
        _leaveOnRecovery();
      }
    });

    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;
    final exempt = session.isSignedIn && isMaintenanceExempt(session.user);
    final active = state.enabled || widget.message != null;
    final message = widget.message ?? state.message;
    final estimatedEnd = widget.estimatedEnd ?? state.estimatedEnd;
    final countdown = formatMaintenanceRemaining(estimatedEnd, _trustedNowMs());

    final card = CampusCard(
      color: tokens.deepMaroon,
      borderColor: tokens.gold.withValues(alpha: 0.35),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: tokens.maroon,
                        border: Border.all(color: tokens.gold, width: 2),
                      ),
                      child: Text(
                        'PUP',
                        style: textTheme.titleSmall?.copyWith(
                          color: tokens.gold,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Icon(Icons.build_outlined, size: 38, color: tokens.gold),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  active ? 'SCHEDULED MAINTENANCE' : 'SYSTEMS AVAILABLE',
                  textAlign: TextAlign.center,
                  style: textTheme.labelSmall?.copyWith(
                    color: tokens.gold,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2.0,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  active
                      ? 'Polycheck is under scheduled maintenance'
                      : 'Polycheck is available',
                  textAlign: TextAlign.center,
                  style: textTheme.headlineSmall?.copyWith(
                    color: tokens.onMaroon,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  active
                      ? message
                      : 'The server is accepting requests. Continue to the '
                            'portal or your dashboard.',
                  textAlign: TextAlign.center,
                  style: textTheme.bodySmall?.copyWith(
                    color: tokens.mutedOnMaroon,
                    height: 1.5,
                  ),
                ),
                if (active &&
                    countdown.tone != MaintenanceCountdownTone.none) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: tokens.gold.withValues(alpha: 0.1),
                      border: Border.all(
                        color:
                            countdown.tone == MaintenanceCountdownTone.overdue
                            ? tokens.gold
                            : tokens.onMaroon.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.schedule, size: 15, color: tokens.gold),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            countdown.label,
                            style: textTheme.labelSmall?.copyWith(
                              color: tokens.onMaroon,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (exempt) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: tokens.gold.withValues(alpha: 0.12),
                      border: Border.all(color: tokens.gold),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'MAINTENANCE EXEMPTION ACTIVE',
                          style: textTheme.labelSmall?.copyWith(
                            color: tokens.gold,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Your super-admin / IT-coordinator designation keeps '
                          'navigation available. Actions still depend on the '
                          'server being reachable.',
                          style: textTheme.bodySmall?.copyWith(
                            color: tokens.onMaroon,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (widget.studentNotice && active) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.18),
                      border: Border(
                        left: BorderSide(color: tokens.gold, width: 4),
                        top: BorderSide(
                          color: tokens.onMaroon.withValues(alpha: 0.14),
                        ),
                        right: BorderSide(
                          color: tokens.onMaroon.withValues(alpha: 0.14),
                        ),
                        bottom: BorderSide(
                          color: tokens.onMaroon.withValues(alpha: 0.14),
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'YOUR RECORDS ARE SAFE',
                          style: textTheme.labelSmall?.copyWith(
                            color: tokens.gold,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'In-class attendance continues normally. Offline '
                          'records are securely stored on this device and will '
                          'sync as soon as servers reopen.',
                          style: textTheme.bodySmall?.copyWith(
                            color: tokens.onMaroon.withValues(alpha: 0.85),
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (state.error != null) ...[
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      state.error!,
                      textAlign: TextAlign.center,
                      style: textTheme.bodySmall?.copyWith(
                        color: tokens.gold,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                if (active)
                  _MaintenanceAction(
                    label: 'Check again',
                    loading: state.probing,
                    onPressed: state.probing
                        ? null
                        : () => ref.read(maintenanceProvider.notifier).probe(),
                  ),
                if (!active) ...[
                  _MaintenanceAction(
                    label: session.isSignedIn
                        ? 'Continue to dashboard'
                        : 'Go to portal',
                    filled: true,
                    onPressed: () => _leaveOnRecovery(),
                  ),
                ],
                if (exempt && active) ...[
                  const SizedBox(height: 10),
                  _MaintenanceAction(
                    label: 'Continue with exemption',
                    filled: true,
                    onPressed: () => _goHome(),
                  ),
                ],
                const SizedBox(height: 16),
                Container(
                  height: 1,
                  color: tokens.onMaroon.withValues(alpha: 0.15),
                ),
                const SizedBox(height: 12),
                Text(
                  'IT desk: Campus MIS Office (IT Coordinator)\n'
                  'Support: Office of the Campus Director',
                  textAlign: TextAlign.center,
                  style: textTheme.bodySmall?.copyWith(
                    color: tokens.mutedOnMaroon,
                    height: 1.5,
                  ),
                ),
                if (widget.showAdminLogin && !session.isSignedIn) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: tokens.gold,
                      minimumSize: const Size(48, 44),
                    ),
                    onPressed: () => context.go(AppRoutes.facultyLogin),
                    child: const Text('Administrator login'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    final content = Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: card,
        ),
      ),
    );

    if (widget.embedded) return content;
    return Scaffold(
      backgroundColor: tokens.maroon,
      body: SafeArea(child: content),
    );
  }

  int _trustedNowMs() {
    final clock = ref.read(trustedClockProvider);
    return clock.nowMs(deviceNow: ref.read(deviceNowProvider));
  }

  void _leaveOnRecovery() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _goHome();
    });
  }

  void _goHome() {
    final session = ref.read(sessionProvider);
    if (!session.isSignedIn) {
      context.go(AppRoutes.portal);
      return;
    }
    final role = resolveAppRole(
      session.user,
      officerPresident: false,
      officerQac: false,
    );
    context.go(roleHome(role));
  }
}

class _MaintenanceAction extends StatelessWidget {
  const _MaintenanceAction({
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.filled = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final foreground = filled ? tokens.deepMaroon : tokens.gold;
    final enabled = !loading && onPressed != null;
    final child = loading
        ? SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(foreground),
            ),
          )
        : Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: enabled ? foreground : foreground.withValues(alpha: 0.55),
              fontWeight: FontWeight.w600,
            ),
          );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.zero,
      side: filled
          ? BorderSide.none
          : BorderSide(color: tokens.gold.withValues(alpha: 0.55)),
    );

    final button = filled
        ? ElevatedButton(
            onPressed: enabled ? onPressed : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: tokens.gold,
              foregroundColor: tokens.deepMaroon,
              disabledBackgroundColor: tokens.gold.withValues(alpha: 0.3),
              disabledForegroundColor: tokens.deepMaroon.withValues(alpha: 0.5),
              elevation: 0,
              shape: shape,
              minimumSize: const Size(48, 48),
            ),
            child: child,
          )
        : OutlinedButton(
            onPressed: enabled ? onPressed : null,
            style: OutlinedButton.styleFrom(
              foregroundColor: tokens.gold,
              disabledForegroundColor: tokens.gold.withValues(alpha: 0.5),
              side: shape.side,
              shape: shape,
              minimumSize: const Size(48, 48),
            ),
            child: child,
          );

    return SizedBox(width: double.infinity, height: 48, child: button);
  }
}
