import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/polycheck_core.dart';
import '../../../../core/widgets/confirm_sign_out.dart';

/// Primary faculty destinations (RN `(faculty)/_layout.tsx` parity).
///
/// Sub-routes resolve to their parent tab via [facultyTabFor] so
/// `/faculty/subjects/:id`, `/faculty/sessions/create`, and friends keep the
/// correct highlight. More-sheet surfaces (schedule, attendance, reports,
/// excuses, at-risk) intentionally have no primary tab.
enum FacultyTab {
  dashboard(
    label: 'Dashboard',
    route: '/faculty/dashboard',
    icon: Icons.dashboard_outlined,
    activeIcon: Icons.dashboard,
  ),
  subjects(
    label: 'Subjects',
    route: '/faculty/subjects',
    icon: Icons.menu_book_outlined,
    activeIcon: Icons.menu_book,
  ),
  sessions(
    label: 'Sessions',
    route: '/faculty/sessions',
    icon: Icons.event_note_outlined,
    activeIcon: Icons.event_note,
  ),
  disputes(
    label: 'Disputes',
    route: '/faculty/disputes',
    icon: Icons.gavel,
    activeIcon: Icons.gavel,
  );

  const FacultyTab({
    required this.label,
    required this.route,
    required this.icon,
    required this.activeIcon,
  });

  final String label;
  final String route;
  final IconData icon;
  final IconData activeIcon;
}

String _facultyPath(String location) {
  final query = location.indexOf('?');
  final path = query < 0 ? location : location.substring(0, query);
  return path.length > 1 && path.endsWith('/')
      ? path.substring(0, path.length - 1)
      : path;
}

/// Active primary tab for a `/faculty/*` location (null for More surfaces).
///
/// Detail/create routes always highlight their owning tab:
/// `subjects/create`, `subjects/:id`, `subjects/:id/sessions`, `sections/*`,
/// and `students/*` are Subjects; `sessions/create` and `sessions/:id` are
/// Sessions.
FacultyTab? facultyTabFor(String location) {
  final path = _facultyPath(location);
  if (path == FacultyTab.dashboard.route) return FacultyTab.dashboard;
  if (path == FacultyTab.subjects.route ||
      path.startsWith('${FacultyTab.subjects.route}/') ||
      path.startsWith('/faculty/sections/') ||
      path.startsWith('/faculty/students/')) {
    return FacultyTab.subjects;
  }
  if (path == FacultyTab.sessions.route ||
      path.startsWith('${FacultyTab.sessions.route}/')) {
    return FacultyTab.sessions;
  }
  if (path == FacultyTab.disputes.route) return FacultyTab.disputes;
  return null;
}

/// [FacultyTab.index] of [facultyTabFor], or null for More surfaces.
int? facultyTabIndexFor(String location) => facultyTabFor(location)?.index;

/// Persistent faculty navigation for every `/faculty/*` surface.
///
/// Mirrors `StudentShell`: the page keeps its own `Scaffold`/`CampusHeader`
/// (so pushed screens retain the system back arrow and the cockpit keeps its
/// header actions) while this shell owns the detached bottom bar.
class FacultyShell extends ConsumerWidget {
  const FacultyShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((state) => state.user));
    if (user == null) {
      return const Scaffold(
        body: CampusLoading(label: 'Loading your account…'),
      );
    }
    if (user.role == UserRole.student) {
      return Scaffold(
        appBar: const CampusHeader(
          title: 'Faculty access only',
          automaticallyImplyLeading: false,
        ),
        body: const CampusEmptyState(
          icon: Icons.lock_outline,
          title: 'Faculty access only',
          message: 'This section is available to faculty accounts.',
        ),
      );
    }
    return Scaffold(
      backgroundColor: PupTheme.of(context).campus,
      body: child,
      bottomNavigationBar: CampusBottomNav(
        items: [
          for (final tab in FacultyTab.values)
            CampusBottomNavItem(
              id: tab.name,
              icon: tab.icon,
              activeIcon: tab.activeIcon,
              label: tab.label,
              selected: tab == facultyTabFor(location),
              onTap: () => context.go(tab.route),
            ),
        ],
      ),
    );
  }
}

/// Shared chrome and micro-widgets for the faculty suite.
class FacultyScaffold extends ConsumerWidget {
  const FacultyScaffold({
    super.key,
    required this.title,
    this.subtitle,
    required this.body,
    this.actions = const <Widget>[],
    this.showDefaultActions = true,
    this.floatingActionButton,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final Widget body;
  final List<Widget> actions;
  final bool showDefaultActions;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: PupTheme.of(context).campus,
      appBar: CampusHeader(
        title: title,
        subtitle: subtitle,
        bottom: bottom,
        actions: [
          ...actions,
          if (showDefaultActions) ...<Widget>[
            IconButton(
              tooltip: 'Notifications',
              icon: const Icon(Icons.notifications_none),
              onPressed: () => context.push('/notifications'),
            ),
            IconButton(
              tooltip: 'Assistant',
              icon: const Icon(Icons.auto_awesome_outlined),
              onPressed: () => context.push(AppRoutes.assistant),
            ),
            IconButton(
              tooltip: 'Profile',
              icon: const Icon(Icons.person_outline),
              onPressed: () => context.push(AppRoutes.profile),
            ),
            IconButton(
              key: const ValueKey<String>('faculty-more-button'),
              tooltip: 'More',
              icon: const Icon(Icons.more_vert),
              onPressed: () => showFacultyMoreSheet(context, ref),
            ),
          ],
        ],
      ),
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}

/// Scrollable page body with the standard padding.
class FacultyPageBody extends StatelessWidget {
  const FacultyPageBody({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.scroll = true,
    this.refresh,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool scroll;
  final Future<void> Function()? refresh;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);
    if (!scroll) return content;
    if (refresh == null) return SingleChildScrollView(child: content);
    return RefreshIndicator(
      onRefresh: refresh!,
      child: SingleChildScrollView(child: content),
    );
  }
}

class FacultyLoading extends StatelessWidget {
  const FacultyLoading({super.key, this.label = 'Loading.'});

  final String label;

  @override
  Widget build(BuildContext context) => CampusLoading(label: label);
}

class FacultyError extends StatelessWidget {
  const FacultyError({
    super.key,
    required this.message,
    this.onRetry,
    this.title = 'Unable to load this page',
  });

  final String message;
  final VoidCallback? onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    return CampusEmptyState(
      icon: Icons.cloud_off_outlined,
      title: title,
      message: message.isEmpty ? null : message,
      actionLabel: onRetry == null ? null : 'Try again',
      onAction: onRetry,
    );
  }
}

/// Square stat tile used on the dashboard and reports.
class FacultyStatCard extends StatelessWidget {
  const FacultyStatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
              const SizedBox(width: 6),
            ],
            Expanded(
              child: Text(
                label.toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: content,
    );
  }
}

/// Responsive stat grid: 2 columns on phones, 3+ on wider screens.
class FacultyStatGrid extends StatelessWidget {
  const FacultyStatGrid({
    super.key,
    required this.children,
    this.wideColumns = 3,
  });

  final List<Widget> children;
  final int wideColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 700
            ? wideColumns
            : (constraints.maxWidth >= 420 ? 2 : 1);
        const spacing = 8.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}

class FacultySectionTitle extends StatelessWidget {
  const FacultySectionTitle({super.key, required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class FacultyRateBar extends StatelessWidget {
  const FacultyRateBar({
    super.key,
    required this.value,
    this.height = 6,
    this.color,
  });

  /// 0..100 (nullable = no data).
  final double? value;
  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final ratio = ((value ?? 0) / 100).clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.zero,
      child: Container(
        height: height,
        color: tokens.borderSubtle,
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: ratio,
          child: ColoredBox(
            color: color ?? (tokens.isDark ? tokens.gold : tokens.maroon),
            child: SizedBox(height: height),
          ),
        ),
      ),
    );
  }
}

/// Simple status pill that is not attendance-specific.
class FacultyPill extends StatelessWidget {
  const FacultyPill({
    super.key,
    required this.label,
    this.background,
    this.foreground,
    this.border,
    this.icon,
  });

  final String label;
  final Color? background;
  final Color? foreground;
  final Color? border;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusBadge(
      label: label,
      background: background ?? tokens.campus,
      foreground: foreground ?? tokens.onSurface,
      border: border ?? tokens.borderSubtle,
      icon: icon,
    );
  }
}

class FacultyEmptyState extends StatelessWidget {
  const FacultyEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return CampusEmptyState(
      title: title,
      message: message,
      icon: icon,
      actionLabel: actionLabel,
      onAction: onAction,
    );
  }
}

/// Reusable square segmented tabs.
class FacultyTabs extends StatelessWidget {
  const FacultyTabs({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var index = 0; index < labels.length; index += 1)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: InkWell(
                onTap: () => onSelected(index),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: index == selectedIndex
                        ? tokens.maroon
                        : tokens.surface,
                    border: Border.all(
                      color: index == selectedIndex
                          ? tokens.maroon
                          : tokens.borderSubtle,
                    ),
                  ),
                  child: Text(
                    labels[index],
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: index == selectedIndex
                          ? Colors.white
                          : tokens.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Simple labelled dropdown.
class FacultyDropdown<T> extends StatelessWidget {
  const FacultyDropdown({
    super.key,
    required this.label,
    required this.items,
    required this.value,
    required this.onChanged,
    this.hint = 'All',
    this.enabled = true,
  });

  final String label;
  final List<DropdownMenuItem<T>> items;
  final T? value;
  final ValueChanged<T?>? onChanged;
  final String hint;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: tokens.muted,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        DropdownButtonFormField<T>(
          initialValue: value,
          isExpanded: true,
          hint: Text(hint),
          decoration: const InputDecoration(
            contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            isDense: true,
          ),
          items: items,
          onChanged: enabled ? onChanged : null,
        ),
      ],
    );
  }
}

Future<bool> showFacultyConfirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool destructive = false,
}) async {
  final result = await showCampusDialog<bool>(
    context,
    title: title,
    description: message,
    actionBuilders: [
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(false),
        child: Text(cancelLabel),
      ),
      (dialogContext) => TextButton(
        onPressed: () => Navigator.of(dialogContext).pop(true),
        style: destructive
            ? TextButton.styleFrom(
                foregroundColor: Theme.of(dialogContext).colorScheme.error,
              )
            : null,
        child: Text(confirmLabel),
      ),
    ],
  );
  return result ?? false;
}

/// Sentinel sheet value for the destructive sign-out row.
const String facultyMoreSignOut = '__sign_out__';

/// AppBar "More" sheet: secondary classroom surfaces + designation suites.
///
/// Mirrors `android/lib/more-items.ts`: schedule/attendance/excuses/reports/
/// at-risk are always present; IT Operations and Registrar items appear only
/// for teachers holding the matching designation (super admins reach those
/// suites through the administrator console instead).
Future<void> showFacultyMoreSheet(BuildContext context, WidgetRef ref) async {
  final user = ref.read(sessionProvider).user;
  final selection = await showCampusBottomSheet<String>(
    context,
    title: 'More',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-schedule'),
          icon: Icons.calendar_month_outlined,
          label: 'Schedule',
          value: '/faculty/schedule',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-attendance'),
          icon: Icons.fact_check_outlined,
          label: 'Attendance',
          value: '/faculty/attendance',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-excuses'),
          icon: Icons.healing_outlined,
          label: 'Excuses',
          value: '/faculty/excuses',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-reports'),
          icon: Icons.insights_outlined,
          label: 'Reports',
          value: '/faculty/reports',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-at-risk'),
          icon: Icons.warning_amber_outlined,
          label: 'At-Risk',
          value: '/faculty/at-risk',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-report-issue'),
          icon: Icons.report_problem_outlined,
          label: 'Report an issue',
          value: '/profile?tab=reports',
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-profile'),
          icon: Icons.person_outline,
          label: 'Profile & security',
          value: AppRoutes.profile,
        ),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-assistant'),
          icon: Icons.auto_awesome_outlined,
          label: 'Assistant',
          value: AppRoutes.assistant,
        ),
        if (canAccessItOperations(user)) ...const <Widget>[
          _FacultyMoreItem(
            key: ValueKey<String>('faculty-more-server-status'),
            icon: Icons.monitor_heart_outlined,
            label: 'Server status',
            value: '/admin/server-status',
          ),
          _FacultyMoreItem(
            key: ValueKey<String>('faculty-more-system-reports'),
            icon: Icons.support_agent_outlined,
            label: 'System reports',
            value: '/admin/system-reports',
          ),
          _FacultyMoreItem(
            key: ValueKey<String>('faculty-more-settings'),
            icon: Icons.settings_outlined,
            label: 'Institution settings',
            value: '/admin/settings',
          ),
        ],
        if (canAccessUserAdmin(user))
          const _FacultyMoreItem(
            key: ValueKey<String>('faculty-more-users'),
            icon: Icons.manage_accounts_outlined,
            label: 'User management',
            value: '/admin/users',
          ),
        Divider(height: 18, color: PupTheme.of(context).borderSubtle),
        const _FacultyMoreItem(
          key: ValueKey<String>('faculty-more-sign-out'),
          icon: Icons.logout,
          label: 'Sign out',
          value: facultyMoreSignOut,
          destructive: true,
        ),
      ],
    ),
  );
  if (selection == null || !context.mounted) return;
  if (selection == facultyMoreSignOut) {
    // Shared confirmed sign-out (dialog actually resolves after FX1 fix).
    await confirmSignOut(context, ref);
    return;
  }
  if (selection.startsWith(AppRoutes.facultyPrefix)) {
    // Classroom destinations are tab-style: replace the shell child so the
    // bottom bar highlight follows the new route.
    context.go(selection);
    return;
  }
  // Shared surfaces and console suites stack on top so the header back arrow
  // returns to the classroom page.
  context.push(selection);
}

class _FacultyMoreItem extends StatelessWidget {
  const _FacultyMoreItem({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final accent = destructive
        ? Theme.of(context).colorScheme.error
        : (tokens.isDark ? tokens.gold : tokens.maroon);
    return InkWell(
      onTap: () => Navigator.of(context).pop(value),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 18, color: accent),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: destructive ? accent : tokens.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(Icons.chevron_right, size: 16, color: tokens.muted),
          ],
        ),
      ),
    );
  }
}

Future<void> copyToClipboard(
  BuildContext context,
  String value, {
  String? label,
}) async {
  await Clipboard.setData(ClipboardData(text: value));
  if (!context.mounted) return;
  CampusToast.showIn(
    context,
    label ?? 'Copied to clipboard.',
    tone: CampusToastTone.success,
  );
}

Future<void> sharePlainText(
  BuildContext context,
  String text, {
  String? subject,
}) async {
  try {
    await SharePlus.instance.share(ShareParams(text: text, subject: subject));
  } catch (_) {
    if (context.mounted) {
      await copyToClipboard(
        context,
        text,
        label: 'Share unavailable — copied instead.',
      );
    }
  }
}

/// Writes [download] bytes to a temp file and opens the platform share sheet
/// with the server-provided filename and content type.
Future<void> shareDownload(
  BuildContext context,
  DocumentDownload download,
) async {
  final safeName = download.filename.trim().isEmpty
      ? 'polycheck-document'
      : download.filename.trim();
  try {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}${Platform.pathSeparator}$safeName');
    await file.writeAsBytes(download.bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [
          XFile(file.path, mimeType: download.contentType, name: safeName),
        ],
        subject: safeName,
      ),
    );
  } catch (error) {
    if (context.mounted) {
      CampusToast.showIn(
        context,
        'Unable to share $safeName: $error',
        tone: CampusToastTone.error,
      );
    }
  }
}

Future<void> shareCsvText(
  BuildContext context,
  String csv,
  String filename, {
  String? subject,
}) async {
  try {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}${Platform.pathSeparator}$filename');
    await file.writeAsString(csv, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'text/csv', name: filename)],
        subject: subject ?? filename,
      ),
    );
  } catch (_) {
    if (context.mounted) {
      await copyToClipboard(
        context,
        csv,
        label: 'Share unavailable — CSV copied instead.',
      );
    }
  }
}

Future<void> shareBytes(
  BuildContext context,
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  await shareDownload(
    context,
    DocumentDownload(bytes: bytes, filename: filename, contentType: mimeType),
  );
}
