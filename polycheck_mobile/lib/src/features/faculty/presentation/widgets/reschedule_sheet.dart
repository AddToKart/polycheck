import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/polycheck_core.dart';

/// Moves a class that has not started to another date, time or room. Returns the
/// saved session, or null when cancelled.
Future<Session?> showRescheduleSheet(
  BuildContext context, {
  required Session session,
  required String label,
}) {
  return showCampusBottomSheet<Session>(
    context,
    title: 'Reschedule class',
    maxHeight: MediaQuery.sizeOf(context).height * 0.75,
    child: _RescheduleForm(session: session, label: label),
  );
}

class _RescheduleForm extends ConsumerStatefulWidget {
  const _RescheduleForm({required this.session, required this.label});

  final Session session;
  final String label;

  @override
  ConsumerState<_RescheduleForm> createState() => _RescheduleFormState();
}

class _RescheduleFormState extends ConsumerState<_RescheduleForm> {
  late final TextEditingController _date = TextEditingController(
    text: widget.session.date,
  );
  late final TextEditingController _start = TextEditingController(
    text: widget.session.startTime,
  );
  late final TextEditingController _end = TextEditingController(
    text: widget.session.endTime,
  );
  late final TextEditingController _room = TextEditingController(
    text: widget.session.room ?? '',
  );
  bool _saving = false;
  String? _failure;

  @override
  void dispose() {
    _date.dispose();
    _start.dispose();
    _end.dispose();
    _room.dispose();
    super.dispose();
  }

  bool get _moved =>
      _date.text != widget.session.date ||
      _start.text.trim() != widget.session.startTime ||
      _end.text.trim() != widget.session.endTime;

  bool get _changed =>
      _moved || _room.text.trim() != (widget.session.room ?? '').trim();

  String? get _problem {
    if (parseCampusDate(_date.text) == null) return 'Choose a date.';
    final time = sessionTimeIssue(_start.text.trim(), _end.text.trim());
    if (time != null) return time;
    if (_moved && _date.text.compareTo(formatCampusDate()) < 0) {
      return 'A class cannot be moved to a past date.';
    }
    return null;
  }

  void _edited([String? _]) => setState(() => _failure = null);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final current = parseCampusDate(_date.text);
    final picked = await showDatePicker(
      context: context,
      initialDate: current == null || current.isBefore(today) ? today : current,
      firstDate: today,
      lastDate: DateTime(2035),
    );
    if (picked == null || !mounted) return;
    _date.text = formatDate(picked);
    _edited();
  }

  Future<void> _save() async {
    if (_saving || !_changed || _problem != null) return;
    setState(() {
      _saving = true;
      _failure = null;
    });
    try {
      final saved = await ref
          .read(sessionsApiProvider)
          .rescheduleSession(
            widget.session.id,
            date: _date.text,
            startTime: _start.text.trim(),
            endTime: _end.text.trim(),
            room: _room.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(saved);
    } on ApiRequestError catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failure = error.message;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failure = 'The class could not be moved: $error';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final problem = _changed ? _problem : null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${widget.label}. It will be labelled Rescheduled, with the original '
          'date kept.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 14),
        CampusTextField(
          controller: _date,
          label: 'New date',
          readOnly: true,
          suffix: IconButton(
            tooltip: 'Pick new date',
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today_outlined, size: 18),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: CampusTimeField(
                controller: _start,
                label: 'Start time',
                onChanged: _edited,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CampusTimeField(
                controller: _end,
                label: 'End time',
                onChanged: _edited,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _room,
          label: 'Room',
          maxLength: sessionRoomMaxLength,
          onChanged: _edited,
        ),
        const SizedBox(height: 14),
        FormProblems(problems: [?(_failure ?? problem)]),
        CampusButton(
          key: const ValueKey<String>('reschedule-save'),
          label: 'Reschedule',
          icon: Icons.edit_calendar_outlined,
          loading: _saving,
          onPressed: _saving || !_changed || _problem != null ? null : _save,
        ),
        const SizedBox(height: 8),
        CampusButton(
          label: 'Cancel',
          variant: CampusButtonVariant.outline,
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
