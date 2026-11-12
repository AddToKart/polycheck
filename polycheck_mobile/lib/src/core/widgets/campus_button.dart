import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';
import '../theme/pup_tokens.dart';

enum CampusButtonVariant { primary, gold, outline, destructive }

/// Square, flat PUP action button with an inline loading state.
///
/// Loading disables the tap target and keeps the width stable so forms never
/// jump when a request starts.
class CampusButton extends StatelessWidget {
  const CampusButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = CampusButtonVariant.primary,
    this.loading = false,
    this.icon,
    this.expand = true,
    this.height = 48,
  });

  final String label;
  final VoidCallback? onPressed;
  final CampusButtonVariant variant;
  final bool loading;
  final IconData? icon;
  final bool expand;
  final double height;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final enabled = !loading && onPressed != null;
    final foreground = _foreground(tokens, enabled: enabled);
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(foreground),
            ),
          ),
          const SizedBox(width: 10),
        ] else if (icon != null) ...[
          Icon(icon, size: 18, color: foreground),
          const SizedBox(width: 8),
        ],
        Text(
          label,
          style: TextStyle(fontWeight: FontWeight.w600, color: foreground),
        ),
      ],
    );

    final button = switch (variant) {
      CampusButtonVariant.primary => ElevatedButton(
        onPressed: enabled ? onPressed : null,
        child: content,
      ),
      CampusButtonVariant.destructive => ElevatedButton(
        onPressed: enabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: tokens.deepMaroon,
          foregroundColor: PupColors.white,
          disabledBackgroundColor: tokens.muted.withValues(alpha: 0.35),
          disabledForegroundColor: tokens.muted,
          elevation: 0,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
        child: content,
      ),
      CampusButtonVariant.gold => ElevatedButton(
        onPressed: enabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: tokens.gold,
          foregroundColor: tokens.deepMaroon,
          disabledBackgroundColor: tokens.muted.withValues(alpha: 0.35),
          disabledForegroundColor: tokens.muted,
          elevation: 0,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
        child: content,
      ),
      CampusButtonVariant.outline => OutlinedButton(
        onPressed: enabled ? onPressed : null,
        child: content,
      ),
    };

    return SizedBox(
      width: expand ? double.infinity : null,
      height: height,
      child: button,
    );
  }

  Color _foreground(PupTokens tokens, {required bool enabled}) {
    if (!enabled) return tokens.muted;
    return switch (variant) {
      CampusButtonVariant.primary ||
      CampusButtonVariant.destructive => PupColors.white,
      CampusButtonVariant.gold => tokens.deepMaroon,
      CampusButtonVariant.outline =>
        tokens.isDark ? tokens.gold : tokens.maroon,
    };
  }
}
