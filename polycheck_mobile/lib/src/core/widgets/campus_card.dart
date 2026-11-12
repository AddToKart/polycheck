import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

/// Square PUP card: 1px border, flat surface, zero radius.
class CampusCard extends StatelessWidget {
  const CampusCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
    this.borderColor,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.zero,
      side: BorderSide(color: borderColor ?? tokens.borderSubtle),
    );

    if (onTap == null) {
      return Semantics(
        label: semanticLabel,
        child: Container(
          decoration: BoxDecoration(
            color: color ?? tokens.surface,
            border: Border(
              top: shape.side,
              left: shape.side,
              right: shape.side,
              bottom: shape.side,
            ),
            borderRadius: BorderRadius.zero,
          ),
          padding: padding,
          child: child,
        ),
      );
    }

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: color ?? tokens.surface,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.zero,
          overlayColor: WidgetStatePropertyAll(
            tokens.maroon.withValues(alpha: 0.06),
          ),
          highlightColor: Colors.transparent,
          splashColor: Colors.transparent,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}
