import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/campus_toast.dart';

/// Navigation helper for cross-wave destinations.
///
/// Other waves own most notification targets, so a destination may not be
/// registered in the current build. Instead of landing on the router error
/// screen this checks the live route configuration first and gracefully
/// explains the fallback.
abstract final class SurfaceNavigation {
  static bool open(
    BuildContext context,
    String location, {
    String? unavailableMessage,
  }) {
    final router = GoRouter.maybeOf(context);
    if (router == null) return false;
    Uri? uri;
    try {
      uri = Uri.parse(location);
    } on FormatException {
      uri = null;
    }
    if (uri == null || !uri.path.startsWith('/')) {
      CampusToast.showIn(
        context,
        unavailableMessage ?? 'That destination is not available.',
        tone: CampusToastTone.warning,
      );
      return false;
    }
    final match = router.configuration.findMatch(uri);
    if (match.isError) {
      CampusToast.showIn(
        context,
        unavailableMessage ??
            'This screen is not available in the current build yet.',
        tone: CampusToastTone.warning,
      );
      return false;
    }
    // Safe guard (FIX3): never run `go` for the location already shown. A
    // redundant `go` collapses the stack and would remove a pushed back
    // affordance; callers that only need "be there" get a no-op success.
    // Prefer the live page state (`GoRouterState`), which knows pushed pages;
    // the delegate's current configuration only tracks the base match.
    final current =
        _liveLocation(context) ??
        router.routerDelegate.currentConfiguration.uri.toString();
    if (current == location) return true;
    router.go(location);
    return true;
  }

  /// Full location of the page owning [context].
  ///
  /// Returns null when [context] is not inside a `GoRouter` page (for example
  /// a context captured before the first route match); callers fall back to
  /// the delegate configuration.
  static String? _liveLocation(BuildContext context) {
    try {
      return GoRouterState.of(context).uri.toString();
    } catch (_) {
      return null;
    }
  }
}
