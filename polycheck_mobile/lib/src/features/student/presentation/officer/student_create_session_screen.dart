import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/officer_session_form.dart';
import '../../data/student_models.dart';
import '../../data/student_providers.dart';
import '../../data/student_scan_service.dart';
import 'officer_geofence_map.dart';

class StudentCreateSessionScreen extends ConsumerStatefulWidget {
  const StudentCreateSessionScreen({super.key, required this.sectionId});

  final String sectionId;

  @override
  ConsumerState<StudentCreateSessionScreen> createState() =>
      _StudentCreateSessionScreenState();
}

class _StudentCreateSessionScreenState
    extends ConsumerState<StudentCreateSessionScreen> {
  @override
  void initState() {
    super.initState();
    // Re-check on every mount (RN parity, Bug 6): the section detail provider
    // may still be alive beneath this pushed route, so a fresh mount must not
    // trust the cached permission answer. `invalidate` is Riverpod's
    // fire-and-forget re-check (same re-fetch as refresh for a watched
    // provider, without the unused-result lint).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.invalidate(studentSectionDetailProvider(widget.sectionId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(
      studentSectionDetailProvider(widget.sectionId),
    );
    return Scaffold(
      appBar: CampusHeader(
        title: 'Create class session',
        subtitle: detailAsync.value?.detail.subjectName,
        automaticallyImplyLeading: true,
      ),
      body: detailAsync.when(
        skipLoadingOnReload: true,
        loading: () => const CampusLoading(label: 'Loading class details…'),
        error: (error, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            _GateCard(
              icon: Icons.lock_outline,
              title: 'Unable to verify officer access',
              message: error is ApiRequestError
                  ? error.message
                  : 'Check your connection and try again.',
              onRetry: () => ref.invalidate(
                studentSectionDetailProvider(widget.sectionId),
              ),
            ),
          ],
        ),
        data: (view) {
          if (!view.isOfficer) {
            return const _GateCard(
              icon: Icons.lock_outline,
              title: 'Officer access required',
              message:
                  'Only the section president or QAC officer can create sessions for this class.',
            );
          }
          if (!view.isPresident) {
            return const _GateCard(
              icon: Icons.info_outline,
              title: 'President only',
              message:
                  'Session creation is limited to the section president. QAC officers can upload proof-of-class photos from a session.',
            );
          }
          switch (view.permission) {
            case OfficerPermissionCheck.authorized:
              return _CreateSessionForm(detail: view.detail);
            case OfficerPermissionCheck.denied:
              return _GateCard(
                icon: Icons.schedule,
                title: 'Permission required',
                message:
                    'Ask your instructor to grant an active session permission before creating a class session.',
                onRetry: () => ref.invalidate(
                  studentSectionDetailProvider(widget.sectionId),
                ),
                retryLabel: 'Check again',
              );
            case OfficerPermissionCheck.errored:
              return _GateCard(
                icon: Icons.cloud_off_outlined,
                title: "Couldn't verify permission",
                message:
                    'The permission check failed (offline or server error). Reconnect and check again — your access was not denied.',
                onRetry: () => ref.invalidate(
                  studentSectionDetailProvider(widget.sectionId),
                ),
                retryLabel: 'Check again',
              );
          }
        },
      ),
    );
  }
}

class _GateCard extends StatelessWidget {
  const _GateCard({
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Try again',
  });

  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        CampusCard(
          child: Column(
            children: <Widget>[
              Icon(
                icon,
                size: 30,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
              if (onRetry != null) ...<Widget>[
                const SizedBox(height: 12),
                CampusButton(
                  label: retryLabel,
                  variant: CampusButtonVariant.outline,
                  expand: false,
                  onPressed: onRetry,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _CreateSessionForm extends ConsumerStatefulWidget {
  const _CreateSessionForm({required this.detail});

  final StudentSectionDetail detail;

  @override
  ConsumerState<_CreateSessionForm> createState() => _CreateSessionFormState();
}

class _CreateSessionFormState extends ConsumerState<_CreateSessionForm> {
  static const double _defaultLatitude = 14.8697;
  static const double _defaultLongitude = 120.9991;

  late final List<SessionSlot> _slots;
  late final TextEditingController _dateController;
  late final TextEditingController _startController;
  late final TextEditingController _endController;
  late final TextEditingController _roomController;
  late final TextEditingController _validityController;
  late final TextEditingController _graceController;

  SessionMode _mode = SessionMode.inPerson;
  String _slotValue = customSlotValue;
  double _latitude = _defaultLatitude;
  double _longitude = _defaultLongitude;
  double _radius = 40;
  bool _submitting = false;
  bool _locating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final seed = initialOfficerFormSeed(widget.detail.section);
    _slots = sectionSessionSlots(widget.detail.section);
    _slotValue = seed.slotValue;
    _dateController = TextEditingController(text: seed.date);
    _startController = TextEditingController(text: seed.startTime);
    _endController = TextEditingController(text: seed.endTime);
    _roomController = TextEditingController(text: seed.room);
    _validityController = TextEditingController(text: '15');
    _graceController = TextEditingController(text: '15');
  }

  @override
  void dispose() {
    _dateController.dispose();
    _startController.dispose();
    _endController.dispose();
    _roomController.dispose();
    _validityController.dispose();
    _graceController.dispose();
    super.dispose();
  }

  void _selectSlot(String value) {
    setState(() {
      _slotValue = value;
      if (value == customSlotValue) return;
      final index = int.tryParse(value);
      if (index == null) return;
      final seed = officerFormSeedForSlot(widget.detail.section, index);
      _dateController.text = seed.date;
      _startController.text = seed.startTime;
      _endController.text = seed.endTime;
      _roomController.text = seed.room;
    });
  }

  Future<void> _useMyLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final location = await ref.read(scanLocationReaderProvider).current();
      if (!mounted) return;
      setState(() {
        _latitude = location.latitude;
        _longitude = location.longitude;
        _locating = false;
      });
    } on ScanLocationException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _locating = false;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _error = 'Your location could not be determined.';
        _locating = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final initial =
        DateTime.tryParse(_dateController.text.trim()) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null || !mounted) return;
    _dateController.text = formatDate(picked);
    if (_slotValue != customSlotValue) {
      setState(() => _slotValue = customSlotValue);
    }
  }

  Future<void> _pickTime(TextEditingController controller) async {
    final parts = controller.text.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 9,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0,
    );
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked == null || !mounted) return;
    controller.text =
        '${picked.hour.toString().padLeft(2, '0')}:'
        '${picked.minute.toString().padLeft(2, '0')}';
  }

  String? _validate() {
    final date = _dateController.text.trim();
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(date) ||
        DateTime.tryParse(date) == null) {
      return 'Enter a valid date (YYYY-MM-DD).';
    }
    final start = _startController.text.trim();
    final end = _endController.text.trim();
    final timePattern = RegExp(r'^\d{2}:\d{2}$');
    if (!timePattern.hasMatch(start) || !timePattern.hasMatch(end)) {
      return 'Enter start and end times (HH:MM).';
    }
    if (end.compareTo(start) <= 0) {
      return 'End time must be after the start time.';
    }
    final validity = int.tryParse(_validityController.text.trim());
    if (validity == null || validity < 1 || validity > 15) {
      return 'QR validity must be between 1 and 15 minutes.';
    }
    final grace = int.tryParse(_graceController.text.trim());
    if (grace == null || grace < 0 || grace > 60) {
      return 'Grace period must be between 0 and 60 minutes.';
    }
    return null;
  }

  Future<void> _submit() async {
    final validation = _validate();
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final allowed = await ref
          .read(sectionsApiProvider)
          .checkSessionPermission(widget.detail.section.id, user.id);
      if (!mounted) return;
      if (!allowed) {
        setState(() {
          _submitting = false;
          _error =
              'Your session permission is no longer active. Ask your instructor to renew it.';
        });
        return;
      }
      final section = widget.detail.section;
      final room = _roomController.text.trim();
      await ref
          .read(sessionsApiProvider)
          .createSession(
            CreateSessionInput(
              sectionId: section.id,
              subjectName: widget.detail.subjectName,
              date: _dateController.text.trim(),
              startTime: _startController.text.trim(),
              endTime: _endController.text.trim(),
              room: room.isEmpty ? null : room,
              mode: _mode,
              qrValidityMinutes: int.parse(_validityController.text.trim()),
              gracePeriodMinutes: int.parse(_graceController.text.trim()),
              geofence: _mode == SessionMode.inPerson
                  ? GeofenceConfig(
                      latitude: _latitude,
                      longitude: _longitude,
                      radiusMeters: _radius,
                    )
                  : null,
              teacherId: user.id,
            ),
          );
      ref.invalidate(studentSectionDetailProvider(section.id));
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Session created. The class session is ready for activation.',
        tone: CampusToastTone.success,
      );
      context.pop();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message.trim().isEmpty
            ? 'Unable to create the session.'
            : error.message.trim();
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Unable to create the session. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final section = widget.detail.section;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: <Widget>[
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'SESSION MODE',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: <Widget>[
                  Expanded(
                    child: _ModeOption(
                      label: 'In person',
                      icon: Icons.location_on_outlined,
                      selected: _mode == SessionMode.inPerson,
                      onTap: () => setState(() => _mode = SessionMode.inPerson),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ModeOption(
                      label: 'Online',
                      icon: Icons.wifi,
                      selected: _mode == SessionMode.online,
                      onTap: () => setState(() => _mode = SessionMode.online),
                    ),
                  ),
                ],
              ),
              if (_mode == SessionMode.online) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  'Online checkpoints never collect GPS (RA 10173). A meeting PIN can be announced in class.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              if (_slots.length > 1) ...<Widget>[
                Text(
                  'CLASS MEETING',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  decoration: BoxDecoration(
                    color: tokens.surface,
                    border: Border.all(color: tokens.borderSubtle),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      key: const ValueKey('officer-slot-picker'),
                      value: _slotValue,
                      isExpanded: true,
                      items: <DropdownMenuItem<String>>[
                        for (var index = 0; index < _slots.length; index++)
                          DropdownMenuItem<String>(
                            value: '$index',
                            child: Text(formatOfficerSlotLabel(_slots[index])),
                          ),
                        const DropdownMenuItem<String>(
                          value: customSlotValue,
                          child: Text('Custom / make-up class'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) _selectSlot(value);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Picking a meeting moves the date to its next occurrence.',
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 12),
              ],
              CampusTextField(
                label: 'Date',
                hint: 'YYYY-MM-DD',
                controller: _dateController,
                keyboardType: TextInputType.datetime,
                suffix: IconButton(
                  tooltip: 'Pick date',
                  onPressed: _pickDate,
                  icon: const Icon(Icons.today, size: 18),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    child: CampusTextField(
                      label: 'Start time',
                      hint: 'HH:MM',
                      controller: _startController,
                      keyboardType: TextInputType.datetime,
                      suffix: IconButton(
                        tooltip: 'Pick start time',
                        onPressed: () => _pickTime(_startController),
                        icon: const Icon(Icons.schedule, size: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CampusTextField(
                      label: 'End time',
                      hint: 'HH:MM',
                      controller: _endController,
                      keyboardType: TextInputType.datetime,
                      suffix: IconButton(
                        tooltip: 'Pick end time',
                        onPressed: () => _pickTime(_endController),
                        icon: const Icon(Icons.schedule, size: 18),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              CampusTextField(
                label: 'Room',
                hint: 'Optional room',
                controller: _roomController,
                prefixIcon: Icons.meeting_room_outlined,
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    child: CampusTextField(
                      label: 'QR validity (min)',
                      hint: '1–15',
                      controller: _validityController,
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CampusTextField(
                      label: 'Grace period (min)',
                      hint: '0–60',
                      controller: _graceController,
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (_mode == SessionMode.inPerson) ...<Widget>[
          const SizedBox(height: 12),
          CampusCard(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        'Students must be within ${_radius.round()} m of the pin.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _locating ? null : _useMyLocation,
                      icon: _locating
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.my_location, size: 17),
                      label: Text(_locating ? 'Locating…' : 'My location'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                OfficerGeofenceMap(
                  latitude: _latitude,
                  longitude: _longitude,
                  radiusMeters: _radius,
                  onChanged: (latitude, longitude) => setState(() {
                    _latitude = latitude;
                    _longitude = longitude;
                  }),
                ),
                const SizedBox(height: 6),
                Slider(
                  value: _radius,
                  min: 10,
                  max: 500,
                  divisions: 49,
                  label: '${_radius.round()} m',
                  onChanged: (value) => setState(() => _radius = value),
                ),
              ],
            ),
          ),
        ],
        if (_error != null) ...<Widget>[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: tokens.gold.withValues(alpha: 0.12),
              border: Border.all(color: tokens.gold),
            ),
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        CampusButton(
          key: const ValueKey('officer-session-submit'),
          label: _submitting ? 'Creating session…' : 'Create session',
          icon: Icons.add,
          loading: _submitting,
          onPressed: _submitting ? null : _submit,
        ),
        const SizedBox(height: 8),
        Text(
          '${widget.detail.subjectName} · ${formatSectionHeading(section: section.section, course: section.course)}',
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }
}

class _ModeOption extends StatelessWidget {
  const _ModeOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      child: Material(
        color: selected
            ? (tokens.isDark ? tokens.gold : tokens.maroon)
            : tokens.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
          side: BorderSide(
            color: selected
                ? (tokens.isDark ? tokens.gold : tokens.maroon)
                : tokens.borderSubtle,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(
                  icon,
                  size: 18,
                  color: selected
                      ? (tokens.isDark ? tokens.deepMaroon : Colors.white)
                      : tokens.muted,
                ),
                const SizedBox(width: 6),
                Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected
                        ? (tokens.isDark ? tokens.deepMaroon : Colors.white)
                        : tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
