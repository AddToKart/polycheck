import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/device_integrity.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/device_now.dart';
import '../../../core/providers/maintenance_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/providers/trusted_clock.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_text_field.dart';
import 'widgets/auth_shell.dart';
import 'widgets/device_gate_panels.dart';

/// Student sign-in with the backend device-integrity gate.
class StudentLoginScreen extends ConsumerStatefulWidget {
  const StudentLoginScreen({super.key, this.redirect, this.reason});

  /// Deep link preserved through the login round trip.
  final String? redirect;

  /// `expired` when the router sent the user here after a 401.
  final String? reason;

  @override
  ConsumerState<StudentLoginScreen> createState() => _StudentLoginScreenState();
}

class _StudentLoginScreenState extends ConsumerState<StudentLoginScreen> {
  final TextEditingController _studentIdController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  String? _studentIdError;
  String? _passwordError;
  String? _error;
  bool _submitting = false;
  _DeviceGate? _gate;

  bool get _showsExpiredNotice =>
      widget.reason == 'expired' || ref.read(sessionProvider).expiredAt != null;

  @override
  void initState() {
    super.initState();
    if (widget.reason == 'expired') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(sessionProvider.notifier).clearExpiredReason();
      });
    }
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final maintenance = ref.watch(maintenanceProvider);

    return AuthShell(
      eyebrow: 'Authentication required',
      title: 'Student sign in',
      subtitle:
          'Use your PUP student number and password. This device is attached '
          'to the session for integrity checks.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_showsExpiredNotice) ...[
            const AuthInfoBanner(
              message:
                  'Your session was replaced or revoked. Sign in again to '
                  'continue.',
              icon: Icons.lock_clock_outlined,
            ),
            const SizedBox(height: 14),
          ],
          if (maintenance.enabled) ...[
            AuthInfoBanner(
              message:
                  'Polycheck is under scheduled maintenance. Only exempt '
                  'administrators can sign in right now.',
              icon: Icons.build_outlined,
            ),
            const SizedBox(height: 14),
          ],
          if (_gate != null) ...[
            _buildGate(_gate!),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _submitting
                    ? null
                    : () => setState(() => _gate = null),
                child: const Text('Use different credentials'),
              ),
            ),
          ] else
            _buildForm(context),
        ],
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!),
          const SizedBox(height: 14),
        ],
        CampusTextField(
          controller: _studentIdController,
          label: 'Student number',
          hint: '2024-00123-MN-0',
          prefixIcon: Icons.badge_outlined,
          errorText: _studentIdError,
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.username],
          onChanged: (_) {
            if (_studentIdError != null) {
              setState(() => _studentIdError = null);
            }
          },
        ),
        const SizedBox(height: 14),
        CampusTextField(
          controller: _passwordController,
          label: 'Password',
          obscure: true,
          prefixIcon: Icons.lock_outline,
          errorText: _passwordError,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.password],
          onChanged: (_) {
            if (_passwordError != null) {
              setState(() => _passwordError = null);
            }
          },
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        CampusButton(
          label: _submitting ? 'Verifying...' : 'Sign in',
          loading: _submitting,
          onPressed: _submitting ? null : _submit,
        ),
        const SizedBox(height: 14),
        Text(
          'The active QR / location evidence policy applies to every '
          'attendance submission. If this device is blocked, your instructor '
          'can issue an Emergency Device Release.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.45),
        ),
      ],
    );
  }

  Widget _buildGate(_DeviceGate gate) {
    return switch (gate) {
      final _ActiveSessionGate active => DeviceActiveSessionPanel(
        activeDeviceKind: active.activeDeviceKind?.wire,
        message: active.message,
        retrying: _submitting,
        onRetry: () => _submit(fromGate: true),
      ),
      final _CooldownGate cooldown => DeviceCooldownPanel(
        key: ValueKey<int>(cooldown.anchorMs),
        remainingSeconds: cooldown.remainingSeconds,
        anchorMs: cooldown.anchorMs,
        message: cooldown.message,
        retrying: _submitting,
        onRetry: () => _submit(fromGate: true),
      ),
    };
  }

  bool _validate() {
    final studentId = _studentIdController.text.trim();
    final password = _passwordController.text;
    final studentIdError = studentId.isEmpty
        ? 'Enter your student number.'
        : null;
    final passwordError = password.isEmpty ? 'Enter your password.' : null;
    setState(() {
      _studentIdError = studentIdError;
      _passwordError = passwordError;
      _error = null;
    });
    return studentIdError == null && passwordError == null;
  }

  Future<void> _submit({bool fromGate = false}) async {
    if (_submitting) return;
    if (!fromGate && !_validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final user = await ref
          .read(sessionProvider.notifier)
          .loginStudent(
            studentId: _studentIdController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      if (user.mustChangePassword) {
        // The router's forced-rotation guard takes over.
        return;
      }
      final role = resolveAppRole(
        user,
        officerPresident: false,
        officerQac: false,
      );
      final destination =
          resolvePostLoginDestination(
            redirect: widget.redirect,
            role: role,
            user: user,
          ) ??
          roleHome(role);
      context.go(destination);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      _applyApiError(error);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _gate = null;
        _error =
            'Unable to sign in. Please check your connection and try again.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _applyApiError(ApiRequestError error) {
    if (error.isActiveSessionElsewhere) {
      setState(() {
        _gate = _ActiveSessionGate(
          activeDeviceKind: error.activeDeviceKind,
          message: error.message,
        );
        _error = null;
      });
      return;
    }
    if (error.isDeviceCooldown) {
      final seconds =
          error.remainingSeconds ?? ((error.remainingMinutes ?? 1) * 60);
      final clock = ref.read(trustedClockProvider);
      final anchorMs = clock.nowMs(deviceNow: ref.read(deviceNowProvider));
      setState(() {
        _gate = _CooldownGate(
          remainingSeconds: seconds < 1 ? 1 : seconds,
          anchorMs: anchorMs,
          message: error.message,
        );
        _error = null;
      });
      return;
    }

    setState(() {
      _gate = null;
      if (error.isUnauthorized) {
        _error = 'Invalid student ID or password.';
      } else if (error.isMaintenance) {
        _error = error.message;
      } else if (error.isNetworkFailure) {
        _error =
            'Cannot reach the Polycheck server. Check your connection and try '
            'again.';
      } else {
        _error = error.message.isEmpty
            ? 'Unable to sign in. Please try again.'
            : error.message;
      }
    });
  }
}

sealed class _DeviceGate {
  const _DeviceGate();
}

class _ActiveSessionGate extends _DeviceGate {
  const _ActiveSessionGate({required this.activeDeviceKind, this.message});

  final ActiveDeviceKind? activeDeviceKind;
  final String? message;
}

class _CooldownGate extends _DeviceGate {
  const _CooldownGate({
    required this.remainingSeconds,
    required this.anchorMs,
    this.message,
  });

  final int remainingSeconds;
  final int anchorMs;
  final String? message;
}
