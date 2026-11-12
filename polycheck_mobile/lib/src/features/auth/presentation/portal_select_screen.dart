import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/app_info.dart';
import '../../../core/providers/maintenance_provider.dart';
import '../../../core/router/routes/app_routes.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/theme/pup_tokens.dart';
import '../../../core/widgets/campus_card.dart';
import 'maintenance_screen.dart';

/// PUP-branded portal selection (public landing).
class PortalSelectScreen extends ConsumerWidget {
  const PortalSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenance = ref.watch(maintenanceProvider);
    if (maintenance.enabled) {
      return MaintenanceScreen(
        message: maintenance.message,
        estimatedEnd: maintenance.estimatedEnd,
      );
    }

    final redirect = GoRouterState.of(context).uri.queryParameters['redirect'];
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: tokens.maroon,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 920),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _BrandBlock(tokens: tokens, textTheme: textTheme),
                  const SizedBox(height: 36),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final wide = constraints.maxWidth >= 700;
                      final cards = <Widget>[
                        _PortalCard(
                          icon: Icons.badge_outlined,
                          title: 'Student',
                          description:
                              'Sign in with your student number to view your '
                              'schedule, scan attendance, and manage disputes.',
                          onTap: () => _openLogin(
                            context,
                            AppRoutes.studentLogin,
                            redirect,
                          ),
                        ),
                        _PortalCard(
                          icon: Icons.school_outlined,
                          title: 'Faculty & Staff',
                          description:
                              'Open your classroom cockpit, sessions, reports, '
                              'and department workspaces.',
                          onTap: () => _openLogin(
                            context,
                            AppRoutes.facultyLogin,
                            redirect,
                          ),
                        ),
                      ];
                      if (!wide) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            cards[0],
                            const SizedBox(height: 14),
                            cards[1],
                          ],
                        );
                      }
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: cards[0]),
                          const SizedBox(width: 14),
                          Expanded(child: cards[1]),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 28),
                  Container(
                    height: 1,
                    color: tokens.onMaroon.withValues(alpha: 0.18),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Polycheck - PUP Santa Maria attendance management',
                          style: textTheme.bodySmall?.copyWith(
                            color: tokens.onMaroon.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                      Text(
                        appVersionLabel,
                        style: textTheme.labelSmall?.copyWith(
                          color: tokens.gold,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openLogin(BuildContext context, String path, String? redirect) {
    final uri = Uri(
      path: path,
      queryParameters: redirect == null || redirect.isEmpty
          ? null
          : <String, String>{'redirect': redirect},
    );
    context.go(uri.toString());
  }
}

class _BrandBlock extends StatelessWidget {
  const _BrandBlock({required this.tokens, required this.textTheme});

  final PupTokens tokens;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 58,
              height: 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: tokens.deepMaroon,
                border: Border.all(color: tokens.gold, width: 2),
              ),
              child: Text(
                'PUP',
                style: textTheme.titleMedium?.copyWith(
                  color: tokens.gold,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'POLYTECHNIC UNIVERSITY OF THE PHILIPPINES',
                    style: textTheme.labelSmall?.copyWith(
                      color: tokens.gold,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Santa Maria, Bulacan',
                    style: textTheme.bodySmall?.copyWith(
                      color: tokens.onMaroon.withValues(alpha: 0.72),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        Text(
          'Polycheck',
          style: textTheme.displayMedium?.copyWith(color: tokens.onMaroon),
        ),
        const SizedBox(height: 8),
        Container(width: 64, height: 3, color: tokens.gold),
        const SizedBox(height: 12),
        Text(
          'Secure, offline-first attendance for the PUP community.',
          style: textTheme.bodyLarge?.copyWith(
            color: tokens.onMaroon.withValues(alpha: 0.82),
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

class _PortalCard extends StatelessWidget {
  const _PortalCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;

    return CampusCard(
      onTap: onTap,
      semanticLabel: '$title sign in',
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(height: 4, color: tokens.gold),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tokens.maroon,
                    border: Border.all(color: tokens.gold, width: 1),
                  ),
                  child: Icon(icon, size: 22, color: tokens.gold),
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  style: textTheme.titleLarge?.copyWith(
                    color: tokens.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: textTheme.bodySmall?.copyWith(
                    color: tokens.muted,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Text(
                      'CONTINUE',
                      style: textTheme.labelSmall?.copyWith(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(
                      Icons.arrow_forward,
                      size: 16,
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
