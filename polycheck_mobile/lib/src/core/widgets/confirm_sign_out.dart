import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/session_provider.dart';
import '../router/routes/app_routes.dart';
import 'campus_dialog.dart';

/// Confirmed sign-out (RN `android/lib/sign-out.ts:64-77` parity).
///
/// Every user-initiated sign-out affordance routes through this helper:
/// logging out clears the encrypted offline store owner and the session, so
/// the destructive confirmation is mandatory. The denied copy is the RN one
/// verbatim; navigation lands back on the portal select screen.

const String confirmSignOutTitle = 'Sign out?';
const String confirmSignOutMessage =
    'You will need to sign in again to use Polycheck.';

/// Destructive confirm dialog. Returns `true` only when the person tapped
/// "Sign out"; false for cancel/dismiss (tests drive both paths directly).
///
/// The actions are built with the dialog's own context: this dialog rides the
/// root navigator while callers may live inside a nested shell navigator
/// (student/faculty `ShellRoute`), so a caller-context `pop` would remove the
/// page and leave `logout()` un-run (the reported blank-screen crash).
Future<bool> showConfirmSignOutDialog(
  BuildContext context, {
  String confirmLabel = 'Sign out',
  String cancelLabel = 'Cancel',
}) async {
  final result = await showCampusDialog<bool>(
    context,
    title: confirmSignOutTitle,
    description: confirmSignOutMessage,
    actionBuilders: [
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(false),
        child: Text(cancelLabel),
      ),
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(true),
        style: TextButton.styleFrom(
          foregroundColor: Theme.of(dialogContext).colorScheme.error,
        ),
        child: Text(confirmLabel),
      ),
    ],
  );
  return result ?? false;
}

/// Full flow: confirm → clear the session (arming the device cooldown per the
/// device-integrity contract) → land on the portal select screen.
Future<void> confirmSignOut(BuildContext context, WidgetRef ref) async {
  final confirmed = await showConfirmSignOutDialog(context);
  if (!confirmed) return;
  await ref.read(sessionProvider.notifier).logout(armDeviceCooldown: true);
  if (!context.mounted) return;
  context.go(AppRoutes.portal);
}
