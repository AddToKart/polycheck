/// Mirrors the date-grid helpers in `shared/src/utils/calendar.ts`.
///
/// The session/attendance calendar-event builders stay with the faculty and
/// student calendar waves; the pure grids, campus date math, and formatting
/// helpers ship here because every calendar surface (and the scanner) needs
/// the same Asia/Manila civil-date behavior.
class WeekDay {
  const WeekDay({
    required this.day,
    required this.date,
    required this.isToday,
    required this.isCurrentMonth,
  });

  final String day;
  final String date;
  final bool isToday;
  final bool isCurrentMonth;

  @override
  bool operator ==(Object other) =>
      other is WeekDay &&
      other.day == day &&
      other.date == date &&
      other.isToday == isToday &&
      other.isCurrentMonth == isCurrentMonth;

  @override
  int get hashCode => Object.hash(day, date, isToday, isCurrentMonth);

  @override
  String toString() =>
      'WeekDay($day, $date, isToday: $isToday, isCurrentMonth: $isCurrentMonth)';
}

class CampusDateRange {
  const CampusDateRange({required this.startDate, required this.endDate});

  final String startDate;
  final String endDate;

  @override
  bool operator ==(Object other) =>
      other is CampusDateRange &&
      other.startDate == startDate &&
      other.endDate == endDate;

  @override
  int get hashCode => Object.hash(startDate, endDate);

  @override
  String toString() => 'CampusDateRange($startDate..$endDate)';
}

class DateRange {
  const DateRange({required this.start, required this.end});

  final String start;
  final String end;

  @override
  bool operator ==(Object other) =>
      other is DateRange && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => 'DateRange($start..$end)';
}

const List<String> _dayNamesShort = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

const List<String> _dayNamesFull = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const List<String> _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// The Philippines does not observe DST, so a fixed offset avoids partial
/// time-zone support differences between platforms.
const int pupTimezoneOffsetMs = 8 * 60 * 60 * 1000;

String _pad(int n) => n < 10 ? '0$n' : '$n';

String _formatLocalDate(DateTime date) =>
    '${date.year}-${_pad(date.month)}-${_pad(date.day)}';

/// `YYYY-MM-DD` from a local date.
String formatDate(DateTime date) => _formatLocalDate(date);

/// Civil calendar date used by PUP (Asia/Manila, UTC+08:00).
String formatCampusDate([DateTime? date]) {
  final instant = date ?? DateTime.now();
  final campus = DateTime.fromMillisecondsSinceEpoch(
    instant.millisecondsSinceEpoch + pupTimezoneOffsetMs,
    isUtc: true,
  );
  return '${campus.year.toString().padLeft(4, '0')}-'
      '${_pad(campus.month)}-${_pad(campus.day)}';
}

/// Inclusive campus-date range ending today (or [date]).
CampusDateRange getRecentCampusDateRange(int days, [DateTime? date]) {
  final normalizedDays = days < 1 ? 1 : days;
  final instant = date ?? DateTime.now();
  final campus = DateTime.fromMillisecondsSinceEpoch(
    instant.millisecondsSinceEpoch + pupTimezoneOffsetMs,
    isUtc: true,
  );
  final endDate =
      '${campus.year.toString().padLeft(4, '0')}-'
      '${_pad(campus.month)}-${_pad(campus.day)}';
  final start = campus.subtract(Duration(days: normalizedDays - 1));
  final startDate =
      '${start.year.toString().padLeft(4, '0')}-'
      '${_pad(start.month)}-${_pad(start.day)}';
  return CampusDateRange(startDate: startDate, endDate: endDate);
}

/// 12-hour clock helper; returns the input unchanged for non-time strings.
String formatTime(String? time) {
  if (time == null || time.isEmpty) return '';
  final parts = time.split(':');
  if (parts.length < 2) return time;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return time;
  final period = hour >= 12 ? 'PM' : 'AM';
  final hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return '${_pad(hour12)}:${_pad(minute)} $period';
}

String getDayName(int dayIndex) =>
    dayIndex >= 0 && dayIndex < 7 ? _dayNamesShort[dayIndex] : '';

String getDayNameFull(int dayIndex) =>
    dayIndex >= 0 && dayIndex < 7 ? _dayNamesFull[dayIndex] : '';

String getMonthName(int monthIndex) =>
    monthIndex >= 0 && monthIndex < 12 ? _monthNames[monthIndex] : '';

/// Full week (Sunday..Saturday) containing [date].
List<WeekDay> getWeekDays(DateTime date, {DateTime? today}) {
  final dayOfWeek = date.weekday % 7;
  final sunday = DateTime(date.year, date.month, date.day - dayOfWeek, 12);
  final todayStr = formatDate(today ?? DateTime.now());
  final month = date.month;

  return [
    for (var index = 0; index < 7; index++)
      () {
        final day = DateTime(sunday.year, sunday.month, sunday.day + index, 12);
        final dateStr = formatDate(day);
        return WeekDay(
          day: getDayName(day.weekday % 7),
          date: dateStr,
          isToday: dateStr == todayStr,
          isCurrentMonth: day.month == month,
        );
      }(),
  ];
}

/// Month grid (0-based [month], matching the shared contract) padded with
/// nulls. Never emits a trailing all-null week: the final row is only appended
/// when it holds a date.
List<List<DateTime?>> getMonthDays(int year, int month) {
  final firstDay = DateTime(year, month + 1, 1, 12);
  final lastDay = DateTime(year, month + 2, 0, 12);
  final startPad = firstDay.weekday % 7;
  final totalDays = lastDay.day;

  final weeks = <List<DateTime?>>[];
  var week = <DateTime?>[];

  for (var pad = 0; pad < startPad; pad++) {
    week.add(null);
  }

  for (var day = 1; day <= totalDays; day++) {
    week.add(DateTime(year, month + 1, day, 12));
    if (week.length == 7) {
      weeks.add(week);
      week = <DateTime?>[];
    }
  }

  if (week.isNotEmpty) {
    while (week.length < 7) {
      week.add(null);
    }
    weeks.add(week);
  }

  return weeks;
}

DateRange getDateRangeForMonth(int year, int month) {
  final first = DateTime(year, month + 1, 1, 12);
  final last = DateTime(year, month + 2, 0, 12);
  return DateRange(start: formatDate(first), end: formatDate(last));
}

int getWeeksInMonth(int year, int month) => getMonthDays(year, month).length;

bool isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

DateRange getDateRangeForWeek(DateTime date) {
  final weekDays = getWeekDays(date);
  return DateRange(start: weekDays.first.date, end: weekDays.last.date);
}
