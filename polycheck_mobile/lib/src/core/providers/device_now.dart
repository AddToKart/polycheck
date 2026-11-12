import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Device wall-clock source used only as the base reading for [TrustedClock].
///
/// Production reads `DateTime.now`; widget tests override it with a mutable
/// fake so countdowns can advance deterministically while remaining driven by
/// the trusted server offset.
final deviceNowProvider = Provider<DateTime Function()>((ref) {
  return DateTime.now;
});
