import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../core/polycheck_core.dart';
import '../../data/faculty_logic.dart';

/// Ticking expiry label driven by the trusted clock.
class TokenCountdown extends StatefulWidget {
  const TokenCountdown({
    super.key,
    required this.expiresAtIso,
    required this.clock,
    required this.deviceNow,
    this.prefix = 'Expires in',
  });

  final String? expiresAtIso;
  final TrustedClock clock;
  final DateTime Function() deviceNow;
  final String prefix;

  @override
  State<TokenCountdown> createState() => _TokenCountdownState();
}

class _TokenCountdownState extends State<TokenCountdown> {
  bool _tickerStarted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_tickerStarted) return;
    _tickerStarted = true;
    _tick();
  }

  void _tick() {
    Future<void>.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      setState(() {});
      _tick();
    });
  }

  @override
  Widget build(BuildContext context) {
    final expires = widget.expiresAtIso == null
        ? null
        : DateTime.tryParse(widget.expiresAtIso!);
    if (expires == null) {
      return Text(
        'No live expiry recorded',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: PupTheme.of(context).muted),
      );
    }
    final remaining = expires.toUtc().difference(
      widget.clock.now(deviceNow: widget.deviceNow),
    );
    final tokens = PupTheme.of(context);
    if (remaining.isNegative && remaining.inSeconds < 0) {
      return Text(
        'Expired — regenerate to keep attendance open',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: tokens.isDark ? tokens.gold : tokens.maroon,
          fontWeight: FontWeight.w700,
        ),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.timer_outlined,
          size: 14,
          color: tokens.isDark ? tokens.gold : tokens.maroon,
        ),
        const SizedBox(width: 4),
        Text(
          '${widget.prefix} ${formatCountdown(remaining)}',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// Token surface used by the cockpit.
///
/// The signed token is rendered as a scannable QR (`qr_flutter`); the raw
/// token stays available below it as the secondary manual-entry fallback.
class QrTokenPanel extends StatelessWidget {
  const QrTokenPanel({
    super.key,
    required this.label,
    required this.token,
    required this.expiresAtIso,
    required this.clock,
    required this.deviceNow,
    required this.onCopy,
    required this.onShare,
    required this.onFullscreen,
    this.note,
  });

  final String label;
  final String? token;
  final String? expiresAtIso;
  final TrustedClock clock;
  final DateTime Function() deviceNow;
  final VoidCallback onCopy;
  final VoidCallback onShare;
  final VoidCallback onFullscreen;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final armed = token != null && token!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.7,
                ),
              ),
            ),
            if (armed)
              TokenCountdown(
                expiresAtIso: expiresAtIso,
                clock: clock,
                deviceNow: deviceNow,
              )
            else
              Text(
                'Not armed',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (armed)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                color: Colors.white,
                child: Center(
                  child: QrImageView(
                    key: const ValueKey('cockpit-qr-image'),
                    data: token!,
                    size: 216,
                    padding: EdgeInsets.zero,
                    backgroundColor: Colors.white,
                    errorCorrectionLevel: QrErrorCorrectLevel.M,
                    semanticsLabel: 'Attendance QR code',
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'MANUAL ENTRY TOKEN',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: tokens.isDark ? Colors.black : tokens.campus,
                  border: Border.all(color: tokens.borderSubtle),
                ),
                child: SelectableText(
                  token!,
                  maxLines: 3,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 9,
                    height: 1.35,
                    color: tokens.onSurface,
                  ),
                ),
              ),
            ],
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 12),
            decoration: BoxDecoration(
              color: tokens.campus,
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Text(
              'Generate the token to open attendance.',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
        if (armed) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCopy,
                  icon: const Icon(Icons.copy_all_outlined, size: 16),
                  label: const Text('Copy'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 42),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onShare,
                  icon: const Icon(Icons.share_outlined, size: 16),
                  label: const Text('Share'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 42),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onFullscreen,
                  icon: const Icon(Icons.fullscreen, size: 16),
                  label: const Text('Open'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 42),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            note ??
                'Students scan this QR with the Polycheck scanner. If a device '
                    'cannot scan, copy the token for manual entry.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.35),
          ),
        ],
      ],
    );
  }
}

/// Fullscreen QR stage for projecting the signed token.
///
/// The raw token stays available below the code as the secondary manual-entry
/// path; [expiresAtIso] adds the trusted-clock countdown when supplied.
Future<void> showTokenFullscreen(
  BuildContext context, {
  required String title,
  required String token,
  required VoidCallback onCopy,
  required VoidCallback onShare,
  String? pin,
  String? expiresAtIso,
  TrustedClock? clock,
  DateTime Function()? deviceNow,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Close token view',
    pageBuilder: (dialogContext, animation, secondaryAnimation) {
      return Directionality(
        textDirection: Directionality.of(context),
        child: Scaffold(
          backgroundColor: PupColors.pupDeepMaroon,
          appBar: AppBar(
            backgroundColor: PupColors.pupDeepMaroon,
            foregroundColor: Colors.white,
            title: Text(title),
            leading: IconButton(
              tooltip: 'Close',
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'SIGNED ATTENDANCE QR',
                    style: TextStyle(
                      color: PupColors.pupGold,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            color: Colors.white,
                            child: QrImageView(
                              key: const ValueKey('cockpit-qr-fullscreen'),
                              data: token,
                              size: (MediaQuery.sizeOf(context).width - 88)
                                  .clamp(220.0, 380.0)
                                  .toDouble(),
                              padding: EdgeInsets.zero,
                              backgroundColor: Colors.white,
                              errorCorrectionLevel: QrErrorCorrectLevel.M,
                              semanticsLabel: 'Attendance QR code',
                            ),
                          ),
                          const SizedBox(height: 10),
                          if (expiresAtIso != null &&
                              clock != null &&
                              deviceNow != null)
                            TokenCountdown(
                              expiresAtIso: expiresAtIso,
                              clock: clock,
                              deviceNow: deviceNow,
                            ),
                          const SizedBox(height: 12),
                          const Text(
                            'MANUAL ENTRY TOKEN',
                            style: TextStyle(
                              color: PupColors.pupGold,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 4),
                          SelectableText(
                            token,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontFamily: 'monospace',
                              fontSize: 10,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (pin != null && pin.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 10, bottom: 8),
                      child: Text(
                        'MEETING PIN: $pin — announce aloud',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: PupColors.pupGold,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  const Text(
                    'Students scan this QR from the Polycheck scanner. If a '
                    'device cannot scan, copy the token for manual entry.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onCopy,
                          icon: const Icon(Icons.copy_all_outlined, size: 16),
                          label: const Text('Copy token'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white38),
                            minimumSize: const Size(0, 46),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: onShare,
                          icon: const Icon(Icons.share_outlined, size: 16),
                          label: const Text('Share'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: PupColors.pupGold,
                            foregroundColor: PupColors.pupDeepMaroon,
                            minimumSize: const Size(0, 46),
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.zero,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
