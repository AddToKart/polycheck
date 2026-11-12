import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

enum CampusToastTone { success, error, info, warning }

/// App-level toast overlay — business screens never depend on
/// `ScaffoldMessenger`.
///
/// Mount [CampusToastBinder] inside the navigator (e.g. around the role shell
/// or the boot scaffold) to register the overlay; `CampusToast.show(...)` then
/// works from any provider/controller. `CampusToast.showIn(context, ...)`
/// resolves the root overlay directly when a context is available.
abstract final class CampusToast {
  static OverlayState? _overlay;
  static final List<OverlayEntry> _active = <OverlayEntry>[];
  static const int _maxVisible = 3;

  static void bind(OverlayState overlay) {
    _overlay = overlay;
  }

  static void unbind(OverlayState overlay) {
    if (identical(_overlay, overlay)) _overlay = null;
  }

  /// Shows a toast through the bound app overlay (no-op when unbound).
  static void show(
    String message, {
    CampusToastTone tone = CampusToastTone.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final overlay = _overlay;
    if (overlay == null) return;
    _present(overlay, message, tone, duration);
  }

  /// Shows a toast using the nearest root overlay.
  static void showIn(
    BuildContext context,
    String message, {
    CampusToastTone tone = CampusToastTone.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    _present(overlay, message, tone, duration);
  }

  static void _present(
    OverlayState overlay,
    String message,
    CampusToastTone tone,
    Duration duration,
  ) {
    if (message.trim().isEmpty) return;
    while (_active.length >= _maxVisible) {
      final oldest = _active.removeAt(0);
      if (oldest.mounted) oldest.remove();
    }

    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) {
        final top = MediaQuery.viewPaddingOf(context).top + 10;
        return Positioned(
          top: top,
          left: 16,
          right: 16,
          child: _CampusToastCard(
            message: message,
            tone: tone,
            duration: duration,
            onDismissed: () {
              _active.remove(entry);
              if (entry.mounted) entry.remove();
            },
          ),
        );
      },
    );
    _active.add(entry);
    overlay.insert(entry);
  }
}

/// Registers the enclosing overlay with [CampusToast]. Place inside the
/// navigator (a route child), not above it.
class CampusToastBinder extends StatefulWidget {
  const CampusToastBinder({super.key, required this.child});

  final Widget child;

  @override
  State<CampusToastBinder> createState() => _CampusToastBinderState();
}

class _CampusToastBinderState extends State<CampusToastBinder> {
  OverlayState? _overlay;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final overlay = Overlay.maybeOf(context);
    if (overlay != null && !identical(overlay, _overlay)) {
      _overlay = overlay;
      CampusToast.bind(overlay);
    }
  }

  @override
  void dispose() {
    final overlay = _overlay;
    if (overlay != null) CampusToast.unbind(overlay);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _CampusToastCard extends StatefulWidget {
  const _CampusToastCard({
    required this.message,
    required this.tone,
    required this.duration,
    required this.onDismissed,
  });

  final String message;
  final CampusToastTone tone;
  final Duration duration;
  final VoidCallback onDismissed;

  @override
  State<_CampusToastCard> createState() => _CampusToastCardState();
}

class _CampusToastCardState extends State<_CampusToastCard> {
  Timer? _timer;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _visible = true);
    });
    _timer = Timer(widget.duration, () {
      if (!mounted) return;
      widget.onDismissed();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final (background, foreground, icon) = switch (widget.tone) {
      CampusToastTone.success => (
        tokens.gold,
        tokens.deepMaroon,
        Icons.check_circle_outline,
      ),
      CampusToastTone.error => (
        tokens.deepMaroon,
        Colors.white,
        Icons.error_outline,
      ),
      CampusToastTone.info => (tokens.maroon, Colors.white, Icons.info_outline),
      CampusToastTone.warning => (
        tokens.gold,
        tokens.deepMaroon,
        Icons.warning_amber_outlined,
      ),
    };

    return Semantics(
      liveRegion: true,
      container: true,
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        offset: _visible ? Offset.zero : const Offset(0, -0.25),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 180),
          opacity: _visible ? 1 : 0,
          child: Material(
            color: background,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.zero,
              side: BorderSide(color: tokens.borderSubtle),
            ),
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 18, color: foreground),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Dismiss',
                    visualDensity: VisualDensity.compact,
                    onPressed: widget.onDismissed,
                    icon: Icon(Icons.close, size: 16, color: foreground),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
