import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

/// Centered maroon spinner with a caption.
class CampusLoading extends StatelessWidget {
  const CampusLoading({
    super.key,
    this.label = 'Loading…',
    this.compact = false,
  });

  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: compact ? 20 : 28,
          height: compact ? 20 : 28,
          child: CircularProgressIndicator(
            strokeWidth: compact ? 2 : 2.5,
            valueColor: AlwaysStoppedAnimation<Color>(
              tokens.isDark ? tokens.gold : tokens.maroon,
            ),
          ),
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );

    if (compact) return content;
    return Center(
      child: Padding(padding: const EdgeInsets.all(24), child: content),
    );
  }
}
