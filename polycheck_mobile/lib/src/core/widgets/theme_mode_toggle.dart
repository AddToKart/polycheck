import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/theme_mode_provider.dart';

/// One-tap light/dark switch for headers and public screens. It flips the
/// theme that is on screen right now (even while following the system), then
/// remembers the choice.
class ThemeModeToggleButton extends ConsumerWidget {
  const ThemeModeToggleButton({super.key, this.color});

  /// Icon color; omit to inherit from the surrounding app bar.
  final Color? color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return IconButton(
      key: const ValueKey<String>('theme-mode-toggle'),
      tooltip: isDark ? 'Switch to light theme' : 'Switch to dark theme',
      color: color,
      icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
      onPressed: () => ref
          .read(themeModeProvider.notifier)
          .set(isDark ? ThemeMode.light : ThemeMode.dark),
    );
  }
}
