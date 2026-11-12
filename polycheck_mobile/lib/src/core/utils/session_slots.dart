import '../models/api.dart';
import 'calendar_utils.dart';

/// Mirrors `frontend/src/lib/session-slots.ts`.
///
/// A section's schedule normally contains one entry per class meeting
/// (e.g. Mon 08:00-10:30 + Wed 09:00-12:30). The single-session form must let
/// the teacher pick which meeting they are creating, and bulk creation must
/// sweep each meeting's weekday with that meeting's own times.
class SessionSlot {
  const SessionSlot({
    required this.day,
    required this.startTime,
    required this.endTime,
    this.room,
  });

  final String day;
  final String startTime;
  final String endTime;
  final String? room;

  @override
  bool operator ==(Object other) =>
      other is SessionSlot &&
      other.day == day &&
      other.startTime == startTime &&
      other.endTime == endTime &&
      other.room == room;

  @override
  int get hashCode => Object.hash(day, startTime, endTime, room);

  @override
  String toString() =>
      'SessionSlot($day $startTime-$endTime${room == null ? '' : ', $room'})';
}

class BulkSlotRow extends SessionSlot {
  const BulkSlotRow({
    required super.day,
    required super.startTime,
    required super.endTime,
    super.room,
    this.selected = true,
  });

  final bool selected;

  BulkSlotRow copyWith({
    String? day,
    String? startTime,
    String? endTime,
    String? room,
    bool? selected,
  }) {
    return BulkSlotRow(
      day: day ?? this.day,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      room: room ?? this.room,
      selected: selected ?? this.selected,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is BulkSlotRow &&
      other.day == day &&
      other.startTime == startTime &&
      other.endTime == endTime &&
      other.room == room &&
      other.selected == selected;

  @override
  int get hashCode => Object.hash(day, startTime, endTime, room, selected);
}

/// Select value that means "the chosen date is not a scheduled class day".
const String customSlotValue = 'custom';

const List<String> _dayNames = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

const Map<String, int> _dayIndex = {
  'Sun': 0,
  'Mon': 1,
  'Tue': 2,
  'Wed': 3,
  'Thu': 4,
  'Fri': 5,
  'Sat': 6,
};

String _pad2(int value) => value.toString().padLeft(2, '0');

String _formatLocalDate(DateTime date) =>
    '${date.year}-${_pad2(date.month)}-${_pad2(date.day)}';

/// Parses a `YYYY-MM-DD` civil date into a local Date pinned at noon, which
/// keeps day arithmetic stable across DST transitions. Returns null for
/// malformed and overflow dates (e.g. `2026-02-31`).
DateTime? parseCampusDate(String? dateStr) {
  final match = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})$',
  ).firstMatch(dateStr?.trim() ?? '');
  if (match == null) return null;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final parsed = DateTime(year, month, day, 12);
  if (parsed.year != year || parsed.month != month || parsed.day != day) {
    return null;
  }
  return parsed;
}

/// Short weekday code (`Mon` .. `Sun`) for a campus date string.
String? dayOfWeek(String? dateStr) {
  final parsed = parseCampusDate(dateStr);
  return parsed == null ? null : _dayNames[parsed.weekday % 7];
}

/// Next date on or after `fromDateStr` whose weekday matches [day].
///
/// Today is returned when it already matches; otherwise the next upcoming
/// instance is returned (wrapping across week, month, and year boundaries).
/// [now] is injectable so tests can pin the Asia/Manila campus date.
String nextOccurrenceDate(String day, [String? fromDateStr, DateTime? now]) {
  final target = _dayIndex[day];
  final fallback = fromDateStr ?? formatCampusDate(now ?? DateTime.now());
  if (target == null) return fallback;
  final start = parseCampusDate(fallback);
  if (start == null) return fallback;
  final currentWeekday = start.weekday % 7;
  final delta = (target - currentWeekday + 7) % 7;
  return _formatLocalDate(
    DateTime(start.year, start.month, start.day + delta, 12),
  );
}

/// `Mon 08:00-10:30 (CCIS Lab 3)`; the room is omitted when absent.
String slotLabel(SessionSlot slot) {
  final room = slot.room?.trim();
  final base = '${slot.day} ${slot.startTime}-${slot.endTime}';
  return room != null && room.isNotEmpty ? '$base ($room)' : base;
}

/// Index of the schedule entry matching the date's weekday, or -1.
int slotMatchingDateIndex(List<SessionSlot> schedule, String dateStr) {
  final weekday = dayOfWeek(dateStr);
  if (weekday == null) return -1;
  return schedule.indexWhere((slot) => slot.day == weekday);
}

/// Initial selection when a section is chosen: the slot matching the current
/// date's weekday, else the first slot (the pre-slot-selector behavior), and
/// the neutral custom option only when there is no schedule at all.
String defaultSlotSelection(List<SessionSlot> schedule, String dateStr) {
  final index = slotMatchingDateIndex(schedule, dateStr);
  if (index >= 0) return '$index';
  return schedule.isNotEmpty ? '0' : customSlotValue;
}

/// Selection that truthfully represents a date: the matching slot when the
/// weekday is scheduled, otherwise the custom option (make-up class).
String slotSelectionForDate(List<SessionSlot> schedule, String dateStr) {
  final index = slotMatchingDateIndex(schedule, dateStr);
  return index >= 0 ? '$index' : customSlotValue;
}

/// Bulk-mode rows derived from the section schedule, all selected by default.
List<BulkSlotRow> buildBulkRows(
  List<SessionSlot> schedule, [
  String? fallbackRoom,
]) {
  final defaultRoom = fallbackRoom?.trim();
  final rows = <BulkSlotRow>[];
  for (final slot in schedule) {
    final slotRoom = slot.room?.trim();
    final hasSlotRoom = slotRoom != null && slotRoom.isNotEmpty;
    final hasDefaultRoom = defaultRoom != null && defaultRoom.isNotEmpty;
    rows.add(
      BulkSlotRow(
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: hasSlotRoom ? slotRoom : (hasDefaultRoom ? defaultRoom : null),
      ),
    );
  }
  return rows;
}

/// Total sessions that will be created: each selected meeting contributes one
/// occurrence per matching weekday inside the inclusive date range.
int countSlotOccurrences(
  List<BulkSlotRow> rows,
  String startDate,
  String endDate,
) {
  final start = parseCampusDate(startDate);
  final end = parseCampusDate(endDate);
  if (start == null || end == null) return 0;
  if (end.isBefore(start)) return 0;

  var count = 0;
  for (final row in rows) {
    if (!row.selected) continue;
    final target = _dayIndex[row.day];
    if (target == null) continue;
    final currentWeekday = start.weekday % 7;
    var cursor = DateTime(
      start.year,
      start.month,
      start.day + ((target - currentWeekday + 7) % 7),
      12,
    );
    while (!cursor.isAfter(end)) {
      count += 1;
      cursor = DateTime(cursor.year, cursor.month, cursor.day + 7, 12);
    }
  }
  return count;
}

/// First selected row whose end time is not after its start time.
BulkSlotRow? firstInvalidSlotRow(List<BulkSlotRow> rows) {
  for (final row in rows) {
    if (!row.selected) continue;
    if (row.startTime.isEmpty ||
        row.endTime.isEmpty ||
        row.endTime.compareTo(row.startTime) <= 0) {
      return row;
    }
  }
  return null;
}

/// Payload shape for `BulkSessionInput.slots` (selected rows only).
List<BulkSessionSlot> buildBulkSlots(List<BulkSlotRow> rows) {
  return [
    for (final row in rows)
      if (row.selected)
        BulkSessionSlot(
          day: row.day,
          startTime: row.startTime,
          endTime: row.endTime,
        ),
  ];
}
