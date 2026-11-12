import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/ai.dart';
import '../../../core/models/user.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/router/routes/app_routes.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/designations.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_header.dart';
import '../../../core/widgets/campus_loading.dart';
import '../data/assistant_copy.dart';
import '../data/outage_demo.dart';
import '../data/surface_navigation.dart';
import '../data/surface_paths.dart';
import 'notifications_panel.dart';
import 'privacy_panel.dart';
import 'widgets/outage_widgets.dart';
import 'widgets/profile_security_panels.dart';
import 'widgets/report_widgets.dart';
import 'widgets/sign_out_tile.dart';

/// Universal profile surface for every role.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, required this.tab});

  final ProfileTab tab;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late User? _user;
  late ProfileTab _tab;
  bool _assistantVisible = false;
  bool _notificationsRedirectScheduled = false;
  int _reportsReloadToken = 0;

  @override
  void initState() {
    super.initState();
    _user = ref.read(sessionProvider).user;
    _tab = _normalizeTab(widget.tab);
    unawaited(_loadAssistantCapability());
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tab != widget.tab) {
      setState(() => _tab = _normalizeTab(widget.tab));
    }
  }

  List<ProfileTab> _tabsFor(User user) {
    final tabs = <ProfileTab>[ProfileTab.security, ProfileTab.contacts];
    if (user.role == UserRole.student) tabs.add(ProfileTab.device);
    if (user.role == UserRole.student || user.role == UserRole.teacher) {
      tabs.add(ProfileTab.reports);
    }
    tabs.add(ProfileTab.privacy);
    if (OutageDemo.enabled) tabs.add(ProfileTab.dev);
    return tabs;
  }

  /// Resolves the requested tab against the role's chip set.
  ///
  /// `ProfileTab.notifications` is legacy wire compatibility only: the chip
  /// duplicated the header bell, so old `?tab=notifications` deep links now
  /// land on the standalone notification center (pushed, so it keeps a back
  /// arrow) and the profile itself opens on security.
  ProfileTab _normalizeTab(ProfileTab requested) {
    final user = _user;
    if (user == null) return ProfileTab.security;
    if (requested == ProfileTab.notifications) {
      _scheduleNotificationsRedirect();
      return ProfileTab.security;
    }
    final tabs = _tabsFor(user);
    return tabs.contains(requested) ? requested : ProfileTab.security;
  }

  void _scheduleNotificationsRedirect() {
    if (_notificationsRedirectScheduled) return;
    _notificationsRedirectScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _notificationsRedirectScheduled = false;
      if (!mounted) return;
      final router = GoRouter.maybeOf(context);
      if (router == null) return;
      if (router.state.uri.path == SurfacePaths.notificationsPage) return;
      router.push(SurfacePaths.notificationsPage);
    });
  }

  bool get _isFullWidthTab => _tab == ProfileTab.privacy;

  Future<void> _loadAssistantCapability() async {
    final user = _user;
    if (user == null) return;
    try {
      final AiCapabilities capabilities = await ref
          .read(aiApiProvider)
          .getCapabilities();
      if (!mounted) return;
      setState(
        () => _assistantVisible = shouldShowAssistantEntry(
          user.role,
          capabilities,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _assistantVisible = false);
    }
  }

  void _selectTab(ProfileTab tab) {
    if (tab == _tab) return;
    // Pure local state: switching tabs inside `/profile` must never run a
    // router `go` (that replaced the pushed profile match, dropped stack
    // depth to one, and removed the header back arrow - gap report B-5/FIX3).
    // `?tab=` still decides the *landing* tab for deep links on mount and
    // didUpdateWidget syncs an explicit new route config.
    setState(() => _tab = tab);
  }

  /// Role landing for the stackless (deep-linked) back affordance.
  String _homeFor(User user) {
    if (user.role == UserRole.superAdmin) return AppRoutes.adminHome;
    return roleHome(
      resolveAppRole(user, officerPresident: false, officerQac: false),
    );
  }

  void _updateUser(User user) {
    if (!mounted) return;
    setState(() => _user = user);
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (user == null) {
      return const Scaffold(body: CampusLoading(label: 'Loading profile.'));
    }
    final compactHeader = _isFullWidthTab;
    // Deep links/notifications can land on `/profile` without a pushed
    // parent (go_router `go` has stack depth 1) - keep an explicit exit.
    final canPop = Navigator.maybeOf(context)?.canPop() ?? false;

    final header = _ProfileHeader(
      user: user,
      tabs: _tabsFor(user),
      activeTab: _tab,
      compact: compactHeader,
      onSelectTab: _selectTab,
    );

    return Scaffold(
      appBar: CampusHeader(
        title: 'My Profile',
        subtitle: 'Identity, security, and device status.',
        automaticallyImplyLeading: canPop,
        leading: canPop
            ? null
            : BackButton(
                key: const ValueKey<String>('profile-back-fallback'),
                onPressed: () => context.go(_homeFor(user)),
              ),
        actions: <Widget>[
          if (_assistantVisible)
            IconButton(
              key: const ValueKey<String>('profile-assistant-action'),
              tooltip: 'Assistant',
              icon: const Icon(Icons.auto_awesome_outlined),
              onPressed: () => SurfaceNavigation.open(
                context,
                SurfacePaths.assistant,
                unavailableMessage:
                    'The assistant is not available in this build.',
              ),
            ),
          const NotificationBellAction(),
        ],
      ),
      body: Stack(
        children: [
          SafeArea(
            top: false,
            child: _isFullWidthTab
                ? Column(
                    children: [
                      header,
                      const Expanded(child: PrivacyPanel()),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
                    children: [header, _panelFor(user)],
                  ),
          ),
          if (OutageDemo.enabled)
            const Positioned(
              top: 8,
              left: 12,
              right: 12,
              child: Align(alignment: Alignment.topLeft, child: OutagePill()),
            ),
        ],
      ),
    );
  }

  Widget _panelFor(User user) {
    switch (_tab) {
      case ProfileTab.security:
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PasswordSecurityPanel(user: user, onUpdated: _updateUser),
              const SizedBox(height: 12),
              const ProfileSignOutTile(),
            ],
          ),
        );
      case ProfileTab.contacts:
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: ContactsPanel(user: user, onUpdated: _updateUser),
        );
      case ProfileTab.device:
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: DeviceBindingPanel(user: user, onUpdated: _updateUser),
        );
      case ProfileTab.reports:
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ReportIssueButton(
                label: 'Report an issue',
                variant: CampusButtonVariant.gold,
                expand: true,
                onSubmitted: () => setState(() => _reportsReloadToken += 1),
              ),
              const SizedBox(height: 12),
              MyReportsPanel(reloadToken: _reportsReloadToken),
            ],
          ),
        );
      case ProfileTab.dev:
        return const Padding(
          padding: EdgeInsets.only(top: 4),
          child: OutageDevSection(),
        );
      case ProfileTab.privacy:
        return const SizedBox.shrink();
      default:
        // `ProfileTab.notifications` remains for wire compatibility but is
        // never rendered here: `_normalizeTab` redirects it to the standalone
        // notification center, which owns that surface now.
        return const SizedBox.shrink();
    }
  }
}

class _ProfileHeader extends ConsumerWidget {
  const _ProfileHeader({
    required this.user,
    required this.tabs,
    required this.activeTab,
    required this.compact,
    required this.onSelectTab,
  });

  final User user;
  final List<ProfileTab> tabs;
  final ProfileTab activeTab;
  final bool compact;
  final ValueChanged<ProfileTab> onSelectTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = PupTheme.of(context);
    final designations = user.role == UserRole.superAdmin
        ? const <FacultyDesignation>[]
        : activeDesignations(user);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: tokens.surface,
            border: Border.all(color: tokens.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(height: 3, color: tokens.gold),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          color: tokens.maroon,
                          alignment: Alignment.center,
                          child: Text(
                            _initials(user.fullName),
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: tokens.gold,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.fullName,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      color: tokens.onSurface,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${_roleLabel(user.role)}'
                                '${user.department == null ? '' : ' \u00b7 ${user.department}'}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (user.role == UserRole.superAdmin ||
                        designations.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 5,
                        runSpacing: 5,
                        children: [
                          if (user.role == UserRole.superAdmin)
                            _DesignationChip(label: 'SUPER ADMIN')
                          else
                            for (final designation in designations)
                              _DesignationChip(
                                label: designation.label.toUpperCase(),
                              ),
                        ],
                      ),
                    ],
                    if (!compact) ...[
                      const SizedBox(height: 12),
                      Divider(color: tokens.borderSubtle, height: 1),
                      const SizedBox(height: 10),
                      _identityRow(
                        context,
                        'PUP ID / STUDENT NUMBER',
                        user.studentId ?? '\u2014',
                      ),
                      _identityRow(
                        context,
                        'PUP EMAIL',
                        user.email ?? '\u2014',
                      ),
                      _identityRow(
                        context,
                        'DEPARTMENT',
                        user.department ?? '\u2014',
                      ),
                      if (user.role == UserRole.student) ...[
                        _identityRow(
                          context,
                          'PROGRAM',
                          user.program ?? '\u2014',
                        ),
                        _identityRow(
                          context,
                          'YEAR LEVEL',
                          user.yearLevel?.toString() ?? '\u2014',
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        'Institutional identity fields are read-only. Contact '
                        'the registrar or an administrator to correct them.',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tokens.muted,
                          height: 1.35,
                        ),
                      ),
                      if (user.role == UserRole.teacher) ...[
                        const SizedBox(height: 10),
                        _DelegatedPermissions(user: user),
                      ],
                      if (user.role == UserRole.superAdmin) ...[
                        const SizedBox(height: 10),
                        _AdminScopeSummary(user: user),
                      ],
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: tabs.length,
            separatorBuilder: (_, _) => const SizedBox(width: 6),
            itemBuilder: (context, index) {
              final tab = tabs[index];
              final active = tab == activeTab;
              return InkWell(
                onTap: () => onSelectTab(tab),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? tokens.maroon : tokens.surface,
                    border: Border.all(
                      color: active ? tokens.maroon : tokens.borderSubtle,
                    ),
                  ),
                  child: Text(
                    tab.label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: active ? Colors.white : tokens.muted,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _identityRow(BuildContext context, String label, String value) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w700,
                fontSize: 9,
                letterSpacing: 0.7,
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final letters = <String>[
      for (final part in parts)
        if (part.isNotEmpty) part.substring(0, 1).toUpperCase(),
    ];
    return letters.take(2).join();
  }
}

class _DesignationChip extends StatelessWidget {
  const _DesignationChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tokens.isDark
            ? tokens.gold.withValues(alpha: 0.14)
            : tokens.gold.withValues(alpha: 0.28),
        border: Border.all(color: tokens.gold),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: tokens.isDark ? tokens.gold : tokens.deepMaroon,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _AdminScopeSummary extends StatelessWidget {
  const _AdminScopeSummary({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: tokens.campus,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ADMINISTRATIVE SCOPE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              fontSize: 9,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${user.scope == null || user.scope!.isEmpty ? 'Institution' : user.scope} '
            'oversight, account administration, audit, reports, and '
            'institution settings. Classroom data stays read-only and is '
            'reachable only through explicit lookup.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.onSurface,
              fontSize: 10,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _DelegatedPermissions extends StatelessWidget {
  const _DelegatedPermissions({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final permissions = user.delegatedPermissions;
    final reset =
        permissions?.canResetStudentPasswords ??
        (user.canResetStudentPasswords ?? false);
    final release =
        permissions?.canEmergencyUnbindDevices ??
        (user.canEmergencyUnbindDevices ?? false);

    return Container(
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: tokens.campus,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DELEGATED TEACHER PERMISSIONS',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              fontSize: 9,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 5),
          _permissionRow(context, 'Reset student passwords', reset),
          _permissionRow(context, 'Emergency device release', release),
        ],
      ),
    );
  }

  Widget _permissionRow(BuildContext context, String label, bool allowed) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(
            allowed ? Icons.check_circle_outline : Icons.remove_circle_outline,
            size: 13,
            color: allowed
                ? (tokens.isDark
                      ? const Color(0xFF86EFAC)
                      : const Color(0xFF15803D))
                : tokens.muted,
          ),
          const SizedBox(width: 5),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.onSurface,
                fontSize: 10,
              ),
            ),
          ),
          Text(
            allowed ? 'ALLOWED' : 'OFF',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

String _roleLabel(UserRole role) {
  return switch (role) {
    UserRole.superAdmin => 'Super Admin',
    UserRole.teacher => 'Teacher',
    UserRole.student => 'Student',
  };
}
