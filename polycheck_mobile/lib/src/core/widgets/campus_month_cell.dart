import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';
import '../theme/pup_tokens.dart';

/// One status/event dot plotted on a [CampusMonthCell].
///
/// Callers own the palette: the faculty calendar passes its active/inactive
/// event colors, the student calendar passes the PUP attendance status colors
/// (`studentMonthDotStyle`). `border` defaults to [fill] so borderless
/// palettes render identically to a plain filled dot.
@immutable
class CampusMonthDot {
  const CampusMonthDot({required this.fill, this.border});

  final Color fill;
  final Color? border;

  @override
  bool operator ==(Object other) =>
      other is CampusMonthDot && other.fill == fill && other.border == border;

  @override
  int get hashCode => Object.hash(fill, border);

  @override
  String toString() => 'CampusMonthDot($fill, $border)';
}

/// Faculty-geometry month day cell (54px fixed bordered square, 1px margin,
/// surface background, maroon solid fill + white number for today, 6px dots
/// with a `+N` overflow badge).
///
/// Shared by the faculty schedule grid and the student month calendar so both
/// grids share one geometry; each caller keeps its own dot palette via
/// [dots]. [selected] (student day selection) draws a gold border and bolds
/// the number; [inMonth] false mutes the number for padding days.
class CampusMonthCell extends StatelessWidget {
  const CampusMonthCell({
    super.key,
    required this.dayNumber,
    required this.today,
    required this.inMonth,
    this.selected = false,
    this.dots = const <CampusMonthDot>[],
    this.maxDots = 3,
    this.badge,
    this.onTap,
    this.semanticLabel,
  });

  /// Day-of-month number rendered top-left.
  final int dayNumber;

  /// Whether this cell is "today" (maroon fill + white number).
  final bool today;

  /// Whether the date belongs to the displayed month (padding days mute the
  /// number).
  final bool inMonth;

  /// Student day-selection highlight (gold border + bold number).
  final bool selected;

  /// Dots plotted on this date; the first [maxDots] render, the remainder
  /// collapse into the `+N` badge.
  final List<CampusMonthDot> dots;

  /// Maximum dots drawn before the overflow badge takes over.
  final int maxDots;

  /// Explicit badge text; when null and the dots overflow, `+N` is computed.
  final String? badge;

  final VoidCallback? onTap;

  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final numberColor = !inMonth
        ? tokens.muted
        : today
        ? PupColors.white
        : tokens.onSurface;
    final overflow =
        badge ?? (dots.length > maxDots ? '+${dots.length - maxDots}' : null);
    return Semantics(
      button: onTap != null,
      selected: selected,
      label: semanticLabel,
      child: InkWell(
        onTap: onTap,
        child: Container(
          // Internal test hook for the cell surface (unique per subtree).
          key: const ValueKey('campus-month-cell-surface'),
          height: 54,
          margin: const EdgeInsets.all(1),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: today ? tokens.maroon : tokens.surface,
            border: Border.all(
              color: selected ? tokens.gold : tokens.borderSubtle,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$dayNumber',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: today || selected
                      ? FontWeight.w800
                      : FontWeight.w500,
                  color: numberColor,
                ),
              ),
              const Spacer(),
              if (dots.isNotEmpty || overflow != null)
                Wrap(
                  spacing: 2,
                  runSpacing: 2,
                  children: [
                    for (
                      var index = 0;
                      index < dots.length && index < maxDots;
                      index++
                    )
                      Container(
                        key: ValueKey('campus-month-dot-$index'),
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: dots[index].fill,
                          border: Border.all(
                            color: dots[index].border ?? dots[index].fill,
                          ),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    if (overflow != null)
                      Text(
                        overflow,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: today ? PupColors.white : tokens.muted,
                          fontSize: 8,
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
