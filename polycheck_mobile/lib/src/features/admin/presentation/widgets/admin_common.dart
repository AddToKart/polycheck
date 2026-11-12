import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/models/user.dart';
import '../../../../core/providers/session_provider.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_badge.dart';
import '../../../../core/widgets/campus_card.dart';
import '../../../../core/widgets/campus_empty_state.dart';
import '../../../../core/widgets/campus_header.dart';
import '../../../../core/widgets/campus_loading.dart';
import '../../domain/admin_access.dart';

/// Most sections the persistent console bottom bar may show.
const int adminBottomNavItemLimit = 4;

/// Sections the `AdminShell` renders in the bottom bar, in console order.
///
/// The rule is designation-driven, never static: the bar is the first
/// [adminBottomNavItemLimit] entries of [adminSectionsFor] (super admin:
/// Dashboard / Users / Settings / Audit). A single-section console — the
/// registrar's department-pinned account console — would read as a broken
/// 58px bar, so it keeps popup-only chrome: fewer than two permitted sections
/// yields no bar items. Everything past the limit stays in the header popup.
List<AdminSection> adminBarSectionsFor(PolyUser? user) {
  final sections = adminSectionsFor(user);
  if (sections.length < 2) return const <AdminSection>[];
  return sections.take(adminBottomNavItemLimit).toList(growable: false);
}

/// True when `AdminShell` renders the persistent bottom bar for [user].
bool adminShowsBottomBar(PolyUser? user) =>
    adminBarSectionsFor(user).isNotEmpty;

/// Sections the header popup must offer, in console order.
///
/// Once the bar is visible the popup becomes overflow-only: sections already
/// embedded in the bar are dropped so the same destination never appears
/// twice. When no bar renders (registrar, empty access) this is exactly
/// [adminSectionsFor], which preserves the pre-shell chrome.
List<AdminSection> adminMenuSectionsFor(PolyUser? user) {
  final sections = adminSectionsFor(user);
  final barSections = adminBarSectionsFor(user);
  if (barSections.isEmpty) return sections;
  final embedded = barSections.toSet();
  return <AdminSection>[
    for (final section in sections)
      if (!embedded.contains(section)) section,
  ];
}

/// Shared maroon header + designation-aware section navigation.
class AdminScaffold extends ConsumerWidget {
  const AdminScaffold({
    super.key,
    required this.title,
    required this.section,
    required this.body,
    this.subtitle,
    this.actions = const <Widget>[],
    this.showNav = true,
    this.canBack = true,
  });

  final String title;
  final String? subtitle;
  final AdminSection section;
  final Widget body;
  final List<Widget> actions;
  final bool showNav;

  /// Back affordance (gap report B-13): pushed console screens get the system
  /// back arrow via `automaticallyImplyLeading`, and a deep-linked screen
  /// (notifications → `router.go`) gets an explicit fallback BackButton that
  /// returns to the account's console landing so "sweep back" is never the
  /// only affordance. Tab-style section switching (the popup menu) keeps
  /// `context.go` semantics.
  final bool canBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final access = adminAccessFor(user);
    final sections = adminSectionsFor(user);
    // When the shell's bottom bar is visible the popup only carries the
    // sections the bar cannot fit; otherwise it stays the full console menu.
    final menuSections = adminMenuSectionsFor(user);

    if (!access.canOpen(section)) {
      return Scaffold(
        appBar: CampusHeader(
          title: title,
          subtitle: subtitle,
          automaticallyImplyLeading: true,
        ),
        body: CampusEmptyState(
          icon: Icons.admin_panel_settings_outlined,
          title: 'Administrator access required',
          message:
              'This console is limited to accounts holding the matching '
              'designation. Ask a super admin if you believe this is wrong.',
          actionLabel: 'Back to my home',
          onAction: () => context.go(adminLandingRoute(user)),
        ),
      );
    }

    return Scaffold(
      appBar: CampusHeader(
        title: title,
        subtitle: subtitle,
        automaticallyImplyLeading: canBack,
        leading: canBack && !(Navigator.maybeOf(context)?.canPop() ?? false)
            ? BackButton(
                key: const ValueKey('admin-back-fallback'),
                onPressed: () => context.go(adminLandingRoute(user)),
              )
            : null,
        actions: <Widget>[
          ...actions,
          if (showNav && sections.length > 1 && menuSections.isNotEmpty)
            PopupMenuButton<AdminSection>(
              tooltip: 'Administrator sections',
              icon: const Icon(Icons.apps_outlined),
              onSelected: (next) {
                if (next != section) context.go(next.route);
              },
              itemBuilder: (context) => <PopupMenuEntry<AdminSection>>[
                for (final entry in menuSections)
                  PopupMenuItem<AdminSection>(
                    value: entry,
                    enabled: entry != section,
                    child: Row(
                      children: <Widget>[
                        Icon(
                          _sectionIcon(entry),
                          size: 18,
                          color: entry == section
                              ? PupTheme.of(context).muted
                              : PupTheme.of(context).maroon,
                        ),
                        const SizedBox(width: 10),
                        Text(entry.label),
                      ],
                    ),
                  ),
              ],
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: body,
    );
  }
}

IconData adminSectionIcon(AdminSection section) => _sectionIcon(section);

/// Filled counterpart of [adminSectionIcon] for the selected bottom-bar item.
IconData adminSectionActiveIcon(AdminSection section) =>
    _activeSectionIcon(section);

IconData _sectionIcon(AdminSection section) {
  return switch (section) {
    AdminSection.dashboard => Icons.dashboard_outlined,
    AdminSection.users => Icons.people_alt_outlined,
    AdminSection.settings => Icons.tune_outlined,
    AdminSection.auditLogs => Icons.receipt_long_outlined,
    AdminSection.serverStatus => Icons.monitor_heart_outlined,
    AdminSection.systemReports => Icons.report_gmailerrorred_outlined,
    AdminSection.search => Icons.search,
  };
}

IconData _activeSectionIcon(AdminSection section) {
  return switch (section) {
    AdminSection.dashboard => Icons.dashboard,
    AdminSection.users => Icons.people_alt,
    AdminSection.settings => Icons.tune,
    AdminSection.auditLogs => Icons.receipt_long,
    AdminSection.serverStatus => Icons.monitor_heart,
    AdminSection.systemReports => Icons.report_gmailerrorred,
    AdminSection.search => Icons.search,
  };
}

/// Full-width loading state used by every console screen.
class AdminLoading extends StatelessWidget {
  const AdminLoading({
    super.key,
    this.label = 'Loading…',
    this.compact = false,
  });

  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) =>
      CampusLoading(label: label, compact: compact);
}

/// Retryable error state.
class AdminErrorState extends StatelessWidget {
  const AdminErrorState({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            CampusCard(
              borderColor: tokens.maroon,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Could not load this console',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class AdminStatTile extends StatelessWidget {
  const AdminStatTile({
    super.key,
    required this.label,
    required this.value,
    this.caption,
    this.icon,
  });

  final String label;
  final String value;
  final String? caption;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: 16, color: tokens.maroon),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (caption != null && caption!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 4),
            Text(
              caption!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
        ],
      ),
    );
  }
}

/// Responsive grid of stat tiles (2-up on phones).
class AdminStatGrid extends StatelessWidget {
  const AdminStatGrid({
    super.key,
    required this.children,
    this.minTileWidth = 150,
  });

  final List<Widget> children;
  final double minTileWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width < 420
            ? 2
            : (width / minTileWidth).floor().clamp(2, 4);
        final spacing = 10.0;
        final tileWidth = (width - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: <Widget>[
            for (final child in children)
              SizedBox(width: tileWidth, child: child),
          ],
        );
      },
    );
  }
}

class AdminSectionLabel extends StatelessWidget {
  const AdminSectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            text.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
        ),
        ?trailing,
      ],
    );
  }
}

class AdminFilterChip extends StatelessWidget {
  const AdminFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      selectedColor: tokens.gold,
      backgroundColor: tokens.surface,
      labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: selected ? tokens.deepMaroon : tokens.onSurface,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
      side: BorderSide(color: selected ? tokens.gold : tokens.borderSubtle),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      showCheckmark: false,
    );
  }
}

class AdminStatusChip extends StatelessWidget {
  const AdminStatusChip({
    super.key,
    required this.label,
    required this.active,
    this.positive = true,
  });

  final String label;
  final bool active;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final background = active
        ? (positive ? tokens.gold : tokens.deepMaroon)
        : tokens.campus;
    final foreground = active
        ? (positive ? tokens.deepMaroon : Colors.white)
        : tokens.muted;
    return CampusBadge(
      label: label,
      background: background,
      foreground: foreground,
      border: active && positive
          ? tokens.gold
          : (active ? tokens.deepMaroon : tokens.borderSubtle),
      dense: true,
    );
  }
}

class AdminInfoBanner extends StatelessWidget {
  const AdminInfoBanner({
    super.key,
    required this.message,
    this.icon = Icons.info_outline,
    this.tone = AdminInfoTone.info,
  });

  final String message;
  final IconData icon;
  final AdminInfoTone tone;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final (background, border, foreground) = switch (tone) {
      AdminInfoTone.info => (
        tokens.campus,
        tokens.borderSubtle,
        tokens.onSurface,
      ),
      AdminInfoTone.warning => (
        tokens.gold.withValues(alpha: 0.18),
        tokens.gold,
        tokens.onSurface,
      ),
      AdminInfoTone.error => (tokens.maroon, tokens.maroon, Colors.white),
    };
    return Container(
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 18, color: foreground),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: foreground, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

enum AdminInfoTone { info, warning, error }
