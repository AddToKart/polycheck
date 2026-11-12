import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/routes/app_routes.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_header.dart';

/// Shared zero-radius authentication page chrome.
class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.child,
    this.subtitle,
    this.showBack = true,
    this.actions,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final Widget child;
  final bool showBack;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: CampusHeader(
        title: 'Polycheck',
        subtitle: 'Polytechnic University of the Philippines',
        automaticallyImplyLeading: false,
        leading: showBack
            ? IconButton(
                tooltip: 'Back to portal',
                onPressed: () => context.go(AppRoutes.portal),
                icon: const Icon(Icons.arrow_back),
              )
            : null,
        actions: actions,
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    eyebrow.toUpperCase(),
                    style: textTheme.labelSmall?.copyWith(
                      color: tokens.muted,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.6,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    title,
                    style: textTheme.headlineMedium?.copyWith(
                      color: tokens.onSurface,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      subtitle!,
                      style: textTheme.bodyMedium?.copyWith(
                        color: tokens.muted,
                        height: 1.45,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Container(width: 48, height: 2, color: tokens.gold),
                  const SizedBox(height: 22),
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Inline form/API error band (square, maroon rail).
class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: tokens.maroon.withValues(alpha: tokens.isDark ? 0.22 : 0.06),
        border: Border(
          left: BorderSide(color: tokens.maroon, width: 4),
          top: BorderSide(color: tokens.borderSubtle),
          right: BorderSide(color: tokens.borderSubtle),
          bottom: BorderSide(color: tokens.borderSubtle),
        ),
      ),
      child: Semantics(
        liveRegion: true,
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: tokens.isDark ? tokens.gold : tokens.maroon,
            fontWeight: FontWeight.w600,
            height: 1.4,
          ),
        ),
      ),
    );
  }
}

/// Neutral information band used for the expired-session notice.
class AuthInfoBanner extends StatelessWidget {
  const AuthInfoBanner({
    super.key,
    required this.message,
    this.icon = Icons.info_outline,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border(
          left: BorderSide(color: tokens.gold, width: 4),
          top: BorderSide(color: tokens.borderSubtle),
          right: BorderSide(color: tokens.borderSubtle),
          bottom: BorderSide(color: tokens.borderSubtle),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: tokens.maroon),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.onSurface,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
