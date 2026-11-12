import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../../core/polycheck_core.dart';
import '../data/cockpit_realtime.dart';
import '../data/faculty_logic.dart';
import '../data/session_wizard.dart';
import '../data/teacher_signing_key.dart';
import 'widgets/cockpit_dialogs.dart';
import 'widgets/faculty_shell.dart';
import 'widgets/qr_token_panel.dart';

/// Live session cockpit (web parity): locally signed Ed25519 tokens, dual
/// online checkpoints with meeting PINs, realtime roster, manual overrides,
/// polling fallback, and End Session resolution.
class SessionCockpitScreen extends ConsumerStatefulWidget {
  const SessionCockpitScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<SessionCockpitScreen> createState() =>
      _SessionCockpitScreenState();
}

class _SessionCockpitScreenState extends ConsumerState<SessionCockpitScreen> {
  bool _loading = true;
  String? _error;
  Session? _session;
  Section? _section;
  List<User> _students = const <User>[];
  List<AttendanceRecord> _records = const <AttendanceRecord>[];

  bool _refreshing = false;
  bool _refreshQueued = false;
  DateTime? _lastUpdated;
  String? _busyAction;

  CheckpointType _checkpointTab = CheckpointType.start;
  String? _startPinPlain;
  String? _endPinPlain;
  CockpitStatusFilter _filter = CockpitStatusFilter.all;
  int _deniedCount = 0;
  SessionFinaleSummary? _finale;
  bool _realtimeConnected = false;

  Timer? _pollTimer;
  Timer? _ticker;
  CockpitRealtime? _realtime;

  TrustedClock get _clock => ref.read(trustedClockProvider);
  DateTime Function() get _deviceNow => ref.read(deviceNowProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _refresh(initial: true);
      await _connectRealtime();
      // B-17: seed the denied-attempts log with the server-side record so
      // the radar list is populated even before the first anomaly event.
      _loadDeniedAttempts();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _ticker?.cancel();
    _ticker = null;
    _realtime?.dispose();
    super.dispose();
  }

  /// 1 Hz repaint for the "Updated Ns ago" freshness label — the only
  /// time-relative text this screen renders (the token countdowns tick inside
  /// `TokenCountdown`).
  ///
  /// DD-F7: the timer used to be created without a handle, so `dispose()` could
  /// not cancel it and every cockpit visit leaked a periodic full rebuild for
  /// the rest of the process. It is now stored, cancelled on dispose, and only
  /// runs while that label is actually on screen (a successful refresh has
  /// recorded [_lastUpdated]).
  void _syncTicker() {
    if (!mounted || _lastUpdated == null) {
      _ticker?.cancel();
      _ticker = null;
      return;
    }
    _ticker ??= Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
    });
  }

  Future<void> _connectRealtime() async {
    if (_realtime != null) return;
    final realtime = CockpitRealtime(
      sessionId: widget.sessionId,
      // Re-read on every (re)connect so a rotated bearer is never stale
      // (DD-F18).
      readToken: () => ref.read(tokenStoreProvider).read(),
      onUpdate: () => _refresh(),
      onAnomaly: (event) {
        if (!mounted) return;
        setState(() => _deniedCount += 1);
        CampusToast.showIn(
          context,
          '${event.studentName ?? 'A student'} was outside the geofence'
          '${event.distanceMeters == null ? '' : ' (${event.distanceMeters!.round()} m)'}',
          tone: CampusToastTone.warning,
        );
        // B-17: refresh the denied-attempts log when the live anomaly event
        // arrives (the server already persisted the attempt).
        _loadDeniedAttempts();
      },
      onFinale: (summary) {
        if (!mounted) return;
        setState(() => _finale = summary);
        _refresh();
      },
      onConnectionChanged: (connected) {
        if (!mounted) return;
        setState(() => _realtimeConnected = connected);
      },
    );
    _realtime = realtime;
    await realtime.connect();
  }

  /// B-17: nudge the denied-attempts log provider (the section widget watches
  /// the family; the socket callback and the cockpit mount invalidate it).
  void _loadDeniedAttempts() {
    ref.invalidate(cockpitDeniedAttemptsProvider(widget.sessionId));
  }

  Future<void> _refresh({bool initial = false}) async {
    if (_refreshing) {
      _refreshQueued = true;
      return;
    }
    _refreshing = true;
    if (initial && mounted) {
      setState(() {
        _loading = _session == null;
        _error = null;
      });
    }
    try {
      final sessionsApi = ref.read(sessionsApiProvider);
      final sectionsApi = ref.read(sectionsApiProvider);
      final attendanceApi = ref.read(attendanceApiProvider);
      final session = await sessionsApi.getSession(widget.sessionId);
      final results = await Future.wait<Object?>(<Future<Object?>>[
        sectionsApi.getSection(session.sectionId),
        sectionsApi.getSectionStudents(session.sectionId),
        attendanceApi.getAttendanceRecords(sessionId: session.id),
      ]);
      if (!mounted) return;
      final roster = results[1] as List<SectionStudent>? ?? const [];
      setState(() {
        _session = session;
        _section = results[0] as Section?;
        _students = roster.map((row) => row.student).toList(growable: false);
        _records =
            results[2] as List<AttendanceRecord>? ?? const <AttendanceRecord>[];
        _lastUpdated = _clock.now(deviceNow: _deviceNow);
        _loading = false;
        _error = null;
      });
      _ensurePolling();
      _syncTicker();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load the session: $error';
      });
    } finally {
      _refreshing = false;
      if (_refreshQueued && mounted) {
        _refreshQueued = false;
        unawaited(_refresh());
      }
    }
  }

  void _ensurePolling() {
    final active = _session?.isActive ?? false;
    if (!active) {
      _pollTimer?.cancel();
      _pollTimer = null;
      return;
    }
    _pollTimer ??= Timer.periodic(
      const Duration(seconds: 10),
      (_) => _refresh(),
    );
  }

  Future<void> _generateInPersonQr() async {
    final session = _session;
    final user = ref.read(sessionProvider).user;
    if (session == null || user == null || _busyAction != null) return;
    final settings = await showInPersonQrDialog(
      context,
      initialValidity: session.qrValidityMinutes.clamp(1, 15),
      initialGrace: session.gracePeriodMinutes.clamp(0, 60),
      regenerating: false,
    );
    if (settings == null || !mounted) return;
    setState(() => _busyAction = 'activation');
    try {
      final keyService = ref.read(teacherSigningKeyServiceProvider);
      final key = await keyService.getOrCreate(user.id);
      final issuedAtMs = _clock.nowMs(deviceNow: _deviceNow);
      final payload = buildInPersonTokenPayload(
        session: session,
        teacher: user,
        issuedAtMs: issuedAtMs,
        validityMinutes: settings.validityMinutes,
        gracePeriodMinutes: settings.gracePeriodMinutes,
      );
      final token = await keyService.signPayload(payload, key);
      final location = await _teacherLocationFix();
      final activated = await _activateWithProvisioningRetry(
        user: user,
        session: session,
        key: key,
        token: token,
        validityMinutes: settings.validityMinutes,
        gracePeriodMinutes: settings.gracePeriodMinutes,
        location: location,
      );
      if (!mounted) return;
      setState(() => _session = activated);
      CampusToast.showIn(
        context,
        'QR armed for ${settings.validityMinutes} min '
        '(${settings.gracePeriodMinutes} min grace).',
        tone: CampusToastTone.success,
      );
      await _refresh();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to generate the QR: $error',
        tone: CampusToastTone.error,
      );
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<Session> _activateWithProvisioningRetry({
    required User user,
    required Session session,
    required TeacherSigningKey key,
    required String token,
    required int validityMinutes,
    required int gracePeriodMinutes,
    required TeacherActivationLocation? location,
  }) async {
    final provisioner = ref.read(teacherKeyProvisionerProvider);
    final api = ref.read(sessionsApiProvider);
    await provisioner.ensure(user: user, session: session, key: key);
    try {
      return await api.activateSession(
        session.id,
        validityMinutes: validityMinutes,
        gracePeriodMinutes: gracePeriodMinutes,
        token: token,
        teacherLocation: location,
      );
    } on ApiRequestError catch (error) {
      if (error.isTeacherLocationRejected &&
          error.canRequestOverride == true &&
          location != null &&
          mounted) {
        final confirmed = await showFacultyConfirm(
          context,
          title: 'Activate away from the classroom?',
          message:
              'Your location is ${error.distanceMeters?.round() ?? '?'} m from '
              'the geofence (allowed ${error.allowedDistanceMeters?.round() ?? '?'} m). '
              'Confirming records an activation override in the audit log.',
          confirmLabel: 'Activate anyway',
        );
        if (confirmed) {
          return api.activateSession(
            session.id,
            validityMinutes: validityMinutes,
            gracePeriodMinutes: gracePeriodMinutes,
            token: token,
            teacherLocation: location.copyWith(overrideFlag: true),
          );
        }
        rethrow;
      }
      final signatureIssue =
          error.message.toLowerCase().contains('signature is invalid') ||
          error.message.toLowerCase().contains('signing key');
      if (!signatureIssue) rethrow;
      await provisioner.ensure(
        user: user,
        session: session,
        key: key,
        force: true,
      );
      return api.activateSession(
        session.id,
        validityMinutes: validityMinutes,
        gracePeriodMinutes: gracePeriodMinutes,
        token: token,
        teacherLocation: location,
      );
    }
  }

  Future<void> _armCheckpoint(
    CheckpointType checkpoint, {
    bool regenerate = false,
  }) async {
    final session = _session;
    final user = ref.read(sessionProvider).user;
    if (session == null || user == null || _busyAction != null) return;
    final remembered = checkpoint == CheckpointType.start
        ? _startPinPlain
        : _endPinPlain;
    final settings = await showCheckpointQrDialog(
      context,
      isStart: checkpoint == CheckpointType.start,
      regenerating: regenerate,
      initialValiditySeconds:
          (checkpoint == CheckpointType.start
              ? session.startQrValiditySeconds
              : session.endQrValiditySeconds) ??
          90,
      initialGraceMinutes: session.startGraceMinutes ?? 10,
      rememberedPin: remembered,
    );
    if (settings == null || !mounted) return;
    setState(() => _busyAction = '${checkpoint.wire}-qr');
    try {
      final keyService = ref.read(teacherSigningKeyServiceProvider);
      final key = await keyService.getOrCreate(user.id);
      final pinHash = settings.pinRequired && settings.pin != null
          ? (await hashMeetingPin(settings.pin!)).serialized
          : null;
      final payload = buildCheckpointTokenPayload(
        session: session,
        teacher: user,
        issuedAtMs: _clock.nowMs(deviceNow: _deviceNow),
        checkpoint: checkpoint,
        validitySeconds: settings.validitySeconds,
        graceMinutes: settings.graceMinutes,
        pinHash: pinHash,
      );
      final token = await keyService.signPayload(payload, key);
      final provisioner = ref.read(teacherKeyProvisionerProvider);
      final api = ref.read(sessionsApiProvider);
      await provisioner.ensure(user: user, session: session, key: key);
      Future<Session> send({required bool forceProvision}) async {
        if (forceProvision) {
          await provisioner.ensure(
            user: user,
            session: session,
            key: key,
            force: true,
          );
        }
        return api.activateCheckpoint(
          GenerateCheckpointQrInput(
            sessionId: session.id,
            checkpoint: checkpoint,
            validitySeconds: settings.validitySeconds,
            graceMinutes: checkpoint == CheckpointType.start
                ? settings.graceMinutes
                : null,
            regenerate: regenerate ? true : null,
          ),
          token: token,
        );
      }

      Session armed;
      try {
        armed = await send(forceProvision: false);
      } on ApiRequestError catch (error) {
        final signatureIssue =
            error.message.toLowerCase().contains('signature is invalid') ||
            error.message.toLowerCase().contains('signing key');
        if (!signatureIssue) rethrow;
        armed = await send(forceProvision: true);
      }
      if (!mounted) return;
      setState(() {
        _session = armed;
        if (checkpoint == CheckpointType.start) {
          _startPinPlain = settings.pinRequired ? settings.pin : null;
        } else {
          _endPinPlain = settings.pinRequired ? settings.pin : null;
        }
      });
      CampusToast.showIn(
        context,
        '${checkpoint == CheckpointType.start ? 'Start' : 'End'} QR armed '
        'for ${settings.validitySeconds}s'
        '${settings.pinRequired ? ' — announce PIN ${settings.pin}' : ''}.',
        tone: CampusToastTone.success,
      );
      await _refresh();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to arm the checkpoint: $error',
        tone: CampusToastTone.error,
      );
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<TeacherActivationLocation?> _teacherLocationFix() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      return TeacherActivationLocation(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _endSession() async {
    final session = _session;
    if (session == null || _busyAction != null) return;
    final rows = buildCockpitRoster(students: _students, records: _records);
    final summary = summarizeRoster(rows);
    final confirmed = await confirmEndSession(
      context,
      online: session.mode == SessionMode.online,
      present: summary.present,
      late: summary.late,
      absent: summary.absent,
      pendingCount: summary.pending,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busyAction = 'end');
    try {
      final ended = await ref.read(sessionsApiProvider).endSession(session.id);
      if (!mounted) return;
      setState(() {
        _session = ended;
        _startPinPlain = null;
        _endPinPlain = null;
        _finale = null;
      });
      CampusToast.showIn(
        context,
        'Session ended. Attendance is final.',
        tone: CampusToastTone.success,
      );
      await _refresh();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<void> _cycleStatus(CockpitRosterRow row) async {
    final session = _session;
    if (session == null || _busyAction != null || !session.isActive) {
      if (session != null && !session.isActive) {
        CampusToast.showIn(
          context,
          'This session has ended. Overrides are closed.',
          tone: CampusToastTone.warning,
        );
      }
      return;
    }
    final next = nextAttendanceStatus(row.status);
    final existing = row.record;
    if (existing != null) {
      final optimistic = existing.copyWith(status: next, manuallySet: true);
      setState(() {
        _records = [
          for (final record in _records)
            if (record.id == existing.id) optimistic else record,
        ];
        _busyAction = 'override:${row.studentId}';
      });
      try {
        await ref
            .read(attendanceApiProvider)
            .updateAttendanceStatus(existing.id, next);
        if (!mounted) return;
        CampusToast.showIn(
          context,
          '${row.studentName} → ${attendanceStatusLabels[next]}',
          tone: CampusToastTone.info,
        );
      } on ApiRequestError catch (error) {
        if (!mounted) return;
        CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
      } finally {
        if (mounted) {
          setState(() => _busyAction = null);
          await _refresh();
        }
      }
      return;
    }

    final now = _clock.now(deviceNow: _deviceNow);
    final optimistic = AttendanceRecord(
      id: const Uuid().v4(),
      sessionId: session.id,
      sectionId: session.sectionId,
      studentId: row.studentId,
      studentName: row.studentName,
      timestamp: now.toIso8601String(),
      status: next,
      coordinates: const AttendanceCoordinates(latitude: null, longitude: null),
      isSynced: true,
      syncedAt: now.toIso8601String(),
      manuallySet: true,
    );
    setState(() {
      _records = [..._records, optimistic];
      _busyAction = 'override:${row.studentId}';
    });
    try {
      await ref.read(attendanceApiProvider).addAttendanceRecord(optimistic);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${row.studentName} → ${attendanceStatusLabels[next]}',
        tone: CampusToastTone.info,
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) {
        setState(() => _busyAction = null);
        await _refresh();
      }
    }
  }

  Future<void> _downloadSessionAttendance(String format) async {
    try {
      final download = await ref
          .read(docsApiProvider)
          .sessionAttendance(widget.sessionId, format: format);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final tokens = PupTheme.of(context);
    final rows = buildCockpitRoster(students: _students, records: _records);
    final summary = summarizeRoster(rows);
    final visible = filterRoster(rows, _filter);
    final online = session?.mode == SessionMode.online;
    final activeToken = session == null
        ? null
        : online
        ? (_checkpointTab == CheckpointType.start
              ? session.startQrToken
              : session.endQrToken)
        : session.qrToken;
    final activeExpiry = session == null
        ? null
        : online
        ? (_checkpointTab == CheckpointType.start
              ? session.startTokenExpiresAt
              : session.endTokenExpiresAt)
        : session.qrTokenExpiresAt;
    final activePin = online
        ? (_checkpointTab == CheckpointType.start
              ? _startPinPlain
              : _endPinPlain)
        : null;
    final startArmed = (session?.startQrToken ?? '').isNotEmpty;
    final endArmed = (session?.endQrToken ?? '').isNotEmpty;
    final section = _section;

    return FacultyScaffold(
      title: session?.subjectName ?? 'Session',
      subtitle: section == null
          ? null
          : formatSectionHeading(
              section: section.section,
              course: section.course,
            ),
      showDefaultActions: false,
      actions: [
        IconButton(
          tooltip: 'Refresh roster',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
        PopupMenuButton<String>(
          tooltip: 'Session exports',
          icon: const Icon(Icons.ios_share),
          onSelected: (value) {
            if (value == 'csv' || value == 'pdf') {
              _downloadSessionAttendance(value);
            }
          },
          itemBuilder: (context) => const [
            PopupMenuItem<String>(value: 'csv', child: Text('Attendance CSV')),
            PopupMenuItem<String>(value: 'pdf', child: Text('Attendance PDF')),
          ],
        ),
      ],
      body: _loading
          ? const FacultyLoading(label: 'Loading the cockpit.')
          : _error != null && session == null
          ? FacultyError(
              message: _error!,
              onRetry: () => _refresh(initial: true),
            )
          : session == null
          ? const FacultyEmptyState(title: 'Session not found')
          : FacultyPageBody(
              refresh: _refresh,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                session.subjectName,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            FacultyPill(
                              label: session.isActive
                                  ? (session.endedAt != null ? 'ENDED' : 'LIVE')
                                  : (session.endedAt != null
                                        ? 'COMPLETED'
                                        : 'SCHEDULED'),
                              background: session.isActive
                                  ? tokens.gold
                                  : (session.endedAt != null
                                        ? tokens.campus
                                        : tokens.maroon),
                              foreground: session.isActive
                                  ? tokens.deepMaroon
                                  : (session.endedAt != null
                                        ? tokens.onSurface
                                        : Colors.white),
                              border: session.isActive
                                  ? tokens.gold
                                  : tokens.borderSubtle,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${session.date} · '
                          '${formatTime(session.startTime)} – '
                          '${formatTime(session.endTime)}'
                          '${(session.room ?? '').trim().isEmpty ? '' : ' · ${session.room}'}',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            FacultyPill(
                              label: modeLabel(session.mode),
                              icon: session.mode == SessionMode.online
                                  ? Icons.videocam_outlined
                                  : Icons.location_on_outlined,
                            ),
                            if (_realtimeConnected)
                              FacultyPill(
                                label: 'LIVE SYNC',
                                icon: Icons.bolt,
                                background: tokens.campus,
                              ),
                            FacultyPill(
                              label:
                                  'P${summary.present} L${summary.late} '
                                  'A${summary.absent} ?${summary.pending}',
                            ),
                            if (summary.incomplete > 0)
                              FacultyPill(
                                label: 'INC ${summary.incomplete}',
                                icon: Icons.timelapse,
                              ),
                            if (summary.disputed > 0)
                              FacultyPill(
                                label: 'DSP ${summary.disputed}',
                                icon: Icons.gavel_outlined,
                                background: tokens.gold,
                                foreground: tokens.deepMaroon,
                                border: tokens.gold,
                              ),
                            if (summary.excused > 0)
                              FacultyPill(
                                label: 'EXC ${summary.excused}',
                                icon: Icons.event_available_outlined,
                              ),
                            if (_deniedCount > 0)
                              FacultyPill(
                                label: '$_deniedCount denied',
                                icon: Icons.block,
                                background: tokens.deepMaroon,
                                foreground: Colors.white,
                                border: tokens.gold,
                              ),
                          ],
                        ),
                        if (_lastUpdated != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Updated ${secondsSince(_lastUpdated!.toIso8601String(), now: _clock.now(deviceNow: _deviceNow)) ?? 0}s ago',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (_finale != null) ...[
                    const SizedBox(height: 10),
                    CampusCard(
                      color: tokens.deepMaroon,
                      borderColor: tokens.gold,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'SESSION FINALE',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: tokens.gold,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _finale!.counts.entries
                                .map(
                                  (entry) => '${entry.key.wire} ${entry.value}',
                                )
                                .join(' · '),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (online && session.isActive) ...[
                          FacultyTabs(
                            labels: [
                              'Start checkpoint${startArmed ? ' · armed' : ''}',
                              'End checkpoint${endArmed ? ' · armed' : ''}',
                            ],
                            selectedIndex:
                                _checkpointTab == CheckpointType.start ? 0 : 1,
                            onSelected: (index) => setState(() {
                              _checkpointTab = index == 0
                                  ? CheckpointType.start
                                  : CheckpointType.end;
                            }),
                          ),
                          const SizedBox(height: 10),
                        ],
                        QrTokenPanel(
                          label: online && session.isActive
                              ? _checkpointTab == CheckpointType.start
                                    ? 'Start-of-class token'
                                    : 'End-of-class token'
                              : 'Attendance token',
                          token: activeToken,
                          expiresAtIso: activeExpiry,
                          clock: _clock,
                          deviceNow: _deviceNow,
                          onCopy: () => copyToClipboard(
                            context,
                            activeToken ?? '',
                            label: 'Token copied.',
                          ),
                          onShare: () => sharePlainText(
                            context,
                            activeToken ?? '',
                            subject: '${session.subjectName} attendance token',
                          ),
                          onFullscreen: () => showTokenFullscreen(
                            context,
                            title: '${session.subjectName} · ${session.date}',
                            token: activeToken ?? '',
                            pin: activePin,
                            expiresAtIso: activeExpiry,
                            clock: _clock,
                            deviceNow: _deviceNow,
                            onCopy: () => copyToClipboard(
                              context,
                              activeToken ?? '',
                              label: 'Token copied.',
                            ),
                            onShare: () => sharePlainText(
                              context,
                              activeToken ?? '',
                              subject:
                                  '${session.subjectName} attendance token',
                            ),
                          ),
                          note: online
                              ? 'Online checkpoints collect no location '
                                    '(RA 10173). The meeting PIN blocks '
                                    'forwarded screenshots.'
                              : null,
                        ),
                        if (activePin != null && activePin.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          CampusBadge(
                            label: 'PIN $activePin — announce aloud',
                            background: tokens.gold,
                            foreground: tokens.deepMaroon,
                            border: tokens.gold,
                            icon: Icons.pin_outlined,
                          ),
                        ],
                        const SizedBox(height: 12),
                        if (!session.isActive && session.endedAt != null)
                          Text(
                            'This session is closed. Attendance is final and '
                            'manual overrides are disabled.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          )
                        else if (!online) ...[
                          if (!session.isActive)
                            CampusButton(
                              label: 'Generate QR',
                              icon: Icons.qr_code_2,
                              loading: _busyAction == 'activation',
                              onPressed: _busyAction == null
                                  ? _generateInPersonQr
                                  : null,
                            )
                          else
                            CampusButton(
                              label: 'End session',
                              variant: CampusButtonVariant.destructive,
                              icon: Icons.stop_circle_outlined,
                              loading: _busyAction == 'end',
                              onPressed: _busyAction == null
                                  ? _endSession
                                  : null,
                            ),
                        ] else ...[
                          Row(
                            children: [
                              if (_checkpointTab == CheckpointType.start)
                                Expanded(
                                  child: CampusButton(
                                    label: startArmed
                                        ? 'Regenerate start'
                                        : 'Arm start',
                                    icon: startArmed
                                        ? Icons.refresh
                                        : Icons.play_arrow,
                                    loading: _busyAction == 'start-qr',
                                    onPressed: _busyAction == null
                                        ? () => _armCheckpoint(
                                            CheckpointType.start,
                                            regenerate: startArmed,
                                          )
                                        : null,
                                  ),
                                )
                              else
                                Expanded(
                                  child: CampusButton(
                                    label: endArmed
                                        ? 'Regenerate end'
                                        : 'Arm end',
                                    icon: endArmed
                                        ? Icons.refresh
                                        : Icons.stop_circle_outlined,
                                    loading: _busyAction == 'end-qr',
                                    onPressed:
                                        _busyAction == null &&
                                            (startArmed || session.isActive)
                                        ? () => _armCheckpoint(
                                            CheckpointType.end,
                                            regenerate: endArmed,
                                          )
                                        : null,
                                  ),
                                ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: CampusButton(
                                  label: 'End session',
                                  variant: CampusButtonVariant.destructive,
                                  icon: Icons.stop_circle_outlined,
                                  loading: _busyAction == 'end',
                                  onPressed: _busyAction == null
                                      ? _endSession
                                      : null,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            session.pinRequired
                                ? 'Meeting PIN required on every armed checkpoint.'
                                : 'No meeting PIN is required for this session yet.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  FacultySectionTitle(
                    title: 'Roster (${rows.length})',
                    trailing: TextButton(
                      onPressed: session.isActive ? _endSession : null,
                      child: const Text('End'),
                    ),
                  ),
                  FacultyTabs(
                    labels: CockpitStatusFilter.values
                        .map((filter) => cockpitStatusFilterLabels[filter]!)
                        .toList(growable: false),
                    selectedIndex: _filter.index,
                    onSelected: (index) => setState(
                      () => _filter = CockpitStatusFilter.values[index],
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (visible.isEmpty)
                    FacultyEmptyState(
                      title: 'No students in this filter',
                      message: rows.isEmpty
                          ? 'The roster is empty. Enroll students from the '
                                'section page.'
                          : null,
                      icon: Icons.people_outline,
                    )
                  else
                    for (final row in visible)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CampusCard(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          onTap: () => _cycleStatus(row),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            row.studentName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodyMedium
                                                ?.copyWith(
                                                  fontWeight: FontWeight.w600,
                                                ),
                                          ),
                                        ),
                                        if (row.record?.manuallySet ?? false)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              left: 4,
                                            ),
                                            child: Tooltip(
                                              message:
                                                  'Manually set by teacher',
                                              child: Icon(
                                                Icons.edit_outlined,
                                                size: 13,
                                                color: tokens.muted,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    Text(
                                      row.studentNumber ?? '',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: tokens.muted),
                                    ),
                                    if (online &&
                                        (row.record?.checkInStatus != null ||
                                            row.record?.checkOutStatus !=
                                                null)) ...[
                                      const SizedBox(height: 4),
                                      Wrap(
                                        spacing: 4,
                                        runSpacing: 4,
                                        children: [
                                          if (row.record?.checkInStatus
                                              case final checkIn?)
                                            CampusStatusBadge(
                                              status: checkIn,
                                              label:
                                                  'IN ${attendanceStatusLabels[checkIn]}',
                                              dense: true,
                                            ),
                                          if (row.record?.checkOutStatus
                                              case final checkOut?)
                                            CampusStatusBadge(
                                              status: checkOut,
                                              label:
                                                  'OUT ${attendanceStatusLabels[checkOut]}',
                                              dense: true,
                                            ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              IconButton(
                                tooltip: 'Open student',
                                onPressed: section == null
                                    ? null
                                    : () => context.push(
                                        '/faculty/students/${row.studentId}'
                                        '?sectionId=${Uri.encodeComponent(section.id)}',
                                      ),
                                icon: Icon(
                                  Icons.chevron_right,
                                  color: tokens.muted,
                                  size: 18,
                                ),
                              ),
                              CampusStatusBadge(status: row.status),
                            ],
                          ),
                        ),
                      ),
                  const SizedBox(height: 14),
                  CockpitDeniedAttemptsSection(sessionId: widget.sessionId),
                ],
              ),
            ),
    );
  }
}

/// ── B-17: denied-attempts log (RN radar-lite parity) ───────────────────────

/// Denied scan attempts for one cockpit session, fetched through the existing
/// `GET /attendance/attempts?sessionId=` binding (`AttendanceApi.getScanAttempts`).
/// The cockpit state invalidates this family on mount and on every
/// `attendance:anomaly` event; the section refetches itself when expanded.
final cockpitDeniedAttemptsProvider = FutureProvider.autoDispose
    .family<List<ScanAttemptView>, String>((ref, sessionId) async {
      final attempts = await ref
          .watch(attendanceApiProvider)
          .getScanAttempts(sessionId: sessionId);
      return deniedAttemptsFrom(attempts);
    });

/// Denied-only projection, newest first (the radar ignores accepted rows).
List<ScanAttemptView> deniedAttemptsFrom(List<ScanAttemptView> attempts) {
  final denied = attempts
      .where((attempt) => attempt.outcome == ScanAttemptOutcome.denied)
      .toList(growable: false);
  denied.sort((a, b) => a.timestamp.compareTo(b.timestamp));
  return List<ScanAttemptView>.unmodifiable(denied.reversed);
}

/// Humanized denial reasons (RN dispute-rail copy where one exists; unknown
/// reasons degrade to underscore-humanized strings like web `humanizeReason`).
String? deniedAttemptReasonLabel(String? reason) {
  if (reason == null || reason.isEmpty) return null;
  return switch (reason) {
    'session_inactive' => 'Session is not armed',
    'not_enrolled' => 'Not enrolled in this section',
    'qr_expired' => 'Expired QR',
    'token_mismatch' => 'QR token mismatch',
    'rate_limited' => 'Too many attempts',
    'mocked_location' => 'Mock GPS · fake location',
    'suspicious_coordinates' => 'Suspicious GPS · unusual jump',
    'outside_geofence' => 'Outside geofence',
    'geofence_uncertain' => 'Location uncertainty extends outside the geofence',
    'poor_location_accuracy' => 'Location accuracy too poor',
    'stale_location' => 'Location fix is stale',
    'missing_location' => 'No location evidence',
    'rooted_device' => 'Rooted / jailbroken device',
    'hook_detected' => 'Hooking tool detected',
    'emulator_detected' => 'Android emulator detected',
    'concurrent_session_conflict' => 'Concurrent session',
    'duplicate' => 'Duplicate submission',
    'client_attempt_conflict' => 'Replayed client attempt id',
    'replayed_rejection' => 'Replayed rejection',
    'pin_incorrect' => 'Wrong meeting PIN',
    'pin_required' => 'Meeting PIN required',
    'pin_locked' => 'PIN attempts locked',
    _ => reason.replaceAll('_', ' '),
  };
}

/// Distance copy in the web radar voice (`124m away · 74m outside geofence`).
String? deniedDistanceCopy({
  required double? distanceMeters,
  required double? geofenceRadiusMeters,
}) {
  final distance = distanceMeters;
  final radius = geofenceRadiusMeters;
  final parts = <String>[
    if (distance != null) '${distance.round()}m away',
    if (distance != null && radius != null && distance > radius)
      '${(distance - radius).round()}m outside geofence',
  ];
  if (parts.isEmpty) return null;
  return parts.join(' · ');
}

/// `now`, `4m ago`, `1h ago`, `Nov 9` relative label for attempt rows.
String deniedAttemptRelativeTime(String timestampIso, {required DateTime now}) {
  final parsed = DateTime.tryParse(timestampIso);
  if (parsed == null) return '';
  final difference = now.toUtc().difference(parsed.toUtc());
  if (difference < const Duration(minutes: 1)) return 'now';
  if (difference < const Duration(hours: 1)) {
    return '${difference.inMinutes}m ago';
  }
  if (difference < const Duration(hours: 24)) {
    return '${difference.inHours}h ago';
  }
  final month = getMonthName(parsed.month - 1);
  return '$month ${parsed.day}';
}

/// Collapsible live diagnostics rail for the cockpit: `DENIED ATTEMPTS (n)`.
/// Rows mirror the RN radar-lite log: student, humanized denial reason, and
/// the distance/radius copy from the server-side scan attempt record.
class CockpitDeniedAttemptsSection extends ConsumerStatefulWidget {
  const CockpitDeniedAttemptsSection({
    super.key,
    required this.sessionId,
    this.now,
    this.initiallyOpen = false,
  });

  final String sessionId;

  /// Injectable clock for tests; defaults to the device wall clock (labels
  /// only — the attempt timestamps come from the server).
  final DateTime Function()? now;
  final bool initiallyOpen;

  @override
  ConsumerState<CockpitDeniedAttemptsSection> createState() =>
      _CockpitDeniedAttemptsSectionState();
}

class _CockpitDeniedAttemptsSectionState
    extends ConsumerState<CockpitDeniedAttemptsSection> {
  late bool _open = widget.initiallyOpen;

  void _toggle() {
    final wasClosed = !_open;
    setState(() => _open = !_open);
    if (wasClosed) {
      ref.invalidate(cockpitDeniedAttemptsProvider(widget.sessionId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final attemptsAsync = ref.watch(
      cockpitDeniedAttemptsProvider(widget.sessionId),
    );
    final attempts = attemptsAsync.value ?? const <ScanAttemptView>[];
    final now = (widget.now ?? DateTime.now)();
    final theme = Theme.of(context);

    return CampusCard(
      key: const ValueKey('cockpit-denied-log'),
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          InkWell(
            key: const ValueKey('cockpit-denied-toggle'),
            onTap: _toggle,
            child: Row(
              children: <Widget>[
                Icon(
                  Icons.gpp_bad_outlined,
                  size: 16,
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                ),
                const SizedBox(width: 6),
                Text(
                  'DENIED ATTEMPTS (${attempts.length})',
                  key: const ValueKey('cockpit-denied-count'),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),
                Icon(
                  _open ? Icons.expand_less : Icons.expand_more,
                  size: 18,
                  color: tokens.muted,
                ),
              ],
            ),
          ),
          if (_open) ...<Widget>[
            const SizedBox(height: 8),
            if (attemptsAsync.isLoading && attempts.isEmpty)
              Text(
                'Loading denied attempts…',
                style: theme.textTheme.bodySmall?.copyWith(color: tokens.muted),
              )
            else if (attempts.isEmpty)
              Text(
                'No denied scan attempts logged for this session.',
                style: theme.textTheme.bodySmall?.copyWith(color: tokens.muted),
              )
            else
              for (final attempt in attempts.take(20))
                _DeniedAttemptRow(
                  key: ValueKey('cockpit-denied-${attempt.id}'),
                  attempt: attempt,
                  now: now,
                ),
          ],
        ],
      ),
    );
  }
}

class _DeniedAttemptRow extends StatelessWidget {
  const _DeniedAttemptRow({
    super.key,
    required this.attempt,
    required this.now,
  });

  final ScanAttemptView attempt;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final theme = Theme.of(context);
    final reason = deniedAttemptReasonLabel(attempt.denialReason);
    final distanceCopy = deniedDistanceCopy(
      distanceMeters: attempt.distanceMeters,
      geofenceRadiusMeters: attempt.geofenceRadiusMeters,
    );
    final student = attempt.studentName.trim().isNotEmpty
        ? attempt.studentName
        : (attempt.studentNumber?.trim().isNotEmpty == true
              ? attempt.studentNumber!
              : 'A student');
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: tokens.maroon.withValues(alpha: tokens.isDark ? 0.14 : 0.05),
          border: Border(left: BorderSide(color: tokens.maroon, width: 4)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    student,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [?reason, ?distanceCopy].join(' · '),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: tokens.muted,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              deniedAttemptRelativeTime(attempt.timestamp, now: now),
              style: theme.textTheme.labelSmall?.copyWith(color: tokens.muted),
            ),
          ],
        ),
      ),
    );
  }
}
