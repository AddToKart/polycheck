import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/dashboard.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../domain/admin_access.dart';
import '../domain/server_metrics.dart';
import 'widgets/admin_common.dart';

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  ConsumerState<AdminDashboardScreen> createState() =>
      _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends ConsumerState<AdminDashboardScreen> {
  AdminOverview? _overview;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final overview = await ref.read(dashboardApiProvider).getAdminOverview();
      if (!mounted) return;
      setState(() {
        _overview = overview;
        _loading = false;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = '$error';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).user;
    final access = adminAccessFor(user);

    return AdminScaffold(
      title: 'Administrator console',
      subtitle: 'Institution-wide oversight and governance',
      section: AdminSection.dashboard,
      actions: <Widget>[
        IconButton(
          tooltip: 'Refresh overview',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: _loading
          ? const AdminLoading(label: 'Loading institution overview…')
          : _error != null
          ? AdminErrorState(message: _error!, onRetry: _load)
          : RefreshIndicator(
              color: PupTheme.of(context).maroon,
              onRefresh: _load,
              child: _DashboardBody(overview: _overview, access: access),
            ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.overview, required this.access});

  final AdminOverview? overview;
  final AdminAccess access;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final data = overview;
    if (data == null) {
      return const CampusEmptyState(
        icon: Icons.dashboard_outlined,
        title: 'No overview available',
        message: 'Pull down to retry.',
      );
    }
    final counts = data.counts;
    final health = data.health;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        CampusCard(
          color: tokens.maroon,
          borderColor: tokens.maroon,
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'POLYCHECK GOVERNANCE',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.mutedOnMaroon,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                data.scope == AdminScopeKind.department
                    ? 'Department scope'
                    : 'Institution scope',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                data.scope == AdminScopeKind.department
                    ? 'Counts are limited to ${data.department ?? 'your department'}.'
                    : 'Live counts across every department and account.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.mutedOnMaroon,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const AdminSectionLabel('Accounts and activity'),
        const SizedBox(height: 8),
        AdminStatGrid(
          children: <Widget>[
            AdminStatTile(
              label: 'Active faculty',
              value: '${counts.activeFaculty}',
              caption: '${counts.disabledFaculty} disabled',
              icon: Icons.school_outlined,
            ),
            AdminStatTile(
              label: 'Active students',
              value: '${counts.activeStudents}',
              caption: '${counts.disabledStudents} disabled',
              icon: Icons.groups_outlined,
            ),
            AdminStatTile(
              label: 'Live sessions',
              value: '${counts.activeSessions}',
              caption: 'Currently active',
              icon: Icons.play_circle_outline,
            ),
            AdminStatTile(
              label: 'Pending disputes',
              value: '${counts.pendingDisputes}',
              caption: 'Waiting for review',
              icon: Icons.gavel_outlined,
            ),
          ],
        ),
        const SizedBox(height: 18),
        const AdminSectionLabel('Infrastructure health'),
        const SizedBox(height: 8),
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(
                    health.status == AdminOverviewHealthStatus.ok
                        ? Icons.check_circle_outline
                        : Icons.error_outline,
                    color: health.status == AdminOverviewHealthStatus.ok
                        ? tokens.maroon
                        : tokens.deepMaroon,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      health.status == AdminOverviewHealthStatus.ok
                          ? 'All core services responding'
                          : 'A core service is unavailable',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  AdminStatusChip(label: 'Database', active: health.database),
                  AdminStatusChip(label: 'Redis', active: health.redis),
                  AdminStatusChip(
                    label: 'API',
                    active: health.status == AdminOverviewHealthStatus.ok,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'Snapshot ${formatDateTimeLabel(health.timestamp)}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
              if (access.canOpen(AdminSection.serverStatus)) ...<Widget>[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.go(AdminSection.serverStatus.route),
                  icon: const Icon(Icons.monitor_heart_outlined, size: 18),
                  label: const Text('Open live server status'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        const AdminSectionLabel('Consoles'),
        const SizedBox(height: 8),
        _ConsoleGrid(access: access),
        const SizedBox(height: 18),
        const AdminSectionLabel('Recent audit activity'),
        const SizedBox(height: 8),
        if (data.recentActivity.isEmpty)
          const CampusEmptyState(
            icon: Icons.history,
            title: 'No audited changes yet',
            message: 'Administrative actions will appear here.',
          )
        else
          ...data.recentActivity
              .take(8)
              .map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: CampusCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Icon(
                          entry.outcome.name == 'failed'
                              ? Icons.error_outline
                              : Icons.check_circle_outline,
                          size: 18,
                          color: entry.outcome.name == 'failed'
                              ? tokens.maroon
                              : tokens.muted,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                entry.actorName.isEmpty
                                    ? 'Unknown account'
                                    : entry.actorName,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                entry.action,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: tokens.maroon,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              Text(
                                '${entry.entityType}'
                                '${entry.entityId == null ? '' : ' · ${entry.entityId}'}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                              Text(
                                formatDateTimeLabel(entry.createdAt),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ],
    );
  }
}

class _ConsoleGrid extends StatelessWidget {
  const _ConsoleGrid({required this.access});

  final AdminAccess access;

  @override
  Widget build(BuildContext context) {
    final sections = <AdminSection>[
      AdminSection.users,
      AdminSection.settings,
      AdminSection.auditLogs,
      AdminSection.serverStatus,
      AdminSection.systemReports,
      AdminSection.search,
    ].where(access.canOpen).toList(growable: false);

    if (sections.isEmpty) {
      return const CampusEmptyState(
        icon: Icons.lock_outline,
        title: 'No additional consoles',
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth < 420 ? 1 : 2;
        final spacing = 10.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: <Widget>[
            for (final section in sections)
              SizedBox(
                width: width,
                child: CampusCard(
                  onTap: () => context.go(section.route),
                  child: Row(
                    children: <Widget>[
                      Icon(
                        adminSectionIcon(section),
                        color: PupTheme.of(context).maroon,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          section.label,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 18),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
