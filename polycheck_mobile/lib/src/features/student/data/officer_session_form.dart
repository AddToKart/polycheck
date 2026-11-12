import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// One pre-filled field set for the officer session composer.
class OfficerFormSeed {
  const OfficerFormSeed({
    required this.slotValue,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.room,
  });

  /// Schedule index (`'0'`, `'1'`, …) or [customSlotValue].
  final String slotValue;
  final String date;
  final String startTime;
  final String endTime;
  final String room;
}

/// Maps a section's schedule entries to the shared A1 [SessionSlot] shape.
List<SessionSlot> sectionSessionSlots(Section section) {
  return <SessionSlot>[
    for (final day in section.schedule)
      SessionSlot(
        day: day.day.wire,
        startTime: day.startTime,
        endTime: day.endTime,
        room: day.room,
      ),
  ];
}

String _today(String? todayDate) =>
    todayDate ?? formatCampusDate(DateTime.now());

/// Initial composer state: the slot matching today's weekday, else the first
/// slot (existing behavior), and the custom option only when there is no
/// schedule at all.
OfficerFormSeed initialOfficerFormSeed(Section section, {String? todayDate}) {
  final today = _today(todayDate);
  final slots = sectionSessionSlots(section);
  if (slots.isEmpty) {
    return OfficerFormSeed(
      slotValue: customSlotValue,
      date: today,
      startTime: '09:00',
      endTime: '10:30',
      room: section.room,
    );
  }
  final selection = defaultSlotSelection(slots, today);
  final index = int.tryParse(selection) ?? 0;
  return officerFormSeedForSlot(section, index, todayDate: today);
}

/// Seed produced when a class meeting is picked. The date moves to that
/// meeting's next occurrence so the user does not have to fix it by hand.
OfficerFormSeed officerFormSeedForSlot(
  Section section,
  int index, {
  String? todayDate,
}) {
  final today = _today(todayDate);
  final slots = sectionSessionSlots(section);
  if (slots.isEmpty) return initialOfficerFormSeed(section, todayDate: today);
  final bounded = index < 0
      ? 0
      : (index >= slots.length ? slots.length - 1 : index);
  final slot = slots[bounded];
  final slotRoom = slot.room?.trim() ?? '';
  return OfficerFormSeed(
    slotValue: '$bounded',
    date: nextOccurrenceDate(slot.day, today),
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slotRoom.isNotEmpty ? slotRoom : section.room,
  );
}

String formatOfficerSlotLabel(SessionSlot slot) => slotLabel(slot);
