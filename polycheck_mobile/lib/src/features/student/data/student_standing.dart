import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Picks the one standing worth surfacing on the dashboard.
///
/// Mirrors `android/lib/standing-alert.ts`: a below-threshold section always
/// wins over an at-risk one, then the lowest attendance rate wins.
AttendanceStanding? pickStandingAlert(List<AttendanceStanding> standings) {
  final candidates = standings
      .where(
        (standing) =>
            standing.attendanceRate != null &&
            standing.attendanceRate!.isFinite,
      )
      .toList(growable: false);

  AttendanceStanding? pickLowest(AttendanceStandingStatus status) {
    final matching = candidates
        .where((standing) => standing.status == status)
        .toList(growable: false);
    if (matching.isEmpty) return null;
    var lowest = matching.first;
    for (final standing in matching.skip(1)) {
      if ((standing.attendanceRate ?? double.infinity) <
          (lowest.attendanceRate ?? double.infinity)) {
        lowest = standing;
      }
    }
    return lowest;
  }

  return pickLowest(AttendanceStandingStatus.belowThreshold) ??
      pickLowest(AttendanceStandingStatus.atRisk);
}

/// Floor to one decimal so a below-threshold rate can never round up to the
/// minimum (74.96 must not display as 75).
String formatStandingRate(double? rate) {
  if (rate == null || !rate.isFinite) return '—';
  final floored = (rate < 0 ? 0.0 : rate * 10).floor() / 10;
  if (floored == floored.roundToDouble()) return floored.toInt().toString();
  return floored.toStringAsFixed(1);
}

String standingDismissKey(String userId, String sectionId) =>
    '$userId:$sectionId';

/// Process-lifetime dismissals (mirrors the web/Android "per session" rule:
/// the banner stays hidden until the app process restarts).
class StandingDismissalsController extends Notifier<Set<String>> {
  @override
  Set<String> build() => const <String>{};

  bool isDismissed(String userId, String sectionId) =>
      state.contains(standingDismissKey(userId, sectionId));

  void dismiss(String userId, String sectionId) {
    state = <String>{...state, standingDismissKey(userId, sectionId)};
  }

  void clear() {
    state = const <String>{};
  }
}

final standingDismissalsProvider =
    NotifierProvider<StandingDismissalsController, Set<String>>(
      StandingDismissalsController.new,
    );
