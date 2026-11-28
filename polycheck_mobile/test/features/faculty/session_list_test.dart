import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/data/session_list.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/archived_subject_dialog.dart';

Session _session(
  String date, {
  bool active = false,
  String? endedAt,
  String? qrToken,
  String? from,
  String subject = 'Algorithms',
}) => Session(
  id: 'sess-$date-$subject',
  sectionId: 'sec-1',
  subjectName: subject,
  date: date,
  startTime: '09:00',
  endTime: '10:30',
  teacherId: 'teacher-1',
  isActive: active,
  endedAt: endedAt,
  qrToken: qrToken,
  isRescheduled: from != null,
  rescheduledFromDate: from,
);

void main() {
  const today = '2026-11-28';

  test('status is live, then completed, then rescheduled, then scheduled', () {
    expect(
      sessionListStatus(_session('2026-11-02', active: true), today),
      SessionListStatus.live,
    );
    expect(
      sessionListStatus(_session('2026-11-02'), today),
      SessionListStatus.completed,
    );
    expect(
      sessionListStatus(_session('2026-12-02', from: '2026-11-30'), today),
      SessionListStatus.rescheduled,
    );
    // The old "Completed" filter also listed every class still to come.
    expect(
      sessionListStatus(_session('2026-12-02'), today),
      SessionListStatus.scheduled,
    );
  });

  test('a class can be moved only until it has been started', () {
    expect(canReschedule(_session('2026-12-02')), isTrue);
    expect(canReschedule(_session('2026-12-02', active: true)), isFalse);
    expect(
      canReschedule(_session('2026-12-02', endedAt: '2026-12-02T01:00:00Z')),
      isFalse,
    );
    expect(canReschedule(_session('2026-12-02', qrToken: 't')), isFalse);
  });

  test('sorts by date either way, next class first, or by subject', () {
    final rows = [
      _session('2026-11-30'),
      _session('2026-11-02'),
      _session('2026-12-07'),
      _session('2026-11-09'),
    ];
    List<String> dates(String sort) => [
      for (final row in sortSessions(rows, sort, today)) row.date.substring(5),
    ];
    expect(dates(''), ['12-07', '11-30', '11-09', '11-02']);
    expect(dates('oldest'), ['11-02', '11-09', '11-30', '12-07']);
    expect(dates('upcoming'), ['11-30', '12-07', '11-09', '11-02']);
    expect(rows.first.date, '2026-11-30', reason: 'the input is not reordered');
  });

  test('filters by period', () {
    expect(inSessionPeriod(today, 'today', today), isTrue);
    expect(inSessionPeriod('2026-12-04', 'week', today), isTrue);
    expect(inSessionPeriod('2026-12-05', 'week', today), isFalse);
    expect(inSessionPeriod('2026-11-01', 'month', today), isTrue);
    expect(inSessionPeriod('2026-12-01', 'month', today), isFalse);
    expect(inSessionPeriod('2026-11-27', 'past', today), isTrue);
    expect(inSessionPeriod('2027-01-01', '', today), isTrue);
  });

  test('pages a list and keeps the page inside the range', () {
    final items = List<int>.generate(53, (index) => index);
    final second = ListPage<int>(items, 2);
    expect([second.first, second.last, second.pages], [11, 20, 6]);
    expect(ListPage<int>(items, 99).page, 6);
    expect(ListPage<int>(items, 0).page, 1);
    final none = ListPage<int>(const <int>[], 3);
    expect([none.page, none.pages, none.first, none.last], [1, 1, 0, 0]);
  });

  test('search needs every word, in any order', () {
    expect(
      matchesQuery('finance 4-2', ['Business Finance', 'Sec 4-2']),
      isTrue,
    );
    expect(
      matchesQuery('finance 4-1', ['Business Finance', 'Sec 4-2']),
      isFalse,
    );
  });

  test('explains why a class time is refused', () {
    expect(sessionTimeIssue('09:00', '10:30'), isNull);
    expect(sessionTimeIssue('99:99', '10:30'), contains('HH:mm'));
    expect(sessionTimeIssue('10:00', '09:00'), contains('after start'));
    expect(sessionTimeIssue('09:00', '09:05'), contains('at least 15'));
    expect(sessionTimeIssue('06:00', '19:00'), contains('at most 12'));
  });

  test('the archive countdown never goes below zero', () {
    final left = countdownParts(
      const Duration(days: 89, hours: 23, minutes: 5, seconds: 9),
    );
    expect([left.days, left.hours, left.minutes, left.seconds], [89, 23, 5, 9]);
    final over = countdownParts(const Duration(seconds: -30));
    expect([over.days, over.seconds], [0, 0]);
    expect(campusLongDate(DateTime.utc(2027, 2, 25, 17)), 'February 26, 2027');
  });
}
