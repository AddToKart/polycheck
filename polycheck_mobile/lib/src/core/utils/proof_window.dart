/// Mirrors `shared/src/utils/proof-window.ts`. The server decides; this only
/// keeps the app from offering an upload that would be refused.
library;

const int proofPhotosPerSession = 4;
const int proofPhotoMaxBytes = 1500000;
const int proofGraceAfterClassMinutes = 15;

int? _minutes(String value) {
  final match = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(value);
  if (match == null) return null;
  return int.parse(match.group(1)!) * 60 + int.parse(match.group(2)!);
}

/// A class is ongoing while its session is live, or during its scheduled time
/// on campus (Asia/Manila, UTC+8) plus a short grace period.
bool isProofWindowOpen({
  required String date,
  required String startTime,
  required String endTime,
  required bool isActive,
  required DateTime now,
}) {
  if (isActive) return true;
  final campus = now.toUtc().add(const Duration(hours: 8)).toIso8601String();
  if (campus.substring(0, 10) != date) return false;
  final start = _minutes(startTime);
  final end = _minutes(endTime);
  final current = _minutes(campus.substring(11, 16));
  if (start == null || end == null || current == null) return false;
  return current >= start && current <= end + proofGraceAfterClassMinutes;
}
