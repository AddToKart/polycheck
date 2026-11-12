import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/notification.dart';
import '../../../core/models/user.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../../../core/widgets/campus_loading.dart';
import '../../../core/widgets/campus_toast.dart';
import '../data/notification_inbox_controller.dart';
import '../data/notification_links.dart';
import '../data/surface_navigation.dart';
import '../data/surface_paths.dart';
import 'widgets/assistant_widgets.dart';

/// Notification inbox list (shared by `/profile?tab=notifications` and any
/// host that embeds it).
class NotificationsPanel extends ConsumerStatefulWidget {
  const NotificationsPanel({super.key, this.embedded = true});

  final bool embedded;

  @override
  ConsumerState<NotificationsPanel> createState() => _NotificationsPanelState();
}

class _NotificationsPanelState extends ConsumerState<NotificationsPanel> {
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(
      const Duration(seconds: 30),
      (_) => mounted ? setState(() {}) : null,
    );
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationInboxProvider);
    final tokens = PupTheme.of(context);
    final now = DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: tokens.campus,
            border: Border(bottom: BorderSide(color: tokens.borderSubtle)),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: state.connected
                      ? (tokens.isDark ? tokens.gold : const Color(0xFF15803D))
                      : tokens.muted,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  state.unreadCount > 0
                      ? '${state.unreadCount} unread \u00b7 '
                            '${state.items.length} total'
                      : 'You are all caught up.',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: state.unreadCount == 0
                    ? null
                    : () => unawaited(
                        ref
                            .read(notificationInboxProvider.notifier)
                            .markAllRead(),
                      ),
                style: TextButton.styleFrom(
                  minimumSize: const Size(48, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: const Text('Mark all read'),
              ),
            ],
          ),
        ),
        if (state.error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: AssistantErrorBanner(
              message: state.error!,
              onRetry: () => unawaited(
                ref.read(notificationInboxProvider.notifier).refresh(),
              ),
            ),
          ),
        Expanded(
          child: state.loading && state.items.isEmpty
              ? const CampusLoading(label: 'Loading notifications.')
              : RefreshIndicator(
                  color: tokens.maroon,
                  backgroundColor: tokens.surface,
                  onRefresh: () =>
                      ref.read(notificationInboxProvider.notifier).refresh(),
                  child: state.items.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 80),
                            CampusEmptyState(
                              icon: Icons.notifications_none,
                              title: 'No notifications yet',
                              message:
                                  'Class updates, disputes, excuses, and '
                                  'account activity appear here.',
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                          itemCount: state.items.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final notification = state.items[index];
                            return _NotificationTile(
                              notification: notification,
                              now: now,
                              onTap: () => _open(notification),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Future<void> _open(AppNotification notification) async {
    final user = ref.read(sessionProvider).user;
    final role = user?.role ?? UserRole.student;
    unawaited(
      ref.read(notificationInboxProvider.notifier).markRead(notification),
    );
    final destination = notificationDestination(notification, role);
    if (destination == null) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'This notification is informational - no related screen is '
        'available for your role.',
        tone: CampusToastTone.info,
      );
      return;
    }
    if (!mounted) return;
    SurfaceNavigation.open(
      context,
      destination,
      unavailableMessage:
          'That related screen is not available in this build yet.',
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.now,
    required this.onTap,
  });

  final AppNotification notification;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final unread = notification.readAt == null;
    final icon = notificationTypeIcon(notification.type);
    final label = notificationTypeLabel(notification.type);

    return Semantics(
      button: true,
      label:
          '${unread ? 'Unread. ' : ''}${notification.title}. '
          '${notification.body}',
      child: Material(
        color: tokens.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
          side: BorderSide(
            color: unread
                ? (tokens.isDark ? tokens.gold : tokens.gold)
                : tokens.borderSubtle,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: unread
                        ? (tokens.isDark
                              ? tokens.gold.withValues(alpha: 0.18)
                              : tokens.gold.withValues(alpha: 0.3))
                        : tokens.campus,
                    border: Border.all(color: tokens.borderSubtle),
                    borderRadius: BorderRadius.zero,
                  ),
                  child: Icon(
                    icon,
                    size: 19,
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (unread) ...[
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: tokens.isDark
                                    ? tokens.gold
                                    : tokens.maroon,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                          ],
                          Expanded(
                            child: Text(
                              notification.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    color: tokens.onSurface,
                                    fontWeight: unread
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                  ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            label.toUpperCase(),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: tokens.muted,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                  fontSize: 9,
                                ),
                          ),
                        ],
                      ),
                      if (notification.body.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          notification.body,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: tokens.muted, height: 1.35),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        '${formatNotificationRelativeTime(notification.createdAt, now: now)}'
                        ' \u00b7 '
                        '${formatNotificationAbsoluteTime(notification.createdAt)}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tokens.muted,
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, size: 18, color: tokens.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bell + unread badge that student/faculty/admin shells may adopt.
class NotificationBellAction extends ConsumerWidget {
  const NotificationBellAction({super.key, this.color});

  final Color? color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(
      notificationInboxProvider.select((state) => state.unreadCount),
    );
    final tokens = PupTheme.of(context);
    final foreground = color ?? IconTheme.of(context).color ?? tokens.onMaroon;
    return IconButton(
      tooltip: unread > 0 ? 'Notifications ($unread unread)' : 'Notifications',
      onPressed: () {
        final router = GoRouter.maybeOf(context);
        if (router == null) return;
        // Push the standalone center so the bell always yields a back arrow;
        // the profile keeps no notifications chip anymore (SW-2).
        router.push(SurfacePaths.notificationsPage);
      },
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(Icons.notifications_none, color: foreground),
          if (unread > 0)
            Positioned(
              top: -5,
              right: -7,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: tokens.gold,
                  border: Border.all(color: tokens.deepMaroon),
                  borderRadius: BorderRadius.zero,
                ),
                constraints: const BoxConstraints(minWidth: 15),
                child: Text(
                  unread > 99 ? '99+' : '$unread',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: tokens.deepMaroon,
                    height: 1.2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
