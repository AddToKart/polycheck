import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

/// Zero-radius bottom-sheet body with a drag handle and optional title.
///
/// The scrollable body is capped at [maxHeight] (default 65% of the screen) so
/// long content — e.g. the full course catalog — can never fill the whole
/// sheet. Pass `null` to disable the cap.
class CampusBottomSheet extends StatelessWidget {
  const CampusBottomSheet({
    super.key,
    this.title,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 16),
    this.showHandle = true,
    this.maxHeight,
  });

  final String? title;
  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool showHandle;

  /// Maximum height of the scrollable body. Defaults to 65% of the screen
  /// height; `null` means uncapped.
  final double? maxHeight;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final cap =
        maxHeight ?? MediaQuery.sizeOf(context).height * _defaultMaxHeightRatio;
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHandle)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: Container(
                  width: 36,
                  height: 3,
                  color: tokens.borderSubtle,
                ),
              ),
            ),
          if (title != null && title!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Text(
                title!,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: cap),
              child: SingleChildScrollView(padding: padding, child: child),
            ),
          ),
        ],
      ),
    );
  }

  static const double _defaultMaxHeightRatio = 0.65;
}

/// Presents a modal bottom sheet with the PUP square treatment and keyboard
/// inset handling (Android 15 edge-to-edge friendly).
///
/// [maxHeight] caps the scrollable body (default 65% of the screen height);
/// pass `double.infinity` for the old uncapped behavior.
Future<T?> showCampusBottomSheet<T>(
  BuildContext context, {
  required Widget child,
  String? title,
  bool isScrollControlled = true,
  bool isDismissible = true,
  double? maxHeight,
}) {
  final tokens = PupTheme.of(context);
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    isDismissible: isDismissible,
    backgroundColor: tokens.surface,
    elevation: 0,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    builder: (sheetContext) {
      return Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: CampusBottomSheet(
          title: title,
          maxHeight: maxHeight,
          child: child,
        ),
      );
    },
  );
}
