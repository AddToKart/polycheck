import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../../../core/api/api_providers.dart';
import '../../../core/models/dashboard.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_card.dart';
import '../domain/admin_access.dart';
import '../domain/server_metrics.dart';
import 'widgets/admin_common.dart';

class ServerStatusScreen extends ConsumerStatefulWidget {
  const ServerStatusScreen({super.key});

  @override
  ConsumerState<ServerStatusScreen> createState() => _ServerStatusScreenState();
}

class _ServerStatusScreenState extends ConsumerState<ServerStatusScreen> {
  ServerStatusSnapshot? _snapshot;
  List<ServerHistorySample> _history = const <ServerHistorySample>[];
  bool _loading = true;
  bool _live = false;
  String? _error;
  String? _liveError;
  socket_io.Socket? _socket;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _start();
    });
  }

  @override
  void dispose() {
    final socket = _socket;
    _socket = null;
    if (socket != null) {
      try {
        if (socket.connected) {
          socket.emit(ServerStatusEvents.unsubscribe);
        }
      } catch (_) {
        // The socket is torn down regardless.
      }
      socket.dispose();
    }
    super.dispose();
  }

  Future<void> _start() async {
    await _loadSnapshot();
    if (!mounted) return;
    await _connect();
  }

  Future<void> _loadSnapshot() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final snapshot = await ref.read(dashboardApiProvider).getServerStatus();
      if (!mounted) return;
      setState(() {
        _snapshot = snapshot;
        _history = appendServerSample(_history, snapshot);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  Future<void> _connect() async {
    try {
      final token = await ref.read(tokenStoreProvider).read();
      final socket = socket_io.io(
        ApiConfig.socketUrl,
        socket_io.OptionBuilder()
            .setTransports(<String>['websocket'])
            .setAuth(<String, dynamic>{'token': ?token})
            .enableForceNew()
            .build(),
      );
      socket.onConnect((_) {
        if (!mounted) return;
        setState(() => _live = true);
        socket.emit(ServerStatusEvents.subscribe);
      });
      socket.on(ServerStatusEvents.metrics, _onMetrics);
      socket.onDisconnect((_) {
        if (!mounted) return;
        setState(() => _live = false);
      });
      socket.onConnectError((dynamic error) {
        if (!mounted) return;
        setState(() {
          _live = false;
          _liveError = 'Live stream unavailable: $error';
        });
      });
      socket.connect();
      _socket = socket;
    } catch (error) {
      if (!mounted) return;
      setState(() => _liveError = 'Live stream unavailable: $error');
    }
  }

  void _onMetrics(dynamic payload) {
    if (!mounted || payload is! Map) return;
    try {
      final snapshot = ServerStatusSnapshot.fromJson(
        payload.cast<String, dynamic>(),
      );
      setState(() {
        _snapshot = snapshot;
        _history = appendServerSample(_history, snapshot);
        _live = true;
        _liveError = null;
      });
    } catch (_) {
      // Ignore malformed frames; the next 5 s tick re-syncs.
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final snapshot = _snapshot;
    return AdminScaffold(
      title: 'Server status',
      subtitle: 'Live health and latency for this Polycheck instance',
      section: AdminSection.serverStatus,
      actions: <Widget>[
        IconButton(
          tooltip: 'Refresh snapshot',
          onPressed: _loading ? null : _loadSnapshot,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: _loading && snapshot == null
          ? const AdminLoading(label: 'Reading server metrics…')
          : snapshot == null
          ? AdminErrorState(
              message: _error ?? 'No server snapshot available.',
              onRetry: _start,
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    AdminStatusChip(
                      label: _live ? 'Live · 5 s ticks' : 'Snapshot only',
                      active: _live,
                      positive: _live,
                    ),
                    AdminStatusChip(
                      label: snapshot.applicationReady
                          ? 'App ready'
                          : 'App down',
                      active: snapshot.applicationReady,
                    ),
                    AdminStatusChip(
                      label: snapshot.databaseReady
                          ? 'Database ready'
                          : 'Database down',
                      active: snapshot.databaseReady,
                    ),
                    AdminStatusChip(
                      label: snapshot.redisReady ? 'Redis ready' : 'Redis down',
                      active: snapshot.redisReady,
                    ),
                  ],
                ),
                if (_liveError != null) ...<Widget>[
                  const SizedBox(height: 10),
                  AdminInfoBanner(
                    icon: Icons.wifi_off,
                    message: _liveError!,
                    tone: AdminInfoTone.warning,
                  ),
                ],
                const SizedBox(height: 14),
                _GaugeRow(
                  latest: snapshot,
                  sample: _history.isEmpty ? null : _history.last,
                ),
                const SizedBox(height: 14),
                _SparklineCard(
                  title: 'CPU',
                  value: _history.isEmpty
                      ? '—'
                      : formatPercent(
                          _history.last.rates?.cpuPercent,
                          fractionDigits: 1,
                        ),
                  caption:
                      'Derived from the cumulative process CPU counter, '
                      'capped at 100%.',
                  series: seriesWithGaps(
                    _history,
                    (sample) => sample.rates?.cpuPercent,
                  ),
                ),
                const SizedBox(height: 10),
                _SparklineCard(
                  title: 'Requests',
                  value: _history.isEmpty
                      ? '—'
                      : formatRate(_history.last.rates?.requestRatePerSecond),
                  caption:
                      'HTTP requests per second since the previous tick. Gaps '
                      'after reconnects are not connected.',
                  series: seriesWithGaps(
                    _history,
                    (sample) => sample.rates?.requestRatePerSecond,
                  ),
                ),
                const SizedBox(height: 10),
                _SparklineCard(
                  title: 'p95 latency',
                  value: formatLatency(snapshot.latencyP95Ms),
                  caption:
                      'p50 ${formatLatency(snapshot.latencyP50Ms)} · p95 '
                      '${formatLatency(snapshot.latencyP95Ms)}',
                  series: seriesWithGaps(
                    _history,
                    (sample) => sample.snapshot.latencyP95Ms,
                  ),
                ),
                const SizedBox(height: 10),
                _SparklineCard(
                  title: 'Resident memory',
                  value: formatByteSize(snapshot.memoryRssBytes),
                  caption: 'RSS over the last 15 minutes.',
                  series: seriesWithGaps(
                    _history,
                    (sample) => sample.snapshot.memoryRssBytes.toDouble(),
                  ),
                ),
                const SizedBox(height: 14),
                CampusCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const AdminSectionLabel('Instance'),
                      const SizedBox(height: 8),
                      _FactRow(
                        label: 'Uptime',
                        value: formatUptime(snapshot.uptimeSeconds),
                      ),
                      _FactRow(
                        label: 'Event loop lag',
                        value: formatLatency(snapshot.eventLoopLagMs),
                      ),
                      _FactRow(
                        label: 'Active sockets',
                        value: '${snapshot.activeSockets}',
                      ),
                      _FactRow(
                        label: 'Total requests',
                        value: '${snapshot.httpRequestsTotal}',
                      ),
                      _FactRow(
                        label: 'Total errors',
                        value: '${snapshot.httpErrorsTotal}',
                      ),
                      _FactRow(
                        label: 'Queue',
                        value:
                            '${snapshot.queue.wait} waiting · '
                            '${snapshot.queue.active} active · '
                            '${snapshot.queue.failed} failed',
                      ),
                      _FactRow(
                        label: 'Snapshot',
                        value: formatSnapshotTimestamp(snapshot.timestamp),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Metrics stream only while this screen is open. The room '
                  'unsubscribes on exit.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
    );
  }
}

class _GaugeRow extends StatelessWidget {
  const _GaugeRow({required this.latest, required this.sample});

  final ServerStatusSnapshot latest;
  final ServerHistorySample? sample;

  @override
  Widget build(BuildContext context) {
    final rates = sample?.rates;
    return AdminStatGrid(
      children: <Widget>[
        AdminStatTile(
          label: 'CPU',
          value: formatPercent(rates?.cpuPercent),
          caption: 'Cumulative process counter',
          icon: Icons.memory,
        ),
        AdminStatTile(
          label: 'Requests / s',
          value: formatRate(rates?.requestRatePerSecond),
          caption: 'Error rate ${formatRate(rates?.errorRatePerSecond)}',
          icon: Icons.swap_vert,
        ),
        AdminStatTile(
          label: 'p95 latency',
          value: formatLatency(latest.latencyP95Ms),
          caption: 'p50 ${formatLatency(latest.latencyP50Ms)}',
          icon: Icons.speed,
        ),
        AdminStatTile(
          label: 'Memory',
          value: formatByteSize(latest.memoryRssBytes),
          caption: 'Resident set',
          icon: Icons.developer_board_outlined,
        ),
      ],
    );
  }
}

class _SparklineCard extends StatelessWidget {
  const _SparklineCard({
    required this.title,
    required this.value,
    required this.caption,
    required this.series,
  });

  final String title;
  final String value;
  final String caption;
  final List<double?> series;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final segments = sparklineSegments(series);
    return CampusCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                value,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: tokens.maroon,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 56,
            width: double.infinity,
            child: segments.isEmpty
                ? Center(
                    child: Text(
                      'Waiting for samples…',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                  )
                : CustomPaint(
                    painter: _SparklinePainter(
                      segments: segments,
                      color: tokens.maroon,
                      baseline: tokens.borderSubtle,
                    ),
                  ),
          ),
          const SizedBox(height: 4),
          Text(
            caption,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  const _SparklinePainter({
    required this.segments,
    required this.color,
    required this.baseline,
  });

  final List<List<SparklinePoint>> segments;
  final Color color;
  final Color baseline;

  @override
  void paint(Canvas canvas, Size size) {
    final baselinePaint = Paint()
      ..color = baseline
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(0, size.height - 1),
      Offset(size.width, size.height - 1),
      baselinePaint,
    );
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (final segment in segments) {
      if (segment.isEmpty) continue;
      final path = Path();
      for (var index = 0; index < segment.length; index++) {
        final point = segment[index];
        final dx = point.x / 100 * size.width;
        final dy = point.y / 32 * size.height;
        if (index == 0) {
          path.moveTo(dx, dy);
        } else {
          path.lineTo(dx, dy);
        }
      }
      if (segment.length == 1) {
        final point = segment.first;
        canvas.drawCircle(
          Offset(point.x / 100 * size.width, point.y / 32 * size.height),
          2,
          Paint()..color = color,
        );
      } else {
        canvas.drawPath(path, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) {
    return oldDelegate.segments != segments ||
        oldDelegate.color != color ||
        oldDelegate.baseline != baseline;
  }
}

class _FactRow extends StatelessWidget {
  const _FactRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}
