import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers/device_now.dart';
import '../../../../core/providers/trusted_clock.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/utils/cooldown.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_card.dart';

/// `403 active_session_elsewhere` panel.
///
/// Mirrors the web `StudentLoginDeviceGate`: the active session is never
/// kicked; the student must sign out there or ask an instructor for an
/// Emergency Device Release.
class DeviceActiveSessionPanel extends StatelessWidget {
  const DeviceActiveSessionPanel({
    super.key,
    required this.activeDeviceKind,
    required this.message,
    required this.retrying,
    required this.onRetry,
  });

  /// `mobile`, `web`, or null when the server did not identify the holder.
  final String? activeDeviceKind;
  final String? message;
  final bool retrying;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final holder = switch (activeDeviceKind) {
      'mobile' => 'your phone',
      'web' => 'the web browser',
      _ => 'another device',
    };

    return _GateShell(
      icon: Icons.shield_outlined,
      title: 'Already signed in elsewhere',
      message: 'Your account is currently signed in on another device.',
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: tokens.campus,
            border: Border(
              left: BorderSide(color: tokens.maroon, width: 4),
              top: BorderSide(color: tokens.borderSubtle),
              right: BorderSide(color: tokens.borderSubtle),
              bottom: BorderSide(color: tokens.borderSubtle),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'The active session is on $holder. Sign out there first, then '
                'try again. If that device is unavailable, ask your instructor '
                'to issue an Emergency Device Release.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.onSurface,
                  height: 1.45,
                ),
              ),
              if (message != null && message!.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  message!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.muted,
                    height: 1.4,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              // FIX5: the wiped/lost-device consequence path is instructor
              // Emergency Device Release - state it explicitly so a locked-out
              // student knows the seat can be freed without self-serve bypass.
              Text(
                'Lost or wiped that phone? Ask any instructor to run an '
                'Emergency Device Release from your class page.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        CampusButton(
          label: 'Try again',
          loading: retrying,
          onPressed: retrying ? null : onRetry,
        ),
        const SizedBox(height: 10),
        Text(
          'Tip: signing out on the other device first is instant. Instructor '
          'releases are recorded in the audit log.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
        ),
      ],
    );
  }
}

/// `403 device_cooldown_active` panel with a trusted-clock countdown.
class DeviceCooldownPanel extends ConsumerStatefulWidget {
  const DeviceCooldownPanel({
    super.key,
    required this.remainingSeconds,
    required this.anchorMs,
    required this.message,
    required this.retrying,
    required this.onRetry,
  });

  final int remainingSeconds;

  /// Trusted-clock reading when the 403 payload arrived.
  final int anchorMs;
  final String? message;
  final bool retrying;
  final VoidCallback onRetry;

  @override
  ConsumerState<DeviceCooldownPanel> createState() =>
      _DeviceCooldownPanelState();
}

class _DeviceCooldownPanelState extends ConsumerState<DeviceCooldownPanel> {
  Timer? _timer;
  late int _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.remainingSeconds < 0 ? 0 : widget.remainingSeconds;
    _startTimer();
  }

  @override
  void didUpdateWidget(DeviceCooldownPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.remainingSeconds != widget.remainingSeconds ||
        oldWidget.anchorMs != widget.anchorMs) {
      _remaining = widget.remainingSeconds < 0 ? 0 : widget.remainingSeconds;
      _startTimer();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = null;
    if (_remaining <= 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final next = _computeRemaining();
      if (next != _remaining) {
        setState(() => _remaining = next);
      }
      if (next <= 0) {
        _timer?.cancel();
        _timer = null;
      }
    });
  }

  int _computeRemaining() {
    final clock = ref.read(trustedClockProvider);
    final nowMs = clock.nowMs(deviceNow: ref.read(deviceNowProvider));
    final elapsedMs = nowMs - widget.anchorMs;
    final elapsedSeconds = elapsedMs <= 0 ? 0 : elapsedMs ~/ 1000;
    final remaining = widget.remainingSeconds - elapsedSeconds;
    return remaining < 0 ? 0 : remaining;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final complete = _remaining <= 0;

    return _GateShell(
      icon: Icons.lock_outline,
      title: 'Device change cooling down',
      message: widget.message?.trim().isNotEmpty == true
          ? widget.message!.trim()
          : 'This account is locked while a device change cools down.',
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: tokens.campus,
            border: Border(
              left: BorderSide(color: tokens.gold, width: 4),
              top: BorderSide(color: tokens.borderSubtle),
              right: BorderSide(color: tokens.borderSubtle),
              bottom: BorderSide(color: tokens.borderSubtle),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TIME REMAINING',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 4),
              Semantics(
                label: 'Device cooldown time remaining',
                child: Text(
                  formatCooldownCountdown(_remaining),
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text(
          complete
              ? 'Cooldown complete. You can try again now.'
              : 'Signing back in on the device you logged out from is instant. '
                    'If this is a new device, wait for the countdown - or ask '
                    'your instructor to issue an Emergency Device Release.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: tokens.onSurface,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 16),
        CampusButton(
          label: 'Try again',
          loading: widget.retrying,
          onPressed: complete && !widget.retrying ? widget.onRetry : null,
        ),
        if (!complete) ...[
          const SizedBox(height: 8),
          Text(
            'Try again becomes available when the countdown reaches zero.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.35),
          ),
        ],
      ],
    );
  }
}

class _GateShell extends StatelessWidget {
  const _GateShell({
    required this.icon,
    required this.title,
    required this.message,
    required this.children,
  });

  final IconData icon;
  final String title;
  final String message;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: tokens.maroon,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(icon, size: 18, color: tokens.gold),
                const SizedBox(width: 8),
                Text(
                  'DEVICE CHECK',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.gold,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: tokens.onSurface),
                ),
                const SizedBox(height: 6),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    message,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.muted,
                      height: 1.45,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ...children,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
