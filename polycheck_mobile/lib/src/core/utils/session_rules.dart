/// Mirrors `shared/src/utils/session-rules.ts`.
library;

const int sessionMinDurationMinutes = 15;
const int sessionMaxDurationMinutes = 12 * 60;
const int sessionRoomMaxLength = 100;

final RegExp _timeOfDay = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');

int _minutesOfDay(String value) =>
    int.parse(value.substring(0, 2)) * 60 + int.parse(value.substring(3, 5));

/// What is wrong with a start/end pair, in words people can act on, or null.
String? sessionTimeIssue(String startTime, String endTime) {
  if (!_timeOfDay.hasMatch(startTime) || !_timeOfDay.hasMatch(endTime)) {
    return 'Enter both times as HH:mm, for example 09:00.';
  }
  final length = _minutesOfDay(endTime) - _minutesOfDay(startTime);
  if (length <= 0) return 'End time must be after start time.';
  if (length < sessionMinDurationMinutes) {
    return 'A class must be at least $sessionMinDurationMinutes minutes long.';
  }
  if (length > sessionMaxDurationMinutes) {
    return 'A class can be at most ${sessionMaxDurationMinutes ~/ 60} hours long.';
  }
  return null;
}
