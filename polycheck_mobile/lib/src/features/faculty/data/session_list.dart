/// Filtering and ordering for the professor's session list. The status rules
/// mirror `frontend/src/lib/session-status.ts`.
library;

import '../../../core/polycheck_core.dart';

enum SessionListStatus {
  live('Live'),
  scheduled('Scheduled'),
  completed('Completed'),
  rescheduled('Rescheduled');

  const SessionListStatus(this.label);

  final String label;
}

/// Live, then completed, then rescheduled, then scheduled.
SessionListStatus sessionListStatus(Session session, String today) {
  if (session.isActive) return SessionListStatus.live;
  if (session.endedAt != null || session.date.compareTo(today) < 0) {
    return SessionListStatus.completed;
  }
  if (wasRescheduled(session)) return SessionListStatus.rescheduled;
  return SessionListStatus.scheduled;
}

bool wasRescheduled(Session session) =>
    session.isRescheduled || (session.rescheduledFromDate ?? '').isNotEmpty;

/// A class can be moved until it has been started.
bool canReschedule(Session session) =>
    !(session.isActive ||
        session.endedAt != null ||
        session.qrToken != null ||
        session.startQrToken != null ||
        session.endQrToken != null ||
        session.autoEndAt != null);

const List<ListOption> sessionSortOptions = <ListOption>[
  ListOption('', 'Newest date first'),
  ListOption('oldest', 'Oldest date first'),
  ListOption('upcoming', 'Next class first'),
  ListOption('subject', 'Subject (A to Z)'),
];

const List<ListOption> sessionPeriodOptions = <ListOption>[
  ListOption('today', 'Today'),
  ListOption('week', 'Next 7 days'),
  ListOption('month', 'This month'),
  ListOption('past', 'Before today'),
];

/// Whether a `yyyy-MM-dd` class date falls in a period relative to [today].
bool inSessionPeriod(String date, String period, String today) {
  switch (period) {
    case 'today':
      return date == today;
    case 'week':
      final start = DateTime.tryParse(today);
      if (start == null) return true;
      final end = formatDate(DateTime(start.year, start.month, start.day + 6));
      return date.compareTo(today) >= 0 && date.compareTo(end) <= 0;
    case 'month':
      return today.length >= 7 && date.startsWith(today.substring(0, 7));
    case 'past':
      return date.compareTo(today) < 0;
    default:
      return true;
  }
}

int _byWhen(Session left, Session right) {
  final date = left.date.compareTo(right.date);
  return date != 0 ? date : left.startTime.compareTo(right.startTime);
}

/// Returns a sorted copy. "Next class first" lists today onwards, then past
/// classes with the latest first.
List<Session> sortSessions(List<Session> sessions, String sort, String today) {
  final copy = List<Session>.of(sessions);
  switch (sort) {
    case 'oldest':
      copy.sort(_byWhen);
    case 'subject':
      copy.sort((left, right) {
        final subject = left.subjectName.compareTo(right.subjectName);
        return subject != 0 ? subject : _byWhen(right, left);
      });
    case 'upcoming':
      copy.sort((left, right) {
        final leftPast = left.date.compareTo(today) < 0;
        if (leftPast != right.date.compareTo(today) < 0) {
          return leftPast ? 1 : -1;
        }
        return leftPast ? _byWhen(right, left) : _byWhen(left, right);
      });
    default:
      copy.sort((left, right) => _byWhen(right, left));
  }
  return copy;
}
