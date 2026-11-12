import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

/// One destination of a [CampusBottomNav].
class CampusBottomNavItem {
  const CampusBottomNavItem({
    required this.id,
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  /// Stable identifier used for test keys (`campus-nav-<id>` /
  /// `campus-nav-selected-<id>`); unique within one bar.
  final String id;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
}

/// Shared full-width flat bottom navigation bar (student geometry).
///
/// Both shells (student + faculty) render this exact component: full-width,
/// flat surface, hairline top border, 58px row, and a 3px gold indicator on
/// the selected item attached to the bar's top edge. Tapping the selected
/// item is a no-op so re-tapping the active tab never re-navigates.
class CampusBottomNav extends StatelessWidget {
  const CampusBottomNav({super.key, required this.items});

  final List<CampusBottomNavItem> items;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Material(
      color: tokens.surface,
      child: SafeArea(
        top: false,
        child: Container(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: tokens.borderSubtle)),
          ),
          child: SizedBox(
            height: 58,
            child: Row(
              children: [
                for (final item in items) _CampusBottomNavItemCell(item: item),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CampusBottomNavItemCell extends StatelessWidget {
  const _CampusBottomNavItemCell({required this.item});

  final CampusBottomNavItem item;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final color = item.selected
        ? (tokens.isDark ? tokens.gold : tokens.maroon)
        : tokens.muted;
    return Expanded(
      child: Semantics(
        selected: item.selected,
        button: true,
        label: item.label,
        child: InkWell(
          key: ValueKey<String>('campus-nav-${item.id}'),
          onTap: item.selected ? null : item.onTap,
          child: Column(
            children: [
              Container(
                key: item.selected
                    ? ValueKey<String>('campus-nav-selected-${item.id}')
                    : null,
                height: 3,
                color: item.selected ? tokens.gold : Colors.transparent,
              ),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      item.selected ? item.activeIcon : item.icon,
                      size: 21,
                      color: color,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: color,
                        fontWeight: item.selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
