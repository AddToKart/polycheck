import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../core/models/host_session.dart';
import '../../data/student_scan_service.dart';

const Duration hostPollInterval = Duration(seconds: 5);
const List<int> _validityChoices = <int>[1, 3, 5, 10, 15];
const List<int> _graceChoices = <int>[0, 5, 10, 15, 30, 60];

const Map<String, String> _statusText = <String, String>{
  'present': 'Present',
  'late': 'Late',
  'absent': 'Absent',
  'excused': 'Excused',
  'disputed': 'For review',
  'incomplete': 'Incomplete',
  'pending': 'Not yet',
};

/// Campus time, whatever the phone's own time zone is.
String _clock(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  final campus = parsed.toUtc().add(const Duration(hours: 8));
  final minute = campus.minute.toString().padLeft(2, '0');
  final hour = campus.hour % 12 == 0 ? 12 : campus.hour % 12;
  return '$hour:$minute ${campus.hour < 12 ? 'AM' : 'PM'}';
}

/// A section president's controls for a session they created: start it, show
/// the QR code, watch who checks in (view only), and end it.
class HostSessionPanel extends ConsumerStatefulWidget {
  const HostSessionPanel({super.key, required this.sessionId, this.onChanged});

  final String sessionId;

  /// Called after starting or ending, so the screen around it can reload.
  final VoidCallback? onChanged;

  @override
  ConsumerState<HostSessionPanel> createState() => _HostSessionPanelState();
}

class _HostSessionPanelState extends ConsumerState<HostSessionPanel> {
  HostSessionState? _state;
  String? _error;
  String? _notice;
  bool _busy = false;
  int _validity = 5;
  int _grace = 15;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  String _reason(Object error, String fallback) =>
      error is ApiRequestError && error.message.trim().isNotEmpty
      ? error.message.trim()
      : fallback;

  /// Keeps the list current while people check in.
  void _apply(HostSessionState next) {
    setState(() {
      _state = next;
      _error = null;
    });
    if (next.isActive) {
      _poll ??= Timer.periodic(hostPollInterval, (_) => _refresh());
    } else {
      _poll?.cancel();
      _poll = null;
    }
  }

  Future<void> _refresh() async {
    try {
      final next = await ref
          .read(sessionsApiProvider)
          .getHostSession(widget.sessionId);
      if (mounted) _apply(next);
    } on Object catch (error) {
      if (!mounted) return;
      setState(
        () => _error = _reason(error, 'Your session controls could not load.'),
      );
    }
  }

  /// Where the phone is, used only to mark the president present. Starting
  /// works without it.
  Future<Map<String, dynamic>> _evidence() async {
    final evidence = <String, dynamic>{};
    try {
      final location = await ref.read(scanLocationReaderProvider).current();
      evidence.addAll(<String, dynamic>{
        'latitude': location.latitude,
        'longitude': location.longitude,
        'accuracyMeters': location.accuracyMeters,
        'mocked': location.isMocked,
        // Both from the phone, so its clock being wrong cancels out.
        'locationCapturedAt': location.capturedAt.toUtc().toIso8601String(),
        'clientTime': (location.deviceNowAtFix ?? location.capturedAt)
            .toUtc()
            .toIso8601String(),
      });
    } on ScanLocationException {
      // The server says why they were not marked present.
    } on Object {
      // Same: never block starting the class on the location.
    }
    try {
      evidence['deviceId'] = await ref
          .read(deviceIdentityProvider)
          .getOrCreate();
    } on Object {
      // Optional.
    }
    try {
      final security = await ref.read(deviceSecurityProberProvider).probe();
      evidence['deviceSecurity'] = security.toJson();
    } on Object {
      // Optional.
    }
    return evidence;
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
      _notice = 'Getting your location…';
    });
    try {
      final body = <String, dynamic>{
        'validityMinutes': _validity,
        'gracePeriodMinutes': _grace,
        ...await _evidence(),
      };
      final next = await ref
          .read(sessionsApiProvider)
          .startHostSession(widget.sessionId, body);
      if (!mounted) return;
      _notice = next.presenceMessage;
      _apply(next);
      widget.onChanged?.call();
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _notice = null;
        _error = _reason(
          error,
          'The session could not be started. Check your connection.',
        );
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _end() async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'End this session?',
      description: 'Students who have not checked in will be marked absent.',
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          key: const ValueKey('host-confirm-end'),
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('End session'),
        ),
      ],
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final next = await ref
          .read(sessionsApiProvider)
          .endHostSession(widget.sessionId);
      if (!mounted) return;
      _notice = 'Session ended.';
      _apply(next);
      widget.onChanged?.call();
    } on Object catch (error) {
      if (!mounted) return;
      setState(
        () => _error = _reason(error, 'The session could not be ended.'),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showFullScreen(String token) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog.fullscreen(
        backgroundColor: Colors.white,
        child: SafeArea(
          child: Column(
            children: <Widget>[
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  tooltip: 'Close QR code',
                  icon: const Icon(Icons.close, color: Colors.black),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                ),
              ),
              Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: QrImageView(
                      data: token,
                      backgroundColor: Colors.white,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                      semanticsLabel: 'Attendance QR code, full screen',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _picker(
    String label,
    int value,
    List<int> choices,
    ValueChanged<int> onChanged,
  ) {
    return DropdownButtonFormField<int>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: <DropdownMenuItem<int>>[
        for (final minutes in choices)
          DropdownMenuItem<int>(value: minutes, child: Text('$minutes min')),
      ],
      onChanged: _busy ? null : (next) => onChanged(next ?? value),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final state = _state;
    final muted = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: tokens.muted);
    final token = state?.qrToken;
    return CampusCard(
      borderColor: tokens.gold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Run this session',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            if (state == null)
              CampusButton(
                label: 'Try again',
                variant: CampusButtonVariant.outline,
                onPressed: _refresh,
              ),
          ],
          if (_notice != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(_notice!),
          ],
          if (state == null && _error == null) ...<Widget>[
            const SizedBox(height: 8),
            Text('Loading…', style: muted),
          ],
          if (state?.message != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(state!.message!, style: muted),
          ],
          if (state?.canStart == true) ...<Widget>[
            const SizedBox(height: 10),
            _picker(
              'QR counts as present for',
              _validity,
              _validityChoices,
              (next) => setState(() => _validity = next),
            ),
            const SizedBox(height: 8),
            _picker(
              'Then counts as late for',
              _grace,
              _graceChoices,
              (next) => setState(() => _grace = next),
            ),
            const SizedBox(height: 8),
            Text(
              'Allow location when asked. If you are inside the class area, '
              'you are marked present.',
              style: muted,
            ),
            const SizedBox(height: 10),
            CampusButton(
              key: const ValueKey('host-start-session'),
              label: _busy ? 'Starting…' : 'Start session',
              icon: Icons.play_arrow,
              loading: _busy,
              onPressed: _busy ? null : _start,
            ),
          ],
          if (state?.canEnd == true) ...<Widget>[
            if (token != null) ...<Widget>[
              const SizedBox(height: 10),
              Semantics(
                button: true,
                label: 'Show the QR code full screen',
                child: GestureDetector(
                  key: const ValueKey('host-qr'),
                  onTap: () => _showFullScreen(token),
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(12),
                    child: Center(
                      child: QrImageView(
                        data: token,
                        size: 240,
                        padding: EdgeInsets.zero,
                        backgroundColor: Colors.white,
                        errorCorrectionLevel: QrErrorCorrectLevel.M,
                        semanticsLabel: 'Attendance QR code for this session',
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Tap the code to show it full screen.'
                '${state!.qrTokenExpiresAt == null ? '' : ' Present until ${_clock(state.qrTokenExpiresAt!)}, then late for ${state.gracePeriodMinutes} min.'}',
                textAlign: TextAlign.center,
                style: muted,
              ),
            ],
            const SizedBox(height: 10),
            CampusButton(
              key: const ValueKey('host-end-session'),
              label: 'End session',
              icon: Icons.stop,
              variant: CampusButtonVariant.outline,
              onPressed: _busy ? null : _end,
            ),
          ],
          if (state != null && state.roster.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            Text(
              '${state.checkedInCount} of ${state.roster.length} checked in',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            for (final entry in state.roster)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: <Widget>[
                    // Names wrap: the president needs them in full.
                    Expanded(child: Text(entry.studentName)),
                    const SizedBox(width: 8),
                    Text(
                      '${_statusText[entry.status] ?? entry.status}'
                      '${entry.scannedAt == null ? '' : ' · ${_clock(entry.scannedAt!)}'}',
                      style: muted,
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
