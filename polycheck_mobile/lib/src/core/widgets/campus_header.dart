import 'package:flutter/material.dart';

/// Maroon app bar: title, optional subtitle, actions, optional tab bar.
///
/// Colors come from the app-bar theme so light/dark stay consistent.
class CampusHeader extends StatelessWidget implements PreferredSizeWidget {
  const CampusHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.leading,
    this.bottom,
    this.automaticallyImplyLeading = true,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  final bool automaticallyImplyLeading;

  /// Room for the title, plus a little more when there is a second line.
  double get _toolbarHeight =>
      subtitle != null && subtitle!.isNotEmpty ? 60 : kToolbarHeight;

  // The reserved height must match the toolbar's: any difference shows up as
  // an empty strip under the title.
  @override
  Size get preferredSize =>
      Size.fromHeight(_toolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final appBarTheme = Theme.of(context).appBarTheme;
    final foreground = appBarTheme.foregroundColor ?? Colors.white;

    return AppBar(
      toolbarHeight: _toolbarHeight,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title),
          if (subtitle != null && subtitle!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                subtitle!,
                style: textTheme.bodySmall?.copyWith(
                  color: foreground.withValues(alpha: 0.72),
                ),
              ),
            ),
        ],
      ),
      leading: leading,
      automaticallyImplyLeading: automaticallyImplyLeading,
      actions: actions,
      bottom: bottom,
    );
  }
}
