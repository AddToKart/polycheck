import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Height reserved for the boot offline strip rendered by `main.dart`.
///
/// The scanner is the only full-bleed screen without an AppBar; it pads its
/// header by this much while the strip is visible so the two never overlap
/// (SW-7). Every other surface keeps its own AppBar inset and is unaffected.
const double offlineBannerHeight = 34;

/// Whether the boot lifecycle is currently showing the gold offline strip.
///
/// `false` covers both "online" and "probe not finished yet", matching the
/// strip's own render condition.
class OfflineBannerController extends Notifier<bool> {
  @override
  bool build() => false;

  void setOffline(bool value) {
    if (state == value) return;
    state = value;
  }
}

final offlineBannerProvider = NotifierProvider<OfflineBannerController, bool>(
  OfflineBannerController.new,
);
